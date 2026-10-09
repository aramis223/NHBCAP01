'use strict';
// One explicitly pinned recovery row. Defaults to SELECT-only verification.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
process.env.CDS_ENV = 'hybrid';
const cds = require('@sap/cds');
const NAMES = ['Customer', 'Account', 'MurabahaFinancing', 'MurabahaInstallment',
    'MurabahaPayment', 'MurabahaPaymentReversal', 'MurabahaAccountingEvent'];
const PINNED_ROW_SHA256 = '70df22038c2261e153190e80d54c7eb11dc4c9f2a6d1377344c474586d716f5e';
class RecoveryError extends Error {}
let committed = false;

function requireThat(condition, message) {
    if (!condition) throw new RecoveryError(message);
}
function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value !== null && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    }
    return JSON.stringify(value);
}
function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}
function digest(rows) {
    return hash(canonical([...rows].sort((a, b) => String(a.ID).localeCompare(String(b.ID)))));
}
function normalize(value, element) {
    if (value == null) return null;
    if (element?.type === 'cds.Decimal') {
        const m = String(value).match(/^(-?)(\d+)(?:\.(\d+))?$/);
        requireThat(m, 'Invalid decimal.');
        const fraction = (m[3] || '').replace(/0+$/, '');
        return m[1] + m[2].replace(/^0+(?=\d)/, '') + (fraction ? '.' + fraction : '');
    }
    if (['cds.Timestamp', 'cds.DateTime'].includes(element?.type)) {
        const date = new Date(value);
        requireThat(Number.isFinite(date.getTime()), 'Invalid timestamp.');
        return date.toISOString();
    }
    return value;
}
function assertRows(name, expected, actual, model) {
    const map = new Map(actual.map(row => [row.ID, row]));
    requireThat(map.size === actual.length && expected.length === actual.length, name + ': row count changed.');
    for (const before of expected) {
        const after = map.get(before.ID);
        requireThat(after, name + ': expected row missing.');
        for (const [field, value] of Object.entries(before)) {
            if (field.startsWith('@')) continue;
            const element = model.elements[field];
            requireThat(element && !element.target, name + ': unsupported field ' + field);
            requireThat(canonical(normalize(value, element)) === canonical(normalize(after[field], element)),
                name + ': changed field ' + field + ' for ' + before.ID);
        }
    }
}
async function readAll(tx, model) {
    const records = {};
    for (const name of NAMES) {
        const entity = model.definitions['NHBCAP01.' + name];
        requireThat(entity, 'Missing database entity: ' + name);
        const fields = Object.entries(entity.elements)
            .filter(([, e]) => !e.target && !e.virtual && !e.elements && !e.items)
            .map(([key]) => key);
        requireThat(fields.includes('ID'), 'Missing ID field.');
        records[name] = await tx.run(cds.ql.SELECT.from('NHBCAP01.' + name).columns(...fields));
    }
    return records;
}
function validateEvidence(records, payment, eventId) {
    requireThat(!records.MurabahaPayment.some(row => row.ID === payment.ID ||
        row.externalPaymentId === payment.externalPaymentId ||
        (row.sourceProvider === 'FISERV' && ['sourceEnvironment', 'sourceOrgId', 'sourceAccountId', 'sourceTransactionId']
            .every(field => row[field] === payment[field]))), 'Payment or source already exists. Stop; do not retry insertion.');
    const events = records.MurabahaAccountingEvent.filter(row => row.payment_ID === payment.ID);
    requireThat(events.length === 1 && events[0].ID === eventId, 'Receipt identity or count changed.');
    const event = events[0];
    requireThat(event.eventType === 'PAYMENT_RECEIVED' && event.postingStatus === 'PENDING', 'Accounting state changed.');
    for (const [field, other] of Object.entries({financing_ID: 'financing_ID', installment_ID: 'installment_ID',
        correlationId: 'externalPaymentId', eventDate: 'paymentDate', currency: 'currency'})) {
        requireThat(event[field] === payment[other], 'Receipt evidence changed: ' + field);
    }
    requireThat(normalize(event.amount, {type: 'cds.Decimal'}) === '2.11', 'Receipt amount changed.');
    requireThat(['externalAccountingDocument', 'externalAccountingDocumentId', 'externalCompanyCode', 'externalFiscalYear']
        .every(field => event[field] == null || event[field] === ''), 'Unexpected SAP document identity.');
    requireThat(!records.MurabahaPaymentReversal.some(row => row.payment_ID === payment.ID), 'Unexpected reversal.');
    const installment = records.MurabahaInstallment.find(row => row.ID === payment.installment_ID);
    requireThat(installment && installment.financing_ID === payment.financing_ID &&
        normalize(installment.paidAmount, {type: 'cds.Decimal'}) === '2.11' &&
        normalize(installment.installmentAmount, {type: 'cds.Decimal'}) === '2200' &&
        installment.status === 'PARTIALLY_PAID', 'Installment state changed.');
    const financing = records.MurabahaFinancing.find(row => row.ID === payment.financing_ID);
    requireThat(financing && financing.status === 'ACTIVE' && financing.currency === 'USD' &&
        financing.finxactAccountId === payment.sourceAccountId &&
        String(financing.contractReference).startsWith('MUR-FISERV-CERT-'), 'Financing state changed.');
}

