const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildVercelFrontend } = require('../scripts/build-vercel-frontend');

test('Vercel frontend build copies the web client and injects the HTTPS backend origin', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-vercel-'));
  try {
    const result = buildVercelFrontend({
      rootDir: path.join(__dirname, '..'),
      outputDir,
      backendUrl: 'https://api.example.com/',
    });

    const indexHtml = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
    const runtimeConfig = fs.readFileSync(path.join(outputDir, 'runtime-config.js'), 'utf8');

    assert.equal(result.backendUrl, 'https://api.example.com');
    assert.ok(fs.existsSync(path.join(outputDir, 'app.js')));
    assert.ok(fs.existsSync(path.join(outputDir, 'ui', 'tutorial-ui.js')));
    assert.match(runtimeConfig, /https:\/\/api\.example\.com/);
    assert.ok(indexHtml.indexOf('/runtime-config.js') < indexHtml.indexOf('/app-runtime.js'));
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('Vercel frontend build rejects an insecure or path-scoped backend URL', () => {
  assert.throws(
    () => buildVercelFrontend({ backendUrl: 'http://api.example.com' }),
    /absolute HTTPS URL/,
  );
  assert.throws(
    () => buildVercelFrontend({ backendUrl: 'https://api.example.com/biz-arena' }),
    /without a path/,
  );
});

test('Vercel project config publishes only the generated static frontend routes', () => {
  const rootDir = path.join(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8'));

  assert.equal(packageJson.scripts['build:vercel'], 'node scripts/build-vercel-frontend.js');
  assert.equal(vercelConfig.buildCommand, 'npm run build:vercel');
  assert.equal(vercelConfig.outputDirectory, 'dist/vercel-public');
  assert.deepEqual(
    vercelConfig.rewrites,
    [
      { source: '/client', destination: '/index.html' },
      { source: '/server', destination: '/index.html' },
    ],
  );
});
