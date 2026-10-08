require('dotenv').config();

const cds = require('@sap/cds');
const { getPartyList, getParty } = require('./fiserv/parties');
const { getAccountDetails } = require('./fiserv/accounts');
const { getAccountTransactions } = require('./fiserv/transactions');
const {
    postJournalEntry,
    postJournalEntryReversal
} = require('./sap/accounting');
const {
    getAccountingConfig,
    getAccountingReversalConfig
} = require('./sap/config');
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

const parseEqFilters = where => {
    const filters = {};

    if (!Array.isArray(where) || where.length === 0) {
        return filters;
    }

    for (let i = 0; i < where.length; i += 4) {
        const field = where[i]?.ref?.[0];
        const operator = where[i + 1];
        const value = where[i + 2]?.val;

        if (!field || operator !== '=') {
            continue;
        }

        filters[field] = value;

        if (i + 3 < where.length && where[i + 3] !== 'and') {
            break;
        }
    }

    return filters;
};

const mapPartyToNHBCustomer = party => {
    const personInfo = party.PersonPartyInfo;
    const orgInfo = party.OrgPartyInfo;

    return {
        CustomerNumber: party.PartyKeys?.PartyId,
        Name: personInfo?.PersonData?.PersonName?.[0]?.FullName
            || orgInfo?.OrgData?.OrgName?.[0]?.Name
            || null,
        CustomerType: personInfo
            ? 'Individual'
            : orgInfo
                ? 'Corporate'
                : null
    };
};

