require('dotenv').config();

const cds = require('@sap/cds');
const { getAccountDetails } = require('./fiserv/accounts');

const CONTRACT_STATUSES = new Set([
    'DRAFT',
    'QUOTED',
    'APPROVED',
    'CREDIT_APPROVED',
    'SHARIA_APPROVED',
    'ASSET_PURCHASED',
    'ASSET_ACQUIRED',
    'OFFERED',
    'CONTRACT_EXECUTED',
    'DELIVERED',
    'ACTIVE',
    'SETTLED',
    'CANCELLED',
    'DEFAULTED'
]);

const CREDIT_DECISION_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);
const SHARIA_APPROVAL_STATUSES = new Set([
    'PENDING',
    'APPROVED',
    'REWORK_REQUIRED',
    'REJECTED'
]);

const INSTALLMENT_STATUSES = new Set([
    'PENDING',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'WAIVED'
]);

const PAYMENT_STATUSES = new Set([
    'RECEIVED',
    'POSTED',
    'REVERSED',
    'FAILED'
]);

const amount = value => value === undefined || value === null
    ? undefined
    : Number(value);

const validateNonNegative = (req, field, value) => {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        req.error(400, field, field + ' must be a non-negative amount.');
    }
};

module.exports = cds.service.impl(async function () {
    const db = await cds.connect.to('db');
    const { MurabahaFinancing } = this.entities;
    const {
        MurabahaFinancing: FinancingDB,
        MurabahaInstallment: InstallmentDB,
        MurabahaPayment: PaymentDB,
        MurabahaPaymentReversal: ReversalDB
    } = cds.entities('NHBCAP01');

    console.log('Fiserv environment check:', {
        baseUrl: !!process.env.FISERV_API_BASE_URL,
        tokenUrl: !!process.env.FISERV_TOKEN_URL,
        apiKey: !!process.env.FISERV_API_KEY,
        apiSecret: !!process.env.FISERV_API_SECRET,
        accountId: !!process.env.FISERV_TEST_ACCOUNT_ID,
        orgId: !!process.env.FISERV_ORG_ID
    });

    this.before(['CREATE', 'UPDATE'], 'MurabahaFinancing', async req => {
        const data = req.data;
        const financingId = data.ID || req.params?.[0]?.ID;
        const current = req.event === 'UPDATE' && financingId
            ? await db.run(SELECT.one.from(MurabahaFinancing).where({ ID: financingId }))
            : {};
        const state = { ...current, ...data };
        const assetCost = amount(data.assetCost);
        const profitAmount = amount(data.profitAmount);
        const salePrice = amount(data.salePrice);

        validateNonNegative(req, 'assetCost', assetCost);
        validateNonNegative(req, 'profitAmount', profitAmount);
        validateNonNegative(req, 'salePrice', salePrice);

        if (assetCost !== undefined && profitAmount !== undefined) {
            const expectedSalePrice = Number((assetCost + profitAmount).toFixed(2));

            if (salePrice === undefined) {
                data.salePrice = expectedSalePrice;
            } else if (Math.abs(salePrice - expectedSalePrice) > 0.009) {
                req.error(
                    400,
                    'salePrice',
                    'salePrice must equal assetCost plus profitAmount.'
                );
            }
        }

        if (data.status && !CONTRACT_STATUSES.has(data.status)) {
            req.error(400, 'status', 'Unsupported Murabaha contract status.');
        }

        if (
            state.contractDate &&
            state.maturityDate &&
            new Date(state.maturityDate) < new Date(state.contractDate)
        ) {
            req.error(
                400,
                'maturityDate',
                'maturityDate cannot be earlier than contractDate.'
            );
        }

        if (state.creditDecisionStatus && !CREDIT_DECISION_STATUSES.has(state.creditDecisionStatus)) {
            req.error(400, 'creditDecisionStatus', 'Unsupported credit decision status.');
        }

        if (state.shariaApprovalStatus && !SHARIA_APPROVAL_STATUSES.has(state.shariaApprovalStatus)) {
            req.error(400, 'shariaApprovalStatus', 'Unsupported Sharia approval status.');
        }

        const ownershipRequiredStatuses = new Set([
            'ASSET_PURCHASED', 'ASSET_ACQUIRED', 'CONTRACT_EXECUTED',
            'DELIVERED', 'ACTIVE', 'SETTLED'
        ]);
        const contractRequiredStatuses = new Set([
            'CONTRACT_EXECUTED', 'DELIVERED', 'ACTIVE', 'SETTLED'
        ]);
        const deliveryRequiredStatuses = new Set(['DELIVERED', 'ACTIVE', 'SETTLED']);

        if (ownershipRequiredStatuses.has(state.status)) {
            if (state.creditDecisionStatus !== 'APPROVED') {
                req.error(400, 'creditDecisionStatus', 'Credit approval is required before asset acquisition.');
            }
            if (state.shariaApprovalStatus !== 'APPROVED') {
                req.error(400, 'shariaApprovalStatus', 'Sharia approval is required before asset acquisition.');
            }
            if (!state.bankOwnershipRecorded || !state.ownershipEvidenceReference) {
                req.error(400, 'bankOwnershipRecorded', 'Bank ownership evidence is required before the Murabaha sale.');
            }
        }

        if (contractRequiredStatuses.has(state.status) && (!state.saleContractExecutedOn || !state.saleContractReference)) {
            req.error(400, 'saleContractExecutedOn', 'Executed Murabaha sale-contract evidence is required.');
        }

        if (deliveryRequiredStatuses.has(state.status) && (!state.assetDeliveredOn || !state.deliveryEvidenceReference)) {
            req.error(400, 'assetDeliveredOn', 'Asset delivery and acceptance evidence is required before activation.');
        }
    });

    this.before(['CREATE', 'UPDATE'], 'MurabahaInstallment', req => {
        const data = req.data;
        const principal = amount(data.principalAmount);
        const profit = amount(data.profitAmount);
        const installment = amount(data.installmentAmount);
        const paid = amount(data.paidAmount);

        if (data.sequenceNumber !== undefined && data.sequenceNumber < 1) {
            req.error(400, 'sequenceNumber', 'sequenceNumber must be greater than zero.');
        }

        validateNonNegative(req, 'principalAmount', principal);
        validateNonNegative(req, 'profitAmount', profit);
        validateNonNegative(req, 'installmentAmount', installment);
        validateNonNegative(req, 'paidAmount', paid);

        if (principal !== undefined && profit !== undefined) {
            const expectedInstallment = Number((principal + profit).toFixed(2));

            if (installment === undefined) {
                data.installmentAmount = expectedInstallment;
            } else if (Math.abs(installment - expectedInstallment) > 0.009) {
                req.error(
                    400,
                    'installmentAmount',
                    'installmentAmount must equal principalAmount plus profitAmount.'
                );
            }
        }

        if (
            paid !== undefined &&
            installment !== undefined &&
            paid > installment
        ) {
            req.error(400, 'paidAmount', 'paidAmount cannot exceed installmentAmount.');
        }

        if (data.status && !INSTALLMENT_STATUSES.has(data.status)) {
            req.error(400, 'status', 'Unsupported Murabaha installment status.');
        }
    });

    this.before(['CREATE', 'UPDATE'], 'MurabahaPayment', req => {
        const data = req.data;
        const paymentAmount = amount(data.amount);

        if (
            paymentAmount !== undefined &&
            (!Number.isFinite(paymentAmount) || paymentAmount <= 0)
        ) {
            req.error(400, 'amount', 'Payment amount must be greater than zero.');
        }

        if (data.status && !PAYMENT_STATUSES.has(data.status)) {
            req.error(400, 'status', 'Unsupported Murabaha payment status.');
        }
    });


    this.before('CREATE', 'MurabahaPayment', req => {
        req.reject(405, 'Use postMurabahaPayment to create payments safely.');
    });

    const postPayment = async (req, financingId, installmentId, paymentData) => {
        const {
            externalPaymentId,
            paymentDate,
            amount: paymentValue,
            currency
        } = paymentData;
        const paymentAmount = amount(paymentValue);

        if (!financingId || !installmentId || !externalPaymentId || !paymentDate) {
            return req.reject(400, 'Financing, installment, external payment ID, and payment date are required.');
        }
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return req.reject(400, 'Payment amount must be greater than zero.');
        }

        const tx = db;
        const financing = await tx.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }
        if (!['ACTIVE', 'DEFAULTED'].includes(financing.status)) {
            return req.reject(409, 'Payments can only be posted to an active or defaulted financing.');
        }

        const installment = await tx.run(
            SELECT.one.from(InstallmentDB).where({ ID: installmentId })
        );
        if (!installment || installment.financing_ID !== financingId) {
            return req.reject(404, 'The installment does not belong to this financing.');
        }

        const paymentCurrency = (currency || financing.currency || '').toUpperCase();
        if (!paymentCurrency || paymentCurrency !== financing.currency) {
            return req.reject(400, 'Payment currency must match the financing currency.');
        }

        const duplicate = await tx.run(
            SELECT.one.from(PaymentDB).where({ externalPaymentId })
        );
        if (duplicate) {
            return req.reject(409, 'A payment with this external payment ID already exists.');
        }

        const installmentAmount = amount(installment.installmentAmount);
        const paidAmount = amount(installment.paidAmount) || 0;
        const outstandingAmount = Number((installmentAmount - paidAmount).toFixed(2));
        if (paymentAmount - outstandingAmount > 0.009) {
            return req.reject(409, 'Payment amount exceeds the outstanding installment balance.');
        }

        const newPaidAmount = Number((paidAmount + paymentAmount).toFixed(2));
        const newInstallmentStatus = Math.abs(newPaidAmount - installmentAmount) <= 0.009
            ? 'PAID'
            : 'PARTIALLY_PAID';
        const paymentId = cds.utils.uuid();

        await tx.run(
            INSERT.into(PaymentDB).entries({
                ID: paymentId,
                financing_ID: financingId,
                installment_ID: installmentId,
                externalPaymentId,
                paymentDate,
                amount: paymentAmount,
                currency: paymentCurrency,
                status: 'POSTED'
            })
        );
        await tx.run(
            UPDATE(InstallmentDB)
                .set({ paidAmount: newPaidAmount, status: newInstallmentStatus })
                .where({ ID: installmentId })
        );

        const installments = await tx.run(
            SELECT.from(InstallmentDB)
                .columns('ID', 'status')
                .where({ financing_ID: financingId })
        );
        const allPaid = installments.length > 0 && installments.every(item =>
            item.ID === installmentId ? newInstallmentStatus === 'PAID' : item.status === 'PAID'
        );
        if (allPaid) {
            await tx.run(
                UPDATE(FinancingDB).set({ status: 'SETTLED' }).where({ ID: financingId })
            );
        }

        return tx.run(SELECT.one.from(PaymentDB).where({ ID: paymentId }));
    };

    this.on('postMurabahaPayment', req =>
        postPayment(req, req.data.financingId, req.data.installmentId, req.data)
    );

    this.on('postPayment', 'MurabahaInstallment', async req => {
        const installmentId = req.params?.[0]?.ID;
        const installment = installmentId
            ? await db.run(SELECT.one.from(InstallmentDB).where({ ID: installmentId }))
            : null;
        if (!installment) {
            return req.reject(404, 'Murabaha installment was not found.');
        }
        return postPayment(req, installment.financing_ID, installmentId, req.data);
    });

    this.on('reverseMurabahaPayment', async req => {
        const { paymentId, externalReversalId, reversalDate, reason } = req.data;
        const reference = externalReversalId?.trim();
        const explanation = reason?.trim();
        if (!paymentId || !reference || !reversalDate || !explanation) {
            return req.reject(400, 'Payment ID, reversal reference, date, and reason are required.');
        }

        // The request's managed transaction keeps the audit record and balance update together.
        const payment = await db.run(
            SELECT.one.from(PaymentDB).where({ ID: paymentId })
        );
        if (!payment) {
            return req.reject(404, 'Murabaha payment was not found.');
        }
        if (payment.status !== 'POSTED') {
            return req.reject(409, 'Only a posted payment can be reversed; this payment may already be reversed.');
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: payment.financing_ID })
        );
        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }
        if (financing.status === 'SETTLED') {
            return req.reject(409, 'A settled financing cannot be reversed without an approved adjustment workflow.');
        }

        const duplicateReference = await db.run(
            SELECT.one.from(ReversalDB).where({ externalReversalId: reference })
        );
        if (duplicateReference) {
            return req.reject(409, 'A reversal with this external reversal ID already exists.');
        }
        const priorReversal = await db.run(
            SELECT.one.from(ReversalDB).where({ payment_ID: paymentId })
        );
        if (priorReversal) {
            return req.reject(409, 'This payment has already been reversed.');
        }

        const installment = await db.run(
            SELECT.one.from(InstallmentDB).where({ ID: payment.installment_ID })
        );
        if (!installment || installment.financing_ID !== payment.financing_ID) {
            return req.reject(409, 'The original payment installment is inconsistent.');
        }
        const paymentAmount = amount(payment.amount);
        const paidAmount = amount(installment.paidAmount) || 0;
        if (!Number.isFinite(paymentAmount) || paidAmount - paymentAmount < -0.009) {
            return req.reject(409, 'The installment balance cannot support this reversal.');
        }
        const newPaidAmount = Number((paidAmount - paymentAmount).toFixed(2));
        const newInstallmentStatus = newPaidAmount <= 0.009
            ? 'PENDING'
            : Math.abs(newPaidAmount - amount(installment.installmentAmount)) <= 0.009
                ? 'PAID'
                : 'PARTIALLY_PAID';
        const reversalId = cds.utils.uuid();

        await db.run(
            INSERT.into(ReversalDB).entries({
                ID: reversalId,
                payment_ID: paymentId,
                financing_ID: payment.financing_ID,
                installment_ID: payment.installment_ID,
                externalReversalId: reference,
                reversalDate,
                reason: explanation,
                amount: paymentAmount,
                currency: payment.currency
            })
        );
        await db.run(
            UPDATE(PaymentDB).set({ status: 'REVERSED' }).where({ ID: paymentId })
        );
        await db.run(
            UPDATE(InstallmentDB)
                .set({ paidAmount: newPaidAmount, status: newInstallmentStatus })
                .where({ ID: payment.installment_ID })
        );

        return db.run(SELECT.one.from(ReversalDB).where({ ID: reversalId }));
    });

    this.on('getFiservAccountDetails', async req => {
        const { accountId } = req.data;

        if (!accountId) {
            return req.reject(400, 'Fiserv accountId is required.');
        }

        try {
            const data = await getAccountDetails(
                accountId,
                process.env.FISERV_ORG_ID
            );
            const account = data.AcctRec;
            const depositInfo = account.DepositAcctInfo;

            return {
                accountId: account.AcctKeys.AcctId,
                accountType: account.AcctKeys.AcctType,
                description: depositInfo.Desc,
                currency: depositInfo.CurCode?.CurCodeValue,
                accountTitle: depositInfo.AcctTitle,
                openDate: depositInfo.OpenDt,
                status: account.AcctStatus?.AcctStatusCode,
                balances: (depositInfo.AcctBal || []).map(balance => ({
                    balanceType: balance.BalType,
                    amount: balance.CurAmt?.Amt,
                    currency: balance.CurAmt?.CurCode?.CurCodeValue
                }))
            };
        } catch (error) {
            console.error('Fiserv account request failed:', error);
            return req.reject(502, 'Fiserv service is currently unavailable.');
        }
    });
});
