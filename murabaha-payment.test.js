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

const allocationApi = require('./srv/fiserv/allocation');

function allocationProviderRecord(overrides = {}) {
  return {
    AcctTrnKeys: { AcctTrnId: 'CERT-TRANSACTION-1' },
    AcctTrnInfo: {
      DrCrType: 'Credit', TrnSrc: 'CORE', MemoPostInd: false,
      PostedDt: '2025-06-09T13:06:00.229',
      TrnAmt: { Amt: 2.11, CurCode: { CurCodeValue: 'USD' } },
      ...overrides
    },
    AcctTrnStatus: { AcctTrnStatusCode: 'Valid' }
  };
}

test('allocation refuses missing, duplicate and non-posted source transactions', () => {
  const select = records => allocationApi.selectTransaction(
    { AcctTrnRec: records }, 'CERT-TRANSACTION-1',
    '2025-05-12T10:01:01.001', '2025-10-12T10:01:01.001'
  );
  assert.throws(() => select([]), /not uniquely found/);
  assert.throws(() => select([allocationProviderRecord(), allocationProviderRecord()]), /not uniquely found/);
  assert.throws(() => select([allocationProviderRecord({ DrCrType: 'Debit' })]), /CORE credit/);
  assert.throws(() => select([allocationProviderRecord({ MemoPostInd: true })]), /CORE credit/);
  assert.throws(() => select([allocationProviderRecord({ PostedDt: '2025-02-30T00:00:00' })]), /posting date/);
});

test('allocation identity includes provider environment, org, account and transaction', () => {
  const identity = allocationApi.sourceIdentity('cert', 'org', 'account', 'transaction');
  assert.equal(identity.length, 71);
  assert.equal(identity, allocationApi.sourceIdentity('cert', 'org', 'account', 'transaction'));
  assert.notEqual(identity, allocationApi.sourceIdentity('cert', 'org', 'other-account', 'transaction'));
  assert.notEqual(identity, allocationApi.sourceIdentity('other', 'org', 'account', 'transaction'));
  assert.notEqual(identity, allocationApi.sourceIdentity('cert', 'other-org', 'account', 'transaction'));
});

