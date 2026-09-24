const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getSapTransportConfig,
    buildBasicAuthorization,
    postSoapRequest
} = require('./srv/sap/transport');

test('builds Basic authorization header', () => {
    const result =
        buildBasicAuthorization('user', 'secret');

    assert.equal(
        result,
        'Basic dXNlcjpzZWNyZXQ='
    );
});

test('loads SAP destination configuration from environment', () => {
    const originalDestination =
        process.env.SAP_JOURNAL_ENTRY_DESTINATION;

    process.env.SAP_JOURNAL_ENTRY_DESTINATION =
        'NHB-S4-JOURNAL';

    const config = getSapTransportConfig();

    assert.deepEqual(config, {
        mode: 'destination',
        destinationName: 'NHB-S4-JOURNAL'
    });

    if (originalDestination === undefined) {
        delete process.env.SAP_JOURNAL_ENTRY_DESTINATION;
    } else {
        process.env.SAP_JOURNAL_ENTRY_DESTINATION =
            originalDestination;
    }
});

test('loads SAP basic transport configuration from environment', () => {
    const originalDestination =
        process.env.SAP_JOURNAL_ENTRY_DESTINATION;

    delete process.env.SAP_JOURNAL_ENTRY_DESTINATION;

    process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL =
        'https://example.test/sap/journal-entry';
    process.env.SAP_JOURNAL_ENTRY_USERNAME =
        'user';
    process.env.SAP_JOURNAL_ENTRY_PASSWORD =
        'secret';

    const config = getSapTransportConfig();

    assert.equal(config.mode, 'basic');
    assert.equal(
        config.endpointUrl,
        'https://example.test/sap/journal-entry'
    );
    assert.equal(config.username, 'user');
    assert.equal(config.password, 'secret');

    if (originalDestination !== undefined) {
        process.env.SAP_JOURNAL_ENTRY_DESTINATION =
            originalDestination;
    }
});

test('rejects missing SAP transport configuration', () => {
    const originalDestination =
        process.env.SAP_JOURNAL_ENTRY_DESTINATION;
    const originalEndpoint =
        process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL;
    const originalUsername =
        process.env.SAP_JOURNAL_ENTRY_USERNAME;
    const originalPassword =
        process.env.SAP_JOURNAL_ENTRY_PASSWORD;

    delete process.env.SAP_JOURNAL_ENTRY_DESTINATION;
    delete process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL;
    delete process.env.SAP_JOURNAL_ENTRY_USERNAME;
    delete process.env.SAP_JOURNAL_ENTRY_PASSWORD;

    assert.throws(
        () => getSapTransportConfig(),
        /SAP transport configuration is missing: endpointUrl, username, password/i
    );

    if (originalDestination !== undefined) {
        process.env.SAP_JOURNAL_ENTRY_DESTINATION =
            originalDestination;
    }
    if (originalEndpoint !== undefined) {
        process.env.SAP_JOURNAL_ENTRY_ENDPOINT_URL =
            originalEndpoint;
    }
    if (originalUsername !== undefined) {
        process.env.SAP_JOURNAL_ENTRY_USERNAME =
            originalUsername;
    }
    if (originalPassword !== undefined) {
        process.env.SAP_JOURNAL_ENTRY_PASSWORD =
            originalPassword;
    }
});

test('posts SOAP XML using basic transport and returns raw response text', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
        assert.equal(
            url,
            'https://example.test/sap/journal-entry'
        );
        assert.equal(options.method, 'POST');
        assert.equal(
            options.headers.Authorization,
            'Basic dXNlcjpzZWNyZXQ='
        );
        assert.equal(
            options.headers['Content-Type'],
            'text/xml; charset=utf-8'
        );
        assert.equal(
            options.headers.Accept,
            'text/xml'
        );
        assert.equal(
            options.body,
            '<soap>test</soap>'
        );

        return {
            ok: true,
            status: 200,
            text: async () =>
                '<soap>response</soap>'
        };
    };

    try {
        const result = await postSoapRequest(
            '<soap>test</soap>',
            {
                mode: 'basic',
                endpointUrl:
                    'https://example.test/sap/journal-entry',
                username: 'user',
                password: 'secret'
            }
        );

        assert.equal(
            result,
            '<soap>response</soap>'
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('rejects SAP HTTP errors in basic mode', async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () =>
            '<fault>posting failed</fault>'
    });

    try {
        await assert.rejects(
            () => postSoapRequest(
                '<soap>test</soap>',
                {
                    mode: 'basic',
                    endpointUrl:
                        'https://example.test/sap/journal-entry',
                    username: 'user',
                    password: 'secret'
                }
            ),
            /SAP SOAP request failed: HTTP 500/
        );
    } finally {
        global.fetch = originalFetch;
    }
});

test('posts SOAP XML using SAP destination transport', async () => {
    const fakeHttpExecutor = async (
        destination,
        request
    ) => {
        assert.deepEqual(destination, {
            destinationName: 'NHB-S4-JOURNAL'
        });

        assert.equal(request.method, 'POST');
        assert.equal(
            request.headers['Content-Type'],
            'text/xml; charset=utf-8'
        );
        assert.equal(
            request.headers.Accept,
            'text/xml'
        );
        assert.equal(
            request.data,
            '<soap>test</soap>'
        );

        return {
            data: '<soap>destination-response</soap>'
        };
    };

    const result = await postSoapRequest(
        '<soap>test</soap>',
        {
            mode: 'destination',
            destinationName: 'NHB-S4-JOURNAL'
        },
        fakeHttpExecutor
    );

    assert.equal(
        result,
        '<soap>destination-response</soap>'
    );
});
