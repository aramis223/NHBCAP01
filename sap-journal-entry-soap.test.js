const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildJournalEntrySoapRequest,
    validateJournalEntry,
    validateMessageContext
} = require('./srv/sap/journal-entry-soap');

const validJournalEntry = {
    eventType: 'PAYMENT_RECEIVED',
    companyCode: 'NHB1',
    documentType: 'SA',
    businessTransactionType: 'RFBU',
    createdByUser: 'NHBCAP01',
    documentDate: '2026-09-24',
    postingDate: '2026-09-24',
    currency: 'USD',
    amount: 400,
    debitAccount: 'TEST-DEBIT',
    creditAccount: 'TEST-CREDIT',
    reference: 'PAY-SVC-TEST-001'
};

const validMessageContext = {
    serviceMessageId: 'SERVICE-MSG-001',
    journalEntryMessageId: 'JE-MSG-001',
    creationDateTime: '2026-09-24T12:00:00Z'
};

test('validates a supported journal entry', () => {
    const result = validateJournalEntry(validJournalEntry);

    assert.equal(result.amount, 400);
    assert.equal(result.eventType, 'PAYMENT_RECEIVED');
});

test('validates SOAP message context', () => {
    const result =
        validateMessageContext(validMessageContext);

    assert.deepEqual(result, validMessageContext);
});

test('rejects incomplete SOAP message context', () => {
    assert.throws(
        () => validateMessageContext({
            serviceMessageId: 'SERVICE-MSG-001'
        }),
        /journalEntryMessageId is required/i
    );
});

test('rejects PAYMENT_REVERSED in the normal posting builder', () => {
    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            eventType: 'PAYMENT_REVERSED'
        }),
        /unsupported SOAP posting event type/i
    );
});

test('rejects an invalid journal-entry amount', () => {
    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            amount: 0
        }),
        /amount must be greater than zero/i
    );
});

test('rejects a SAP document reference longer than 16 characters', () => {
    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            reference: 'PAY-SVC-TEST-001X'
        }),
        /reference exceeds SAP maximum length 16/i
    );
});

test('rejects invalid SAP field lengths', () => {
    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            companyCode: 'NHB01'
        }),
        /companyCode exceeds SAP maximum length 4/i
    );

    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            businessTransactionType: 'RFBU1'
        }),
        /businessTransactionType exceeds SAP maximum length 4/i
    );

    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            createdByUser: 'NHBCAP01-USER'
        }),
        /createdByUser exceeds SAP maximum length 12/i
    );
});

test('rejects a currency that is not exactly 3 characters', () => {
    assert.throws(
        () => validateJournalEntry({
            ...validJournalEntry,
            currency: 'US'
        }),
        /currency must be exactly 3 characters/i
    );
});
test('builds the synchronous SAP journal-entry SOAP structure', () => {
    const xml =
        buildJournalEntrySoapRequest(
            validJournalEntry,
            validMessageContext
        );

    assert.match(
        xml,
        /<sfin:JournalEntryBulkCreateRequest>/
    );
    assert.match(
        xml,
        /<JournalEntryCreateRequest>/
    );
    assert.match(
        xml,
        /<ID>SERVICE-MSG-001<\/ID>/
    );
    assert.match(
        xml,
        /<ID>JE-MSG-001<\/ID>/
    );
    assert.match(
        xml,
        /<CreationDateTime>2026-09-24T12:00:00Z<\/CreationDateTime>/
    );
    assert.match(
        xml,
        /<OriginalReferenceDocumentType>BKPFF<\/OriginalReferenceDocumentType>/
    );
    assert.match(
        xml,
        /<BusinessTransactionType>RFBU<\/BusinessTransactionType>/
    );
    assert.match(
        xml,
        /<AccountingDocumentType>SA<\/AccountingDocumentType>/
    );
    assert.match(
        xml,
        /<CompanyCode>NHB1<\/CompanyCode>/
    );
    assert.match(
        xml,
        /<DebitCreditCode>S<\/DebitCreditCode>/
    );
    assert.match(
        xml,
        /<DebitCreditCode>H<\/DebitCreditCode>/
    );
});

test('escapes XML-sensitive values', () => {
    const xml =
        buildJournalEntrySoapRequest(
            {
                ...validJournalEntry,
                reference: 'PAY&<TEST>'
            },
            validMessageContext
        );

    assert.match(
        xml,
        /PAY&amp;&lt;TEST&gt;/
    );
});
