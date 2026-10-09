'use strict';
const NAMES = ['Customer', 'Account', 'MurabahaFinancing', 'MurabahaInstallment',
  'MurabahaPayment', 'MurabahaPaymentReversal', 'MurabahaAccountingEvent'];
const UNKNOWN = ['createdAt', 'createdBy', 'modifiedAt', 'modifiedBy', 'sourceProvider',
  'sourceEnvironment', 'sourceOrgId', 'sourceAccountId', 'sourceTransactionId',
  'sourcePostedDateTime', 'sourceProviderReference', 'allocationReason'];
class ReconstructionError extends Error {}
function check(ok, message) { if (!ok) throw new ReconstructionError(message); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function cents(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2})0*)?$/);
  check(match, 'Invalid nonnegative money value.');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
}
function normalized(value, element) {
  if (value == null) return null;
  if (element.type === 'cds.Decimal') {
    const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?$/);
    check(match, 'Invalid decimal representation.');
    const fraction = (match[3] || '').replace(/0+$/, '');
    return match[1] + match[2].replace(/^0+(?=\d)/, '') + (fraction ? '.' + fraction : '');
  }
  if (['cds.Timestamp', 'cds.DateTime'].includes(element.type)) {
    const date = new Date(value);
    check(Number.isFinite(date.getTime()), 'Invalid timestamp.');
    return date.toISOString();
  }
  return value;
}
function compare(name, expected, actual, model) {
  const byId = new Map(actual.map(r => [r.ID, r]));
  check(byId.size === actual.length && actual.length === expected.length, name + ': row count changed.');
  for (const original of expected) {
    const row = byId.get(original.ID);
    check(row, name + ': missing existing row.');
    for (const [field, value] of Object.entries(original)) {
      if (field.startsWith('@')) continue;
      const element = model.elements[field];
      check(element && !element.target, name + ': unsupported field ' + field);
      check(canonical(normalized(value, element)) === canonical(normalized(row[field], element)),
        name + ': changed ' + field + ' for ' + original.ID);
    }
  }
}
async function readAll(tx, cds, model) {
  const result = {};
  for (const name of NAMES) {
    const entity = model.definitions['NHBCAP01.' + name];
    check(entity, 'Missing entity: ' + name);
    const fields = Object.entries(entity.elements).filter(([, e]) =>
      !e.target && !e.virtual && !e.elements && !e.items).map(([key]) => key);
    result[name] = await tx.run(cds.ql.SELECT.from('NHBCAP01.' + name).columns(...fields));
  }
  return result;
}
function validateCandidates(records, templates) {
  check(templates.length > 0, 'No reconstruction candidates.');
  const ids = new Set(records.MurabahaPayment.map(r => r.ID));
  const references = new Set(records.MurabahaPayment.map(r => r.externalPaymentId).filter(Boolean));
  for (const template of templates) {
    const p = template.recordTemplate;
    check(p && p.ID === template.paymentId && !ids.has(p.ID), 'Missing, duplicate or existing payment ID.');
    check(typeof p.externalPaymentId === 'string' && p.externalPaymentId.length <= 100 &&
      p.externalPaymentId.trim() && !references.has(p.externalPaymentId), 'Payment reference collision.');
    ids.add(p.ID); references.add(p.externalPaymentId);
    check(UNKNOWN.every(field => p[field] === null), 'Unknown original audit fields must be explicit null.');
    check(p.recoveryStatus === 'RECONSTRUCTED' && p.originalAuditUnavailable === true &&
      p.sourceAuditUnavailable === true && typeof p.recoveryReason === 'string' &&
      p.recoveryReason.length > 0 && p.recoveryReason.length <= 1000 &&
      typeof p.recoveryEvidence === 'string', 'Invalid reconstruction metadata.');
    const receipts = records.MurabahaAccountingEvent.filter(r => r.payment_ID === p.ID && r.eventType === 'PAYMENT_RECEIVED');
    check(receipts.length === 1, 'Missing or ambiguous receipt evidence.');
    const receipt = receipts[0];
    check(receipt.correlationId === p.externalPaymentId && receipt.eventDate === p.paymentDate &&
      receipt.financing_ID === p.financing_ID && receipt.installment_ID === p.installment_ID &&
      receipt.currency === p.currency && cents(receipt.amount) === cents(p.amount) && cents(p.amount) > 0n,
      'Receipt core fields differ.');
    const reversalRows = records.MurabahaPaymentReversal.filter(r => r.payment_ID === p.ID);
    const reversalEvents = records.MurabahaAccountingEvent.filter(r => r.payment_ID === p.ID && r.eventType === 'PAYMENT_REVERSED');
    check(reversalRows.length <= 1 && reversalEvents.length === reversalRows.length &&
      p.status === (reversalRows.length ? 'REVERSED' : 'POSTED'), 'Reversal state differs.');
    for (const row of [...reversalRows, ...reversalEvents]) check(row.financing_ID === p.financing_ID &&
      row.installment_ID === p.installment_ID && row.currency === p.currency && cents(row.amount) === cents(p.amount),
      'Reversal evidence differs.');
    const inst = records.MurabahaInstallment.find(r => r.ID === p.installment_ID);
    const fin = records.MurabahaFinancing.find(r => r.ID === p.financing_ID);
    check(inst && fin && inst.financing_ID === fin.ID && fin.currency === p.currency &&
      records.Customer.some(r => r.ID === fin.customer_ID), 'Financing, installment or customer evidence differs.');
    const allReceipts = records.MurabahaAccountingEvent.filter(r => r.installment_ID === inst.ID && r.eventType === 'PAYMENT_RECEIVED');
    const receiptIds = new Set(allReceipts.map(r => r.payment_ID));
    check(receiptIds.size === allReceipts.length, 'Duplicate installment receipt evidence.');
    const surviving = records.MurabahaPayment.filter(r => r.installment_ID === inst.ID && !receiptIds.has(r.ID));
    const allReversals = records.MurabahaPaymentReversal.filter(r => r.installment_ID === inst.ID);
    const net = [...allReceipts, ...surviving].reduce((sum, r) => sum + cents(r.amount), 0n) -
      allReversals.reduce((sum, r) => sum + cents(r.amount), 0n);
    check(net === cents(inst.paidAmount), 'Installment evidence does not reconcile; exclude this payment.');
    const evidence = JSON.parse(p.recoveryEvidence);
    check(canonical(evidence.receiptEventIds) === canonical([receipt.ID]) &&
      canonical([...evidence.reversalRecordIds].sort()) === canonical(reversalRows.map(r => r.ID).sort()) &&
      canonical([...evidence.reversalEventIds].sort()) === canonical(reversalEvents.map(r => r.ID).sort()),
      'Recovery evidence identities differ.');
  }
}
async function execute({tx, cds, model, snapshot, plan, apply, actor, recoveredAt, saveBackup, dialect = 'hana'}) {
  if (dialect === 'hana') await tx.run('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  const before = await readAll(tx, cds, model);
  for (const name of NAMES) compare(name, snapshot[name], before[name], model.definitions['NHBCAP01.' + name]);
  validateCandidates(before, plan.templates);
  const elements = model.definitions['NHBCAP01.MurabahaPayment'].elements;
  const sample = {...plan.templates[0].recordTemplate, recoveredAt, recoveredBy: actor};
  check(Object.keys(sample).every(key => /^[A-Za-z][A-Za-z0-9_]*$/.test(key) && elements[key] && !elements[key].target),
    'Deployed model lacks required reconstruction fields.');
  if (!apply) return {mode: 'LIVE_RECONSTRUCTION_CHECK_ONLY', candidateCount: plan.templates.length, existingValuesUnchanged: true};
  check(typeof actor === 'string' && actor.trim() === actor && actor.length > 0 && actor.length <= 255 &&
    !/[\x00-\x1f]/.test(actor), 'Supply an explicit recovery operator identity.');
  check(new Date(recoveredAt).toISOString() === recoveredAt, 'Invalid recovery timestamp.');
  saveBackup(before);
  const inserted = [];
  for (const template of plan.templates) {
    const row = {...template.recordTemplate, recoveredAt, recoveredBy: actor};
    const fields = Object.keys(row);
    check(fields.every(field => /^[A-Za-z][A-Za-z0-9_]*$/.test(field) && elements[field] && !elements[field].target), 'Unsupported row field.');
    const sql = 'INSERT INTO "NHBCAP01_MURABAHAPAYMENT" (' + fields.map(f => '"' + f.toUpperCase() + '"').join(',') +
      ') VALUES (' + fields.map(() => '?').join(',') + ')';
    await tx.run(sql, fields.map(f => typeof row[f] === 'boolean' ? Number(row[f]) : row[f]));
    inserted.push(row);
  }
  const after = await readAll(tx, cds, model);
  for (const name of NAMES) compare(name, name === 'MurabahaPayment' ? [...before[name], ...inserted] : before[name],
    after[name], model.definitions['NHBCAP01.' + name]);
  return {mode: 'RECONSTRUCTED_PAYMENTS', insertedCount: inserted.length,
    existingPaymentCount: before.MurabahaPayment.length, finalPaymentCount: after.MurabahaPayment.length,
    recoveredAt, recoveredBy: actor, existingValuesUnchanged: true, newAccountingEventCount: 0, sapPostings: 0};
}
module.exports = {execute, readAll, compare, validateCandidates, canonical, NAMES, UNKNOWN, ReconstructionError};
