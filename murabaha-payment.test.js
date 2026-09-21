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
