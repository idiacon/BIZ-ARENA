const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const rootDir = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3299);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PROFILE_LABEL = process.env.BIZ_ARENA_SMOKE_PROFILE || 'Durable cloud';
const PROFILE_SLUG = PROFILE_LABEL.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cloud';
const DATA_DIR = process.env.BIZ_ARENA_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), `biz-arena-${PROFILE_SLUG}-smoke-`));
const SQLITE_PATH = process.env.BIZ_ARENA_SQLITE_PATH || path.join(DATA_DIR, 'biz-arena.sqlite');
const SHOULD_CLEAN_DATA_DIR = !process.env.BIZ_ARENA_DATA_DIR;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function profileEnv(allowRegistration) {
  return {
    ...process.env,
    PORT: String(PORT),
    BIZ_ARENA_HOST: '127.0.0.1',
    NODE_ENV: 'production',
    BIZ_ARENA_DEPLOYMENT: 'cloud',
    BIZ_ARENA_APP_MODE: 'server',
    BIZ_ARENA_STORAGE: 'sqlite',
    BIZ_ARENA_DATA_DIR: DATA_DIR,
    BIZ_ARENA_SQLITE_PATH: SQLITE_PATH,
    BIZ_ARENA_PUBLIC_URL: BASE_URL,
    BIZ_ARENA_ALLOW_REGISTRATION: allowRegistration ? 'true' : 'false',
  };
}

function startServer(allowRegistration) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: rootDir,
    env: profileEnv(allowRegistration),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', chunk => process.stdout.write(`[${PROFILE_SLUG}-server] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[${PROFILE_SLUG}-server] ${chunk}`));
  return child;
}

function stopServer(child) {
  return new Promise(resolve => {
    if (!child || child.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 5000);
    child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function waitForMeta(deadlineMs = 15000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/meta`);
      if (response.ok) return response.json();
    } catch {
      await wait(250);
    }
  }
  throw new Error(`${PROFILE_LABEL} profile server did not answer at ${BASE_URL}`);
}

async function getJson(pathname, { token, playerToken } = {}) {
  const headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(playerToken ? { 'X-Player-Session': playerToken } : {}),
  };
  const response = await fetch(`${BASE_URL}${pathname}`, { headers });
  const json = await response.json();
  return { status: response.status, json, headers: response.headers };
}

async function postJson(pathname, body, { token, playerToken } = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(playerToken ? { 'X-Player-Session': playerToken } : {}),
  };
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json };
}

function waitForWsEvent(ws, type, deadlineMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for WS event ${type}`));
    }, deadlineMs);

    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage);
      ws.off('error', onError);
      ws.off('close', onClose);
    }

    function onMessage(chunk) {
      let payload = null;
      try {
        payload = JSON.parse(String(chunk));
      } catch {
        return;
      }
      if (payload.type !== type) return;
      cleanup();
      resolve(payload);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onClose() {
      cleanup();
      reject(new Error(`WebSocket closed before ${type}`));
    }

    ws.on('message', onMessage);
    ws.on('error', onError);
    ws.on('close', onClose);
  });
}