const mapPartyListRecordToNHBCustomer = party => {
    const partyId = party.PartyKeys?.PartyId;

    if (!partyId) {
        console.warn(
            'Skipping Fiserv Party List record without PartyId:',
            {
                name:
                    party.PersonPartyListInfo?.PersonName?.FullName
                    || party.OrgPartyListInfo?.OrgName?.Name
                    || null,
                taxIdentType:
                    party.PersonPartyListInfo?.TaxIdentType
                    || party.OrgPartyListInfo?.TaxIdentType
                    || null,
                taxIdent:
                    party.PersonPartyListInfo?.TaxIdent
                    || party.OrgPartyListInfo?.TaxIdent
                    || null
            }
        );

        return null;

    }

    const personInfo = party.PersonPartyListInfo;
    const orgInfo = party.OrgPartyListInfo;

    return {
        CustomerNumber: partyId,
        Name: personInfo?.PersonName?.FullName
            || orgInfo?.OrgName?.Name
            || null,
        CustomerType: personInfo
            ? 'Individual'
            : orgInfo
                ? 'Corporate'
                : null
    };
};
module.exports = cds.service.impl(async function () {
    const db = await cds.connect.to('db');
    const { MurabahaFinancing } = this.entities;
    const {
        MurabahaFinancing: FinancingDB,
        MurabahaInstallment: InstallmentDB,
        MurabahaPayment: PaymentDB,
        MurabahaPaymentReversal: ReversalDB,
        MurabahaAccountingEvent: AccountingEventDB
    } = cds.entities('NHBCAP01');

    this.before(['CREATE', 'UPDATE'], 'MurabahaFinancing', async req => {
        const data = req.data;
        const financingId = data.ID || req.params?.[0]?.ID;
        const current = req.event === 'UPDATE' && financingId
            ? await db.run(SELECT.one.from(MurabahaFinancing).where({ ID: financingId }))
            : {};
        const state = { ...current, ...data };
        if (req.event === 'CREATE' && data.status && data.status !== 'DRAFT') {
            return req.reject(
                409,
                'New Murabaha financing must start in DRAFT status.'
            );
        }

        if (
            req.event === 'UPDATE' &&
            data.status &&
            current?.status &&
            data.status !== current.status
        ) {
            return req.reject(
                409,
                'Murabaha lifecycle status cannot be changed directly; use the governed lifecycle actions.'
            );
        }
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

    this.on('recordCreditDecision', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            decisionStatus,
            decisionDate,
            decisionReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (!decisionStatus || !CREDIT_DECISION_STATUSES.has(decisionStatus)) {
            return req.reject(400, 'A valid credit decision status is required.');
        }

        if (!decisionDate || !decisionReference?.trim()) {
            return req.reject(400, 'Credit decision date and reference are required.');
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'DRAFT') {
            return req.reject(
                409,
                'Credit decision can only be recorded while the financing is in DRAFT status.'
            );
        }

        const newStatus = decisionStatus === 'APPROVED'
            ? 'CREDIT_APPROVED'
            : 'DRAFT';

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    creditDecisionStatus: decisionStatus,
                    creditDecisionDate: decisionDate,
                    creditDecisionReference: decisionReference.trim(),
                    status: newStatus
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('recordShariaDecision', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            approvalStatus,
            approvalDate,
            approvalReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (!approvalStatus || !SHARIA_APPROVAL_STATUSES.has(approvalStatus)) {
            return req.reject(400, 'A valid Sharia approval status is required.');
        }

        if (!approvalDate || !approvalReference?.trim()) {
            return req.reject(400, 'Sharia approval date and reference are required.');
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'CREDIT_APPROVED') {
            return req.reject(
                409,
                'Sharia decision can only be recorded after credit approval.'
            );
        }

        const newStatus = approvalStatus === 'APPROVED'
            ? 'SHARIA_APPROVED'
            : 'CREDIT_APPROVED';

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    shariaApprovalStatus: approvalStatus,
                    shariaApprovalDate: approvalDate,
                    shariaApprovalReference: approvalReference.trim(),
                    status: newStatus
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('recordAssetAcquisition', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            acquisitionDate,
            evidenceReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (!acquisitionDate || !evidenceReference?.trim()) {
            return req.reject(
                400,
                'Asset acquisition date and ownership evidence reference are required.'
            );
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'SHARIA_APPROVED') {
            return req.reject(
                409,
                'Asset acquisition can only be recorded after Sharia approval.'
            );
        }

        if (financing.creditDecisionStatus !== 'APPROVED') {
            return req.reject(
                409,
                'Credit approval is required before asset acquisition.'
            );
        }

        if (financing.shariaApprovalStatus !== 'APPROVED') {
            return req.reject(
                409,
                'Sharia approval is required before asset acquisition.'
            );
        }

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    bankOwnershipRecorded: true,
                    assetAcquisitionDate: acquisitionDate,
                    ownershipEvidenceReference: evidenceReference.trim(),
                    status: 'ASSET_ACQUIRED'
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('executeSaleContract', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            executionDate,
            contractReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (!executionDate || !contractReference?.trim()) {
            return req.reject(
                400,
                'Sale contract execution date and reference are required.'
            );
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'ASSET_ACQUIRED') {
            return req.reject(
                409,
                'Murabaha sale contract can only be executed after asset acquisition.'
            );
        }

        if (!financing.bankOwnershipRecorded || !financing.ownershipEvidenceReference) {
            return req.reject(
                409,
                'Bank ownership evidence is required before executing the Murabaha sale contract.'
            );
        }

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    saleContractExecutedOn: executionDate,
                    saleContractReference: contractReference.trim(),
                    status: 'CONTRACT_EXECUTED'
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('confirmAssetDelivery', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            deliveryDate,
            evidenceReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (!deliveryDate || !evidenceReference?.trim()) {
            return req.reject(
                400,
                'Asset delivery date and evidence reference are required.'
            );
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'CONTRACT_EXECUTED') {
            return req.reject(
                409,
                'Asset delivery can only be confirmed after execution of the Murabaha sale contract.'
            );
        }

        if (!financing.saleContractExecutedOn || !financing.saleContractReference) {
            return req.reject(
                409,
                'Executed Murabaha sale-contract evidence is required before asset delivery.'
            );
        }

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    assetDeliveredOn: deliveryDate,
                    deliveryEvidenceReference: evidenceReference.trim(),
                    status: 'DELIVERED'
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('activateFinancing', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'DELIVERED') {
            return req.reject(
                409,
                'Financing can only be activated after confirmed asset delivery.'
            );
        }

        if (!financing.assetDeliveredOn || !financing.deliveryEvidenceReference) {
            return req.reject(
                409,
                'Asset delivery evidence is required before financing activation.'
            );
        }

        await db.run(
            UPDATE(FinancingDB)
                .set({ status: 'ACTIVE' })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('cancelFinancing', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            cancellationDate,
            cancellationReason,
            cancellationReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (
            !cancellationDate ||
            !cancellationReason?.trim() ||
            !cancellationReference?.trim()
        ) {
            return req.reject(
                400,
                'Cancellation date, reason, and reference are required.'
            );
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        const cancellableStatuses = new Set([
            'DRAFT',
            'CREDIT_APPROVED',
            'SHARIA_APPROVED',
            'ASSET_ACQUIRED',
            'CONTRACT_EXECUTED',
            'DELIVERED'
        ]);

        if (!cancellableStatuses.has(financing.status)) {
            return req.reject(
                409,
                `Financing cannot be cancelled from status ${financing.status}.`
            );
        }

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    cancellationDate,
                    cancellationReason: cancellationReason.trim(),
                    cancellationReference: cancellationReference.trim(),
                    status: 'CANCELLED'
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
    });

    this.on('markFinancingDefaulted', 'MurabahaFinancing', async req => {
        const financingId = req.params?.[0]?.ID;
        const {
            defaultDate,
            defaultReason,
            defaultReference
        } = req.data;

        if (!financingId) {
            return req.reject(400, 'Murabaha financing ID is required.');
        }

        if (!defaultDate || !defaultReason?.trim() || !defaultReference?.trim()) {
            return req.reject(
                400,
                'Default date, reason, and reference are required.'
            );
        }

        const financing = await db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );

        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }

        if (financing.status !== 'ACTIVE') {
            return req.reject(
                409,
                'Only an ACTIVE financing can be marked DEFAULTED.'
            );
        }

        await db.run(
            UPDATE(FinancingDB)
                .set({
                    defaultDate,
                    defaultReason: defaultReason.trim(),
                    defaultReference: defaultReference.trim(),
                    status: 'DEFAULTED'
                })
                .where({ ID: financingId })
        );

        return db.run(
            SELECT.one.from(FinancingDB).where({ ID: financingId })
        );
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
            INSERT.into(AccountingEventDB).entries({
                ID: cds.utils.uuid(),
                eventType: 'PAYMENT_RECEIVED',
                payment_ID: paymentId,
                financing_ID: financingId,
                installment_ID: installmentId,
                eventDate: paymentDate,
                amount: paymentAmount,
                currency: paymentCurrency,
                correlationId: externalPaymentId,
                postingStatus: 'PENDING'
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
            return req.reject(
                400,
                'Payment ID, reversal reference, date, and reason are required.'
            );
        }

        const tx = db;

        // The request's managed transaction keeps the audit record and balance update together.
        const payment = await tx.run(
            SELECT.one.from(PaymentDB).where({ ID: paymentId })
        );
        if (!payment) {
            return req.reject(404, 'Murabaha payment was not found.');
        }
        if (payment.status !== 'POSTED') {
            return req.reject(409, 'Only a posted payment can be reversed; this payment may already be reversed.');
        }

        const financing = await tx.run(
            SELECT.one.from(FinancingDB).where({ ID: payment.financing_ID })
        );
        if (!financing) {
            return req.reject(404, 'Murabaha financing was not found.');
        }
        if (financing.status === 'SETTLED') {
            return req.reject(409, 'A settled financing cannot be reversed without an approved adjustment workflow.');
        }

        const duplicateReference = await tx.run(
            SELECT.one.from(ReversalDB).where({ externalReversalId: reference })
        );
        if (duplicateReference) {
            return req.reject(409, 'A reversal with this external reversal ID already exists.');
        }
        const priorReversal = await tx.run(
            SELECT.one.from(ReversalDB).where({ payment_ID: paymentId })
        );
        if (priorReversal) {
            return req.reject(409, 'This payment has already been reversed.');
        }

        const installment = await tx.run(
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

        await tx.run(
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
        await tx.run(
            UPDATE(PaymentDB).set({ status: 'REVERSED' }).where({ ID: paymentId })
        );
        await tx.run(
            UPDATE(InstallmentDB)
                .set({ paidAmount: newPaidAmount, status: newInstallmentStatus })
                .where({ ID: payment.installment_ID })
        );

        await tx.run(
            INSERT.into(AccountingEventDB).entries({
                ID: cds.utils.uuid(),
                eventType: 'PAYMENT_REVERSED',
                payment_ID: paymentId,
                financing_ID: payment.financing_ID,
                installment_ID: payment.installment_ID,
                eventDate: reversalDate,
                amount: paymentAmount,
                currency: payment.currency,
                correlationId: reference,
                postingStatus: 'PENDING'
            })
        );

        return tx.run(SELECT.one.from(ReversalDB).where({ ID: reversalId }));
    });

    this.on('postAccountingEvent', async req => {
        const { accountingEventId } = req.data;

        if (!accountingEventId) {
            return req.reject(
                400,
                'Accounting event ID is required.'
            );
        }

        const tx = db;

        const accountingEvent = await tx.run(
            SELECT.one
                .from(AccountingEventDB)
                .where({ ID: accountingEventId })
        );

        if (!accountingEvent) {
            return req.reject(
                404,
                'Murabaha accounting event was not found.'
            );
        }

        if (accountingEvent.postingStatus !== 'PENDING') {
            return req.reject(
                409,
                'Only a pending accounting event can be submitted for posting.'
            );
        }
if (
    !['PAYMENT_RECEIVED', 'PAYMENT_REVERSED']
        .includes(accountingEvent.eventType)
) {
    return req.reject(
        400,
        'Unsupported Murabaha accounting event type.'
    );
}

const eventAmount = amount(accountingEvent.amount);

if (!Number.isFinite(eventAmount) || eventAmount <= 0) {
    return req.reject(
        400,
        'Accounting event amount must be greater than zero.'
    );
}

if (!accountingEvent.currency) {
    return req.reject(
        400,
        'Accounting event currency is required.'
    );
}

if (!accountingEvent.correlationId) {
    return req.reject(
        400,
        'Accounting event correlation ID is required.'
    );
}

if (
    !accountingEvent.payment_ID ||
    !accountingEvent.financing_ID ||
    !accountingEvent.installment_ID
) {
    return req.reject(
        409,
        'Accounting event is missing Murabaha traceability references.'
    );
}

let accountingConfig;
let originalPosting;

try {
    if (accountingEvent.eventType === 'PAYMENT_REVERSED') {
        accountingConfig =
            getAccountingReversalConfig();

        originalPosting = await tx.run(
            SELECT.one
                .from(AccountingEventDB)
                .where({
                    payment_ID:
                        accountingEvent.payment_ID,
                    eventType:
                        'PAYMENT_RECEIVED'
                })
        );

        if (!originalPosting) {
            return req.reject(
                409,
                'Original payment accounting event was not found.'
            );
        }

        if (
            originalPosting.postingStatus !==
            'POSTED'
        ) {
            return req.reject(
                409,
                'Original payment accounting event has not been posted to SAP.'
            );
        }

        if (
            !originalPosting.externalAccountingDocument ||
            !originalPosting.externalCompanyCode ||
            !originalPosting.externalFiscalYear
        ) {
            return req.reject(
                409,
                'Original SAP accounting document identity is incomplete.'
            );
        }

    } else {
        accountingConfig =
            getAccountingConfig();
    }

} catch (error) {
    return req.reject(
        500,
        error.message
    );
}

try {
    const postingResult =
        accountingEvent.eventType === 'PAYMENT_REVERSED'
            ? await postJournalEntryReversal(
                accountingEvent,
                accountingConfig,
                originalPosting
            )
            : await postJournalEntry(
                accountingEvent,
                accountingConfig
            );

    await tx.run(
        UPDATE(AccountingEventDB)
            .set({
                postingStatus: 'POSTED',
                externalAccountingDocument:
                    postingResult.accountingDocument,
                externalCompanyCode:
                    postingResult.companyCode,
                externalFiscalYear:
                    postingResult.fiscalYear,
                externalAccountingDocumentId:
                    postingResult.externalAccountingDocumentId,
                errorMessage: null
            })
            .where({ ID: accountingEventId })
    );

    return tx.run(
        SELECT.one
            .from(AccountingEventDB)
            .where({ ID: accountingEventId })
    );

} catch (error) {
    const errorMessage =
        String(error?.message || error)
            .slice(0, 500);

    await tx.run(
        UPDATE(AccountingEventDB)
            .set({
                postingStatus: 'FAILED',
                errorMessage
            })
            .where({ ID: accountingEventId })
    );

    return tx.run(
        SELECT.one
            .from(AccountingEventDB)
            .where({ ID: accountingEventId })
    );
}
});

    this.on('READ', 'NHBCustomer', async req => {
        const customerNumber = req.data?.CustomerNumber;
        if (customerNumber) {
            try {
                const data = await getParty(
                    customerNumber,
                    process.env.FISERV_ORG_ID
                );

                const party = data.PartyRec;
                return mapPartyToNHBCustomer(party);

            } catch (error) {
                console.error('Fiserv Get Party request failed:', error);
                return req.reject(502, 'Fiserv service is currently unavailable.');
            }
        }
        try {
            const where = req.query.SELECT?.where;
            const filters = parseEqFilters(where);
            const nameFilter = filters.Name || null;
            const customerTypeFilter = filters.CustomerType || null;

            const data = await getPartyList(
                process.env.FISERV_ORG_ID,
                nameFilter ? { name: nameFilter } : {}
            );

            const parties = data.PartyListRec || [];

            const customers = parties
                .map(mapPartyListRecordToNHBCustomer)
                .filter(Boolean)
                .filter(customer =>
                    !customerTypeFilter ||
                    customer.CustomerType === customerTypeFilter
                );

            const limit = req.query.SELECT?.limit;

            const top = limit?.rows?.val;
            const skip = limit?.offset?.val || 0;

            if (top !== undefined) {
                return customers.slice(skip, skip + top);
            }

            if (skip) {
                return customers.slice(skip);
            }
            return customers;
        } catch (error) {
            console.error('Fiserv party list request failed:', error);
            return req.reject(502, 'Fiserv service is currently unavailable.');
        }
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
    this.on('getFiservAccountTransactions', async req => {
        const { accountId, startDateTime, endDateTime, direction } = req.data;
        if (!accountId || !startDateTime || !endDateTime) {
            return req.reject(400, 'accountId, startDateTime and endDateTime are required.');
        }
        if (!['Debit', 'Credit'].includes(direction)) {
            return req.reject(400, 'direction must be Debit or Credit.');
        }
        // Provider date-times have no timezone; preserve that contract.
        const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?$/;
        const validDateTime = value => {
            if (!datePattern.test(value)) return false;
            const normalized = value.length === 19 ? `${value}.000` : value;
            const parsed = new Date(`${normalized}Z`);
            return Number.isFinite(parsed.getTime()) &&
                parsed.toISOString().slice(0, -1) === normalized;
        };
        if (!validDateTime(startDateTime) || !validDateTime(endDateTime) ||
            Date.parse(`${startDateTime}Z`) > Date.parse(`${endDateTime}Z`)) {
            return req.reject(400, 'Supply an ordered date range as YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.SSS.');
        }
        try {
            const data = await getAccountTransactions(
                accountId, process.env.FISERV_ORG_ID,
                { startDateTime, endDateTime, direction }
            );
            return {
                accountId,
                transactions: (data.AcctTrnRec || []).map(record => {
                    const info = record.AcctTrnInfo || {};
                    return {
                        transactionId: record.AcctTrnKeys?.AcctTrnId,
                        transactionCode: info.TrnCode,
                        direction: info.DrCrType,
                        source: info.TrnSrc,
                        memoPosted: info.MemoPostInd,
                        postedDateTime: info.PostedDt,
                        transactionDateTime: info.TrnDt,
                        amount: info.TrnAmt?.Amt,
                        currency: info.TrnAmt?.CurCode?.CurCodeValue,
                        descriptions: info.Desc || [],
                        status: record.AcctTrnStatus?.AcctTrnStatusCode
                    };
                })
            };
        } catch (error) {
            console.error('Fiserv transaction request failed:', error.message);
            return req.reject(502, 'Fiserv service is currently unavailable.');
        }
    });
});
