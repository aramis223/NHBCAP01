'use strict';

const crypto = require('crypto');
const { fetchWithTimeout } = require('../integration/http');
const { getAccessToken } = require('./auth');

function normalizeTransactionPagination({ cursor, pageSize } = {}) {
    cursor = cursor ?? '';
    pageSize = pageSize ?? 5;
    if (typeof cursor !== 'string' || cursor.length > 4096 || /[\x00-\x1f\x7f]/.test(cursor)) {
        throw new Error('cursor must be a string without control characters, at most 4096 characters.');
    }
    // Conservative application limit; this is not a claimed provider maximum.
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 5) {
        throw new Error('pageSize must be an integer from 1 to 5.');
    }
    return { cursor, pageSize };
}

async function getAccountTransactions(accountId, orgId, {
    startDateTime,
    endDateTime,
    direction = 'Debit',
    cursor,
    pageSize
}) {
    const baseUrl = process.env.FISERV_API_BASE_URL;

    if (!baseUrl || !accountId || !orgId) {
        throw new Error('Fiserv base URL, accountId and orgId are required');
    }

    if (!startDateTime || !endDateTime) {
        throw new Error('Transaction date range is required');
    }

    if (!['Debit', 'Credit'].includes(direction)) {
        throw new Error('Transaction direction must be Debit or Credit');
    }

    const pagination = normalizeTransactionPagination({ cursor, pageSize });

    const accessToken = await getAccessToken();

    const response = await fetchWithTimeout(
        `${baseUrl}/acctservice/acctmgmt/acctTrn/secured`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                EFXHeader: JSON.stringify({
                    OrganizationId: orgId,
                    TrnId: crypto.randomUUID()
                })
            },
            body: JSON.stringify({
                RecCtrlIn: {
                    MaxRecLimit: String(pagination.pageSize),
                    Cursor: pagination.cursor
                },
                AcctTrnSel: {
                    DrCrType: direction,
                    TrnSrc: ['CORE'],
                    AcctKeys: {
                        AcctId: accountId,
                        AcctType: 'DDA'
                    },
                    DtRange: [{
                        StartDt: startDateTime,
                        EndDt: endDateTime
                    }],
                    CurAmtRange: {
                        LowCurAmt: { Amt: 1 },
                        HighCurAmt: { Amt: 20000 }
                    },
                    Sort: [{
                        SortCriterionType: 'PostedDt',
                        SortOrder: 'Descending'
                    }]
                }
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Fiserv transaction history failed: HTTP ${response.status}`
        );
    }

    const data = await response.json();

    if (String(data.Status?.StatusCode) !== '0') {
        throw new Error(
            `Fiserv transaction history returned ${
                data.Status?.StatusCode ?? 'Unknown'
            }: ${data.Status?.StatusDesc ?? 'Unknown error'}`
        );
    }

    return data;
}

module.exports = { getAccountTransactions, normalizeTransactionPagination };
