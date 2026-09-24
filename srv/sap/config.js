function getAccountingConfig() {
    const config = {
        companyCode: process.env.SAP_ACCOUNTING_COMPANY_CODE,
        documentType: process.env.SAP_ACCOUNTING_DOCUMENT_TYPE,
        businessTransactionType:
            process.env.SAP_ACCOUNTING_BUSINESS_TRANSACTION_TYPE,
        createdByUser: process.env.SAP_ACCOUNTING_CREATED_BY_USER,
        debitAccount: process.env.SAP_ACCOUNTING_DEBIT_ACCOUNT,
        creditAccount: process.env.SAP_ACCOUNTING_CREDIT_ACCOUNT
    };

    const missing = Object.entries(config)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length) {
        throw new Error(
            `SAP accounting configuration is missing: ${missing.join(', ')}`
        );
    }

    return config;
}

module.exports = {
    getAccountingConfig
};
