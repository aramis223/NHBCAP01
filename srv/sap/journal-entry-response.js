function decodeXml(value) {
    return String(value)
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&');
}

function extractFirst(xml, tagName) {
    const pattern = new RegExp(
        `<(?:[A-Za-z0-9_-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${tagName}>`,
        'i'
    );

    const match = xml.match(pattern);

    return match
        ? decodeXml(match[1].trim())
        : null;
}

function extractLogNotes(xml) {
    const notes = [];
    const pattern =
        /<(?:[A-Za-z0-9_-]+:)?Note(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?Note>/gi;

    let match;

    while ((match = pattern.exec(xml)) !== null) {
        notes.push(
            decodeXml(match[1].trim())
        );
    }

    return notes;
}

function parseJournalEntryResponse(xml) {
    if (!xml || !String(xml).trim()) {
        throw new Error(
            'SAP journal-entry response XML is required'
        );
    }

    const responseXml = String(xml);

    if (
        /<(?:[A-Za-z0-9_-]+:)?Fault(?:\s|>)/i.test(
            responseXml
        )
    ) {
        const faultString =
            extractFirst(responseXml, 'faultstring') ||
            extractFirst(responseXml, 'Text') ||
            'Unknown SOAP fault';

        throw new Error(
            `SAP SOAP fault: ${faultString}`
        );
    }

    const accountingDocument =
        extractFirst(
            responseXml,
            'AccountingDocument'
        );

    const companyCode =
        extractFirst(
            responseXml,
            'CompanyCode'
        );

    const fiscalYear =
        extractFirst(
            responseXml,
            'FiscalYear'
        );

    const maximumSeverity =
        extractFirst(
            responseXml,
            'MaximumLogItemSeverityCode'
        );

    const processingResultCode =
        extractFirst(
            responseXml,
            'BusinessDocumentProcessingResultCode'
        );

    const logNotes =
        extractLogNotes(responseXml);

    if (
        !accountingDocument ||
        accountingDocument === '0000000000'
    ) {
        const detail = logNotes.length
            ? logNotes.join(' | ')
            : 'SAP did not return a posted accounting document';

        throw new Error(
            `SAP journal-entry posting failed: ${detail}`
        );
    }

    if (!companyCode || !fiscalYear) {
        throw new Error(
            'SAP journal-entry confirmation is missing company code or fiscal year'
        );
    }

    return {
        success: true,
        accountingDocument,
        companyCode,
        fiscalYear,
        processingResultCode,
        maximumSeverity,
        logNotes,
        externalAccountingDocumentId:
            `${companyCode}-${fiscalYear}-${accountingDocument}`
    };
}

module.exports = {
    parseJournalEntryResponse
};
