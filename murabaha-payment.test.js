process.env.SAP_ACCOUNTING_COMPANY_CODE = 'NHB1';
process.env.SAP_ACCOUNTING_DOCUMENT_TYPE = 'SA';
process.env.SAP_ACCOUNTING_DEBIT_ACCOUNT = 'TEST-DEBIT';
process.env.SAP_ACCOUNTING_CREDIT_ACCOUNT = 'TEST-CREDIT';
process.env.SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE = 'RFBU';
process.env.SAP_ACCOUNTING_CREATED_BY_USER = 'NHBCAP01';
process.env.SAP_ACCOUNTING_REVERSAL_REASON = '01';

const cds = require('@sap/cds');
const assert = require('node:assert/strict');

// cds.test starts a separate CAP server with an in-memory development database.
const { data } = cds.test('serve', 'all', '--in-memory');
const INSTALLMENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-000000000002';
const getService = () => {
  const service = cds.services.NHBCAP01Service;
  assert.ok(service, `NHBCAP01Service unavailable; started services: ${Object.keys(cds.services).join(', ')}`);
  return service;
};

beforeEach(data.reset);

const installment = () => {
  const service = getService();
  return service.run(
    cds.ql.SELECT.one.from(service.entities.MurabahaInstallment).where({ ID: INSTALLMENT_ID })
  );
};

const paymentsWithReference = externalPaymentId => {
  const service = getService();
  return service.run(
    cds.ql.SELECT.from(service.entities.MurabahaPayment).where({ externalPaymentId })
  );
};

const postPayment = (externalPaymentId, amount, installmentId = INSTALLMENT_ID) => getService().send({
  event: 'postPayment',
  entity: 'MurabahaInstallment',
  params: [{ ID: installmentId }],
  data: {
    externalPaymentId,
    paymentDate: '2026-09-21',
    amount,
    currency: 'USD'
  }
});

const paymentById = paymentId => {
  const service = getService();
  return service.run(
    cds.ql.SELECT.one.from(service.entities.MurabahaPayment).where({ ID: paymentId })
  );
};

const reversalsWithReference = externalReversalId => {
  const service = getService();
  return service.run(
    cds.ql.SELECT.from(service.entities.MurabahaPaymentReversal).where({ externalReversalId })
  );
};

const reversePayment = (paymentId, externalReversalId) => getService().send({
  event: 'reverseMurabahaPayment',
  data: {
    paymentId,
    externalReversalId,
    reversalDate: '2026-09-21',
    reason: 'Synthetic test correction'
  }
});

test('posts a valid partial payment and updates the installment', async () => {
  const reference = 'TEST-AUTO-VALID-001';
  const before = await installment();
  assert.equal(Number(before.paidAmount), 0);

  const posted = await postPayment(reference, 1000);
  const after = await installment();
  const payments = await paymentsWithReference(reference);

  assert.equal(posted.externalPaymentId, reference);
  assert.equal(posted.status, 'POSTED');
  assert.equal(Number(after.paidAmount), 1000);
  assert.equal(after.status, 'PARTIALLY_PAID');
  assert.equal(payments.length, 1);
});

test('rejects a duplicate external payment ID without changing the balance', async () => {
  const reference = 'TEST-AUTO-DUPLICATE-001';
  await postPayment(reference, 1000);

  await assert.rejects(
    () => postPayment(reference, 200),
    /external payment ID already exists/i
  );

  const after = await installment();
  assert.equal(Number(after.paidAmount), 1000);
  assert.equal((await paymentsWithReference(reference)).length, 1);
});

test('rejects an overpayment without creating a payment', async () => {
  const reference = 'TEST-AUTO-OVERPAY-001';

  await assert.rejects(
    () => postPayment(reference, 11501),
    /exceeds the outstanding installment balance/i
  );

  const after = await installment();
  assert.equal(Number(after.paidAmount), 0);
  assert.equal(after.status, 'PENDING');
  assert.equal((await paymentsWithReference(reference)).length, 0);
});

