'use strict';
// SELECT only. Never starts CAP services, seeds a database or invokes actions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
process.env.CDS_ENV = 'hybrid';
const cds = require('@sap/cds');
class ReviewError extends Error {}
let stage = 'reading snapshot';

function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value !== null && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
}

function snapshotDigest(rows) {
    const ordered = [...rows].sort((a, b) => String(a.ID).localeCompare(String(b.ID)));
    return crypto.createHash('sha256').update(canonical(ordered)).digest('hex');
}

function normalize(value, element) {
    if (value == null) return null;
    if (element?.type === 'cds.Decimal') {
        const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?$/);
        if (!match) throw new ReviewError('Unexpected decimal representation.');
        const integer = match[2].replace(/^0+(?=\d)/, '');
        const fraction = (match[3] || '').replace(/0+$/, '');
        return match[1] + integer + (fraction ? '.' + fraction : '');
    }
    if (['cds.Timestamp', 'cds.DateTime'].includes(element?.type)) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) throw new ReviewError('Invalid database timestamp.');
        return date.toISOString();
    }
    return value;
}

function assertSnapshotMatches(name, before, after, model) {
    const actual = new Map(after.map(row => [row.ID, row]));
    if (actual.size !== after.length || before.length !== after.length) {
        throw new ReviewError(name + ': database row count differs from the reviewed snapshot.');
    }
    for (const expected of before) {
        const row = actual.get(expected.ID);
        if (!row) throw new ReviewError(name + ': snapshot row missing from the database.');
        for (const [field, value] of Object.entries(expected)) {
            if (field.startsWith('@')) continue;
            const element = model.elements[field];
            if (!element || element.target) throw new ReviewError(name + ': unsupported snapshot field ' + field);
            if (canonical(normalize(value, element)) !== canonical(normalize(row[field], element))) {
                throw new ReviewError(name + ': snapshot value changed for ' + expected.ID + ', field ' + field);
            }
        }
    }
}

