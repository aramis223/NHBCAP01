#!/usr/bin/env python3
"""Prepare reconstruction templates offline. Never inserts rows or calls services."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from snapshot_cap_data import validate_snapshot
from plan_remaining_payment_recovery import build_review

REASON = ('Reconstructed missing CAP payment core fields from surviving receipt and reversal evidence '
          'after fixture import data loss. Original managed and provider audit fields unavailable. '
          'Existing balances and accounting events must be preserved; no SAP reposting.')


def templates(records, live_review, snapshot_checksums):
    review = build_review(records, live_review)
    output = []
    for candidate in review['candidates']:
        payment = candidate['proposedCoreFields']
        # No event timestamp/user is substituted for an unknown payment audit value.
        evidence = {
            'receiptEventIds': [r['ID'] for r in candidate['accountingEventsToPreserveExactly']
                                if r['eventType'] == 'PAYMENT_RECEIVED'],
            'reversalEventIds': [r['ID'] for r in candidate['accountingEventsToPreserveExactly']
                                 if r['eventType'] == 'PAYMENT_REVERSED'],
            'reversalRecordIds': candidate['reversalRecordIdsToPreserve'],
            'snapshotChecksums': snapshot_checksums,
            'unknownOriginalFields': ['createdAt', 'createdBy', 'modifiedAt', 'modifiedBy',
                                      'sourceProvider', 'sourceEnvironment', 'sourceOrgId',
                                      'sourceAccountId', 'sourceTransactionId', 'sourcePostedDateTime',
                                      'sourceProviderReference', 'allocationReason']
        }
        row = {**payment, **{key: None for key in evidence['unknownOriginalFields']},
               'recoveryStatus': 'RECONSTRUCTED', 'originalAuditUnavailable': True,
               'sourceAuditUnavailable': True, 'recoveryReason': REASON,
               'recoveryEvidence': json.dumps(evidence, sort_keys=True, separators=(',', ':'))}
        output.append({
            'paymentId': payment['ID'], 'recordTemplate': row,
            'deferredFields': {'recoveredAt': 'Actual restoration time, assigned during the write transaction.',
                               'recoveredBy': 'Explicitly supplied recovery operator identity.'},
            'accountingEventsToPreserveExactly': candidate['accountingEventsToPreserveExactly'],
            'postedAccountingEventIds': candidate['postedAccountingEventIds'],
            'insertBlockedUntil': ['Recovery columns deployed and verified without changes to existing data.',
                                   'Fresh live evidence and balance checks pass.',
                                   'Apply tooling and transaction rollback tests are completed.']
        })
    return {'mode': 'OFFLINE_RECONSTRUCTION_DRY_RUN', 'databaseWrites': 0,
            'summary': {**review['summary'], 'templateCount': len(output)},
            'templates': output, 'excludedPayments': review['excludedPayments'],
            'installmentExceptions': review['installmentExceptions'],
            'preservationPolicy': review['preservationPolicy'],
            'limitations': ['Core fields are reconstructed; complete original payment rows are unavailable.',
                            'Recovery metadata is separate from original managed audit fields.',
                            'This file contains templates, not executable INSERT instructions.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True)
    directory = Path(parser.parse_args().snapshot).resolve()
    if directory == Path.cwd().resolve() or Path.cwd().resolve() in directory.parents:
        raise ValueError('Choose the snapshot directory outside the repository.')
    manifest, records = validate_snapshot(directory)
    source = directory / 'payment-recovery-live-review.json'
    live = json.loads(source.read_text(encoding='utf-8'))
    if live.get('snapshotCapturedAt') != manifest['capturedAt']:
        raise ValueError('Live review belongs to another snapshot.')
    result = templates(records, live, manifest['entities'])
    result['snapshotCapturedAt'] = manifest['capturedAt']
    result['liveReviewSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    target = directory / 'payment-reconstruction-dry-run.json'
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'mode': result['mode'], **result['summary']}, indent=2))
    print('Dry-run templates saved outside the repository: ' + str(target))
    print('No network calls, deployment, database writes or SAP postings performed.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, ArithmeticError) as error:
        print('Reconstruction dry run stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
