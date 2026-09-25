const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseJournalEntryResponse
} = require('./srv/sap/journal-entry-response');

test('parses a successful SAP journal-entry confirmation', () => {
    const xml = `
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
    <soap-env:Body>
        <JournalEntryBulkCreateConfirmation>
            <JournalEntryCreateConfirmation>
                <JournalEntryCreateConfirmation>
                    <AccountingDocument>1900000123</AccountingDocument>
                    <CompanyCode>NHB1</CompanyCode>
                    <FiscalYear>2026</FiscalYear>
                </JournalEntryCreateConfirmation>
                    <Log>
                        <BusinessDocumentProcessingResultCode>3</BusinessDocumentProcessingResultCode>
                        <MaximumLogItemSeverityCode>1</MaximumLogItemSeverityCode>
                        <Item>
                            <Note>Journal entry posted successfully</Note>
                        </Item>
                    </Log>
            </JournalEntryCreateConfirmation>
        </JournalEntryBulkCreateConfirmation>
    </soap-env:Body>
</soap-env:Envelope>`;

    const result = parseJournalEntryResponse(xml);

    assert.equal(result.success, true);
    assert.equal(
        result.accountingDocument,
        '1900000123'
    );
    assert.equal(result.companyCode, 'NHB1');
    assert.equal(result.fiscalYear, '2026');
    assert.equal(
        result.processingResultCode,
        '3'
    );
    assert.equal(
        result.maximumSeverity,
        '1'
    );
    assert.deepEqual(
        result.logNotes,
        ['Journal entry posted successfully']
    );
    assert.equal(
        result.externalAccountingDocumentId,
        'NHB1-2026-1900000123'
    );
});

test('rejects SAP business failure with zero accounting document', () => {
    const xml = `
<JournalEntryBulkCreateConfirmation>
    <JournalEntryCreateConfirmation>
        <AccountingDocument>0000000000</AccountingDocument>
        <CompanyCode>NHB1</CompanyCode>
        <FiscalYear>2026</FiscalYear>
        <Log>
            <MaximumLogItemSeverityCode>3</MaximumLogItemSeverityCode>
            <Item>
                <Note>G/L account is not valid</Note>
            </Item>
            <Item>
                <Note>Journal entry was not posted</Note>
            </Item>
        </Log>
    </JournalEntryCreateConfirmation>
</JournalEntryBulkCreateConfirmation>`;

    assert.throws(
        () => parseJournalEntryResponse(xml),
        /G\/L account is not valid.*Journal entry was not posted/i
    );
});

test('rejects a SOAP fault', () => {
    const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
        <soapenv:Fault>
            <faultcode>soapenv:Server</faultcode>
            <faultstring>Posting service unavailable</faultstring>
        </soapenv:Fault>
    </soapenv:Body>
</soapenv:Envelope>`;

    assert.throws(
        () => parseJournalEntryResponse(xml),
        /SAP SOAP fault: Posting service unavailable/i
    );
});

test('rejects an incomplete success confirmation', () => {
    const xml = `
<JournalEntryCreateConfirmation>
    <AccountingDocument>1900000123</AccountingDocument>
</JournalEntryCreateConfirmation>`;

    assert.throws(
        () => parseJournalEntryResponse(xml),
        /missing company code or fiscal year/i
    );
});

test('rejects an empty response', () => {
    assert.throws(
        () => parseJournalEntryResponse(''),
        /response XML is required/i
    );
});
