const test = require('node:test');
const assert = require('node:assert/strict');

const { forwardedClientAddress } = require('../server/http/client-address');

test('client address ignores forwarded headers from direct remote clients', () => {
  assert.equal(forwardedClientAddress({
    socket: { remoteAddress: '203.0.113.20' },
    headers: { 'x-forwarded-for': '198.51.100.99' },
  }), '203.0.113.20');
});

test('client address uses the nginx-appended address behind a local proxy', () => {
  assert.equal(forwardedClientAddress({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': '198.51.100.77, 203.0.113.42' },
  }), '203.0.113.42');
});

test('client address rejects malformed forwarded values', () => {
  assert.equal(forwardedClientAddress({
    socket: { remoteAddress: '::1' },
    headers: { 'x-forwarded-for': 'not-an-ip' },
  }), '::1');
});