async function execute(tx, model, snapshot, plan, apply, saveBackup) {
    // All values are parameters. SQL avoids managed-field replacement by CREATE handlers.
    await tx.run('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const before = await readAll(tx, model);
    for (const name of NAMES) assertRows(name, snapshot[name], before[name], model.definitions['NHBCAP01.' + name]);
    const payment = plan.proposedInsert;
    validateEvidence(before, payment, plan.existingAccountingEventId);
    if (!apply) return {mode: 'LIVE_CHECK_ONLY', paymentId: payment.ID, verifiedCollections: NAMES.length};
    saveBackup(before);
    const fields = Object.keys(payment);
    const elements = model.definitions['NHBCAP01.MurabahaPayment'].elements;
    requireThat(fields.every(field => /^[A-Za-z][A-Za-z0-9_]*$/.test(field) && elements[field] && !elements[field].target),
        'Unsupported insert field.');
    const columns = fields.map(field => '"' + field.toUpperCase() + '"').join(',');
    await tx.run('INSERT INTO "NHBCAP01_MURABAHAPAYMENT" (' + columns + ') VALUES (' + fields.map(() => '?').join(',') + ')',
        fields.map(field => payment[field]));
    const after = await readAll(tx, model);
    for (const name of NAMES) {
        const expected = name === 'MurabahaPayment' ? [...before[name], payment] : before[name];
        assertRows(name, expected, after[name], model.definitions['NHBCAP01.' + name]);
    }
    const restored = after.MurabahaPayment.find(row => row.ID === payment.ID);
    requireThat(restored.sourceProviderReference == null, 'Unexpected provider reference.');
    return {mode: 'RESTORED_ONE_PAYMENT', paymentId: payment.ID, amount: '2.11', currency: 'USD',
        paidAmountPreserved: '2.11', accountingEventPreserved: plan.existingAccountingEventId,
        verifiedExistingRowsUnchanged: true};
}

async function main() {
    const args = process.argv.slice(2);
    requireThat(args.length >= 1 && args.length <= 2 && (!args[1] || ['--check', '--apply'].includes(args[1])),
        'Usage: node restore_fiserv_payment.cjs SNAPSHOT_DIRECTORY [--check|--apply]');
    const apply = args[1] === '--apply';
    const directory = path.resolve(args[0]);
    const relative = path.relative(process.cwd(), directory);
    requireThat(relative && (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)), 'Use the snapshot directory outside the project.');
    const read = name => JSON.parse(fs.readFileSync(path.join(directory, name + '.json'), 'utf8'));
    const manifest = read('manifest');
    const plan = read('fiserv-payment-recovery-plan');
    requireThat(plan.mode === 'OFFLINE_PLAN_ONLY' && hash(canonical(plan.proposedInsert)) === PINNED_ROW_SHA256,
        'Plan payment differs from the pinned original response.');
    requireThat(plan.existingAccountingEventId === '1cdb4ebd-b67f-4776-b2a2-a3b8afd84ccc', 'Unexpected receipt event.');
    requireThat(plan.snapshotCapturedAt === manifest.capturedAt && canonical(plan.snapshotChecksums) === canonical(manifest.entities),
        'Plan does not match snapshot.');
    requireThat(hash(fs.readFileSync(path.join(directory, 'payment-recovery-live-review.json'))) === plan.liveReviewSha256,
        'Live review report changed.');
    const snapshot = {};
    for (const name of NAMES) {
        snapshot[name] = read(name);
        requireThat(snapshot[name].length === manifest.entities[name]?.count && digest(snapshot[name]) === manifest.entities[name]?.sha256,
            'Snapshot checksum failed: ' + name);
    }
    cds.model = cds.compile.for.nodejs(await cds.load('db/schema.cds'));
    requireThat(['hana', 'hana-cloud'].includes(cds.env.requires.db?.kind), 'HANA binding required.');
    requireThat(!cds.env.sql?.names || cds.env.sql.names === 'plain', 'Plain SQL naming required for this pinned table.');
    const db = await cds.connect.to('db');
    const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID();
    const backupPath = path.join(directory, 'fiserv-pre-restore-' + runId + '.json');
    const resultPath = path.join(directory, 'fiserv-restore-result-' + runId + '.json');
    try {
        const result = await db.tx(tx => execute(tx, cds.model, snapshot, plan, apply, records => {
            fs.writeFileSync(backupPath, JSON.stringify({capturedAt: new Date().toISOString(), records}, null, 2), {flag: 'wx', mode: 0o600});
        }));
        committed = apply;
        console.log(JSON.stringify({...result, ...(apply ? {backup: backupPath} : {})}, null, 2));
        if (apply) {
            fs.writeFileSync(resultPath, JSON.stringify({...result, committedAt: new Date().toISOString(), backup: backupPath}, null, 2), {flag: 'wx', mode: 0o600});
            console.log('One original payment restored. No balance updates, new accounting events or SAP postings.');
            console.log('Recovery receipt: ' + resultPath);
        } else console.log('SELECT only. No data changed.');
    } finally {
        await db.disconnect();
    }
}
if (require.main === module) main().catch(error => {
    console.error(error instanceof RecoveryError ? error.message : 'Recovery stopped (' + error.name + '); driver details hidden.');
    console.error(committed ? 'The payment transaction COMMITTED. Do not reinsert; inspect the payment by ID.' :
        'No successful commit reported. If a connection failed during commit, verify the payment by ID before retrying.');
    process.exitCode = 1;
});
module.exports = {execute, canonical, digest, assertRows, RecoveryError};
