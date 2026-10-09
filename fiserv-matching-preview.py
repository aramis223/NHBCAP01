#!/usr/bin/env python3
"""Read-only certification matching preview. Creates no payments or SAP entries."""
import argparse
import hashlib
import json
import os
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

CERT_ENVIRONMENT = 'https://bankinghub-cert.fiservapis.com/banking/efx/v1'


class PreviewError(Exception):
    pass


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def source_identity(environment, org, account, transaction):
    source = json.dumps([environment, org, account, transaction],
                        separators=(',', ':'), ensure_ascii=False)
    return 'FISERV-' + hashlib.sha256(source.encode('utf-8')).hexdigest()


def safe_url(base, path):
    target = urljoin(base, path)
    expected, actual = urlsplit(base), urlsplit(target)
    if (actual.scheme != 'https' or actual.netloc != expected.netloc
            or not actual.path.startswith(expected.path) or actual.fragment):
        raise PreviewError('CAP continuation URL left the configured service. Preview stopped.')
    return target


def collection(get, entity, filters, fields, max_pages):
    query = urlencode({'$filter': filters, '$select': fields}).replace('+', '%20')
    path = entity + '?' + query
    visited, records = set(), []
    for _ in range(max_pages):
        if path in visited:
            raise PreviewError('CAP collection repeated a continuation link. Preview stopped.')
        visited.add(path)
        data = get(path)
        if not isinstance(data.get('value'), list):
            raise PreviewError('CAP collection response has no record list.')
        records.extend(data['value'])
        next_path = data.get('@odata.nextLink')
        if not next_path:
            return records
        if not isinstance(next_path, str):
            raise PreviewError('CAP collection returned an invalid continuation link.')
        path = urljoin(path, next_path)
    raise PreviewError('CAP collection page limit reached. No complete preview produced.')


def transaction_pages(get, args):
    cursor = ''
    seen_cursors, seen_ids, records = set(), set(), []
    for page_number in range(1, args.max_pages + 1):
        seen_cursors.add(cursor)
        function = 'getFiservAccountTransactions(' + ','.join([
            'accountId=' + literal(args.account),
            'startDateTime=' + literal(args.start),
            'endDateTime=' + literal(args.end),
            "direction='Credit'", 'cursor=' + literal(cursor),
            'pageSize=' + str(args.page_size)
        ]) + ')'
        data = get(quote(function, safe="(),'="))
        if data.get('accountId') != args.account or not isinstance(data.get('transactions'), list):
            raise PreviewError('Invalid transaction page or unexpected account.')
        if type(data.get('hasMore')) is not bool or 'nextCursor' not in data:
            raise PreviewError('Pagination metadata missing. Deploy the cursor API first.')
        for record in data['transactions']:
            transaction_id = record.get('transactionId')
            if not isinstance(transaction_id, str) or not transaction_id or transaction_id in seen_ids:
                raise PreviewError('Missing or repeated transaction identity across pages. Preview stopped.')
            seen_ids.add(transaction_id)
            records.append(record)
        next_cursor = data['nextCursor']
        if not data['hasMore']:
            if next_cursor not in [None, '']:
                raise PreviewError('Inconsistent terminal-page metadata.')
            return records, page_number
        if not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen_cursors:
            raise PreviewError('Missing or repeated transaction cursor. Preview stopped.')
        cursor = next_cursor
    raise PreviewError('Transaction page limit reached. No complete preview produced.')


def money(value):
    try:
        result = Decimal(str(value))
        if not result.is_finite():
            raise InvalidOperation
        return result
    except (InvalidOperation, ValueError):
        raise PreviewError('Missing or invalid amount. Preview stopped.') from None


