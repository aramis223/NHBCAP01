import unittest
from assess_payment_recovery import assess


def records():
    return {
        'Customer': [{'ID': 'customer'}], 'Account': [],
        'MurabahaFinancing': [{'ID': 'fin', 'customer_ID': 'customer', 'currency': 'USD'}],
        'MurabahaInstallment': [{'ID': 'inst', 'financing_ID': 'fin', 'paidAmount': '2.11'}],
        'MurabahaPayment': [], 'MurabahaPaymentReversal': [],
        'MurabahaAccountingEvent': [dict(ID='event', payment_ID='lost', financing_ID='fin',
            installment_ID='inst', eventType='PAYMENT_RECEIVED', postingStatus='PENDING',
            correlationId='FISERV-reference', eventDate='2025-06-09', amount='2.11', currency='USD')]
    }


class RecoveryAssessmentTests(unittest.TestCase):
    def test_single_missing_payment_preserves_evidence_and_balance(self):
        data = records()
        result = assess(data)
        self.assertEqual(result['summary']['missingPaymentIdCount'], 1)
        self.assertEqual(result['summary']['coreEvidenceAvailableRequiringReview'], 1)
        row = result['missingPayments'][0]
        self.assertEqual(row['coreFieldsFromReceiptEvent']['ID'], 'lost')
        self.assertEqual(row['coreFieldsFromReceiptEvent']['externalPaymentId'], 'FISERV-reference')
        self.assertEqual(row['installmentReconciliation']['evidenceNetAmount'], '2.11')
        self.assertEqual(data['MurabahaInstallment'][0]['paidAmount'], '2.11')
        self.assertEqual(len(data['MurabahaPayment']), 0)

    def test_failed_sap_posting_still_counts_as_local_payment_evidence(self):
        data = records()
        data['MurabahaAccountingEvent'][0]['postingStatus'] = 'FAILED'
        row = assess(data)['missingPayments'][0]
        self.assertEqual(row['statusIndicatedByReversalEvidence'], 'POSTED')
        self.assertEqual(row['installmentReconciliation']['evidenceNetAmount'], '2.11')

    def test_reversal_with_original_receipt_and_event_nets_to_zero(self):
        data = records()
        reversal = dict(ID='reversal', payment_ID='lost', financing_ID='fin', installment_ID='inst',
                        amount='2.11', currency='USD')
        data['MurabahaPaymentReversal'] = [reversal]
        data['MurabahaAccountingEvent'].append(dict(reversal, ID='reversal-event',
            eventType='PAYMENT_REVERSED', postingStatus='POSTED'))
        data['MurabahaInstallment'][0]['paidAmount'] = '0.00'
        result = assess(data)
        self.assertEqual(result['summary']['missingPaymentIdCount'], 1)
        self.assertEqual(result['summary']['postedAccountingEventsReferencingMissingPayments'], 1)
        self.assertEqual(result['missingPayments'][0]['statusIndicatedByReversalEvidence'], 'REVERSED')
        self.assertEqual(result['missingPayments'][0]['blockers'], [])
        self.assertEqual(result['installmentReconciliation'][0]['evidenceNetAmount'], '0.00')

    def test_reversal_without_receipt_is_blocked(self):
        data = records()
        data['MurabahaAccountingEvent'] = []
        data['MurabahaPaymentReversal'] = [dict(ID='reversal', payment_ID='lost', financing_ID='fin',
            installment_ID='inst', amount='2.11', currency='USD')]
        result = assess(data)
        self.assertEqual(result['summary']['missingPaymentsWithoutUniqueReceiptEvent'], 1)
        self.assertIn('NO_UNIQUE_PAYMENT_RECEIVED_EVENT', result['missingPayments'][0]['blockers'])
        self.assertIn('REVERSAL_WITHOUT_ORIGINAL_RECEIPT_EVIDENCE',
                      result['installmentReconciliation'][0]['issues'])

    def test_balance_mismatch_or_reference_collision_blocks_review_candidate(self):
        data = records()
        data['MurabahaInstallment'][0]['paidAmount'] = '0.00'
        self.assertIn('INSTALLMENT_RECONCILIATION_REQUIRED', assess(data)['missingPayments'][0]['blockers'])
        data = records()
        data['MurabahaPayment'] = [dict(ID='other', externalPaymentId='FISERV-reference',
            installment_ID='other-inst', financing_ID='fin', status='POSTED', amount='2.11', currency='USD')]
        self.assertIn('EXTERNAL_REFERENCE_CONFLICT', assess(data)['missingPayments'][0]['blockers'])

    def test_seeded_payment_without_accounting_event_is_counted_once(self):
        data = records()
        data['MurabahaPayment'] = [dict(ID='seed', externalPaymentId='SEED', financing_ID='fin',
            installment_ID='inst', status='POSTED', amount='10.00', currency='USD')]
        data['MurabahaInstallment'][0]['paidAmount'] = '12.11'
        row = assess(data)['installmentReconciliation'][0]
        self.assertEqual(row['evidenceNetAmount'], '12.11')
        self.assertEqual(row['issues'], [])


if __name__ == '__main__':
    unittest.main()
