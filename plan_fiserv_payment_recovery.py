#!/usr/bin/env python3
"""Prepare one payment recovery plan offline. No network or database writes."""
import argparse
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import sys

from snapshot_cap_data import validate_snapshot

PAYMENT = {
    'ID': 'b4a6c7b6-6ec5-444e-b079-58022d150e63',
    'externalPaymentId': 'FISERV-1186528d489f56cd749bf516d993d4b7f1045ee144bd1eb65c8ee9e1cc71a3e7',
    'financing_ID': '6579b3a2-37a7-4dbb-bcea-a083b906c10a',
    'installment_ID': '703133a9-c2d0-4cb6-be75-d144b3b8af0e',
    'paymentDate': '2025-06-09', 'amount': '2.11', 'currency': 'USD',
    'status': 'POSTED',
    'createdAt': '2026-10-09T10:46:27.842Z', 'createdBy': 'system',
    'modifiedAt': '2026-10-09T10:46:27.842Z', 'modifiedBy': 'system',
    'sourceProvider': 'FISERV',
    'sourceEnvironment': 'https://bankinghub-cert.fiservapis.com/banking/efx/v1',
    'sourceOrgId': '999990601', 'sourceAccountId': '110000000055',
    'sourceTransactionId': '53SWeKZRHsGoRjibWoKPEYQI',
    'sourcePostedDateTime': '2025-06-09T13:06:00.229',
    'allocationReason': 'Synthetic certification allocation of a provider transfer; not evidence of a real financing repayment.'
}
EVENT_ID = '1cdb4ebd-b67f-4776-b2a2-a3b8afd84ccc'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def one(rows, field, value):
    matches = [row for row in rows if row.get(field) == value]
    require(len(matches) == 1, 'Expected exactly one record for ' + field + ': ' + value)
    return matches[0]


def equal(field, actual, expected):
    if field == 'amount':
        return Decimal(str(actual)) == Decimal(str(expected))
    return actual == expected