test('marks an installment paid when the full balance is received', async () => {
  const reference = 'TEST-AUTO-FULL-001';
  const posted = await postPayment(reference, 11500);
  const after = await installment();
  const payments = await paymentsWithReference(reference);

  assert.equal(posted.externalPaymentId, reference);
  assert.equal(posted.status, 'POSTED');
  assert.equal(Number(after.paidAmount), 11500);
  assert.equal(after.status, 'PAID');
  assert.equal(payments.length, 1);
});
test('reverses a posted payment and restores the installment balance', async () => {
  const posted = await postPayment('TEST-AUTO-REV-PAY-001', 1000);
  const reference = 'TEST-AUTO-REV-001';
  const reversal = await reversePayment(posted.ID, reference);
  const after = await installment();

  assert.equal(reversal.externalReversalId, reference);
  assert.equal(Number(reversal.amount), 1000);
  assert.equal((await paymentById(posted.ID)).status, 'REVERSED');
  assert.equal(Number(after.paidAmount), 0);
  assert.equal(after.status, 'PENDING');
  assert.equal((await reversalsWithReference(reference)).length, 1);
});

test('rejects a second reversal of the same payment', async () => {
  const posted = await postPayment('TEST-AUTO-REV-PAY-002', 1000);
  await reversePayment(posted.ID, 'TEST-AUTO-REV-002A');

  await assert.rejects(
    () => reversePayment(posted.ID, 'TEST-AUTO-REV-002B'),
    /only a posted payment can be reversed|already been reversed/i
  );
  assert.equal(Number((await installment()).paidAmount), 0);
  assert.equal((await reversalsWithReference('TEST-AUTO-REV-002B')).length, 0);
});

test('rejects a reused external reversal ID without altering another payment', async () => {
  const first = await postPayment('TEST-AUTO-REV-PAY-003A', 100);
  const second = await postPayment('TEST-AUTO-REV-PAY-003B', 200);
  const reference = 'TEST-AUTO-REV-003';
  await reversePayment(first.ID, reference);

  await assert.rejects(
    () => reversePayment(second.ID, reference),
    /external reversal ID already exists/i
  );
  assert.equal((await paymentById(second.ID)).status, 'POSTED');
  assert.equal(Number((await installment()).paidAmount), 200);
  assert.equal((await reversalsWithReference(reference)).length, 1);
});

