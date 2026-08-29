const test = require('node:test');
const assert = require('node:assert/strict');

const { createCorsPolicy } = require('../server/http/cors-policy');

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    ended: false,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    writeHead(statusCode) {
      this.statusCode = statusCode;
    },
    end() {
      this.ended = true;
    },
  };
}

test('configured Vercel origin receives explicit CORS headers and a successful preflight', () => {
  const policy = createCorsPolicy({
    allowedOrigins: 'https://biz-arena.vercel.app, https://play.example',
    publicUrl: 'https://api.example',
  });
  const req = {
    method: 'OPTIONS',
    headers: {
      origin: 'https://biz-arena.vercel.app',
      'access-control-request-method': 'POST',
    },
  };
  const res = createResponse();

  assert.equal(policy.handlePreflight(req, res), true);
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(res.getHeader('access-control-allow-origin'), 'https://biz-arena.vercel.app');
  assert.match(res.getHeader('access-control-allow-methods'), /POST/);
  assert.match(res.getHeader('access-control-allow-headers'), /Authorization/);
  assert.match(res.getHeader('access-control-allow-headers'), /X-Player-Session/);
  assert.equal(res.getHeader('vary'), 'Origin');
});

test('configured policy rejects unknown browser origins but keeps server-side WebSocket clients working', () => {
  const policy = createCorsPolicy({
    allowedOrigins: 'https://biz-arena.vercel.app',
    publicUrl: 'https://api.example',
  });
  const res = createResponse();

  assert.equal(policy.handlePreflight({
    method: 'OPTIONS',
    headers: {
      origin: 'https://evil.example',
      'access-control-request-method': 'POST',
    },
  }, res), true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.getHeader('access-control-allow-origin'), undefined);
  assert.equal(policy.allowsWebSocket({ headers: { origin: 'https://evil.example' } }), false);
  assert.equal(policy.allowsWebSocket({ headers: { origin: 'https://api.example' } }), true);
  assert.equal(policy.allowsWebSocket({ headers: {} }), true);
});
