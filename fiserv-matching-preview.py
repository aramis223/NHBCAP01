#!/usr/bin/env python3
"""Read-only certification matching preview. Creates no payments or SAP entries."""
import argparse
import json
import os
from decimal import Decimal
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--account', default='110000000055')
    parser.add_argument('--start', default='2025-05-12T10:01:01.001')
    parser.add_argument('--end', default='2025-10-12T10:01:01.001')
    args = parser.parse_args()
    app = os.environ.get('APP_URL', '').rstrip('/')
    token = os.environ.get('XSUAA_TOKEN', '')
    if not app.startswith('https://') or not token:
        raise SystemExit('Set APP_URL (HTTPS) and XSUAA_TOKEN in this terminal.')
    base = app + '/service/NHBCAP01Service/'

    def get(path):
        request = Request(base + path, headers={
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/json'
        })
        try:
            with urlopen(request, timeout=100) as response:
                return json.load(response)
        except HTTPError as error:
            raise SystemExit(f'CAP request failed: HTTP {error.code}. No writes performed.')

    def literal(value):
        return "'" + value.replace("'", "''") + "'"

    def collection(entity, filters, fields):
        query = urlencode({'$filter': filters, '$select': fields}).replace('+', '%20')
        data = get(entity + '?' + query)
        if data.get('@odata.nextLink'):
            raise SystemExit('CAP collection is paginated. Preview stopped to avoid incomplete candidate matching.')
        return data.get('value', [])

    function = 'getFiservAccountTransactions(' + ','.join([
        'accountId=' + literal(args.account),
        'startDateTime=' + literal(args.start),
        'endDateTime=' + literal(args.end),
        "direction='Credit'"
    ]) + ')'
    # Encode only the OData argument content; retain its structural syntax.
    from urllib.parse import quote
    transactions = get(quote(function, safe="(),'=|"))['transactions']
    financings = collection('MurabahaFinancing',
        'finxactAccountId eq ' + literal(args.account),
        'ID,contractReference,customer_ID,finxactAccountId,status,currency')
    candidates = []
    for financing in financings:
        installments = collection('MurabahaInstallment',
            'financing_ID eq ' + financing['ID'],
            'ID,sequenceNumber,dueDate,installmentAmount,paidAmount,status')
        for installment in installments:
            outstanding = Decimal(str(installment['installmentAmount'])) - Decimal(str(installment['paidAmount']))
            if outstanding > 0:
                candidates.append((financing, installment, outstanding))

    previews = []
    for transaction in transactions:
        comparisons = []
        for financing, installment, outstanding in candidates:
            blockers = []
            if financing['status'] != 'ACTIVE':
                blockers.append('FINANCING_NOT_ACTIVE')
            if installment['status'] not in ['PENDING', 'PARTIALLY_PAID']:
                blockers.append('INSTALLMENT_STATUS_REQUIRES_REVIEW')
            if transaction.get('currency') != financing['currency']:
                blockers.append('CURRENCY_MISMATCH')
            if transaction.get('direction') != 'Credit' or transaction.get('status') != 'Valid' or transaction.get('memoPosted') is not False:
                blockers.append('TRANSACTION_NOT_CONFIRMED_POSTED_CREDIT')
            amount = Decimal(str(transaction['amount']))
            if amount <= 0 or amount > outstanding:
                blockers.append('AMOUNT_OUTSIDE_INSTALLMENT_BALANCE')
            comparisons.append({
                'financingId': financing['ID'],
                'contractReference': financing['contractReference'],
                'installmentId': installment['ID'],
                'dueDate': installment['dueDate'],
                'outstandingAmount': str(outstanding),
                'blockers': blockers,
                'decision': 'BLOCKED_FOR_THIS_CANDIDATE' if blockers else 'REVIEW_REQUIRED',
                'reason': 'Account linkage does not prove repayment purpose or installment allocation.'
            })
        previews.append({'transaction': transaction, 'candidates': comparisons})

    print(json.dumps({
        'mode': 'READ_ONLY',
        'accountId': args.account,
        'warnings': [
            'Certification fixture financing is synthetic.',
            'Transactions are limited to the first five CORE credits with amount range 1–20000; completeness is unverified.',
            'Ownership, payment reference, prior ingestion and allocation policies are not verified by this script.',
            'No automatic match or repayment classification is made. No payments or SAP postings are created.'
        ],
        'linkedFinancingCount': len(financings),
        'preview': previews
    }, indent=2))


if __name__ == '__main__':
    main()