test('blocks reversal after the financing is settled', async () => {
  await postPayment('TEST-AUTO-SETTLE-002', 11500);
  const finalPayment = await postPayment(
    'TEST-AUTO-SETTLE-003', 11500, 'bbbbbbbb-bbbb-bbbb-bbbb-000000000003'
  );
  const service = getService();
  const financing = await service.run(
    cds.ql.SELECT.one.from(service.entities.MurabahaFinancing)
      .where({ ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
  );
  assert.equal(financing.status, 'SETTLED');

  await assert.rejects(
    () => reversePayment(finalPayment.ID, 'TEST-AUTO-REV-SETTLED'),
    /settled financing cannot be reversed/i
  );
  assert.equal((await paymentById(finalPayment.ID)).status, 'POSTED');
  assert.equal((await reversalsWithReference('TEST-AUTO-REV-SETTLED')).length, 0);
});

const accountingEventByCorrelation = correlationId => {
  const service = getService();

  return service.run(
    cds.ql.SELECT.one
      .from(service.entities.MurabahaAccountingEvent)
      .where({ correlationId })
  );
};

const postAccountingEvent = accountingEventId => getService().send({
  event: 'postAccountingEvent',
  data: {
    accountingEventId
  }
});

const setAccountingEventStatus = async (accountingEventId, postingStatus) => {
  const db = await cds.connect.to('db');
  const { MurabahaAccountingEvent } = cds.entities('NHBCAP01');

  return db.run(
    cds.ql.UPDATE(MurabahaAccountingEvent)
      .set({ postingStatus })
      .where({ ID: accountingEventId })
  );
};

test('marks a pending accounting event FAILED when SAP posting fails', async () => {
  const reference = 'TEST-AUTO-ACCOUNTING-001';

  await postPayment(reference, 1000);

  const event = await accountingEventByCorrelation(reference);

  assert.ok(event);
  assert.equal(event.eventType, 'PAYMENT_RECEIVED');
  assert.equal(event.postingStatus, 'PENDING');

  const result = await postAccountingEvent(event.ID);

  assert.equal(result.ID, event.ID);
  assert.equal(result.postingStatus, 'FAILED');
  assert.equal(result.externalAccountingDocumentId, null);
  assert.ok(result.errorMessage);

  const after = await accountingEventByCorrelation(reference);

  assert.equal(after.postingStatus, 'FAILED');
  assert.ok(after.errorMessage);
});

test('marks a pending accounting event POSTED when SAP confirms posting', async () => {
  const reference = 'AUTO-SAP-OK-001';
  const originalFetch = global.fetch;
  const originalDestination =
    process.env.SAP_JOURNAL_ENTRY_DESTINATION;
  const originalEndpoint =
    process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL;
  const originalUsername =
    process.env.SAP_JOURNAL_ENTRY_USERNAME;
  const originalPassword =
    process.env.SAP_JOURNAL_ENTRY_PASSWORD;

  delete process.env.SAP_JOURNAL_ENTRY_DESTINATION;

  process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL =
    'https://example.test/sap/journal-entry';
  process.env.SAP_JOURNAL_ENTRY_USERNAME =
    'user';
  process.env.SAP_JOURNAL_ENTRY_PASSWORD =
    'secret';

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => `
        <JournalEntryBulkCreateConfirmation>
            <JournalEntryCreateConfirmation>
                <AccountingDocument>1900000123</AccountingDocument>
                <CompanyCode>NHB1</CompanyCode>
                <FiscalYear>2026</FiscalYear>
                <Log>
                    <MaximumLogItemSeverityCode>1</MaximumLogItemSeverityCode>
                    <Item>
                        <Note>Journal entry posted successfully</Note>
                    </Item>
                </Log>
            </JournalEntryCreateConfirmation>
        </JournalEntryBulkCreateConfirmation>`
  });
  try {
    await postPayment(reference, 1000);

    const event =
      await accountingEventByCorrelation(reference);

    assert.ok(event);
    assert.equal(
      event.postingStatus,
      'PENDING'
    );

    const result =
      await postAccountingEvent(event.ID);
    assert.equal(
      result.externalAccountingDocument,
      '1900000123'
    );
    assert.equal(
      result.externalCompanyCode,
      'NHB1'
    );
    assert.equal(
      result.externalFiscalYear,
      '2026'
    );
    assert.equal(result.ID, event.ID);
    assert.equal(
      result.postingStatus,
      'POSTED'
    );
    assert.equal(
      result.externalAccountingDocumentId,
      'NHB1-2026-1900000123'
    );
    assert.equal(result.errorMessage, null);

    const after =
      await accountingEventByCorrelation(reference);
    assert.equal(
      after.postingStatus,
      'POSTED'
    );
    assert.equal(
      result.externalAccountingDocument,
      '1900000123'
    );
    assert.equal(
      result.externalCompanyCode,
      'NHB1'
    );
    assert.equal(
      result.externalFiscalYear,
      '2026'
    );
    assert.equal(after.errorMessage, null);

  } finally {
    global.fetch = originalFetch;

    if (originalDestination === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_DESTINATION;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_DESTINATION =
        originalDestination;
    }

    if (originalEndpoint === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_ENDPOINT_URL;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_ENDPOINT_URL =
        originalEndpoint;
    }

    if (originalUsername === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_USERNAME;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_USERNAME =
        originalUsername;
    }

    if (originalPassword === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_PASSWORD;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_PASSWORD =
        originalPassword;
    }
  }
});

