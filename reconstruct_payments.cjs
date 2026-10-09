'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {execute, canonical, NAMES, ReconstructionError} = require('./payment_reconstruction_core.cjs');
let committed = false;
function check(ok, message) { if (!ok) throw new ReconstructionError(message); }
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function main() {
  const args = process.argv.slice(2);
  check(args.length >= 1 && args.length <= 3 && (!args[1] || ['--check', '--apply'].includes(args[1])),
    'Usage: node reconstruct_payments.cjs SNAPSHOT_DIRECTORY [--check|--apply] [RECOVERY_OPERATOR]');
  const apply = args[1] === '--apply';
  check(!apply || args[2], 'Apply requires an explicit recovery operator identity.');
  const directory = path.resolve(args[0]);
  const relative = path.relative(process.cwd(), directory);
  check(relative && (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)), 'Snapshot must be outside the repository.');
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name + '.json'), 'utf8'));
  const manifest = read('manifest');
  const plan = read('payment-reconstruction-dry-run');
  const live = read('payment-recovery-live-review');
  check(plan.mode === 'OFFLINE_RECONSTRUCTION_DRY_RUN' && plan.templates?.length === 52,
    'This recovery run is limited to the reviewed 52-payment plan.');
  check(plan.snapshotCapturedAt === manifest.capturedAt && live.snapshotCapturedAt === manifest.capturedAt,
    'Plan, review and snapshot must have the same baseline.');
  check(hash(fs.readFileSync(path.join(directory, 'payment-recovery-live-review.json'))) === plan.liveReviewSha256,
    'Live review changed; regenerate the dry run.');
  const snapshot = {};
  for (const name of NAMES) {
    snapshot[name] = read(name);
    const ordered = [...snapshot[name]].sort((a, b) => String(a.ID).localeCompare(String(b.ID)));
    check(snapshot[name].length === manifest.entities[name]?.count && hash(canonical(ordered)) === manifest.entities[name]?.sha256,
      'Snapshot checksum failed: ' + name);
  }
  // Recompute templates with the existing offline evidence rules; do not trust edited plan rows.
  const code = 'import json,sys; from plan_reconstructed_payments import templates; d=json.load(sys.stdin); json.dump(templates(d["records"],d["live"],d["checksums"]),sys.stdout)';
  const rebuilt = spawnSync('python3', ['-B', '-c', code], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    input: JSON.stringify({records: snapshot, live, checksums: manifest.entities})});
  check(rebuilt.status === 0, 'Offline plan recomputation failed; run plan_reconstructed_payments.py for details.');
  const expected = JSON.parse(rebuilt.stdout);
  for (const key of ['templates', 'summary', 'excludedPayments', 'installmentExceptions']) {
    check(canonical(plan[key]) === canonical(expected[key]), 'Reconstruction plan differs from recomputed evidence: ' + key);
  }
  process.env.CDS_ENV = 'hybrid';
  const cds = require('@sap/cds');
  cds.model = cds.compile.for.nodejs(await cds.load('db/schema.cds'));
  check(['hana', 'hana-cloud'].includes(cds.env.requires.db?.kind), 'Use the HANA hybrid binding.');
  check(!cds.env.sql?.names || cds.env.sql.names === 'plain', 'This helper requires plain SQL naming.');
  const db = await cds.connect.to('db');
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID();
  const backupPath = path.join(directory, 'pre-reconstruction-' + runId + '.json');
  const receiptPath = path.join(directory, 'reconstruction-receipt-' + runId + '.json');
  try {
    const recoveredAt = new Date().toISOString();
    const result = await db.tx(tx => execute({tx, cds, model: cds.model, snapshot, plan, apply,
      actor: args[2], recoveredAt, saveBackup(records) {
        fs.writeFileSync(backupPath, JSON.stringify({capturedAt: recoveredAt, records}, null, 2), {flag: 'wx', mode: 0o600});
      }}));
    committed = apply;
    console.log(JSON.stringify(result, null, 2));
    if (apply) {
      fs.writeFileSync(receiptPath, JSON.stringify({...result, snapshotCapturedAt: manifest.capturedAt,
        planSha256: hash(fs.readFileSync(path.join(directory, 'payment-reconstruction-dry-run.json'))),
        backup: backupPath, restoredPaymentIds: plan.templates.map(r => r.paymentId),
        committedAt: new Date().toISOString()}, null, 2), {flag: 'wx', mode: 0o600});
      console.log('Backup: ' + backupPath);
      console.log('Recovery receipt: ' + receiptPath);
      console.log('52 explicitly reconstructed records committed. Existing balances, events and SAP references preserved.');
    } else console.log('SELECT only. No payments reconstructed and no SAP postings performed.');
  } finally {
    await db.disconnect();
  }
}
main().catch(error => {
  console.error(error instanceof ReconstructionError ? error.message : 'Reconstruction stopped (' + error.name + '); driver details hidden.');
  console.error(committed ? 'The transaction COMMITTED. Do not reinsert; inspect the recovery records.' :
    'No successful commit reported. If the connection failed during commit, verify payment IDs before retrying.');
  process.exitCode = 1;
});
