const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const {
  browserErrors,
  connectRemoteBrowser,
  evaluate,
  installPlayerSession,
  navigate,
  waitFor,
} = require('./lib/cdp-browser');

const rootDir = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 3399);
const baseUrl = `http://127.0.0.1:${port}`;
const storageBackend = String(process.env.BIZ_ARENA_STORAGE || 'sqlite').toLowerCase();
const serverCdpPort = Number(process.env.BIZ_ARENA_PACKAGED_SERVER_CDP_PORT || 9450);
const clientCdpPort = Number(process.env.BIZ_ARENA_PACKAGED_CLIENT_CDP_PORT || 9451);
const screenshotDir = path.join(distDir, 'packaged-smoke-screenshots');

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

function launch(exePath, envPatch = {}, args = []) {
  const child = spawn(exePath, args, {
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

async function postJson(route, payload) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${route} failed: ${response.status} ${JSON.stringify(result)}`);
  return result;
}

async function createVisualQaClassroom() {
  const teacher = await postJson('/api/rooms/create', {
    roomName: 'ELECTRON-QA',
    companyName: 'Альфа',
    userName: 'Electron Teacher',
    avatar: 'ET',
    teacherHost: true,
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
    maxPlayers: 4,
    dayLimit: 5,
    turnDurationMs: 300000,
  });
  const student = await postJson('/api/rooms/join', {
    roomCode: teacher.roomCode,
    companyName: 'Бета',
    userName: 'Electron Student',
    avatar: 'ES',
  });
  await postJson('/api/action', {
    playerId: student.playerId,
    sessionToken: student.sessionToken,
    action: 'toggle-ready',
  });
  await postJson('/api/server/action', {
    roomCode: teacher.roomCode,
    action: 'start-game',
  });
  return { teacher, student, roomCode: teacher.roomCode };
}

async function captureScreenshot(cdp, fileName) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const filePath = path.join(screenshotDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  return filePath;
}

async function auditElectronRoleSurface(cdp, { label, role, selector, fileName }) {
  await waitFor(
    cdp,
    `document.body.dataset.playerRole === ${JSON.stringify(role)} && Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    `${label} role surface`,
    120,
  );
  const layout = await evaluate(cdp, `(() => {
    const root = document.querySelector(${JSON.stringify(selector)});
    const rect = root?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const overflow = Math.max(
      document.documentElement.scrollWidth - viewportWidth,
      document.body.scrollWidth - viewportWidth,
    );
    const markers = ['????', 'вЂ', 'в‚', 'Ð', 'Ñ', 'Рџ', 'РЎ', 'Рќ'];
    const text = document.body.innerText || '';
    return {
      role: document.body.dataset.playerRole || '',
      visible: Boolean(root && rect && rect.width > 400 && rect.height > 300),
      width: Math.round(rect?.width || 0),
      height: Math.round(rect?.height || 0),
      overflow,
      textMarkers: markers.filter(marker => text.includes(marker)),
    };
  })()`);
  const errors = browserErrors(cdp);
  const screenshotPath = await captureScreenshot(cdp, fileName);
  const ok = layout.role === role
    && layout.visible
    && layout.overflow <= 4
    && layout.textMarkers.length === 0
    && errors.length === 0;
  if (!ok) throw new Error(`${label} packaged Electron audit failed: ${JSON.stringify({ layout, errors: errors.slice(0, 8) })}`);
  return {
    ok,
    label,
    selector,
    screenshotPath,
    layout,
    browserErrors: errors,
  };
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
  let serverCdp = null;
  let clientCdp = null;
  try {
    fs.rmSync(path.join(distDir, 'packaged-smoke-data'), { recursive: true, force: true });
    fs.rmSync(screenshotDir, { recursive: true, force: true });
    fs.mkdirSync(screenshotDir, { recursive: true });
    serverProcess = launch(serverExe, {
      PORT: String(port),
      BIZ_ARENA_DESKTOP_MODE: 'server',
      BIZ_ARENA_STORAGE: storageBackend,
      BIZ_ARENA_DATA_DIR: path.join(distDir, 'packaged-smoke-data'),
    }, [`--remote-debugging-port=${serverCdpPort}`]);
    await waitForHealth();
    const meta = await getMeta();
    if (!isRunning(serverProcess)) throw new Error('Packaged Server exited during smoke.');

    const classroom = await createVisualQaClassroom();
    serverCdp = await connectRemoteBrowser({ cdpPort: serverCdpPort, label: 'packaged Server.exe', startupAttempts: 200 });
    await installPlayerSession(serverCdp, {
      ...classroom.teacher,
      roomCode: classroom.roomCode,
      userName: 'Electron Teacher',
      performanceMode: 'standard',
      gameTab: 'teacher',
    });
    await navigate(serverCdp, `${baseUrl}/server`);
    await evaluate(serverCdp, 'showScreen("game-screen"); setGameTab("teacher"); true');

    clientProcess = launch(clientExe, {
      PORT: String(port),
      BIZ_ARENA_DESKTOP_MODE: 'client',
      BIZ_ARENA_SERVER_URL: `${baseUrl}/client`,
    }, [`--remote-debugging-port=${clientCdpPort}`]);
    clientCdp = await connectRemoteBrowser({ cdpPort: clientCdpPort, label: 'packaged Client.exe', startupAttempts: 200 });
    await installPlayerSession(clientCdp, {
      ...classroom.student,
      roomCode: classroom.roomCode,
      userName: 'Electron Student',
      performanceMode: 'standard',
      gameTab: 'operations',
    });
    await navigate(clientCdp, `${baseUrl}/client?roomCode=${encodeURIComponent(classroom.roomCode)}`);
    await evaluate(clientCdp, 'showScreen("game-screen"); setGameTab("operations"); true');
    await wait(1000);
    if (!isRunning(clientProcess)) throw new Error('Packaged Client exited during smoke.');

    const visualQa = {
      teacher: await auditElectronRoleSurface(serverCdp, {
        label: 'teacher operations center',
        role: 'teacher',
        selector: '.teacher-operations-center',
        fileName: 'teacher-operations-center.png',
      }),
      student: await auditElectronRoleSurface(clientCdp, {
        label: 'student premium tycoon',
        role: 'student',
        selector: '.student-tycoon-console',
        fileName: 'student-premium-tycoon.png',
      }),
    };

    console.log(JSON.stringify({
      ok: true,
      version,
      storageBackend: meta.storage.backend,
      serverExe: path.basename(serverExe),
      clientExe: path.basename(clientExe),
      healthUrl: `${baseUrl}/api/health`,
      serverRunning: true,
      clientRunning: true,
      visualQa,
    }, null, 2));
  } finally {
    serverCdp?.close();
    clientCdp?.close();
    killTree(clientProcess);
    killTree(serverProcess);
    fs.rmSync(path.join(distDir, 'packaged-smoke-data'), { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
