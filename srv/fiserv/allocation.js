'use strict';

const crypto = require('crypto');
const cds = require('@sap/cds');
const { getAccountTransactions } = require('./transactions');

function reject(code, message) {
    const error = new Error(message);
    error.statusCode = code;
    throw error;
}

function validDateTime(value) {
    if (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?$/.test(value)) return false;
    const normalized = value.length === 19 ? `${value}.000` : value;
    const date = new Date(`${normalized}Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, -1) === normalized;
}

function validateInput(data) {
    for (const field of ['accountId', 'transactionId', 'allocationReason']) {
        const max = field === 'allocationReason' ? 500 : 100;
        if (typeof data[field] !== 'string' || !data[field].trim() ||
            data[field].length > max || data[field] !== data[field].trim()) {
            reject(400, `${field} is required, must fit its field length, and have no surrounding whitespace.`);
        }
    }
    if (!data.financingId || !data.installmentId || data.confirmSyntheticAllocation !== true) {
        reject(400, 'Financing, installment and explicit synthetic allocation confirmation are required.');
    }
    if (!validDateTime(data.startDateTime) || !validDateTime(data.endDateTime) ||
        Date.parse(`${data.startDateTime}Z`) > Date.parse(`${data.endDateTime}Z`)) {
        reject(400, 'Supply an ordered provider date-time range without a timezone.');
    }
}

function selectTransaction(data, transactionId, start, end) {
    if (!Array.isArray(data.AcctTrnRec)) reject(502, 'Fiserv returned no transaction array.');
    const matches = data.AcctTrnRec.filter(record => record.AcctTrnKeys?.AcctTrnId === transactionId);
    if (matches.length !== 1) {
        reject(409, 'Selected transaction was not uniquely found in the limited inquiry page. No allocation made.');
    }
    const record = matches[0];
    const info = record.AcctTrnInfo || {};
    if (info.DrCrType !== 'Credit' || info.TrnSrc !== 'CORE' ||
        info.MemoPostInd !== false || record.AcctTrnStatus?.AcctTrnStatusCode !== 'Valid') {
        reject(409, 'Selected transaction must be a Valid, non-memo CORE credit.');
    }
    // Enum values and linkage semantics are not yet verified. Fail closed
    // for every populated marker, including whitespace and unknown values.
    if (info.TrnRevType != null && info.TrnRevType !== '') {
        reject(409, 'Transactions with a reversal or adjustment marker require review. No allocation made.');
    }
    if (info.SPRefIdent != null &&
        (typeof info.SPRefIdent !== 'string' || info.SPRefIdent.length > 36)) {
        reject(409, 'Provider reference must be a string of at most 36 characters.');
    }
    if (!validDateTime(info.PostedDt) ||
        Date.parse(`${info.PostedDt}Z`) < Date.parse(`${start}Z`) ||
        Date.parse(`${info.PostedDt}Z`) > Date.parse(`${end}Z`)) {
        reject(409, 'Provider posting date is invalid or outside the selected range.');
    }
    const value = String(info.TrnAmt?.Amt ?? '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0) {
        reject(409, 'Provider transaction amount must be positive with at most two decimals.');
    }
    const currency = info.TrnAmt?.CurCode?.CurCodeValue;
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
        reject(409, 'Provider currency is missing or invalid.');
    }
    return { amount: value, currency, postedDateTime: info.PostedDt,
        providerReference: info.SPRefIdent ?? null };
}

function sourceIdentity(environment, orgId, accountId, transactionId) {
    return 'FISERV-' + crypto.createHash('sha256')
        .update(JSON.stringify([environment, orgId, accountId, transactionId]))
        .digest('hex');
}

function registerFiservAllocation(service, { db, FinancingDB, PaymentDB, postPayment }) {
    service.on('allocateFiservCertificationTransaction', async req => {
        const input = req.data;
        try { validateInput(input); }
        catch (error) { return req.reject(error.statusCode, error.message); }

        const environment = (process.env.FISERV_API_BASE_URL || '').replace(/\/+$/, '');
        const orgId = process.env.FISERV_ORG_ID || '';
        if (environment !== 'https://bankinghub-cert.fiservapis.com/banking/efx/v1' ||
            !orgId || orgId.length > 100) {
            return req.reject(409, 'This action is restricted to the verified Fiserv certification environment.');
        }
        const financing = await db.run(cds.ql.SELECT.one.from(FinancingDB)
            .where({ ID: input.financingId }));
        if (!financing) return req.reject(404, 'Murabaha financing was not found.');
        if (!financing.contractReference?.startsWith('MUR-FISERV-CERT-') ||
            financing.finxactAccountId !== input.accountId) {
            return req.reject(409, 'Use a synthetic Fiserv certification financing linked to the selected account.');
        }
        if (!['ACTIVE', 'DEFAULTED'].includes(financing.status)) {
            return req.reject(409, 'Financing is not eligible to receive a payment.');
        }
        const externalPaymentId = sourceIdentity(environment, orgId, input.accountId, input.transactionId);
        const existing = await db.run(cds.ql.SELECT.one.from(PaymentDB).where({ externalPaymentId }));
        if (existing) return req.reject(409, 'This Fiserv source transaction has already been allocated.');

        let provider;
        try {
            provider = await getAccountTransactions(input.accountId, orgId, {
                startDateTime: input.startDateTime,
                endDateTime: input.endDateTime,
                direction: 'Credit'
            });
        } catch (error) {
            console.error('Fiserv allocation inquiry failed:', error.name);
            return req.reject(502, 'Fiserv transaction inquiry is currently unavailable.');
        }
        let selected;
        try { selected = selectTransaction(provider, input.transactionId, input.startDateTime, input.endDateTime); }
        catch (error) { return req.reject(error.statusCode, error.message); }

        // postPayment validates installment membership, currency and balance.
        const payment = await postPayment(req, input.financingId, input.installmentId, {
            externalPaymentId,
            paymentDate: selected.postedDateTime.slice(0, 10),
            amount: selected.amount,
            currency: selected.currency
        });
        // Saved in the same CAP request transaction as the payment and event.
        await db.run(cds.ql.UPDATE(PaymentDB).set({
            sourceProvider: 'FISERV', sourceEnvironment: environment,
            sourceOrgId: orgId, sourceAccountId: input.accountId,
            sourceTransactionId: input.transactionId,
            sourcePostedDateTime: selected.postedDateTime,
            sourceProviderReference: selected.providerReference,
            allocationReason: input.allocationReason
        }).where({ ID: payment.ID }));
        return db.run(cds.ql.SELECT.one.from(PaymentDB).where({ ID: payment.ID }));
    });
}

module.exports = { registerFiservAllocation, validateInput, selectTransaction, sourceIdentity };
