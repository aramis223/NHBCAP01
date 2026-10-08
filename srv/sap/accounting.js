const crypto = require('node:crypto');
const {
    parseJournalEntryResponse
} = require('./journal-entry-response');

const {
    buildJournalEntrySoapRequest
} = require('./journal-entry-soap');

const {
    buildJournalEntryReversalSoapRequest
} = require('./journal-entry-reversal-soap');

const {
    postSoapRequest
} = require('./transport');

function buildSapDocumentReference(accountingEvent) {
    if (!accountingEvent?.ID) {
        throw new Error(
            'Accounting event ID is required for SAP document reference'
        );
    }

    return accountingEvent.ID
        .replaceAll('-', '')
        .slice(0, 16);
}

function validateAccountingConfig(accountingConfig) {
    const requiredFields = [
        'companyCode',
        'documentType',
        'businessTransactionType',
        'createdByUser',
        'debitAccount',
        'creditAccount'
    ];

    for (const field of requiredFields) {
        if (!accountingConfig?.[field]) {
            throw new Error(
                `Accounting configuration field ${field} is required`
            );
        }
    }

    return accountingConfig;
}

function mapAccountingEventToJournalEntry(
    accountingEvent,
    accountingConfig
) {
    if (!accountingEvent) {
        throw new Error('Accounting event is required');
    }

    validateAccountingConfig(accountingConfig);

    const amount = Number(accountingEvent.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
            'Accounting event amount must be greater than zero'
        );
    }

    if (!accountingEvent.eventDate) {
        throw new Error('Accounting event date is required');
    }

    if (!accountingEvent.currency) {
        throw new Error('Accounting event currency is required');
    }

    if (!accountingEvent.correlationId) {
        throw new Error(
            'Accounting event correlation ID is required'
        );
    }

    if (
        !['PAYMENT_RECEIVED', 'PAYMENT_REVERSED']
            .includes(accountingEvent.eventType)
    ) {
        throw new Error(
            `Unsupported accounting event type: ${accountingEvent.eventType}`
        );
    }

    return {
        eventType: accountingEvent.eventType,
        companyCode: accountingConfig.companyCode,
        documentType: accountingConfig.documentType,
        businessTransactionType:
            accountingConfig.businessTransactionType,
        createdByUser: accountingConfig.createdByUser,
        postingDate: accountingEvent.eventDate,
        documentDate: accountingEvent.eventDate,
        currency: accountingEvent.currency,
        amount,
        debitAccount: accountingConfig.debitAccount,
        creditAccount: accountingConfig.creditAccount,
        reference: buildSapDocumentReference(accountingEvent),
        nhbAccountingEventId: accountingEvent.ID,
        nhbPaymentId: accountingEvent.payment_ID,
        nhbFinancingId: accountingEvent.financing_ID,
        nhbInstallmentId: accountingEvent.installment_ID
    };
}

function validateAccountingReversalConfig(accountingConfig) {
    const requiredFields = [
        'companyCode',
        'documentType',
        'businessTransactionType',
        'createdByUser',
        'reversalReason'
    ];

    for (const field of requiredFields) {
        if (!accountingConfig?.[field]) {
            throw new Error(
                `Accounting reversal configuration field ${field} is required`
            );
        }
    }

    return accountingConfig;
}

function mapAccountingEventToJournalEntryReversal(
    accountingEvent,
    accountingConfig,
    originalPosting
) {
    if (!accountingEvent) {
        throw new Error(
            'Accounting reversal event is required'
        );
    }

    if (accountingEvent.eventType !== 'PAYMENT_REVERSED') {
        throw new Error(
            `Unsupported accounting reversal event type: ${accountingEvent.eventType}`
        );
    }

    if (!accountingEvent.eventDate) {
        throw new Error(
            'Accounting reversal event date is required'
        );
    }

    validateAccountingReversalConfig(
        accountingConfig
    );

    if (
        !originalPosting?.externalAccountingDocument ||
        !originalPosting?.externalCompanyCode ||
        !originalPosting?.externalFiscalYear
    ) {
        throw new Error(
            'Original SAP accounting document identity is required for reversal'
        );
    }

    if (
        originalPosting.externalCompanyCode !==
        accountingConfig.companyCode
    ) {
        throw new Error(
            'Original SAP company code does not match reversal configuration'
        );
    }

    const reversalReferenceDocument =
        `${originalPosting.externalAccountingDocument}` +
        `${originalPosting.externalCompanyCode}` +
        `${originalPosting.externalFiscalYear}`;

    return {
        eventType: accountingEvent.eventType,
        companyCode: accountingConfig.companyCode,
        documentType: accountingConfig.documentType,
        businessTransactionType:
            accountingConfig.businessTransactionType,
        createdByUser:
            accountingConfig.createdByUser,
        documentDate: accountingEvent.eventDate,
        postingDate: accountingEvent.eventDate,
        reversalDate: accountingEvent.eventDate,
        reversalReason:
            accountingConfig.reversalReason,
        reversalReferenceDocument,
        nhbAccountingEventId:
            accountingEvent.ID,
        nhbPaymentId:
            accountingEvent.payment_ID
    };
}

function createSoapMessageContext() {
    return {
        serviceMessageId:
            `NHB${crypto.randomUUID().replaceAll('-', '')}`,
        journalEntryMessageId:
            `NHB${crypto.randomUUID().replaceAll('-', '')}`,
        creationDateTime:
            new Date().toISOString()
    };
}

async function postJournalEntry(
    accountingEvent,
    accountingConfig,
    options = {}
) {
    const journalEntry =
        mapAccountingEventToJournalEntry(
            accountingEvent,
            accountingConfig
        );

    const messageContext =
        options.messageContext ||
        createSoapMessageContext();

    const xml =
        buildJournalEntrySoapRequest(
            journalEntry,
            messageContext
        );

    const responseXml = await postSoapRequest(
        xml,
        options.transportConfig,
        options.httpExecutor,
        {
            correlationId:
                accountingEvent.correlationId
        }
    );

    return parseJournalEntryResponse(responseXml);
}

async function postJournalEntryReversal(
    accountingEvent,
    accountingConfig,
    originalPosting,
    options = {}
) {
    const reversal =
        mapAccountingEventToJournalEntryReversal(
            accountingEvent,
            accountingConfig,
            originalPosting
        );

    const messageContext =
        options.messageContext ||
        createSoapMessageContext();

    const xml =
        buildJournalEntryReversalSoapRequest(
            reversal,
            messageContext
        );

    const responseXml =
        await postSoapRequest(
            xml,
            options.transportConfig,
            options.httpExecutor,
            {
                correlationId:
                    accountingEvent.correlationId
            }
        );

    return parseJournalEntryResponse(
        responseXml
    );
}

module.exports = {
    postJournalEntry,
    postJournalEntryReversal,
    validateAccountingConfig,
    validateAccountingReversalConfig,
    mapAccountingEventToJournalEntry,
    mapAccountingEventToJournalEntryReversal,
    createSoapMessageContext,
    buildSapDocumentReference
};