async function withAllocationFixture(work) {
  const names = ['FISERV_API_BASE_URL', 'FISERV_ORG_ID', 'FISERV_TOKEN_URL', 'FISERV_API_KEY', 'FISERV_API_SECRET'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = global.fetch;
  const db = await cds.connect.to('db');
  const entities = cds.entities('NHBCAP01');
  const current = await installment();
  const originalFinancing = await db.run(cds.ql.SELECT.one.from(entities.MurabahaFinancing)
    .where({ ID: current.financing_ID }));
  try {
    Object.assign(process.env, {
      FISERV_API_BASE_URL: 'https://bankinghub-cert.fiservapis.com/banking/efx/v1',
      FISERV_ORG_ID: 'TEST-ORG', FISERV_TOKEN_URL: 'https://example.invalid/token',
      FISERV_API_KEY: 'test-key', FISERV_API_SECRET: 'test-secret'
    });
    await db.run(cds.ql.UPDATE(entities.MurabahaFinancing).set({
      contractReference: 'MUR-FISERV-CERT-AUTO', finxactAccountId: 'TEST-ACCOUNT'
    }).where({ ID: current.financing_ID }));
    global.fetch = async url => new Response(JSON.stringify(
      url === process.env.FISERV_TOKEN_URL ? { access_token: 'test-token' } : {
        Status: { StatusCode: '0' }, AcctTrnRec: [allocationProviderRecord()]
      }
    ), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const input = {
      financingId: current.financing_ID, installmentId: INSTALLMENT_ID,
      accountId: 'TEST-ACCOUNT', transactionId: 'CERT-TRANSACTION-1',
      startDateTime: '2025-05-12T10:01:01.001', endDateTime: '2025-10-12T10:01:01.001',
      allocationReason: 'Synthetic automated certification allocation',
      confirmSyntheticAllocation: true
    };
    const allocate = changes => getService().tx({
      user: new cds.User({ id: 'allocation-test-system', roles: ['system-user'] })
    }, tx => tx.send({
      event: 'allocateFiservCertificationTransaction', data: { ...input, ...changes }
    }));
    await work({ allocate, input, db, entities });
  } finally {
    global.fetch = originalFetch;
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
    await db.run(cds.ql.UPDATE(entities.MurabahaFinancing).set({
      contractReference: originalFinancing.contractReference,
      finxactAccountId: originalFinancing.finxactAccountId
    }).where({ ID: current.financing_ID }));
  }
}

test('explicit Fiserv allocation stores provider evidence and one pending event', async () => {
  await withAllocationFixture(async ({ allocate }) => {
    const payment = await allocate();
    assert.equal(Number(payment.amount), 2.11);
    assert.equal(payment.currency, 'USD');
    assert.equal(payment.paymentDate, '2025-06-09');
    assert.equal(payment.sourceTransactionId, 'CERT-TRANSACTION-1');
    assert.equal(payment.sourceOrgId, 'TEST-ORG');
    assert.equal(payment.sourceAccountId, 'TEST-ACCOUNT');
    assert.equal(payment.allocationReason, 'Synthetic automated certification allocation');
    assert.equal(Number((await installment()).paidAmount), 2.11);
    const events = await getService().run(cds.ql.SELECT.from(
      getService().entities.MurabahaAccountingEvent
    ).where({ payment_ID: payment.ID }));
    assert.equal(events.length, 1);
    assert.equal(events[0].postingStatus, 'PENDING');
    await assert.rejects(() => allocate(), /already been allocated/);
    assert.equal(Number((await installment()).paidAmount), 2.11);
  });
});

test('Fiserv allocation rejects unconfirmed or mismatched account selections', async () => {
  await withAllocationFixture(async ({ allocate }) => {
    await assert.rejects(() => allocate({ confirmSyntheticAllocation: false }), /confirmation/);
    await assert.rejects(() => allocate({ accountId: 'OTHER-ACCOUNT' }), /linked to the selected account/);
    assert.equal(Number((await installment()).paidAmount), 0);
  });
});

test('Fiserv allocation rejects an unknown transaction without creating a payment', async () => {
  await withAllocationFixture(async ({ allocate, db, entities }) => {
    const before = await db.run(cds.ql.SELECT.from(entities.MurabahaPayment));
    await assert.rejects(() => allocate({ transactionId: 'MISSING' }), /not uniquely found/);
    const after = await db.run(cds.ql.SELECT.from(entities.MurabahaPayment));
    assert.equal(after.length, before.length);
    assert.equal(Number((await installment()).paidAmount), 0);
  });
});

test('Fiserv allocation rejects an anonymous caller', async () => {
  await assert.rejects(() => getService().tx({
    user: new cds.User.Anonymous()
  }, tx => tx.send({
    event: 'allocateFiservCertificationTransaction', data: {}
  })), error => Number(error.code || error.statusCode) === 401);
});


test('Fiserv selection rejects every populated reversal marker and validates reference length', () => {
  const select = info => allocationApi.selectTransaction(
    { AcctTrnRec: [allocationProviderRecord(info)] }, 'CERT-TRANSACTION-1',
    '2025-05-12T10:01:01.001', '2025-10-12T10:01:01.001');
  for (const TrnRevType of ['REVERSAL', 'ADJUSTMENT', 'unknown', ' ', 0, false]) {
    assert.throws(() => select({ TrnRevType }), error =>
      error.statusCode === 409 && /reversal or adjustment marker/.test(error.message));
  }
  for (const TrnRevType of [undefined, null, '']) {
    assert.equal(select({ TrnRevType, SPRefIdent: 'SCO-BATCH-TEST' }).providerReference, 'SCO-BATCH-TEST');
  }
  assert.equal(select({}).providerReference, null);
  assert.equal(select({ SPRefIdent: 'x'.repeat(36) }).providerReference.length, 36);
  for (const SPRefIdent of [123, 'x'.repeat(37)]) {
    assert.throws(() => select({ SPRefIdent }), /Provider reference/);
  }
});

function mockAllocationProvider(info) {
  global.fetch = async url => new Response(JSON.stringify(
    url === process.env.FISERV_TOKEN_URL ? { access_token: 'test-token' } : {
      Status: { StatusCode: '0' }, AcctTrnRec: [allocationProviderRecord(info)]
    }
  ), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('Fiserv history exposes provider reference and reversal marker without classification', async () => {
  await withAllocationFixture(async ({ input }) => {
    mockAllocationProvider({ SPRefIdent: 'SCO-BATCH-TEST', TrnRevType: 'UNKNOWN-MARKER' });
    const data = await getService().tx({
      user: new cds.User({ id: 'allocation-test-system', roles: ['system-user'] })
    }, tx => tx.send({ event: 'getFiservAccountTransactions', data: {
      accountId: input.accountId, startDateTime: input.startDateTime,
      endDateTime: input.endDateTime, direction: 'Credit'
    } }));
    assert.equal(data.transactions[0].providerReference, 'SCO-BATCH-TEST');
    assert.equal(data.transactions[0].reversalType, 'UNKNOWN-MARKER');
  });
});

test('Fiserv reversal or adjustment markers create no payment, event or balance change', async () => {
  await withAllocationFixture(async ({ allocate, db, entities }) => {
    const paymentCount = (await db.run(cds.ql.SELECT.from(entities.MurabahaPayment))).length;
    const eventCount = (await db.run(cds.ql.SELECT.from(entities.MurabahaAccountingEvent))).length;
    const before = await installment();
    for (const TrnRevType of ['REVERSAL', 'ADJUSTMENT', 'unknown', ' ']) {
      mockAllocationProvider({ TrnRevType });
      await assert.rejects(() => allocate(), /reversal or adjustment marker/);
    }
    assert.equal((await db.run(cds.ql.SELECT.from(entities.MurabahaPayment))).length, paymentCount);
    assert.equal((await db.run(cds.ql.SELECT.from(entities.MurabahaAccountingEvent))).length, eventCount);
    const after = await installment();
    assert.equal(Number(after.paidAmount), Number(before.paidAmount));
    assert.equal(after.status, before.status);
  });
});

test('Fiserv certification allocation preserves SCO provider reference as audit evidence', async () => {
  await withAllocationFixture(async ({ allocate }) => {
    mockAllocationProvider({ SPRefIdent: 'SCO-BATCH-TEST', TrnRevType: '' });
    const payment = await allocate();
    assert.equal(payment.sourceProviderReference, 'SCO-BATCH-TEST');
    assert.equal(payment.sourceTransactionId, 'CERT-TRANSACTION-1');
    assert.equal(Number(payment.amount), 2.11);
  });
});
