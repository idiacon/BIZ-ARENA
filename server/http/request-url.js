function parseRequestUrl(req) {
  try {
    return new URL(String(req?.url || '/'), 'http://localhost');
  } catch (cause) {
    throw Object.assign(new Error('Invalid request URL'), {
      status: 400,
      code: 'BIZ_ARENA_INVALID_REQUEST_URL',
      cause,
    });
  }
}

module.exports = { parseRequestUrl };
