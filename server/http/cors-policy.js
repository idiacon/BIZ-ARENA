const CORS_METHODS = 'GET, POST, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, X-Player-Session, X-Teacher-Session';

function normalizeOrigin(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.origin;
  } catch (_error) {
    return '';
  }
}

function parseAllowedOrigins(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

function appendVary(res, value) {
  const current = String(res.getHeader?.('Vary') || '').trim();
  const values = new Set(current.split(',').map(item => item.trim()).filter(Boolean));
  values.add(value);
  res.setHeader('Vary', [...values].join(', '));
}

function createCorsPolicy({ allowedOrigins = '', publicUrl = '' } = {}) {
  const browserOrigins = parseAllowedOrigins(allowedOrigins);
  const websocketOrigins = new Set(browserOrigins);
  const serverOrigin = normalizeOrigin(publicUrl);
  if (serverOrigin) websocketOrigins.add(serverOrigin);

  function applyHttpHeaders(req, res) {
    const origin = normalizeOrigin(req?.headers?.origin);
    if (!origin || !browserOrigins.has(origin)) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', CORS_METHODS);
    res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');
    appendVary(res, 'Origin');
    return true;
  }

  function handlePreflight(req, res) {
    const origin = normalizeOrigin(req?.headers?.origin);
    const requestedMethod = String(req?.headers?.['access-control-request-method'] || '').trim();
    if (String(req?.method || '').toUpperCase() !== 'OPTIONS' || !origin || !requestedMethod) return false;
    const allowed = applyHttpHeaders(req, res);
    res.writeHead(allowed ? 204 : 403);
    res.end();
    return true;
  }

  function allowsWebSocket(req) {
    const origin = normalizeOrigin(req?.headers?.origin);
    if (!origin) return true;
    if (!browserOrigins.size) return true;
    return websocketOrigins.has(origin);
  }

  return {
    applyHttpHeaders,
    handlePreflight,
    allowsWebSocket,
    allowedOrigins: [...browserOrigins],
  };
}

module.exports = {
  createCorsPolicy,
  normalizeOrigin,
  parseAllowedOrigins,
};