test('rejects postAccountingEvent without an accounting event ID', async () => {
  const service = getService();

  await assert.rejects(
    () => service.send({
      event: 'postAccountingEvent',
      data: {}
    }),
    /accounting event ID is required/i
  );
});

test('rejects an unknown accounting event ID', async () => {
  await assert.rejects(
    () => postAccountingEvent(
      '00000000-0000-0000-0000-000000000000'
    ),
    /accounting event was not found/i
  );
});

test('rejects an accounting event that is no longer pending', async () => {
  const reference = 'TEST-AUTO-ACCOUNTING-POSTED-001';

  await postPayment(reference, 1000);

  const event = await accountingEventByCorrelation(reference);

  assert.ok(event);
  assert.equal(event.postingStatus, 'PENDING');

  await setAccountingEventStatus(event.ID, 'POSTED');

  const changed = await accountingEventByCorrelation(reference);
  assert.equal(changed.postingStatus, 'POSTED');

  await assert.rejects(
    () => postAccountingEvent(event.ID),
    /only a pending accounting event can be submitted for posting/i
  );
});

test('marks a reversal accounting event POSTED when SAP confirms reversal', async () => {
  const paymentReference = 'REV-SAP-PAY-001';
  const reversalReference = 'REV-SAP-001';

  const originalFetch = global.fetch;
  const originalDestination =
    process.env.SAP_JOURNAL_ENTRY_DESTINATION;
  const originalEndpoint =
    process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL;
  const originalUsername =
    process.env.SAP_JOURNAL_ENTRY_USERNAME;
  const originalPassword =
    process.env.SAP_JOURNAL_ENTRY_PASSWORD;

  delete process.env.SAP_JOURNAL_ENTRY_DESTINATION;

  process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL =
    'https://example.test/sap/journal-entry';
  process.env.SAP_JOURNAL_ENTRY_USERNAME =
    'user';
  process.env.SAP_JOURNAL_ENTRY_PASSWORD =
    'secret';

  try {
    const payment =
      await postPayment(
        paymentReference,
        1000
      );

    const originalEvent =
      await accountingEventByCorrelation(
        paymentReference
      );

    assert.ok(originalEvent);

    const db =
      await cds.connect.to('db');

    const {
      MurabahaAccountingEvent
    } = cds.entities('NHBCAP01');

    await db.run(
      cds.ql.UPDATE(
        MurabahaAccountingEvent
      )
        .set({
          postingStatus: 'POSTED',
          externalAccountingDocument:
            '1900000123',
          externalCompanyCode:
            'NHB1',
          externalFiscalYear:
            '2026',
          externalAccountingDocumentId:
            'NHB1-2026-1900000123'
        })
        .where({
          ID: originalEvent.ID
        })
    );

    await reversePayment(
      payment.ID,
      reversalReference
    );

    const reversalEvent =
      await accountingEventByCorrelation(
        reversalReference
      );

    assert.ok(reversalEvent);
    assert.equal(
      reversalEvent.eventType,
      'PAYMENT_REVERSED'
    );
    assert.equal(
      reversalEvent.postingStatus,
      'PENDING'
    );

    global.fetch = async (
      url,
      options
    ) => {
      assert.equal(
        url,
        'https://example.test/sap/journal-entry'
      );

      assert.match(
        options.body,
        /<ReversalReason>01<\/ReversalReason>/
      );

      assert.match(
        options.body,
        /<ReversalReferenceDocument>1900000123NHB12026<\/ReversalReferenceDocument>/
      );

      assert.doesNotMatch(
        options.body,
        /<Item>/
      );

      return {
        ok: true,
        status: 200,
        text: async () => `
                    <JournalEntryBulkCreateConfirmation>
                        <JournalEntryCreateConfirmation>
                            <AccountingDocument>1900000456</AccountingDocument>
                            <CompanyCode>NHB1</CompanyCode>
                            <FiscalYear>2026</FiscalYear>
                            <Log>
                                <MaximumLogItemSeverityCode>1</MaximumLogItemSeverityCode>
                                <Item>
                                    <Note>Journal entry reversed successfully</Note>
                                </Item>
                            </Log>
                        </JournalEntryCreateConfirmation>
                    </JournalEntryBulkCreateConfirmation>`
      };
    };

    const result =
      await postAccountingEvent(
        reversalEvent.ID
      );

    assert.equal(
      result.postingStatus,
      'POSTED',
      `Reversal posting failed: ${result.errorMessage}`
    );

    assert.equal(
      result.externalAccountingDocument,
      '1900000456'
    );

    assert.equal(
      result.externalCompanyCode,
      'NHB1'
    );

    assert.equal(
      result.externalFiscalYear,
      '2026'
    );

    assert.equal(
      result.externalAccountingDocumentId,
      'NHB1-2026-1900000456'
    );

    assert.equal(
      result.errorMessage,
      null
    );

  } finally {
    global.fetch = originalFetch;

    if (originalDestination === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_DESTINATION;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_DESTINATION =
        originalDestination;
    }

    if (originalEndpoint === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_ENDPOINT_URL;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_ENDPOINT_URL =
        originalEndpoint;
    }

    if (originalUsername === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_USERNAME;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_USERNAME =
        originalUsername;
    }

    if (originalPassword === undefined) {
      delete process.env
        .SAP_JOURNAL_ENTRY_PASSWORD;
    } else {
      process.env
        .SAP_JOURNAL_ENTRY_PASSWORD =
        originalPassword;
    }
  }
});

