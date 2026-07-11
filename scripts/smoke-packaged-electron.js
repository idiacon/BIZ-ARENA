const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 3399);
const baseUrl = `http://127.0.0.1:${port}`;
const storageBackend = String(process.env.BIZ_ARENA_STORAGE || 'sqlite').toLowerCase();

const serverExe = path.join(distDir, `BizArena-Server-${version}-Portable-x64.exe`);
const clientExe = path.join(distDir, `BizArena-Client-${version}-Portable-x64.exe`);

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Required packaged artifact is missing: ${filePath}`);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(deadlineMs = 30_000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const payload = await response.json();
      if (response.ok && payload.ok) return payload;
    } catch {
      await wait(500);
    }
  }
  throw new Error(`Packaged server did not answer /api/health at ${baseUrl}`);
}

async function getMeta() {
  const response = await fetch(`${baseUrl}/api/meta`);
  const payload = await response.json();
  if (!response.ok || payload.meta?.storage?.backend !== storageBackend) {
    throw new Error(`Packaged server storage backend mismatch: ${JSON.stringify(payload)}`);
  }
  return payload.meta;
}

function launch(exePath, envPatch = {}) {
  const child = spawn(exePath, [], {
    cwd: distDir,
    env: {
      ...process.env,
      ...envPatch,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', chunk => process.stdout.write(`[${path.basename(exePath)}] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[${path.basename(exePath)}] ${chunk}`));
  return child;
}

function isRunning(child) {
  return child && child.exitCode === null && child.signalCode === null;
}

function killTree(child) {
  if (!child || !child.pid) return;
  try {
    execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    try {
      child.kill();
    } catch {
      // The process may already be gone.
    }
  }
}

async function main() {
  assertFile(serverExe);
  assertFile(clientExe);

  let serverProcess = null;
  let clientProcess = null;
  try {
    serverProcess = launch(serverExe, {
      PORT: String(port),
      BIZ_ARENA_DESKTOP_MODE: 'server',
      BIZ_ARENA_STORAGE: storageBackend,
      BIZ_ARENA_DATA_DIR: path.join(distDir, 'packaged-smoke-data'),
    });
    await waitForHealth();
    const meta = await getMeta();
    if (!isRunning(serverProcess)) throw new Error('Packaged Server exited during smoke.');

    clientProcess = launch(clientExe, {
      PORT: String(port),
      BIZ_ARENA_DESKTOP_MODE: 'client',
      BIZ_ARENA_SERVER_URL: `${baseUrl}/client`,
    });
    await wait(5000);
    if (!isRunning(clientProcess)) throw new Error('Packaged Client exited during smoke.');

    console.log(JSON.stringify({
      ok: true,
      version,
      storageBackend: meta.storage.backend,
      serverExe: path.basename(serverExe),
      clientExe: path.basename(clientExe),
      healthUrl: `${baseUrl}/api/health`,
      serverRunning: true,
      clientRunning: true,
    }, null, 2));
  } finally {
    killTree(clientProcess);
    killTree(serverProcess);
    fs.rmSync(path.join(distDir, 'packaged-smoke-data'), { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