def make_plan(records, review):
    require(review.get('mode') == 'LIVE_READ_ONLY_REVIEW' and
            review.get('verifiedCollectionCount') == 7, 'Missing complete live review.')
    require(not any(row.get('ID') == PAYMENT['ID'] or
                    row.get('externalPaymentId') == PAYMENT['externalPaymentId'] or
                    (row.get('sourceProvider') == 'FISERV' and
                     all(row.get(field) == PAYMENT[field] for field in
                         ['sourceEnvironment', 'sourceOrgId', 'sourceAccountId', 'sourceTransactionId']))
                    for row in records['MurabahaPayment']), 'Payment identity or source already exists.')
    candidate = one(review['candidates'], 'ID', PAYMENT['ID'])
    for field in ['ID', 'financing_ID', 'installment_ID', 'externalPaymentId',
                  'paymentDate', 'amount', 'currency', 'status']:
        require(equal(field, candidate.get(field), PAYMENT[field]), 'Candidate differs: ' + field)
    require(candidate.get('evidenceEventId') == EVENT_ID, 'Candidate receipt identity differs.')
    events = [row for row in records['MurabahaAccountingEvent'] if row.get('payment_ID') == PAYMENT['ID']]
    require(len(events) == 1, 'Unexpected number of accounting events for payment.')
    event = one(events, 'ID', EVENT_ID)
    expected_event = {
        'payment_ID': PAYMENT['ID'], 'financing_ID': PAYMENT['financing_ID'],
        'installment_ID': PAYMENT['installment_ID'], 'correlationId': PAYMENT['externalPaymentId'],
        'amount': PAYMENT['amount'], 'currency': PAYMENT['currency'],
        'eventDate': PAYMENT['paymentDate'], 'eventType': 'PAYMENT_RECEIVED',
        'postingStatus': 'PENDING'
    }
    for field, value in expected_event.items():
        require(equal(field, event.get(field), value), 'Accounting evidence differs: ' + field)
    require(all(event.get(field) in [None, ''] for field in
                ['externalAccountingDocument', 'externalAccountingDocumentId',
                 'externalCompanyCode', 'externalFiscalYear']), 'Unexpected external accounting identity.')
    require(not any(row.get('payment_ID') == PAYMENT['ID'] for row in records['MurabahaPaymentReversal']),
            'Unexpected reversal evidence.')
    installment = one(records['MurabahaInstallment'], 'ID', PAYMENT['installment_ID'])
    require(installment.get('financing_ID') == PAYMENT['financing_ID'] and
            Decimal(str(installment.get('paidAmount'))) == Decimal('2.11') and
            Decimal(str(installment.get('installmentAmount'))) == Decimal('2200') and
            installment.get('status') == 'PARTIALLY_PAID', 'Installment no longer matches reviewed state.')
    financing = one(records['MurabahaFinancing'], 'ID', PAYMENT['financing_ID'])
    require(financing.get('finxactAccountId') == PAYMENT['sourceAccountId'] and
            financing.get('currency') == 'USD' and financing.get('status') == 'ACTIVE' and
            str(financing.get('contractReference', '')).startswith('MUR-FISERV-CERT-'),
            'Synthetic financing evidence differs.')
    expected_key = 'FISERV-' + hashlib.sha256(json.dumps([
        PAYMENT[field] for field in ['sourceEnvironment', 'sourceOrgId', 'sourceAccountId', 'sourceTransactionId']
    ], separators=(',', ':')).encode()).hexdigest()
    require(expected_key == PAYMENT['externalPaymentId'], 'Provider source identity hash differs.')
    return {
        'mode': 'OFFLINE_PLAN_ONLY', 'scope': 'ONE_SYNTHETIC_FISERV_PAYMENT',
        'evidence': 'Original successful CAP response pasted in this conversation, corroborated by snapshot and live review.',
        'proposedInsert': dict(PAYMENT),
        'unknownFields': ['sourceProviderReference: absent from original response; do not invent a value'],
        'existingAccountingEventId': EVENT_ID,
        'preserveExactly': ['All existing rows, installment paidAmount/status, financing status, and accounting event including postingStatus.'],
        'applyRequirements': [
            'Take a fresh snapshot and check live evidence again before any write.',
            'Use one database transaction; insert only this missing payment with the original ID.',
            'Do not invoke postPayment, allocation, reversal or SAP posting actions.',
            'Preserve the saved original managed timestamps and users; do not replace them with recovery time.',
            'Verify one added payment and all previously existing rows unchanged after restoration.'
        ],
        'otherRecoveryCandidates': 'Deferred; this plan does not approve the remaining 52 candidates.',
        'unresolvedHistory': 'Two blocked payments and six installment discrepancies remain unresolved.'
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True)
    args = parser.parse_args()
    directory = Path(args.snapshot).resolve()
    require(directory != Path.cwd().resolve() and Path.cwd().resolve() not in directory.parents,
            'Use the snapshot directory outside the repository.')
    manifest, records = validate_snapshot(directory)
    review_path = directory / 'payment-recovery-live-review.json'
    review = json.loads(review_path.read_text(encoding='utf-8'))
    require(review.get('snapshotCapturedAt') == manifest.get('capturedAt'), 'Live review belongs to another snapshot.')
    plan = make_plan(records, review)
    plan['snapshotCapturedAt'] = manifest.get('capturedAt')
    plan['snapshotChecksums'] = manifest['entities']
    plan['liveReviewSha256'] = hashlib.sha256(review_path.read_bytes()).hexdigest()
    target = directory / 'fiserv-payment-recovery-plan.json'
    target.write_text(json.dumps(plan, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'mode': plan['mode'], 'proposedPaymentId': PAYMENT['ID'],
                      'amount': PAYMENT['amount'], 'currency': PAYMENT['currency'],
                      'existingPaidAmountToPreserve': '2.11',
                      'accountingEventToPreserve': EVENT_ID, 'plan': str(target)}, indent=2))
    print('No network calls, database changes, payment actions or SAP postings performed.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, ArithmeticError) as error:
        print('Recovery plan stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
