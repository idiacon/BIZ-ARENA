const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const ROOT_DIR = path.resolve(__dirname, '..');
const REQUESTED_PORT = Number(process.env.BIZ_ARENA_LOAD_PORT || 0);
let PORT = 0;
let BASE_URL = '';
const STUDENT_COUNT = Math.min(30, Math.max(25, Number(process.env.BIZ_ARENA_LOAD_STUDENTS || 30)));
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-load-'));
const LIMITS_MS = {
  joinP95: Number(process.env.BIZ_ARENA_LOAD_JOIN_P95_MS || 1500),
  stateP95: Number(process.env.BIZ_ARENA_LOAD_STATE_P95_MS || 750),
  actionP95: Number(process.env.BIZ_ARENA_LOAD_ACTION_P95_MS || 1000),
};

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function canListenOnLocalhost(port) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve(true));
    });
  });
}

async function chooseLoadPort() {
  if (REQUESTED_PORT) {
    if (await canListenOnLocalhost(REQUESTED_PORT)) return REQUESTED_PORT;
    throw new Error(`Requested load-test port ${REQUESTED_PORT} is already in use on 127.0.0.1.`);
  }
  for (let port = 33217; port < 33317; port += 1) {
    if (await canListenOnLocalhost(port)) return port;
  }
  throw new Error('Could not find a free localhost port for the classroom load test.');
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
}

function summarize(values) {
  return {
    count: values.length,
    minMs: Math.min(...values),
    avgMs: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: Math.max(...values),
  };
}

async function timed(operation) {
  const startedAt = performance.now();
  const result = await operation();
  return { result, elapsedMs: Math.round(performance.now() - startedAt) };
}

