const {
    executeHttpRequest
} = require('@sap-cloud-sdk/http-client');

function getSapTransportConfig() {
    const destinationName =
        process.env.SAP_JOURNAL_ENTRY_DESTINATION;

    if (destinationName) {
        return {
            mode: 'destination',
            destinationName
        };
    }

    const config = {
        mode: 'basic',
        endpointUrl:
            process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL,
        username:
            process.env.SAP_JOURNAL_ENTRY_USERNAME,
        password:
            process.env.SAP_JOURNAL_ENTRY_PASSWORD
    };

    const missing = [
        'endpointUrl',
        'username',
        'password'
    ].filter(field => !config[field]);

    if (missing.length) {
        throw new Error(
            `SAP transport configuration is missing: ${missing.join(', ')}`
        );
    }

    return config;
}

function buildBasicAuthorization(username, password) {
    return `Basic ${Buffer
        .from(`${username}:${password}`)
        .toString('base64')}`;
}

async function postSoapRequest(
    xml,
    transportConfig,
    httpExecutor = executeHttpRequest
) {
    if (!xml) {
        throw new Error('SOAP request XML is required');
    }

    const config =
        transportConfig || getSapTransportConfig();

    if (config.mode === 'destination') {
        const response =
            await httpExecutor(
                {
                    destinationName:
                        config.destinationName
                },
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'text/xml; charset=utf-8',
                        Accept: 'text/xml'
                    },
                    data: xml
                }
            );

        return typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
    }

    const response = await fetch(
        config.endpointUrl,
        {
            method: 'POST',
            headers: {
                Authorization:
                    buildBasicAuthorization(
                        config.username,
                        config.password
                    ),
                'Content-Type':
                    'text/xml; charset=utf-8',
                Accept: 'text/xml'
            },
            body: xml
        }
    );

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(
            `SAP SOAP request failed: HTTP ${response.status} ${responseText}`
        );
    }

    return responseText;
}

module.exports = {
    getSapTransportConfig,
    buildBasicAuthorization,
    postSoapRequest
};
