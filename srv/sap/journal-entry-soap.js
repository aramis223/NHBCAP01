function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function validateJournalEntry(journalEntry) {
    const requiredFields = [
        'eventType',
        'companyCode',
        'documentType',
        'businessTransactionType',
        'createdByUser',
        'documentDate',
        'postingDate',
        'currency',
        'amount',
        'debitAccount',
        'creditAccount',
        'reference'
    ];

    for (const field of requiredFields) {
        if (
            journalEntry?.[field] === undefined ||
            journalEntry?.[field] === null ||
            journalEntry?.[field] === ''
        ) {
            throw new Error(
                `Journal entry field ${field} is required`
            );
        }
    }

    if (journalEntry.eventType !== 'PAYMENT_RECEIVED') {
        throw new Error(
            `Unsupported SOAP posting event type: ${journalEntry.eventType}`
        );
    }

    const maxLengths = {
        companyCode: 4,
        documentType: 5,
        businessTransactionType: 4,
        createdByUser: 12,
        reference: 16
    };

    for (const [field, maxLength] of Object.entries(maxLengths)) {
        if (String(journalEntry[field]).length > maxLength) {
            throw new Error(
                `Journal entry field ${field} exceeds SAP maximum length ${maxLength}`
            );
        }
    }

    if (String(journalEntry.currency).length !== 3) {
        throw new Error(
            'Journal entry currency must be exactly 3 characters'
        );
    }
    const amount = Number(journalEntry.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
            'Journal entry amount must be greater than zero'
        );
    }

    return {
        ...journalEntry,
        amount
    };
}

function validateMessageContext(messageContext) {
    const requiredFields = [
        'serviceMessageId',
        'journalEntryMessageId',
        'creationDateTime'
    ];

    for (const field of requiredFields) {
        if (!messageContext?.[field]) {
            throw new Error(
                `SOAP message context field ${field} is required`
            );
        }
    }

    return messageContext;
}

function buildJournalEntrySoapRequest(
    journalEntry,
    messageContext
) {
    const entry = validateJournalEntry(journalEntry);
    const context =
        validateMessageContext(messageContext);

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:sfin="http://sap.com/xi/SAPSCORE/SFIN">
    <soapenv:Header/>
    <soapenv:Body>
        <sfin:JournalEntryBulkCreateRequest>
            <MessageHeader>
                <ID>${escapeXml(context.serviceMessageId)}</ID>
                <CreationDateTime>${escapeXml(context.creationDateTime)}</CreationDateTime>
            </MessageHeader>
            <JournalEntryCreateRequest>
                <MessageHeader>
                    <ID>${escapeXml(context.journalEntryMessageId)}</ID>
                    <CreationDateTime>${escapeXml(context.creationDateTime)}</CreationDateTime>
                </MessageHeader>
                <JournalEntry>
                    <OriginalReferenceDocumentType>BKPFF</OriginalReferenceDocumentType>
                    <BusinessTransactionType>${escapeXml(entry.businessTransactionType)}</BusinessTransactionType>
                    <AccountingDocumentType>${escapeXml(entry.documentType)}</AccountingDocumentType>
                    <DocumentReferenceID>${escapeXml(entry.reference)}</DocumentReferenceID>
                    <CreatedByUser>${escapeXml(entry.createdByUser)}</CreatedByUser>
                    <CompanyCode>${escapeXml(entry.companyCode)}</CompanyCode>
                    <DocumentDate>${escapeXml(entry.documentDate)}</DocumentDate>
                    <PostingDate>${escapeXml(entry.postingDate)}</PostingDate>
                    <Item>
                        <ReferenceDocumentItem>1</ReferenceDocumentItem>
                        <GLAccount>${escapeXml(entry.debitAccount)}</GLAccount>
                        <AmountInTransactionCurrency currencyCode="${escapeXml(entry.currency)}">${escapeXml(entry.amount)}</AmountInTransactionCurrency>
                        <DebitCreditCode>S</DebitCreditCode>
                    </Item>
                    <Item>
                        <ReferenceDocumentItem>2</ReferenceDocumentItem>
                        <GLAccount>${escapeXml(entry.creditAccount)}</GLAccount>
                        <AmountInTransactionCurrency currencyCode="${escapeXml(entry.currency)}">-${escapeXml(entry.amount)}</AmountInTransactionCurrency>
                        <DebitCreditCode>H</DebitCreditCode>
                    </Item>
                </JournalEntry>
            </JournalEntryCreateRequest>
        </sfin:JournalEntryBulkCreateRequest>
    </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = {
    buildJournalEntrySoapRequest,
    validateJournalEntry,
    validateMessageContext
};
