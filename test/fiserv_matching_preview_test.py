import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from urllib.parse import unquote

spec = importlib.util.spec_from_file_location('preview',
    Path(__file__).resolve().parents[1] / 'fiserv-matching-preview.py')
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


def arguments(**changes):
    values = dict(account='110000000055', start='2025-05-12T10:01:01.001',
        end='2025-10-12T10:01:01.001', max_pages=100, page_size=2,
        source_environment=preview.CERT_ENVIRONMENT, org='999990601')
    return SimpleNamespace(**(values | changes))


def page(ids, cursor=None):
    return dict(accountId='110000000055', nextCursor=cursor, hasMore=bool(cursor),
        transactions=[dict(transactionId=value, amount='2.11', currency='USD',
            direction='Credit', status='Valid', memoPosted=False, source='CORE') for value in ids])


class PreviewTests(unittest.TestCase):
    def test_identity_matches_live_allocation(self):
        self.assertEqual(preview.source_identity(preview.CERT_ENVIRONMENT, '999990601',
            '110000000055', '53SWeKZRHsGoRjibWoKPEYQI'),
            'FISERV-1186528d489f56cd749bf516d993d4b7f1045ee144bd1eb65c8ee9e1cc71a3e7')
        self.assertNotEqual(preview.source_identity('other', '999990601', '110000000055', 'x'),
                            preview.source_identity(preview.CERT_ENVIRONMENT, '999990601', '110000000055', 'x'))

    def test_three_pages_keep_filters_and_encode_opaque_cursor(self):
        pages = iter([page(['a', 'b'], "opaque+/='"), page(['c', 'd'], 'last'), page(['e'])])
        paths = []
        def get(path):
            paths.append(path)
            return next(pages)
        records, count = preview.transaction_pages(get, arguments())
        self.assertEqual(count, 3)
        self.assertEqual([r['transactionId'] for r in records], list('abcde'))
        self.assertIn("cursor='opaque%2B%2F=''", paths[1])
        for path in paths:
            decoded = unquote(path)
            self.assertIn("accountId='110000000055'", decoded)
            self.assertIn("startDateTime='2025-05-12T10:01:01.001'", decoded)
            self.assertIn("endDateTime='2025-10-12T10:01:01.001'", decoded)
            self.assertIn("direction='Credit'", decoded)
            self.assertIn('pageSize=2', decoded)

    def test_repeated_cursor_or_transaction_stops(self):
        for pages in ([page(['a'], 'loop'), page(['b'], 'loop')],
                      [page(['a'], 'next'), page(['a'])]):
            iterator = iter(pages)
            with self.assertRaises(preview.PreviewError):
                preview.transaction_pages(lambda _: next(iterator), arguments())

    def test_limit_and_missing_metadata_stop(self):
        with self.assertRaisesRegex(preview.PreviewError, 'page limit'):
            preview.transaction_pages(lambda _: page(['a'], 'next'), arguments(max_pages=1))
        data = page(['a'])
        del data['hasMore']
        with self.assertRaisesRegex(preview.PreviewError, 'metadata missing'):
            preview.transaction_pages(lambda _: data, arguments())

    def test_cap_collections_follow_query_relative_next_link(self):
        paths = []
        def get(path):
            paths.append(path)
            if len(paths) == 1:
                return {'value': [{'ID': 'one'}], '@odata.nextLink': '?$skiptoken=next'}
            return {'value': [{'ID': 'two'}]}
        records = preview.collection(get, 'MurabahaPayment', "externalPaymentId eq 'x'", 'ID', 5)
        self.assertEqual([r['ID'] for r in records], ['one', 'two'])
        self.assertEqual(paths[1], 'MurabahaPayment?$skiptoken=next')
        with self.assertRaises(preview.PreviewError):
            preview.collection(lambda _: {'value': [], '@odata.nextLink': '?again'},
                               'MurabahaPayment', '', 'ID', 5)

    def test_next_links_stay_within_service(self):
        base = 'https://app.example/service/NHBCAP01Service/'
        self.assertEqual(preview.safe_url(base, '/service/NHBCAP01Service/MurabahaPayment'),
                         base + 'MurabahaPayment')
        for link in ['https://evil.example/data', '//evil.example/data',
                     '/service/other/Payments', '../other/Payments']:
            with self.assertRaises(preview.PreviewError):
                preview.safe_url(base, link)

    def test_allocated_transaction_is_blocked_even_when_reversed(self):
        target = '53SWeKZRHsGoRjibWoKPEYQI'
        key = preview.source_identity(preview.CERT_ENVIRONMENT, '999990601', '110000000055', target)
        requests = []
        def get(path):
            requests.append(path)
            if path.startswith('getFiserv'):
                result = page([target, 'unallocated', 'deposit'])
                result['transactions'][-1]['amount'] = '10000.00'
                return result
            if path.startswith('MurabahaFinancing'):
                return {'value': [dict(ID='fin', contractReference='MUR-FISERV-CERT-fin',
                    status='ACTIVE', currency='USD')]}
            if path.startswith('MurabahaInstallment'):
                return {'value': [dict(ID='inst', dueDate='2026-05-16', installmentAmount='2200.00',
                    paidAmount='2.11', status='PARTIALLY_PAID')]}
            if path.startswith('MurabahaPayment'):
                return {'value': [dict(ID='payment', status='REVERSED')] if key in path else []}
            self.fail('Unexpected request: ' + path)
        result = preview.build_preview(get, arguments())
        self.assertEqual(result['mode'], 'READ_ONLY')
        self.assertEqual(result['alreadyAllocatedCount'], 1)
        first, second, third = result['preview']
        self.assertEqual(first['allocationStatus'], 'ALREADY_ALLOCATED')
        self.assertIn('SOURCE_TRANSACTION_ALREADY_ALLOCATED', first['candidates'][0]['blockers'])
        self.assertEqual(first['candidates'][0]['decision'], 'BLOCKED_FOR_THIS_CANDIDATE')
        self.assertEqual(second['allocationStatus'], 'NOT_FOUND_IN_CAP')
        self.assertEqual(second['candidates'][0]['decision'], 'REVIEW_REQUIRED')
        self.assertEqual(second['candidates'][0]['outstandingAmount'], '2197.89')
        self.assertIn('AMOUNT_OUTSIDE_INSTALLMENT_BALANCE', third['candidates'][0]['blockers'])
        self.assertTrue(all('allocateFiserv' not in path and 'postAccounting' not in path for path in requests))

    def test_invalid_money_stops(self):
        for amount in [None, 'NaN', 'Infinity', 'bad']:
            with self.assertRaises(preview.PreviewError):
                preview.money(amount)


if __name__ == '__main__':
    unittest.main()