async function main() {
    if (process.argv.length !== 3) throw new ReviewError('Usage: node review_payment_recovery.cjs SNAPSHOT_DIRECTORY');
    const directory = path.resolve(process.argv[2]);
    const read = name => JSON.parse(fs.readFileSync(path.join(directory, name + '.json'), 'utf8'));
    const manifest = read('manifest');
    const report = read('payment-recovery-assessment');
    const names = ['Customer', 'Account', 'MurabahaFinancing', 'MurabahaInstallment',
        'MurabahaPayment', 'MurabahaPaymentReversal', 'MurabahaAccountingEvent'];
    const snapshot = {};
    for (const name of names) {
        snapshot[name] = read(name);
        if (manifest.entities[name]?.count !== snapshot[name].length ||
            manifest.entities[name]?.sha256 !== snapshotDigest(snapshot[name])) {
            throw new ReviewError('Snapshot checksum failed: ' + name);
        }
    }
    stage = 'loading database model';
    console.log('Snapshot checksums passed. Loading database model.');
    // Compile the runtime model so managed association keys (e.g. customer_ID)
    // are present as scalar elements, just as they are in the running CAP app.
    cds.model = cds.compile.for.nodejs(await cds.load('db/schema.cds'));
    if (!['hana', 'hana-cloud'].includes(cds.env.requires.db?.kind)) {
        throw new ReviewError('Resolved database must be hana or hana-cloud. Use cds bind --exec.');
    }
    stage = 'connecting to HANA';
    console.log('Connecting to HANA using resolved bindings.');
    const db = await cds.connect.to('db');
    try {
        const candidates = await db.tx(async tx => {
            const live = {};
            for (const name of names) {
                stage = 'reading ' + name;
                console.log('Checking live collection: ' + name);
                const entity = 'NHBCAP01.' + name;
                const model = cds.model.definitions[entity];
                if (!model) throw new ReviewError('Database model missing: ' + entity);
                const fields = [...new Set(snapshot[name].flatMap(row => Object.keys(row)))].filter(key => !key.startsWith('@'));
                if (!fields.includes('ID')) fields.push('ID');
                for (const field of fields) {
                    const element = model.elements[field];
                    if (!element || element.target) {
                        throw new ReviewError(name + ': unsupported snapshot field ' + field);
                    }
                }
                live[name] = await tx.run(cds.ql.SELECT.from(entity).columns(...fields));
                assertSnapshotMatches(name, snapshot[name], live[name], model);
                console.log(name + ': snapshot matches (' + live[name].length + ')');
            }
            const payments = new Set(live.MurabahaPayment.map(row => row.ID));
            const refs = new Set(live.MurabahaPayment.map(row => row.externalPaymentId).filter(Boolean));
            const reviewable = report.missingPayments.filter(row =>
                row.decision === 'CORE_EVIDENCE_AVAILABLE_REQUIRES_REVIEW' && row.blockers.length === 0);
            const planned = [];
            for (const candidate of reviewable) {
                const receipts = live.MurabahaAccountingEvent.filter(row =>
                    row.payment_ID === candidate.paymentId && row.eventType === 'PAYMENT_RECEIVED');
                if (receipts.length !== 1 || payments.has(candidate.paymentId)) {
                    throw new ReviewError('Recovery candidate no longer has a single receipt and absent payment.');
                }
                const receipt = receipts[0];
                const evidence = {
                    ID: candidate.paymentId, financing_ID: receipt.financing_ID,
                    installment_ID: receipt.installment_ID, externalPaymentId: receipt.correlationId,
                    paymentDate: receipt.eventDate, amount: receipt.amount, currency: receipt.currency
                };
                const elements = cds.model.definitions['NHBCAP01.MurabahaPayment'].elements;
                for (const [field, value] of Object.entries(evidence)) {
                    if (canonical(normalize(value, elements[field])) !==
                        canonical(normalize(candidate.coreFieldsFromReceiptEvent[field], elements[field]))) {
                        throw new ReviewError('Receipt evidence differs from assessment for ' + candidate.paymentId);
                    }
                }
                if (!evidence.externalPaymentId || refs.has(evidence.externalPaymentId)) {
                    throw new ReviewError('Missing or colliding external payment reference.');
                }
                refs.add(evidence.externalPaymentId);
                const reversalRows = live.MurabahaPaymentReversal.filter(row => row.payment_ID === candidate.paymentId);
                const status = reversalRows.length ? 'REVERSED' : 'POSTED';
                if (candidate.statusIndicatedByReversalEvidence !== status) throw new ReviewError('Reversal evidence changed.');
                planned.push({ ...evidence, status,
                    evidenceEventId: receipt.ID,
                    accountingPostingStatus: receipt.postingStatus,
                    providerAuditFields: 'REQUIRES_INDEPENDENT_EVIDENCE_IF_APPLICABLE',
                    originalManagedTimestamps: 'UNKNOWN_DO_NOT_INVENT' });
            }
            return planned;
        });
        const target = path.join(directory, 'payment-recovery-live-review.json');
        const result = {
            mode: 'LIVE_READ_ONLY_REVIEW', reviewedAt: new Date().toISOString(),
            snapshotCapturedAt: manifest.capturedAt,
            verifiedCollectionCount: names.length, candidateCount: candidates.length,
            proposedPaymentStatusCounts: candidates.reduce((counts, row) => {
                counts[row.status] = (counts[row.status] || 0) + 1;
                return counts;
            }, {}),
            excludedPaymentIds: report.missingPayments.filter(row => row.blockers.length).map(row => row.paymentId),
            note: 'SELECT only. This review does not insert payments or prove unknown audit fields. Six installment exceptions remain outside scope.',
            candidates
        };
        fs.writeFileSync(target, JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ mode: result.mode, verifiedCollectionCount: result.verifiedCollectionCount,
            candidateCount: result.candidateCount, proposedPaymentStatusCounts: result.proposedPaymentStatusCounts,
            excludedPaymentIds: result.excludedPaymentIds, report: target }, null, 2));
        console.log('No INSERT, UPDATE, DELETE, payment actions or SAP postings performed.');
    } finally {
        await db.disconnect();
    }
}

main().catch(error => {
    // Avoid exposing database credentials through driver exception details.
    console.error(error instanceof ReviewError ? error.message : 'Database connection or snapshot reading failed (' + error.name + ').');
    console.error('Stopped while: ' + stage);
    console.error('Live recovery review stopped. No payment repair was performed.');
    process.exitCode = 1;
});
