'use strict';
const assert = require('node:assert/strict');
const {
    getAccountTransactions,
    normalizeTransactionPagination
} = require('./srv/fiserv/transactions');

test('transaction pagination preserves opaque cursors and validates page sizes', () => {
    assert.deepEqual(normalizeTransactionPagination(), { cursor: '', pageSize: 5 });
    assert.deepEqual(normalizeTransactionPagination({ cursor: null, pageSize: null }),
        { cursor: '', pageSize: 5 });
    const cursor = 'opaque+/=_-';
    assert.equal(normalizeTransactionPagination({ cursor, pageSize: 2 }).cursor, cursor);
    for (const pageSize of [0, 6, 1.5, '2', NaN]) {
        assert.throws(() => normalizeTransactionPagination({ pageSize }), /pageSize/);
    }
    for (const cursor of [123, 'bad\nvalue', 'x'.repeat(4097)]) {
        assert.throws(() => normalizeTransactionPagination({ cursor }), /cursor/);
    }
});

test('transaction history follows supplied cursors across three pages with unchanged filters', async () => {
    const names = ['FISERV_API_BASE_URL', 'FISERV_TOKEN_URL', 'FISERV_API_KEY', 'FISERV_API_SECRET'];
    const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
    const oldFetch = global.fetch;
    const bodies = [];
    const pages = [
        { RecCtrlOut: { SentRecCount: 2, Cursor: 'opaque-page-two' }, ids: ['a', 'b'] },
        { RecCtrlOut: { SentRecCount: 2, Cursor: 'opaque-page-three' }, ids: ['c', 'd'] },
        { RecCtrlOut: { SentRecCount: 1 }, ids: ['e'] }
    ];
    try {
        process.env.FISERV_API_BASE_URL = 'https://fiserv.invalid/banking/efx/v1';
        process.env.FISERV_TOKEN_URL = 'https://fiserv.invalid/token';
        process.env.FISERV_API_KEY = 'test-key';
        process.env.FISERV_API_SECRET = 'test-secret';
        global.fetch = async (url, options) => {
            if (String(url) === process.env.FISERV_TOKEN_URL) {
                return { ok: true, json: async () => ({ access_token: 'test-token' }) };
            }
            assert.equal(String(url), process.env.FISERV_API_BASE_URL + '/acctservice/acctmgmt/acctTrn/secured');
            assert.equal(options.headers.Authorization, 'Bearer test-token');
            bodies.push(JSON.parse(options.body));
            const page = pages[bodies.length - 1];
            assert.ok(page, 'Unexpected extra provider request');
            return { ok: true, json: async () => ({
                Status: { StatusCode: '0' }, RecCtrlOut: page.RecCtrlOut,
                AcctTrnRec: page.ids.map(AcctTrnId => ({ AcctTrnKeys: { AcctTrnId } }))
            }) };
        };
        const filters = {
            startDateTime: '2025-05-12T10:01:01.001',
            endDateTime: '2025-10-12T10:01:01.001', direction: 'Credit'
        };
        let cursor = '';
        const ids = [];
        for (let i = 0; i < 3; i++) {
            const data = await getAccountTransactions('test-account', 'test-org',
                { ...filters, pageSize: 2, cursor });
            ids.push(...data.AcctTrnRec.map(record => record.AcctTrnKeys.AcctTrnId));
            cursor = data.RecCtrlOut.Cursor;
        }
        assert.equal(cursor, undefined);
        assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'e']);
        assert.equal(new Set(ids).size, 5);
        assert.deepEqual(bodies.map(body => body.RecCtrlIn), [
            { MaxRecLimit: '2', Cursor: '' },
            { MaxRecLimit: '2', Cursor: 'opaque-page-two' },
            { MaxRecLimit: '2', Cursor: 'opaque-page-three' }
        ]);
        for (const body of bodies.slice(1)) {
            assert.deepEqual(body.AcctTrnSel, bodies[0].AcctTrnSel);
        }
        await getAccountTransactions('test-account', 'test-org', { ...filters, pageSize: 0 })
            .then(() => assert.fail('Invalid page size accepted'), error => assert.match(error.message, /pageSize/));
        assert.equal(bodies.length, 3, 'Invalid input must not call provider');
    } finally {
        global.fetch = oldFetch;
        for (const name of names) {
            if (saved[name] === undefined) delete process.env[name];
            else process.env[name] = saved[name];
        }
    }
});
