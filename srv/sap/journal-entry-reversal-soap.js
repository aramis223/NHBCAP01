const {
    validateMessageContext
} = require('./journal-entry-soap');

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function validateJournalEntryReversal(reversal) {
    const requiredFields = [
        'eventType',
        'companyCode',
        'documentType',
        'businessTransactionType',
        'createdByUser',
        'documentDate',
        'postingDate',
        'reversalDate',
        'reversalReason',
        'reversalReferenceDocument'
    ];

    for (const field of requiredFields) {
        if (
            reversal?.[field] === undefined ||
            reversal?.[field] === null ||
            reversal?.[field] === ''
        ) {
            throw new Error(
                `Journal entry reversal field ${field} is required`
            );
        }
    }

    if (reversal.eventType !== 'PAYMENT_REVERSED') {
        throw new Error(
            `Unsupported SOAP reversal event type: ${reversal.eventType}`
        );
    }

    const maxLengths = {
        companyCode: 4,
        documentType: 5,
        businessTransactionType: 4,
        createdByUser: 12,
        reversalReason: 2,
        reversalReferenceDocument: 20
    };

    for (
        const [field, maxLength]
        of Object.entries(maxLengths)
    ) {
        if (
            String(reversal[field]).length >
            maxLength
        ) {
            throw new Error(
                `Journal entry reversal field ${field} exceeds SAP maximum length ${maxLength}`
            );
        }
    }

    return reversal;
}

function buildJournalEntryReversalSoapRequest(
    reversal,
    messageContext
) {
    const entry =
        validateJournalEntryReversal(reversal);

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
                    <ReversalReason>${escapeXml(entry.reversalReason)}</ReversalReason>
                    <ReversalReferenceDocument>${escapeXml(entry.reversalReferenceDocument)}</ReversalReferenceDocument>
                    <ReversalDate>${escapeXml(entry.reversalDate)}</ReversalDate>
                    <CreatedByUser>${escapeXml(entry.createdByUser)}</CreatedByUser>
                    <CompanyCode>${escapeXml(entry.companyCode)}</CompanyCode>
                    <DocumentDate>${escapeXml(entry.documentDate)}</DocumentDate>
                    <PostingDate>${escapeXml(entry.postingDate)}</PostingDate>
                </JournalEntry>
            </JournalEntryCreateRequest>
        </sfin:JournalEntryBulkCreateRequest>
    </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = {
    buildJournalEntryReversalSoapRequest,
    validateJournalEntryReversal
};