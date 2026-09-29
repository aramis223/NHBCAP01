const http = require('http');

const PORT = process.env.PORT || 5100;

function buildSuccessResponse() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:sfin="http://sap.com/xi/SAPSCORE/SFIN">
    <soapenv:Body>
        <sfin:JournalEntryBulkCreateConfirmation>
            <AccountingDocument>1900000001</AccountingDocument>
            <CompanyCode>1000</CompanyCode>
            <FiscalYear>2026</FiscalYear>
            <BusinessDocumentProcessingResultCode>SUCCESS</BusinessDocumentProcessingResultCode>
            <MaximumLogItemSeverityCode>1</MaximumLogItemSeverityCode>
            <Note>Mock S/4 journal entry posted successfully.</Note>
        </sfin:JournalEntryBulkCreateConfirmation>
    </soapenv:Body>
</soapenv:Envelope>`;
}

function buildFaultResponse(message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
    <soapenv:Body>
        <soapenv:Fault>
            <faultcode>soapenv:Server</faultcode>
            <faultstring>${message}</faultstring>
        </soapenv:Fault>
    </soapenv:Body>
</soapenv:Envelope>`;
}

const server = http.createServer((req, res) => {
    if (req.url !== '/journal-entry') {
        res.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        res.end('Not Found');
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead(405, {
            'Content-Type': 'text/plain'
        });
        res.end('Method Not Allowed');
        return;
    }

    let body = '';

    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', () => {
        console.log('Mock S/4 received SOAP request');
        console.log(`Path: ${req.url}`);
        console.log(`Bytes: ${Buffer.byteLength(body)}`);

        if (!body.includes('Envelope')) {
            const fault = buildFaultResponse(
                'Invalid SOAP request'
            );

            res.writeHead(500, {
                'Content-Type':
                    'text/xml; charset=utf-8'
            });

            res.end(fault);
            return;
        }

        const responseXml =
            buildSuccessResponse();

        res.writeHead(200, {
            'Content-Type':
                'text/xml; charset=utf-8'
        });

        res.end(responseXml);
    });
});

server.listen(PORT, () => {
    console.log(
        `Mock S/4 SOAP service running on port ${PORT}`
    );
});
