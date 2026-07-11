const net = require('node:net');

function isLoopbackAddress(address) {
  const value = String(address || '').trim().toLowerCase();
  return value === ''
    || value === '127.0.0.1'
    || value === '::1'
    || value === '::ffff:127.0.0.1';
}

function forwardedClientAddress(req) {
  const remoteAddress = String(req?.socket?.remoteAddress || '').trim();
  if (!isLoopbackAddress(remoteAddress)) return remoteAddress || 'unknown';

  const forwarded = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const candidate = forwarded.at(-1) || '';
  return net.isIP(candidate) ? candidate : (remoteAddress || 'unknown');
}

module.exports = { forwardedClientAddress, isLoopbackAddress };
