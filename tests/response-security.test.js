const test = require('node:test');
const assert = require('node:assert/strict');

const { applyResponseSecurityHeaders } = require('../server/http/response-security');

function createResponse() {
  const headers = new Map();
  return {
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test('API responses disable caching and apply browser security headers', () => {
  const res = createResponse();
  applyResponseSecurityHeaders({ url: '/api/state', headers: {}, socket: {} }, res);

  assert.equal(res.getHeader('cache-control'), 'no-store');
  assert.equal(res.getHeader('pragma'), 'no-cache');
  assert.equal(res.getHeader('x-content-type-options'), 'nosniff');
  assert.equal(res.getHeader('x-frame-options'), 'DENY');
  assert.equal(res.getHeader('referrer-policy'), 'no-referrer');
  assert.match(res.getHeader('permissions-policy'), /camera=\(\)/);
  assert.match(res.getHeader('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(res.getHeader('strict-transport-security'), undefined);
});

test('HTTPS proxy responses enable HSTS while static responses remain revalidatable', () => {
  const res = createResponse();
  applyResponseSecurityHeaders({
    url: '/styles.css',
    headers: { 'x-forwarded-proto': 'https' },
    socket: {},
  }, res);

  assert.equal(res.getHeader('cache-control'), undefined);
  assert.equal(res.getHeader('strict-transport-security'), 'max-age=31536000; includeSubDomains');
});
