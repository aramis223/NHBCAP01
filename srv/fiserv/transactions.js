'use strict';

const crypto = require('crypto');
const { fetchWithTimeout } = require('../integration/http');
const { getAccessToken } = require('./auth');

async function getAccountTransactions(accountId, orgId, {
    startDateTime,
    endDateTime,
    direction = 'Debit'
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
                    MaxRecLimit: '5',
                    Cursor: ''
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

module.exports = { getAccountTransactions };
