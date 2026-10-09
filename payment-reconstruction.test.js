const cds = require('@sap/cds');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {execute, readAll, compare, NAMES, UNKNOWN} = require('./payment_reconstruction_core.cjs');
const {data} = cds.test('serve', 'all', '--in-memory');
beforeEach(data.reset);
const INSTALLMENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-000000000002';

async function fixture() {
  const inst = await cds.db.run(cds.ql.SELECT.one.from('NHBCAP01.MurabahaInstallment').where({ID: INSTALLMENT_ID}));
  assert.ok(inst);
  const templates = [];
  for (const amount of [1, 2]) {
    const id = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const reference = 'RECONSTRUCTION-TEST-' + id;
    await cds.db.run(cds.ql.INSERT.into('NHBCAP01.MurabahaAccountingEvent').entries({
      ID: eventId, payment_ID: id, financing_ID: inst.financing_ID, installment_ID: inst.ID,
      eventType: 'PAYMENT_RECEIVED', postingStatus: 'PENDING', correlationId: reference,
      eventDate: '2026-09-21', amount, currency: 'USD'
    }));
    const row = {ID: id, externalPaymentId: reference, financing_ID: inst.financing_ID,
      installment_ID: inst.ID, paymentDate: '2026-09-21', amount: String(amount), currency: 'USD', status: 'POSTED',
      ...Object.fromEntries(UNKNOWN.map(k => [k, null])), recoveryStatus: 'RECONSTRUCTED',
      originalAuditUnavailable: true, sourceAuditUnavailable: true,
      recoveryReason: 'Synthetic offline transaction test only.',
      recoveryEvidence: JSON.stringify({receiptEventIds: [eventId], reversalRecordIds: [], reversalEventIds: []})};
    templates.push({paymentId: id, recordTemplate: row});
  }
  await cds.db.run(cds.ql.UPDATE('NHBCAP01.MurabahaInstallment').set({paidAmount: 3}).where({ID: inst.ID}));
  const snapshot = await cds.db.tx(tx => readAll(tx, cds, cds.model));
  return {snapshot, plan: {templates}};
}
async function run(f, apply, wrap = tx => tx) {
  return cds.db.tx(tx => execute({tx: wrap(tx), cds, model: cds.model, snapshot: f.snapshot,
    plan: f.plan, apply, actor: 'offline-test-operator', recoveredAt: '2026-10-10T00:00:00.000Z',
    saveBackup() {}, dialect: 'sqlite'}));
}
async function unchanged(snapshot) {
  const actual = await cds.db.tx(tx => readAll(tx, cds, cds.model));
  for (const name of NAMES) compare(name, snapshot[name], actual[name], cds.model.definitions['NHBCAP01.' + name]);
}

test('reconstruction check performs no INSERT and preserves all rows', async () => {
  const f = await fixture();
  const result = await run(f, false, tx => ({run(query, values) {
    assert.notEqual(typeof query, 'string', 'SQLite check must perform no raw INSERT');
    return tx.run(query, values);
  }}));
  assert.equal(result.mode, 'LIVE_RECONSTRUCTION_CHECK_ONLY');
  await unchanged(f.snapshot);
});

test('reconstruction commits only marked payments with null original audit', async () => {
  const f = await fixture();
  const result = await run(f, true);
  assert.equal(result.insertedCount, 2);
  const actual = await cds.db.tx(tx => readAll(tx, cds, cds.model));
  for (const name of NAMES.filter(n => n !== 'MurabahaPayment')) {
    compare(name, f.snapshot[name], actual[name], cds.model.definitions['NHBCAP01.' + name]);
  }
  for (const template of f.plan.templates) {
    const row = actual.MurabahaPayment.find(r => r.ID === template.paymentId);
    assert.equal(row.recoveryStatus, 'RECONSTRUCTED');
    assert.equal(row.originalAuditUnavailable, true);
    assert.equal(row.recoveredBy, 'offline-test-operator');
    for (const field of UNKNOWN) assert.equal(row[field], null);
  }
});

test('failure on second INSERT rolls back the first INSERT', async () => {
  const f = await fixture();
  let inserts = 0;
  await assert.rejects(run(f, true, tx => ({run(query, values) {
    if (typeof query === 'string' && query.startsWith('INSERT') && ++inserts === 2) {
      throw new Error('Injected second insert failure');
    }
    return tx.run(query, values);
  }})), /Injected second insert failure/);
  assert.equal(inserts, 2);
  await unchanged(f.snapshot);
});

test('unexpected balance change after INSERT triggers full rollback', async () => {
  const f = await fixture();
  let changed = false;
  await assert.rejects(run(f, true, tx => ({async run(query, values) {
    const result = await tx.run(query, values);
    if (!changed && typeof query === 'string' && query.startsWith('INSERT')) {
      changed = true;
      await tx.run(cds.ql.UPDATE('NHBCAP01.MurabahaInstallment').set({paidAmount: 4}).where({ID: INSTALLMENT_ID}));
    }
    return result;
  }})), /MurabahaInstallment: changed (?:paidAmount|modifiedAt|modifiedBy) for /);
  await unchanged(f.snapshot);
});

test('existing reference collision blocks reconstruction', async () => {
  const f = await fixture();
  f.plan.templates[1].recordTemplate.externalPaymentId = f.plan.templates[0].recordTemplate.externalPaymentId;
  await assert.rejects(run(f, true), /reference collision/);
  await unchanged(f.snapshot);
});