async function requestJson(pathname, { method = 'GET', body, token, playerToken } = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(playerToken ? { 'X-Player-Session': playerToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${method} ${pathname} failed (${response.status}): ${JSON.stringify(json)}`);
  return json;
}

async function waitForServer(deadlineMs = 15000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const health = await requestJson('/api/health');
      if (health.ok) return health;
    } catch {
      await wait(150);
    }
  }
  throw new Error(`Load-test server did not answer at ${BASE_URL}`);
}

async function connectStudent(student) {
  const ticketPayload = await requestJson('/api/realtime/ticket', {
    method: 'POST',
    body: { playerId: student.playerId },
    playerToken: student.sessionToken,
  });
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?ticket=${encodeURIComponent(ticketPayload.ticket)}`);
    const timer = setTimeout(() => reject(new Error(`WebSocket timeout for ${student.playerId}`)), 5000);
    ws.once('message', chunk => {
      const payload = JSON.parse(String(chunk));
      if (payload.type !== 'connected') return reject(new Error(`Unexpected WebSocket response: ${String(chunk)}`));
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', reject);
  });
}

async function main() {
  PORT = await chooseLoadPort();
  BASE_URL = `http://127.0.0.1:${PORT}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      BIZ_ARENA_HOST: '127.0.0.1',
      BIZ_ARENA_DEPLOYMENT: 'cloud',
      BIZ_ARENA_APP_MODE: 'server',
      BIZ_ARENA_STORAGE: 'sqlite',
      BIZ_ARENA_DATA_DIR: DATA_DIR,
      BIZ_ARENA_SQLITE_PATH: path.join(DATA_DIR, 'biz-arena-load.sqlite'),
      BIZ_ARENA_PUBLIC_URL: BASE_URL,
      BIZ_ARENA_ALLOW_REGISTRATION: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const serverOutput = [];
  child.stdout.on('data', chunk => serverOutput.push(String(chunk)));
  child.stderr.on('data', chunk => serverOutput.push(String(chunk)));
  const sockets = [];

  try {
    await waitForServer().catch(error => {
      const detail = serverOutput.join('').trim();
      if (detail) error.message = `${error.message}\nServer output:\n${detail}`;
      throw error;
    });
    const registered = await requestJson('/api/teacher/register', {
      method: 'POST',
      body: {
        email: `load-${Date.now()}@example.com`,
        password: 'classroom-load-42',
        displayName: 'Load Teacher',
      },
    });
    const teacherToken = registered.teacherSessionToken;
    const created = await requestJson('/api/teacher/action', {
      method: 'POST',
      token: teacherToken,
      body: {
        action: 'create-room',
        roomName: '30 Student Load Test',
        companyName: 'Teacher Console',
        scenarioKey: 'motorcycles',
        difficulty: 'easy',
        maxPlayers: STUDENT_COUNT,
      },
    });
    const roomCode = created.result.roomCode;

    const joinSamples = await Promise.all(Array.from({ length: STUDENT_COUNT }, async (_, index) => {
      const sample = await timed(() => requestJson('/api/rooms/join', {
        method: 'POST',
        body: {
          roomCode,
          companyName: `Load Team ${index + 1}`,
          userName: `Load Student ${index + 1}`,
        },
      }));
      return { ...sample.result, elapsedMs: sample.elapsedMs };
    }));

    sockets.push(...await Promise.all(joinSamples.map(connectStudent)));

    const actionSamples = await Promise.all(joinSamples.map(async (student, index) => {
      const sample = await timed(() => requestJson('/api/action', {
        method: 'POST',
        body: {
          playerId: student.playerId,
          sessionToken: student.sessionToken,
          actionId: `load-ready-${Date.now()}-${index}`,
          action: 'toggle-ready',
        },
      }));
      return sample.elapsedMs;
    }));

    const stateSamples = await Promise.all(joinSamples.map(async student => {
      const pathName = `/api/state?view=student&playerId=${encodeURIComponent(student.playerId)}`;
      const first = await timed(() => requestJson(pathName, { playerToken: student.sessionToken }));
      if (first.result.stateContract !== 'student-state-v2') throw new Error('Student load request did not receive student-state-v2.');
      if (first.result.room?.summaryView !== 'student') throw new Error('Student load request did not receive thin student view.');
      if (first.result.room?.summaryContract !== 'student-v2') throw new Error('Student load request did not receive student-v2 room contract.');
      if (first.result.player?.playerContract !== 'student-player-v2') throw new Error('Student load request did not receive student-player-v2.');
      const unchanged = await requestJson(
        `${pathName}&sinceRoomVersion=${first.result.roomVersion}&sincePlayerVersion=${first.result.playerVersion}`,
        { playerToken: student.sessionToken }
      );
      if (unchanged.unchanged !== true) throw new Error('Student unchanged-state shortcut failed under load.');
      return first.elapsedMs;
    }));

    const started = await requestJson('/api/teacher/action', {
      method: 'POST',
      token: teacherToken,
      body: { action: 'start-game', roomCode },
    });
    if (started.result.status !== 'running') throw new Error('30-student room did not start.');

    const overview = await requestJson('/api/teacher/overview', { token: teacherToken });
    const room = overview.overview.rooms.find(item => item.code === roomCode);
    if (!room || room.humanCount !== STUDENT_COUNT || room.readyCount !== STUDENT_COUNT) {
      throw new Error(`Teacher overview count mismatch: ${JSON.stringify(room)}`);
    }

    const join = summarize(joinSamples.map(sample => sample.elapsedMs));
    const state = summarize(stateSamples);
    const action = summarize(actionSamples);
    const failures = [];
    if (join.p95Ms > LIMITS_MS.joinP95) failures.push(`join p95 ${join.p95Ms}ms > ${LIMITS_MS.joinP95}ms`);
    if (state.p95Ms > LIMITS_MS.stateP95) failures.push(`state p95 ${state.p95Ms}ms > ${LIMITS_MS.stateP95}ms`);
    if (action.p95Ms > LIMITS_MS.actionP95) failures.push(`action p95 ${action.p95Ms}ms > ${LIMITS_MS.actionP95}ms`);

    const result = {
      ok: failures.length === 0,
      profile: 'cloud-sqlite',
      port: PORT,
      students: STUDENT_COUNT,
      websocketConnections: sockets.filter(socket => socket.readyState === WebSocket.OPEN).length,
      roomStarted: true,
      teacherOverviewCounts: { joined: room.humanCount, ready: room.readyCount },
      latency: { join, state, action },
      limitsMs: LIMITS_MS,
      failures,
    };
    console.log(JSON.stringify(result, null, 2));
    if (failures.length) throw new Error(`Classroom load acceptance failed: ${failures.join('; ')}`);
  } finally {
    sockets.forEach(socket => socket.close());
    child.kill();
    await wait(250);
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
