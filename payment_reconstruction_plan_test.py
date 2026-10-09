import copy
import json
import unittest

from assess_payment_recovery import assess
from payment_recovery_assessment_test import records
from plan_reconstructed_payments import templates


def live_review(data):
    result = assess(data)
    return {'mode': 'LIVE_READ_ONLY_REVIEW', 'verifiedCollectionCount': 7,
            'candidates': [{**r['coreFieldsFromReceiptEvent'],
                            'status': r['statusIndicatedByReversalEvidence'],
                            'evidenceEventId': r['receiptEventIds'][0]}
                           for r in result['missingPayments'] if not r['blockers']]}


class ReconstructionPlanTests(unittest.TestCase):
    def test_unknown_audit_fields_remain_null_with_separate_recovery_metadata(self):
        data = records()
        result = templates(data, live_review(data), {})
        row = result['templates'][0]['recordTemplate']
        self.assertEqual(row['recoveryStatus'], 'RECONSTRUCTED')
        self.assertTrue(row['originalAuditUnavailable'])
        self.assertTrue(row['sourceAuditUnavailable'])
        for field in ['createdAt', 'createdBy', 'modifiedAt', 'modifiedBy', 'sourceTransactionId']:
            self.assertIsNone(row[field])
        self.assertNotIn('recoveredAt', row)
        self.assertNotIn('recoveredBy', row)

    def test_source_prefix_does_not_invent_provider_audit(self):
        data = records()
        row = templates(data, live_review(data), {})['templates'][0]['recordTemplate']
        self.assertTrue(row['externalPaymentId'].startswith('FISERV-'))
        self.assertIsNone(row['sourceProvider'])

    def test_accounting_identity_and_original_records_preserved(self):
        data = records()
        data['MurabahaAccountingEvent'][0].update(postingStatus='POSTED', externalAccountingDocumentId='62')
        before = copy.deepcopy(data)
        result = templates(data, live_review(data), {'test': 'checksum'})
        self.assertEqual(before, data)
        self.assertEqual(result['templates'][0]['accountingEventsToPreserveExactly'][0]['externalAccountingDocumentId'], '62')
        evidence = json.loads(result['templates'][0]['recordTemplate']['recoveryEvidence'])
        self.assertEqual(evidence['snapshotChecksums'], {'test': 'checksum'})
        self.assertEqual(evidence['receiptEventIds'], ['event'])

    def test_reversed_status_requires_reversal_row_and_event(self):
        data = records()
        reversal = dict(ID='rev', payment_ID='lost', financing_ID='fin', installment_ID='inst', amount='2.11', currency='USD')
        data['MurabahaPaymentReversal'] = [reversal]
        data['MurabahaAccountingEvent'].append(dict(reversal, ID='rev-event', eventType='PAYMENT_REVERSED', postingStatus='PENDING'))
        data['MurabahaInstallment'][0]['paidAmount'] = '0.00'
        row = templates(data, live_review(data), {})['templates'][0]
        self.assertEqual(row['recordTemplate']['status'], 'REVERSED')
        self.assertEqual(json.loads(row['recordTemplate']['recoveryEvidence'])['reversalRecordIds'], ['rev'])

    def test_changed_core_evidence_is_rejected(self):
        data = records()
        live = live_review(data)
        live['candidates'][0]['amount'] = '20.00'
        with self.assertRaises(ValueError):
            templates(data, live, {})

    def test_conflicting_installment_is_excluded(self):
        data = records()
        data['MurabahaInstallment'][0]['paidAmount'] = '200.00'
        result = templates(data, live_review(data), {})
        self.assertEqual(result['summary']['templateCount'], 0)
        self.assertEqual(result['summary']['approvedForInsertion'], 0)
        self.assertEqual(result['summary']['excludedPaymentCount'], 1)


if __name__ == '__main__':
    unittest.main()