def build_preview(get, args):
    transactions, page_count = transaction_pages(get, args)
    financings = collection(get, 'MurabahaFinancing',
        'finxactAccountId eq ' + literal(args.account),
        'ID,contractReference,customer_ID,finxactAccountId,status,currency', args.max_pages)
    candidates = []
    for financing in financings:
        installments = collection(get, 'MurabahaInstallment',
            'financing_ID eq ' + financing['ID'],
            'ID,sequenceNumber,dueDate,installmentAmount,paidAmount,status', args.max_pages)
        for installment in installments:
            outstanding = money(installment['installmentAmount']) - money(installment['paidAmount'])
            if outstanding > 0:
                candidates.append((financing, installment, outstanding))

    previews = []
    for transaction in transactions:
        identity = source_identity(args.source_environment, args.org, args.account,
                                   transaction['transactionId'])
        # Match the same namespace and deterministic key enforced by allocation.
        # Reversed payments still reserve their source transaction identity.
        payments = collection(get, 'MurabahaPayment',
            'externalPaymentId eq ' + literal(identity),
            'ID,externalPaymentId,status,amount,currency,financing_ID,installment_ID', args.max_pages)
        comparisons = []
        for financing, installment, outstanding in candidates:
            blockers = []
            if payments:
                blockers.append('SOURCE_TRANSACTION_ALREADY_ALLOCATED')
            if financing['status'] not in ['ACTIVE', 'DEFAULTED']:
                blockers.append('FINANCING_NOT_ELIGIBLE')
            if not (financing.get('contractReference') or '').startswith('MUR-FISERV-CERT-'):
                blockers.append('NOT_SYNTHETIC_CERTIFICATION_FINANCING')
            if installment['status'] not in ['PENDING', 'PARTIALLY_PAID']:
                blockers.append('INSTALLMENT_STATUS_REQUIRES_REVIEW')
            if transaction.get('currency') != financing['currency']:
                blockers.append('CURRENCY_MISMATCH')
            if (transaction.get('direction') != 'Credit' or transaction.get('status') != 'Valid'
                    or transaction.get('memoPosted') is not False or transaction.get('source') != 'CORE'):
                blockers.append('TRANSACTION_NOT_CONFIRMED_POSTED_CORE_CREDIT')
            amount = money(transaction.get('amount'))
            if amount <= 0 or amount > outstanding:
                blockers.append('AMOUNT_OUTSIDE_INSTALLMENT_BALANCE')
            comparisons.append({
                'financingId': financing['ID'], 'contractReference': financing['contractReference'],
                'installmentId': installment['ID'], 'dueDate': installment['dueDate'],
                'outstandingAmount': str(outstanding), 'blockers': blockers,
                'decision': 'BLOCKED_FOR_THIS_CANDIDATE' if blockers else 'REVIEW_REQUIRED',
                'reason': 'Account linkage does not prove repayment purpose or installment allocation.'
            })
        previews.append({
            'transaction': transaction, 'externalPaymentId': identity,
            'allocationStatus': 'ALREADY_ALLOCATED' if payments else 'NOT_FOUND_IN_CAP',
            'existingPayments': payments, 'candidates': comparisons
        })
    return {
        'mode': 'READ_ONLY', 'accountId': args.account,
        'allocationAuditScope': {'sourceEnvironment': args.source_environment, 'orgId': args.org},
        'transactionPageCount': page_count, 'transactionCount': len(transactions),
        'filteredQueryExhausted': True,
        'alreadyAllocatedCount': sum(bool(item['existingPayments']) for item in previews),
        'warnings': [
            'Allocation audit uses the explicitly configured environment and organization; confirm they match CAP deployment.',
            'All cursor pages were followed for this filtered CORE Credit query, with amount range 1–20000. This is not unfiltered history.',
            'NOT_FOUND_IN_CAP means no payment with the deterministic source key was found; it is not proof of repayment eligibility.',
            'Certification fixture financing is synthetic. Ownership and repayment purpose are not verified.',
            'Reads are not a database or provider snapshot; allocation must revalidate current state.',
            'Allocation still queries its original five-record page; preview pagination does not extend allocation lookup.',
            'No automatic match or repayment classification is made. No payments or SAP postings are created.'
        ],
        'linkedFinancingCount': len(financings), 'preview': previews
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--account', default='110000000055')
    parser.add_argument('--start', default='2025-05-12T10:01:01.001')
    parser.add_argument('--end', default='2025-10-12T10:01:01.001')
    parser.add_argument('--page-size', type=int, choices=range(1, 6), default=2)
    parser.add_argument('--max-pages', type=int, default=100)
    parser.add_argument('--source-environment', default=CERT_ENVIRONMENT)
    parser.add_argument('--org', default='999990601')
    args = parser.parse_args()
    args.source_environment = args.source_environment.rstrip('/')
    if args.max_pages < 1 or args.source_environment != CERT_ENVIRONMENT or not args.org.strip():
        parser.error('Use a positive page limit, certification environment and nonempty organization.')
    app = os.environ.get('APP_URL', '').rstrip('/')
    token = os.environ.get('XSUAA_TOKEN', '')
    app_parts = urlsplit(app)
    if (app_parts.scheme != 'https' or not app_parts.netloc or app_parts.username
            or app_parts.query or app_parts.fragment or not token):
        raise SystemExit('Set APP_URL (HTTPS) and XSUAA_TOKEN in this terminal.')
    base = app + '/service/NHBCAP01Service/'

    def get(path):
        request = Request(safe_url(base, path), headers={
            'Authorization': 'Bearer ' + token, 'Accept': 'application/json'
        }, method='GET')
        try:
            with urlopen(request, timeout=100) as response:
                return json.load(response)
        except HTTPError as error:
            raise PreviewError(f'CAP request failed: HTTP {error.code}. No writes performed.') from None
        except (URLError, TimeoutError, json.JSONDecodeError):
            raise PreviewError('CAP request failed or returned invalid JSON. No writes performed.') from None

    try:
        result = build_preview(get, args)
    except PreviewError as error:
        raise SystemExit(str(error)) from None
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
