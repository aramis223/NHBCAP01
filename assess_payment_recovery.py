#!/usr/bin/env python3
"""Assess a validated CAP snapshot offline. No network requests or database writes."""
import argparse
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import sys

from snapshot_cap_data import validate_snapshot


def amount(value):
    try:
        value = Decimal(str(value))
        if not value.is_finite() or value < 0 or value != value.quantize(Decimal('0.01')):
            raise InvalidOperation
        return value
    except (InvalidOperation, ValueError):
        raise ValueError('Invalid monetary amount in snapshot.') from None


def index(rows, entity):
    result = {}
    for row in rows:
        key = row.get('ID')
        if not key or key in result:
            raise ValueError('Missing or duplicated ID in ' + entity)
        result[key] = row
    return result


def assess(records):
    payments = index(records['MurabahaPayment'], 'payments')
    events = index(records['MurabahaAccountingEvent'], 'events')
    reversals = index(records['MurabahaPaymentReversal'], 'reversals')
    installments = index(records['MurabahaInstallment'], 'installments')
    financings = index(records['MurabahaFinancing'], 'financings')
    customers = index(records['Customer'], 'customers')
    received_by_payment, reversal_events_by_payment, reversals_by_payment = (
        defaultdict(list), defaultdict(list), defaultdict(list))
    events_without_payment = []
    for event in events.values():
        payment_id = event.get('payment_ID')
        if not payment_id:
            events_without_payment.append(event['ID'])
        elif event.get('eventType') == 'PAYMENT_RECEIVED':
            received_by_payment[payment_id].append(event)
        elif event.get('eventType') == 'PAYMENT_REVERSED':
            reversal_events_by_payment[payment_id].append(event)
    reversals_without_payment = []
    for reversal in reversals.values():
        if reversal.get('payment_ID'):
            reversals_by_payment[reversal['payment_ID']].append(reversal)
        else:
            reversals_without_payment.append(reversal['ID'])
    referenced_ids = {row['payment_ID'] for row in list(events.values()) + list(reversals.values())
                      if row.get('payment_ID')}
    missing_ids = referenced_ids - payments.keys()
    refs = defaultdict(set)
    for row in payments.values():
        if row.get('externalPaymentId'):
            refs[row['externalPaymentId']].add(row['ID'])
    for payment_id, receipts in received_by_payment.items():
        for receipt in receipts:
            if receipt.get('correlationId'):
                refs[receipt['correlationId']].add(payment_id)

    recovery = []
    for payment_id in sorted(missing_ids):
        receipts = received_by_payment[payment_id]
        reversal_rows = reversals_by_payment[payment_id]
        reversal_events = reversal_events_by_payment[payment_id]
        blockers = []
        core = None
        if len(receipts) != 1:
            blockers.append('NO_UNIQUE_PAYMENT_RECEIVED_EVENT')
        else:
            receipt = receipts[0]
            core = {
                'ID': payment_id,
                'financing_ID': receipt.get('financing_ID'),
                'installment_ID': receipt.get('installment_ID'),
                'externalPaymentId': receipt.get('correlationId'),
                'paymentDate': receipt.get('eventDate'),
                'amount': receipt.get('amount'), 'currency': receipt.get('currency')
            }
            if any(core[field] in [None, ''] for field in core):
                blockers.append('INCOMPLETE_RECEIPT_EVIDENCE')
            if not core['externalPaymentId'] or len(str(core['externalPaymentId'])) > 100:
                blockers.append('INVALID_OR_MISSING_EXTERNAL_PAYMENT_REFERENCE')
            elif len(refs[core['externalPaymentId']]) > 1:
                blockers.append('EXTERNAL_REFERENCE_CONFLICT')
            financing = financings.get(core['financing_ID'])
            installment = installments.get(core['installment_ID'])
            if not financing:
                blockers.append('FINANCING_MISSING')
            elif financing.get('customer_ID') not in customers:
                blockers.append('FINANCING_CUSTOMER_MISSING')
            if not installment:
                blockers.append('INSTALLMENT_MISSING')
            elif installment.get('financing_ID') != core['financing_ID']:
                blockers.append('INSTALLMENT_FINANCING_MISMATCH')
            if financing and core['currency'] != financing.get('currency'):
                blockers.append('CURRENCY_MISMATCH')
            if amount(core['amount']) <= 0:
                blockers.append('NONPOSITIVE_RECEIPT_AMOUNT')
            for related in reversal_rows + reversal_events:
                if any(related.get(field) != core[field]
                       for field in ['financing_ID', 'installment_ID', 'currency']):
                    blockers.append('REVERSAL_IDENTITY_MISMATCH')
                if amount(related.get('amount')) != amount(core['amount']):
                    blockers.append('REVERSAL_AMOUNT_MISMATCH')
        if len(reversal_rows) > 1 or len(reversal_events) > 1:
            blockers.append('MULTIPLE_REVERSAL_RECORDS')
        if bool(reversal_rows) != bool(reversal_events):
            blockers.append('REVERSAL_RECORD_EVENT_DISAGREEMENT')
        recovery.append({
            'paymentId': payment_id,
            'decision': 'INSUFFICIENT_OR_CONFLICTING_EVIDENCE' if blockers else 'CORE_EVIDENCE_AVAILABLE_REQUIRES_REVIEW',
            'blockers': sorted(set(blockers)),
            'coreFieldsFromReceiptEvent': core,
            'statusIndicatedByReversalEvidence': 'REVERSED' if reversal_rows or reversal_events else 'POSTED',
            'receiptEventIds': [r['ID'] for r in receipts],
            'reversalIds': [r['ID'] for r in reversal_rows],
            'reversalEventIds': [r['ID'] for r in reversal_events],
            'postedAccountingEventIds': [r['ID'] for r in receipts + reversal_events if r.get('postingStatus') == 'POSTED'],
            'unknownFields': ['original createdAt/createdBy/modifiedAt/modifiedBy',
                              'provider audit fields unless recovered from independent evidence']
        })

    installment_report = []
    for installment_id, installment in sorted(installments.items()):
        receipts = [row for row in events.values() if row.get('eventType') == 'PAYMENT_RECEIVED'
                    and row.get('installment_ID') == installment_id]
        reversal_rows = [row for row in reversals.values() if row.get('installment_ID') == installment_id]
        reversal_events = [row for row in events.values() if row.get('eventType') == 'PAYMENT_REVERSED'
                           and row.get('installment_ID') == installment_id]
        receipt_ids = {row.get('payment_ID') for row in receipts}
        # Include surviving seeded payments that never had an accounting event.
        payment_only_rows = [row for row in payments.values()
                             if row.get('installment_ID') == installment_id and row['ID'] not in receipt_ids]
        known_receipts = sum((amount(row.get('amount')) for row in receipts), Decimal(0))
        known_receipts += sum((amount(row.get('amount')) for row in payment_only_rows), Decimal(0))
        known_reversals = sum((amount(row.get('amount')) for row in reversal_rows), Decimal(0))
        net = known_receipts - known_reversals
        paid = amount(installment.get('paidAmount'))
        issues = []
        if len(receipts) != len(receipt_ids):
            issues.append('DUPLICATE_RECEIPT_EVIDENCE')
        if any(row.get('payment_ID') not in receipt_ids | {r['ID'] for r in payment_only_rows}
               for row in reversal_rows):
            issues.append('REVERSAL_WITHOUT_ORIGINAL_RECEIPT_EVIDENCE')
        if {row.get('payment_ID') for row in reversal_rows} != {row.get('payment_ID') for row in reversal_events}:
            issues.append('REVERSAL_RECORD_EVENT_DISAGREEMENT')
        financing = financings.get(installment.get('financing_ID'))
        if not financing:
            issues.append('FINANCING_MISSING')
        else:
            if any(row.get('currency') != financing.get('currency') for row in receipts + reversal_rows + payment_only_rows):
                issues.append('CURRENCY_MISMATCH_IN_EVIDENCE')
            if any(row.get('financing_ID') != financing['ID'] for row in receipts + reversal_rows + payment_only_rows):
                issues.append('FINANCING_MISMATCH_IN_EVIDENCE')
        if net != paid:
            issues.append('EVIDENCE_NET_DIFFERS_FROM_STORED_PAID_AMOUNT')
        if any(row.get('status') not in ['POSTED', 'REVERSED'] for row in payment_only_rows):
            issues.append('UNEXPECTED_SURVIVING_PAYMENT_STATUS')
        if any(row.get('status') == 'REVERSED' and row['ID'] not in reversals_by_payment for row in payment_only_rows):
            issues.append('REVERSED_PAYMENT_WITHOUT_REVERSAL_ROW')
        if receipts or reversal_rows or reversal_events or payment_only_rows or paid:
            installment_report.append({
                'installmentId': installment_id, 'financingId': installment.get('financing_ID'),
                'storedPaidAmount': str(paid), 'receiptEvidenceAmount': str(known_receipts),
                'reversalRecordAmount': str(known_reversals), 'evidenceNetAmount': str(net),
                'issues': sorted(set(issues)),
                'decision': 'REQUIRES_RECONCILIATION' if issues else 'EVIDENCE_TOTAL_MATCHES_STORED_BALANCE'
            })
    by_installment = {row['installmentId']: row for row in installment_report}
    for row in recovery:
        core = row['coreFieldsFromReceiptEvent']
        row['installmentReconciliation'] = by_installment.get(core['installment_ID']) if core else None
        if row['installmentReconciliation'] and row['installmentReconciliation']['issues']:
            row['blockers'].append('INSTALLMENT_RECONCILIATION_REQUIRED')
            row['decision'] = 'INSUFFICIENT_OR_CONFLICTING_EVIDENCE'
    orphan_events = [row for row in events.values() if row.get('payment_ID') in missing_ids]
    return {
        'mode': 'OFFLINE_READ_ONLY_ASSESSMENT',
        'summary': {
            'missingPaymentIdCount': len(missing_ids),
            'accountingEventsReferencingMissingPayments': len(orphan_events),
            'reversalsReferencingMissingPayments': sum(row.get('payment_ID') in missing_ids for row in reversals.values()),
            'missingPaymentsWithoutUniqueReceiptEvent': sum(len(received_by_payment[key]) != 1 for key in missing_ids),
            'postedAccountingEventsReferencingMissingPayments': sum(row.get('postingStatus') == 'POSTED' for row in orphan_events),
            'coreEvidenceAvailableRequiringReview': sum(row['decision'] == 'CORE_EVIDENCE_AVAILABLE_REQUIRES_REVIEW' for row in recovery),
            'missingPaymentsWithBlockers': sum(bool(row['blockers']) for row in recovery),
            'installmentsCompared': len(installment_report),
            'installmentsRequiringReconciliation': sum(bool(row['issues']) for row in installment_report),
            'decisionCounts': dict(Counter(row['decision'] for row in recovery))
        },
        'warnings': [
            'This report is not an executable repair plan and does not authorize replaying payments or SAP postings.',
            'Evidence totals are incomplete where source records are missing; a total matching a balance alone does not prove completeness.',
            'Accounting posting status is separate from local payment status; FAILED SAP events can still represent recorded CAP payments.',
            'Preserve existing accounting events, document identities and balances; do not recreate them through payment actions.',
            'Receipt correlation IDs and event dates are proposed evidence for original payment references and dates, requiring review.',
            'Provider audit fields and original managed timestamps must come from independent evidence; they are not invented here.'
        ],
        'eventsWithoutPaymentId': events_without_payment,
        'reversalsWithoutPaymentId': reversals_without_payment,
        'missingPayments': recovery, 'installmentReconciliation': installment_report
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True)
    args = parser.parse_args()
    directory = Path(args.snapshot).resolve()
    manifest, records = validate_snapshot(directory)
    report = assess(records)
    report['snapshotCapturedAt'] = manifest['capturedAt']
    report['appUrl'] = manifest['appUrl']
    target = directory / 'payment-recovery-assessment.json'
    target.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report['summary'], indent=2))
    print('Detailed assessment saved outside the repository: ' + str(target))
    print('No network calls, payment restoration, balance changes or SAP postings performed.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print('Assessment stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