test('database rejects a duplicate external payment reference', async () => {
  const reference = 'TEST-DB-UNIQUE-001';
  const payment = await postPayment(reference, 100);
  const db = await cds.connect.to('db');
  const { MurabahaPayment } = cds.entities('NHBCAP01');
  await assert.rejects(() => db.tx(async tx => {
    await tx.run(cds.ql.INSERT.into(MurabahaPayment).entries({
      ID: cds.utils.uuid(),
      financing_ID: payment.financing_ID,
      installment_ID: payment.installment_ID,
      externalPaymentId: reference,
      paymentDate: payment.paymentDate,
      amount: 100,
      currency: 'USD',
      status: 'POSTED'
    }));
  }));
  assert.equal((await paymentsWithReference(reference)).length, 1);
  assert.equal(Number((await installment()).paidAmount), 100);
});

test('competing submissions of one reference create one payment and event', async () => {
  const reference = 'TEST-CONCURRENT-SAME-001';
  const results = await Promise.allSettled([
    postPayment(reference, 100), postPayment(reference, 100)
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const payments = await paymentsWithReference(reference);
  assert.equal(payments.length, 1);
  assert.equal(Number((await installment()).paidAmount), 100);
  const service = getService();
  const events = await service.run(cds.ql.SELECT.from(
    service.entities.MurabahaAccountingEvent
  ).where({ payment_ID: payments[0].ID, eventType: 'PAYMENT_RECEIVED' }));
  assert.equal(events.length, 1);
});

test('competing distinct payments do not lose successful balance updates', async () => {
  const references = ['TEST-CONCURRENT-A-001', 'TEST-CONCURRENT-B-001'];
  const amounts = [100, 200];
  const results = await Promise.allSettled(references.map(
    (reference, index) => postPayment(reference, amounts[index])
  ));
  const successful = results.filter(result => result.status === 'fulfilled');
  assert.ok(successful.length >= 1, 'At least one payment should succeed');
  let expected = 0;
  for (let index = 0; index < references.length; index++) {
    const payments = await paymentsWithReference(references[index]);
    if (results[index].status === 'fulfilled') {
      expected += amounts[index];
      assert.equal(payments.length, 1);
    } else {
      assert.equal(payments.length, 0, 'Rejected request must not leave a payment');
    }
  }
  assert.equal(Number((await installment()).paidAmount), expected);
});
