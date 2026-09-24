const test = require('node:test');
const assert = require('node:assert/strict');

const {
    postJournalEntry
} = require('./srv/sap/accounting');

const {
    getAccountingConfig
} = require('./srv/sap/config');

const {
    validateAccountingConfig,
    mapAccountingEventToJournalEntry
} = require('./srv/sap/accounting');

const validConfig = {
    companyCode: 'NHB1',
    documentType: 'SA',
    businessTransactionType: 'RFBU',
    createdByUser: 'NHBCAP01',
    debitAccount: 'TEST-DEBIT',
    creditAccount: 'TEST-CREDIT'
};

const validEvent = {
    ID: '11111111-1111-1111-1111-111111111111',
    eventType: 'PAYMENT_RECEIVED',
    eventDate: '2026-09-24',
    amount: 400,
    currency: 'USD',
    correlationId: 'PAY-SVC-TEST-001',
    payment_ID: '22222222-2222-2222-2222-222222222222',
    financing_ID: '33333333-3333-3333-3333-333333333333',
    installment_ID: '44444444-4444-4444-4444-444444444444'
};

test('validates complete accounting configuration', () => {
    const result =
        validateAccountingConfig(validConfig);

    assert.deepEqual(result, validConfig);
});

test('rejects incomplete accounting configuration', () => {
    assert.throws(
        () => validateAccountingConfig({
            companyCode: 'NHB1',
            documentType: 'SA',
            businessTransactionType: 'RFBU',
            createdByUser: 'NHBCAP01'
        }),
        /debitAccount is required/i
    );
});

test(
    'maps PAYMENT_RECEIVED to normalized journal-entry candidate',
    () => {
        const result =
            mapAccountingEventToJournalEntry(
                validEvent,
                validConfig
            );

        assert.equal(
            result.eventType,
            'PAYMENT_RECEIVED'
        );
        assert.equal(result.companyCode, 'NHB1');
        assert.equal(result.documentType, 'SA');
        assert.equal(
            result.businessTransactionType,
            'RFBU'
        );
        assert.equal(
            result.createdByUser,
            'NHBCAP01'
        );
        assert.equal(
            result.postingDate,
            '2026-09-24'
        );
        assert.equal(
            result.documentDate,
            '2026-09-24'
        );
        assert.equal(result.currency, 'USD');
        assert.equal(result.amount, 400);
        assert.equal(
            result.debitAccount,
            'TEST-DEBIT'
        );
        assert.equal(
            result.creditAccount,
            'TEST-CREDIT'
        );
        assert.equal(
            result.reference,
            'PAY-SVC-TEST-001'
        );
        assert.equal(
            result.nhbAccountingEventId,
            validEvent.ID
        );
        assert.equal(
            result.nhbPaymentId,
            validEvent.payment_ID
        );
        assert.equal(
            result.nhbFinancingId,
            validEvent.financing_ID
        );
        assert.equal(
            result.nhbInstallmentId,
            validEvent.installment_ID
        );
    }
);

test(
    'accepts PAYMENT_REVERSED as a supported accounting event type',
    () => {
        const result =
            mapAccountingEventToJournalEntry(
                {
                    ...validEvent,
                    eventType: 'PAYMENT_REVERSED',
                    correlationId:
                        'REV-SVC-TEST-001'
                },
                validConfig
            );

        assert.equal(
            result.eventType,
            'PAYMENT_REVERSED'
        );
        assert.equal(
            result.reference,
            'REV-SVC-TEST-001'
        );
    }
);

test('rejects unsupported accounting event type', () => {
    assert.throws(
        () => mapAccountingEventToJournalEntry(
            {
                ...validEvent,
                eventType: 'UNKNOWN_EVENT'
            },
            validConfig
        ),
        /unsupported accounting event type/i
    );
});

test('rejects invalid accounting amount', () => {
    assert.throws(
        () => mapAccountingEventToJournalEntry(
            {
                ...validEvent,
                amount: 0
            },
            validConfig
        ),
        /amount must be greater than zero/i
    );
});