function assertDurableCloudMeta(metaPayload) {
  const meta = metaPayload.meta;
  if (meta?.deployment !== 'cloud') {
    throw new Error(`Expected cloud deployment metadata: ${JSON.stringify(metaPayload)}`);
  }
  if (meta?.storage?.backend !== 'sqlite') {
    throw new Error(`Expected sqlite storage backend: ${JSON.stringify(meta?.storage)}`);
  }
  if (meta?.storage?.durable !== true) {
    throw new Error(`Expected durable storage metadata: ${JSON.stringify(meta?.storage)}`);
  }
  if (meta?.storage?.warning) {
    throw new Error(`${PROFILE_LABEL} profile should not show a storage warning: ${meta.storage.warning}`);
  }
  if (meta?.host !== '127.0.0.1') {
    throw new Error(`Expected reverse-proxy-only host binding: ${JSON.stringify(meta)}`);
  }
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const teacherEmail = `${PROFILE_SLUG}-teacher-${Date.now()}@example.com`;
  const teacherPassword = 'correct-horse-42';
  let roomCode = '';
  let playerId = '';
  let playerSessionToken = '';
  let child = null;
  let ws = null;

  try {
    child = startServer(true);
    assertDurableCloudMeta(await waitForMeta());

    const health = await getJson('/api/health');
    if (health.status !== 200 || !health.json.ok) throw new Error(`/api/health failed in ${PROFILE_LABEL} profile.`);
    if (health.headers.get('cache-control') !== 'no-store' || health.headers.get('x-content-type-options') !== 'nosniff') {
      throw new Error(`${PROFILE_LABEL} API security headers are incomplete.`);
    }

    const anonymousAccount = await getJson('/api/account?userName=CloudProbe');
    if (anonymousAccount.status !== 404) {
      throw new Error(`${PROFILE_LABEL} exposed legacy account lookup: ${anonymousAccount.status}`);
    }

    const registered = await postJson('/api/teacher/register', {
      email: teacherEmail,
      password: teacherPassword,
      displayName: `${PROFILE_LABEL} Teacher`,
    });
    if (registered.status !== 201 || !registered.json.teacherSessionToken) {
      throw new Error(`Teacher registration failed: ${registered.status} ${JSON.stringify(registered.json)}`);
    }
    const teacherToken = registered.json.teacherSessionToken;

    const created = await postJson('/api/teacher/action', {
      action: 'create-room',
      roomName: `${PROFILE_LABEL} Smoke Room`,
      companyName: 'Teacher Console',
      scenarioKey: 'motorcycles',
      difficulty: 'easy',
    }, { token: teacherToken });
    if (created.status !== 200 || !created.json.result?.roomCode) {
      throw new Error(`Cloud room creation failed: ${created.status} ${JSON.stringify(created.json)}`);
    }
    roomCode = created.json.result.roomCode;

    const joined = await postJson('/api/rooms/join', {
      roomCode,
      companyName: `${PROFILE_LABEL} Student Plant`,
      userName: `${PROFILE_LABEL} Student ${Date.now()}`,
    });
    if (joined.status !== 201 || !joined.json.sessionToken) {
      throw new Error(`Student join failed: ${joined.status} ${JSON.stringify(joined.json)}`);
    }
    playerId = joined.json.playerId;
    playerSessionToken = joined.json.sessionToken;

    const realtimeTicket = await postJson('/api/realtime/ticket', {
      playerId,
    }, { playerToken: playerSessionToken });
    if (realtimeTicket.status !== 201 || !realtimeTicket.json.ticket) {
      throw new Error(`Realtime ticket failed: ${realtimeTicket.status} ${JSON.stringify(realtimeTicket.json)}`);
    }
    ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?ticket=${encodeURIComponent(realtimeTicket.json.ticket)}`);
    await waitForWsEvent(ws, 'connected');
    const roomUpdated = waitForWsEvent(ws, 'room-updated');
    const ready = await postJson('/api/action', {
      playerId,
      sessionToken: playerSessionToken,
      action: 'toggle-ready',
    });
    if (ready.status !== 200) throw new Error(`Student ready action failed: ${ready.status}`);
    await roomUpdated;
    await wait(750);

    ws.close();
    ws = null;
    await stopServer(child);
    child = null;

    if (!fs.existsSync(SQLITE_PATH)) {
      throw new Error(`SQLite database was not created: ${SQLITE_PATH}`);
    }

    child = startServer(false);
    const restartedMeta = await waitForMeta();
    assertDurableCloudMeta(restartedMeta);
    if (restartedMeta.meta?.allowRegistration !== false) {
      throw new Error(`Expected registration lock after restart: ${JSON.stringify(restartedMeta.meta)}`);
    }

    const lockedRegister = await postJson('/api/teacher/register', {
      email: `blocked-${Date.now()}@example.com`,
      password: teacherPassword,
      displayName: 'Blocked Teacher',
    });
    if (lockedRegister.status !== 403) {
      throw new Error(`Registration lock did not reject new teacher: ${lockedRegister.status}`);
    }

    const loggedIn = await postJson('/api/teacher/login', {
      email: teacherEmail,
      password: teacherPassword,
    });
    if (loggedIn.status !== 200 || !loggedIn.json.teacherSessionToken) {
      throw new Error(`Persisted teacher login failed: ${loggedIn.status} ${JSON.stringify(loggedIn.json)}`);
    }

    const overview = await getJson('/api/teacher/overview', { token: loggedIn.json.teacherSessionToken });
    const restoredRoom = overview.json.overview?.rooms?.find(room => room.code === roomCode);
    if (overview.status !== 200 || !restoredRoom) {
      throw new Error(`Persisted room was not restored: ${overview.status} ${JSON.stringify(overview.json)}`);
    }

    const studentState = await getJson(
      `/api/state?view=student&playerId=${encodeURIComponent(playerId)}`,
      { playerToken: playerSessionToken }
    );
    if (studentState.status !== 200 || studentState.json.room?.code !== roomCode) {
      throw new Error(`Persisted student session failed: ${studentState.status} ${JSON.stringify(studentState.json)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      deployment: restartedMeta.meta.deployment,
      host: restartedMeta.meta.host,
      storageBackend: restartedMeta.meta.storage.backend,
      durable: restartedMeta.meta.storage.durable,
      dataDir: DATA_DIR,
      sqlitePath: SQLITE_PATH,
      registrationLocked: true,
      anonymousAccountLookupClosed: true,
      securityHeaders: true,
      restoredRoom: roomCode,
      restoredStudentSession: true,
      websocketInvalidation: true,
    }, null, 2));
  } finally {
    if (ws) ws.close();
    if (child) await stopServer(child);
    if (SHOULD_CLEAN_DATA_DIR) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
