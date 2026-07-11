const test = require('node:test');
const assert = require('node:assert/strict');

const { parseRequestUrl } = require('../server/http/request-url');

test('request URL parsing does not trust the Host header', () => {
  const parsed = parseRequestUrl({
    url: '/api/health?source=test',
    headers: { host: '[' },
  });

  assert.equal(parsed.pathname, '/api/health');
  assert.equal(parsed.searchParams.get('source'), 'test');
});

test('malformed request targets fail with a client error', () => {
  assert.throws(
    () => parseRequestUrl({ url: 'http://[', headers: { host: 'localhost' } }),
    error => error.status === 400 && error.code === 'BIZ_ARENA_INVALID_REQUEST_URL'
  );
});