test(
    'loads SAP accounting configuration from environment',
    () => {
        process.env.SAP_ACCOUNTING_COMPANY_CODE =
            'NHB1';
        process.env.SAP_ACCOUNTING_DOCUMENT_TYPE =
            'SA';
        process.env.SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE =
            'RFBU';
        process.env.SAP_ACCOUNTING_CREATED_BY_USER =
            'NHBCAP01';
        process.env.SAP_ACCOUNTING_DEBIT_ACCOUNT =
            'TEST-DEBIT';
        process.env.SAP_ACCOUNTING_CREDIT_ACCOUNT =
            'TEST-CREDIT';

        const config = getAccountingConfig();

        assert.equal(config.companyCode, 'NHB1');
        assert.equal(config.documentType, 'SA');
        assert.equal(
            config.businessTransactionType,
            'RFBU'
        );
        assert.equal(
            config.createdByUser,
            'NHBCAP01'
        );
        assert.equal(
            config.debitAccount,
            'TEST-DEBIT'
        );
        assert.equal(
            config.creditAccount,
            'TEST-CREDIT'
        );
    }
);

test(
    'rejects missing SAP accounting configuration',
    () => {
        const original =
            process.env.SAP_ACCOUNTING_CREDIT_ACCOUNT;

        delete process.env
            .SAP_ACCOUNTING_CREDIT_ACCOUNT;

        assert.throws(
            () => getAccountingConfig(),
            /SAP accounting configuration is missing: creditAccount/i
        );

        if (original === undefined) {
            delete process.env
                .SAP_ACCOUNTING_CREDIT_ACCOUNT;
        } else {
            process.env
                .SAP_ACCOUNTING_CREDIT_ACCOUNT =
                original;
        }
    }
);

test('orchestrates accounting mapping, SOAP building, and transport', async () => {
    const fakeHttpExecutor = async (
        destination,
        request
    ) => {
        assert.deepEqual(destination, {
            destinationName: 'NHB-S4-JOURNAL'
        });

        assert.equal(request.method, 'POST');
        assert.match(
            request.data,
            /<sfin:JournalEntryBulkCreateRequest>/
        );
        assert.match(
            request.data,
            /<CompanyCode>NHB1<\/CompanyCode>/
        );
        assert.match(
            request.data,
            /<BusinessTransactionType>RFBU<\/BusinessTransactionType>/
        );
        assert.match(
            request.data,
            /<ID>SERVICE-MSG-001<\/ID>/
        );
        assert.match(
            request.data,
            /<ID>JE-MSG-001<\/ID>/
        );

        return {
            data: `
                <JournalEntryBulkCreateConfirmation>
                    <JournalEntryCreateConfirmation>
                        <AccountingDocument>1900000123</AccountingDocument>
                        <CompanyCode>NHB1</CompanyCode>
                        <FiscalYear>2026</FiscalYear>
                        <Log>
                            <MaximumLogItemSeverityCode>1</MaximumLogItemSeverityCode>
                            <Item>
                                <Note>Journal entry posted successfully</Note>
                            </Item>
                        </Log>
                    </JournalEntryCreateConfirmation>
                </JournalEntryBulkCreateConfirmation>`
        };
    };

    const result = await postJournalEntry(
        validEvent,
        validConfig,
        {
            messageContext: {
                serviceMessageId: 'SERVICE-MSG-001',
                journalEntryMessageId: 'JE-MSG-001',
                creationDateTime:
                    '2026-09-24T12:00:00Z'
            },
            transportConfig: {
                mode: 'destination',
                destinationName:
                    'NHB-S4-JOURNAL'
            },
            httpExecutor: fakeHttpExecutor
        }
    );

    assert.equal(result.success, true);
    assert.equal(
        result.accountingDocument,
        '1900000123'
    );
    assert.equal(
        result.externalAccountingDocumentId,
        'NHB1-2026-1900000123'
    );

});