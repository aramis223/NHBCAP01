const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildJournalEntryReversalSoapRequest,
    validateJournalEntryReversal
} = require('./srv/sap/journal-entry-reversal-soap');

const validReversal = {
    eventType: 'PAYMENT_REVERSED',
    companyCode: 'NHB1',
    documentType: 'SA',
    businessTransactionType: 'RFBU',
    createdByUser: 'NHBCAP01',
    documentDate: '2026-09-25',
    postingDate: '2026-09-25',
    reversalDate: '2026-09-25',
    reversalReason: '01',
    reversalReferenceDocument: '1900000123NHB12026'
};

const validMessageContext = {
    serviceMessageId: 'SERVICE-REV-001',
    journalEntryMessageId: 'JE-REV-001',
    creationDateTime: '2026-09-25T12:00:00Z'
};

test('validates a supported journal-entry reversal', () => {
    const result =
        validateJournalEntryReversal(validReversal);

    assert.deepEqual(result, validReversal);
});

test('rejects a non-reversal event type', () => {
    assert.throws(
        () => validateJournalEntryReversal({
            ...validReversal,
            eventType: 'PAYMENT_RECEIVED'
        }),
        /unsupported SOAP reversal event type/i
    );
});

test('rejects an invalid reversal reason length', () => {
    assert.throws(
        () => validateJournalEntryReversal({
            ...validReversal,
            reversalReason: '001'
        }),
        /reversalReason exceeds SAP maximum length 2/i
    );
});

test('rejects an oversized reversal reference', () => {
    assert.throws(
        () => validateJournalEntryReversal({
            ...validReversal,
            reversalReferenceDocument:
                '123456789012345678901'
        }),
        /reversalReferenceDocument exceeds SAP maximum length 20/i
    );
});

test('builds SAP reversal SOAP without journal-entry items', () => {
    const xml =
        buildJournalEntryReversalSoapRequest(
            validReversal,
            validMessageContext
        );

    assert.match(
        xml,
        /<sfin:JournalEntryBulkCreateRequest>/
    );

    assert.match(
        xml,
        /<ReversalReason>01<\/ReversalReason>/
    );

    assert.match(
        xml,
        /<ReversalReferenceDocument>1900000123NHB12026<\/ReversalReferenceDocument>/
    );

    assert.match(
        xml,
        /<ReversalDate>2026-09-25<\/ReversalDate>/
    );

    assert.doesNotMatch(
        xml,
        /<Item>/
    );
});