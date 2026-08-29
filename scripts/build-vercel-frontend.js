const fs = require('fs');
const path = require('path');

function normalizeBackendUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) throw new Error('BIZ_ARENA_BACKEND_URL is required for the Vercel frontend build.');
  let url;
  try {
    url = new URL(candidate);
  } catch (_error) {
    throw new Error('BIZ_ARENA_BACKEND_URL must be an absolute HTTPS URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('BIZ_ARENA_BACKEND_URL must be an absolute HTTPS URL without credentials.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BIZ_ARENA_BACKEND_URL must point to the backend origin without a path, query, or hash.');
  }
  return url.origin;
}

function buildVercelFrontend({
  rootDir = path.resolve(__dirname, '..'),
  outputDir = path.join(rootDir, 'dist', 'vercel-public'),
  backendUrl = process.env.BIZ_ARENA_BACKEND_URL,
} = {}) {
  const normalizedBackendUrl = normalizeBackendUrl(backendUrl);
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
    throw new Error(`Public frontend is missing: ${publicDir}`);
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
  fs.cpSync(publicDir, outputDir, { recursive: true });

  const runtimeConfig = [
    'window.BizArenaDeploymentConfig = Object.freeze({',
    `  backendUrl: ${JSON.stringify(normalizedBackendUrl)},`,
    '});',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outputDir, 'runtime-config.js'), runtimeConfig, 'utf8');

  const indexPath = path.join(outputDir, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  if (!indexHtml.includes('<script src="/runtime-config.js"></script>')) {
    throw new Error('public/index.html must load /runtime-config.js before /app-runtime.js.');
  }
  if (indexHtml.indexOf('/runtime-config.js') > indexHtml.indexOf('/app-runtime.js')) {
    throw new Error('/runtime-config.js must load before /app-runtime.js.');
  }

  return {
    outputDir,
    backendUrl: normalizedBackendUrl,
  };
}

if (require.main === module) {
  const result = buildVercelFrontend();
  console.log(`Created ${path.relative(path.resolve(__dirname, '..'), result.outputDir)}`);
  console.log(`Backend ${result.backendUrl}`);
}

module.exports = {
  buildVercelFrontend,
  normalizeBackendUrl,
};
