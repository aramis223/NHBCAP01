#!/usr/bin/env python3
"""Build an offline evidence review for remaining payments. No repair or network access."""
import argparse
from collections import Counter
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys

from assess_payment_recovery import assess
from snapshot_cap_data import validate_snapshot


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build_review(records, live_review):
    assessment = assess(records)
    eligible = {row['paymentId']: row for row in assessment['missingPayments']
                if not row['blockers'] and row['decision'] == 'CORE_EVIDENCE_AVAILABLE_REQUIRES_REVIEW'}
    candidates = live_review.get('candidates', [])
    require(live_review.get('mode') == 'LIVE_READ_ONLY_REVIEW' and
            live_review.get('verifiedCollectionCount') == 7, 'Incomplete live review.')
    require(len({r['ID'] for r in candidates}) == len(candidates) == len(eligible) and
            {r['ID'] for r in candidates} == set(eligible), 'Candidate set differs from recomputed evidence.')
    events = {r['ID']: r for r in records['MurabahaAccountingEvent']}
    financings = {r['ID']: r for r in records['MurabahaFinancing']}
    details = []
    for candidate in sorted(candidates, key=lambda row: row['ID']):
        evidence = eligible[candidate['ID']]
        core = evidence['coreFieldsFromReceiptEvent']
        for field, value in core.items():
            require((Decimal(str(candidate[field])) == Decimal(str(value))) if field == 'amount'
                    else candidate.get(field) == value, 'Candidate field differs: ' + field)
        require(candidate['status'] == evidence['statusIndicatedByReversalEvidence'] and
                [candidate['evidenceEventId']] == evidence['receiptEventIds'], 'Candidate status or receipt differs.')
        event_ids = evidence['receiptEventIds'] + evidence['reversalEventIds']
        related = [events[event_id] for event_id in event_ids]
        posted = [r for r in related if r.get('postingStatus') == 'POSTED']
        missing_doc_ids = [r['ID'] for r in posted if not (r.get('externalAccountingDocument') or
                                                        r.get('externalAccountingDocumentId'))]
        details.append({
            'paymentId': candidate['ID'],
            'decision': 'REVIEW_ONLY_NOT_APPROVED_FOR_INSERT',
            'proposedCoreFields': {**core, 'status': candidate['status']},
            'contractReference': financings[core['financing_ID']].get('contractReference'),
            'originalManagedAuditFields': 'UNKNOWN_REQUIRE_INDEPENDENT_EVIDENCE_OR_EXPLICIT_RECONSTRUCTION_POLICY',
            'providerAuditFields': 'UNKNOWN_DO_NOT_INFER_FROM_REFERENCE_PREFIX_OR_ACCOUNT_LINK',
            'reversalRecordIdsToPreserve': evidence['reversalIds'],
            'accountingEventsToPreserveExactly': related,
            'postedAccountingEventIds': [r['ID'] for r in posted],
            'postedEventsWithoutDocumentIdentity': missing_doc_ids,
            'installmentEvidence': evidence['installmentReconciliation'],
            'requiredReview': ['Confirm original reference and payment date from receipt evidence.',
                               'Determine how to represent unknown original audit fields without inventing history.',
                               'Preserve every existing accounting event and SAP identity; never repost as recovery.']
        })
    return {
        'mode': 'OFFLINE_REMAINING_PAYMENT_REVIEW',
        'summary': {
            'candidateCount': len(details),
            'proposedStatusCounts': dict(Counter(r['proposedCoreFields']['status'] for r in details)),
            'candidatesWithPostedAccountingEvents': sum(bool(r['postedAccountingEventIds']) for r in details),
            'postedAccountingEventCount': sum(len(r['postedAccountingEventIds']) for r in details),
            'postedEventsWithoutDocumentIdentity': sum(len(r['postedEventsWithoutDocumentIdentity']) for r in details),
            'candidatesWithUnknownOriginalAuditFields': len(details),
            'approvedForInsertion': 0,
            'excludedPaymentCount': sum(bool(r['blockers']) for r in assessment['missingPayments']),
            'installmentsRequiringReconciliation': assessment['summary']['installmentsRequiringReconciliation']
        },
        'candidates': details,
        'excludedPayments': [r for r in assessment['missingPayments'] if r['blockers']],
        'installmentExceptions': [r for r in assessment['installmentReconciliation'] if r['issues']],
        'preservationPolicy': 'No changes to existing payments, reversals, balances, financing states, accounting events, or SAP documents.',
        'limitation': 'Receipt evidence supports core fields but does not reproduce the complete original payment row. This is not an executable restoration plan.'
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True)
    directory = Path(parser.parse_args().snapshot).resolve()
    require(directory != Path.cwd().resolve() and Path.cwd().resolve() not in directory.parents,
            'Use a snapshot directory outside the repository.')
    manifest, records = validate_snapshot(directory)
    source = directory / 'payment-recovery-live-review.json'
    live_review = json.loads(source.read_text(encoding='utf-8'))
    require(live_review.get('snapshotCapturedAt') == manifest['capturedAt'], 'Review belongs to another snapshot.')
    result = build_review(records, live_review)
    result['snapshotCapturedAt'] = manifest['capturedAt']
    result['snapshotChecksums'] = manifest['entities']
    result['liveReviewSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    target = directory / 'remaining-payment-recovery-review.json'
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result['summary'], indent=2))
    print('Detailed review saved outside the repository: ' + str(target))
    print('No network calls, database writes, payment actions or SAP postings performed.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, ArithmeticError) as error:
        print('Remaining recovery review stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
