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

const postPayment = (externalPaymentId, amount) => getService().send({
  event: 'postPayment',
  entity: 'MurabahaInstallment',
  params: [{ ID: INSTALLMENT_ID }],
  data: {
    externalPaymentId,
    paymentDate: '2026-09-21',
    amount,
    currency: 'USD'
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
