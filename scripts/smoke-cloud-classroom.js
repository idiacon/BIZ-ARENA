const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 3199);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = process.env.BIZ_ARENA_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-cloud-smoke-'));
const SHOULD_CLEAN_DATA_DIR = !process.env.BIZ_ARENA_DATA_DIR;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  throw new Error(`Cloud server did not answer at ${BASE_URL}`);
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
      ws.off('message', onMessage);
      reject(new Error(`Timed out waiting for WS event ${type}`));
    }, deadlineMs);

    function onMessage(chunk) {
      let payload = null;
      try {
        payload = JSON.parse(String(chunk));
      } catch {
        return;
      }
      if (payload.type !== type) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(payload);
    }

    ws.on('message', onMessage);
  });
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      BIZ_ARENA_DEPLOYMENT: 'cloud',
      BIZ_ARENA_APP_MODE: 'server',
      BIZ_ARENA_PUBLIC_URL: BASE_URL,
      BIZ_ARENA_ALLOW_REGISTRATION: 'true',
      BIZ_ARENA_DATA_DIR: DATA_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', chunk => process.stdout.write(`[cloud-server] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[cloud-server] ${chunk}`));

  let ws = null;
  try {
    const metaPayload = await waitForMeta();
    if (metaPayload.meta?.deployment !== 'cloud') {
      throw new Error(`Expected cloud deployment metadata: ${JSON.stringify(metaPayload)}`);
    }
    const expectedStorage = String(process.env.BIZ_ARENA_STORAGE || 'json').toLowerCase();
    if (metaPayload.meta?.storage?.backend !== expectedStorage) {
      throw new Error(`Expected ${expectedStorage} storage backend: ${JSON.stringify(metaPayload.meta?.storage)}`);
    }

    const health = await getJson('/api/health');
    if (health.status !== 200 || !health.json.ok) throw new Error('/api/health failed in cloud mode.');
    if (health.headers.get('cache-control') !== 'no-store') {
      throw new Error(`Cloud API responses must disable caching: ${health.headers.get('cache-control')}`);
    }
    if (health.headers.get('x-content-type-options') !== 'nosniff') {
      throw new Error('Cloud API responses are missing X-Content-Type-Options.');
    }
    if (!health.headers.get('content-security-policy')?.includes("frame-ancestors 'none'")) {
      throw new Error('Cloud responses are missing the expected Content-Security-Policy.');
    }

    const anonymousAccount = await getJson('/api/account?userName=CloudProbe');
    if (anonymousAccount.status !== 404) {
      throw new Error(`Cloud mode exposed legacy account lookup: ${anonymousAccount.status}`);
    }
    const anonymousState = await getJson('/api/state');
    if (anonymousState.status !== 200 || anonymousState.json.rooms?.length !== 0) {
      throw new Error(`Cloud mode exposed room discovery: ${JSON.stringify(anonymousState.json)}`);
    }

    const localAdminOverview = await getJson('/api/server/overview');
    if (localAdminOverview.status !== 403) {
      throw new Error(`Cloud mode exposed local admin overview: ${localAdminOverview.status}`);
    }
    const localAdminAction = await postJson('/api/server/action', {
      roomCode: 'ABCDE',
      action: 'pause-game',
    });
    if (localAdminAction.status !== 403) {
      throw new Error(`Cloud mode exposed local admin action: ${localAdminAction.status}`);
    }
    const anonymousCreate = await postJson('/api/rooms/create', {
      roomName: 'Anonymous Cloud Room',
      companyName: 'Anonymous Host',
      userName: 'Anonymous Teacher',
    });
    if (anonymousCreate.status !== 403) {
      throw new Error(`Cloud mode allowed anonymous room creation: ${anonymousCreate.status}`);
    }

    const weakRegister = await postJson('/api/teacher/register', {
      email: 'weak@example.com',
      password: 'short',
      displayName: 'Weak Teacher',
    });
    if (weakRegister.status !== 400) throw new Error(`Weak teacher password was not rejected: ${weakRegister.status}`);

    const teacherEmail = `teacher-${Date.now()}@example.com`;
    const registered = await postJson('/api/teacher/register', {
      email: teacherEmail,
      password: 'correct-horse-42',
      displayName: 'Cloud Teacher',
    });
    if (registered.status !== 201 || !registered.json.teacherSessionToken) {
      throw new Error(`Teacher registration failed: ${registered.status} ${JSON.stringify(registered.json)}`);
    }
    const teacherToken = registered.json.teacherSessionToken;

    const me = await getJson('/api/teacher/me', { token: teacherToken });
    if (me.status !== 200 || me.json.teacher?.email !== teacherEmail) throw new Error('/api/teacher/me did not return teacher account.');

    const hiddenCreated = await postJson('/api/teacher/action', {
      action: 'create-room',
      roomName: 'Hidden Cloud Smoke',
      companyName: 'Teacher Console',
      scenarioKey: 'motorcycles',
      difficulty: 'easy',
    }, { token: teacherToken });
    if (hiddenCreated.status !== 200 || !hiddenCreated.json.result?.roomCode) {
      throw new Error(`Hidden cloud room creation failed: ${hiddenCreated.status} ${JSON.stringify(hiddenCreated.json)}`);
    }
    const hiddenDirectory = await getJson('/api/rooms/directory');
    if (hiddenDirectory.status !== 200 || hiddenDirectory.json.rooms?.length !== 0
      || JSON.stringify(hiddenDirectory.json).includes(hiddenCreated.json.result.roomCode)) {
      throw new Error(`Code-only cloud room leaked into the directory: ${JSON.stringify(hiddenDirectory.json)}`);
    }

    const created = await postJson('/api/teacher/action', {
      action: 'create-room',
      roomName: 'Cloud Smoke',
      companyName: 'Teacher Console',
      scenarioKey: 'motorcycles',
      difficulty: 'easy',
      lobbyVisibility: 'listed',
    }, { token: teacherToken });
    if (created.status !== 200 || !created.json.result?.roomCode || !created.json.result?.studentUrl) {
      throw new Error(`Cloud room creation failed: ${created.status} ${JSON.stringify(created.json)}`);
    }
    const roomCode = created.json.result.roomCode;

    const directory = await getJson('/api/rooms/directory');
    const directoryRoom = directory.json.rooms?.find(room => room.name === 'Cloud Smoke');
    const expectedDirectoryKeys = ['directoryId', 'maxPlayers', 'name', 'playerCount', 'requiresCode', 'scenarioLabel', 'status'];
    if (directory.status !== 200 || directory.json.contract !== 'public-room-directory-v1' || !directoryRoom) {
      throw new Error(`Listed cloud room did not appear in the public directory: ${JSON.stringify(directory.json)}`);
    }
    if (JSON.stringify(directory.json).includes(roomCode)
      || JSON.stringify(Object.keys(directoryRoom).sort()) !== JSON.stringify(expectedDirectoryKeys)) {
      throw new Error(`Cloud directory crossed its public field boundary: ${JSON.stringify(directoryRoom)}`);
    }

    const studentUserName = `Student-${Date.now()}`;
    const joined = await postJson('/api/rooms/join', {
      roomCode,
      directoryId: directoryRoom.directoryId,
      companyName: 'Student Plant',
      userName: studentUserName,
    });
    if (joined.status !== 201 || !joined.json.sessionToken) {
      throw new Error(`Student join failed: ${joined.status} ${JSON.stringify(joined.json)}`);
    }
    const joinedPeer = await postJson('/api/rooms/join', {
      roomCode,
      companyName: 'Peer Plant',
      userName: `Peer-${Date.now()}`,
    });
    if (joinedPeer.status !== 201 || !joinedPeer.json.sessionToken) {
      throw new Error(`Peer join failed: ${joinedPeer.status} ${JSON.stringify(joinedPeer.json)}`);
    }

    const legacyWs = new WebSocket(`ws://127.0.0.1:${PORT}/ws?playerId=${encodeURIComponent(joined.json.playerId)}&sessionToken=${encodeURIComponent(joined.json.sessionToken)}`);
    await waitForWsEvent(legacyWs, 'error');
    legacyWs.close();

    const realtimeTicket = await postJson('/api/realtime/ticket', {
      playerId: joined.json.playerId,
    }, { playerToken: joined.json.sessionToken });
    if (realtimeTicket.status !== 201 || !realtimeTicket.json.ticket) {
      throw new Error(`Realtime ticket failed: ${realtimeTicket.status} ${JSON.stringify(realtimeTicket.json)}`);
    }
    ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?ticket=${encodeURIComponent(realtimeTicket.json.ticket)}`);
    await waitForWsEvent(ws, 'connected');

    const roomUpdated = waitForWsEvent(ws, 'room-updated');
    const ready = await postJson('/api/action', {
      playerId: joined.json.playerId,
      sessionToken: joined.json.sessionToken,
      action: 'toggle-ready',
    });
    if (ready.status !== 200) throw new Error(`Student ready action failed: ${ready.status}`);
    await roomUpdated;
    const peerReady = await postJson('/api/action', {
      playerId: joinedPeer.json.playerId,
      sessionToken: joinedPeer.json.sessionToken,
      action: 'toggle-ready',
    });
    if (peerReady.status !== 200) throw new Error(`Peer ready action failed: ${peerReady.status}`);

    const studentState = await getJson(
      `/api/state?view=student&playerId=${encodeURIComponent(joined.json.playerId)}`,
      { playerToken: joined.json.sessionToken }
    );
    if (studentState.status !== 200 || !studentState.json.roomVersion || !studentState.json.playerVersion) {
      throw new Error(`Student thin state failed: ${studentState.status} ${JSON.stringify(studentState.json)}`);
    }
    if (studentState.json.stateContract !== 'student-state-v2') throw new Error('Student state did not use student-state-v2 contract.');
    if (studentState.json.room?.summaryView !== 'student') throw new Error('Student summary did not use student view contract.');
    if (studentState.json.room?.summaryContract !== 'student-v2') throw new Error('Student room summary did not use student-v2 contract.');
    if (studentState.json.player?.playerContract !== 'student-player-v2') throw new Error('Student player summary did not use student-player-v2 contract.');
    if (studentState.json.player?.executionPlan) throw new Error('Student player summary leaked executionPlan.');
    if (studentState.json.player?.intel) throw new Error('Student player summary leaked intel payload.');
    if (studentState.json.room?.teacherAccountId) throw new Error('Student summary leaked teacherAccountId.');
    if (studentState.json.room?.teacherControls?.eventCatalog) throw new Error('Student summary leaked teacher event catalog.');
    if (studentState.json.room?.classDashboard) throw new Error('Student summary leaked classDashboard.');
    if (studentState.json.room?.classReadiness) throw new Error('Student summary leaked classReadiness.');
    if (studentState.json.room?.scenarioExperiment) throw new Error('Student summary leaked scenarioExperiment.');

    const escalatedState = await getJson(
      `/api/state?view=teacher&playerId=${encodeURIComponent(joined.json.playerId)}`,
      { playerToken: joined.json.sessionToken }
    );
    if (escalatedState.status !== 200 || escalatedState.json.room?.summaryView !== 'student') {
      throw new Error(`Student token escalated its state view: ${escalatedState.status} ${JSON.stringify(escalatedState.json.room)}`);
    }

    const unchanged = await getJson(
      `/api/state?view=student&playerId=${encodeURIComponent(joined.json.playerId)}&sinceRoomVersion=${studentState.json.roomVersion}&sincePlayerVersion=${studentState.json.playerVersion}`,
      { playerToken: joined.json.sessionToken }
    );
    if (unchanged.status !== 200 || unchanged.json.unchanged !== true) {
      throw new Error(`Unchanged state shortcut failed: ${unchanged.status} ${JSON.stringify(unchanged.json)}`);
    }

    const started = await postJson('/api/teacher/action', {
      action: 'start-game',
      roomCode,
    }, { token: teacherToken });
    if (started.status !== 200 || started.json.result?.status !== 'running') {
      throw new Error(`Teacher start failed: ${started.status} ${JSON.stringify(started.json)}`);
    }
    if (started.json.result?.lifecycle?.contract !== 'teacher-lifecycle-v1' || started.json.result?.lifecycle?.phase !== 'running') {
      throw new Error(`Teacher start did not return lifecycle contract: ${JSON.stringify(started.json.result)}`);
    }

    const closedDirectory = await getJson('/api/rooms/directory');
    if (closedDirectory.json.rooms?.some(room => room.directoryId === directoryRoom.directoryId)) {
      throw new Error(`Running cloud room remained in the public directory: ${JSON.stringify(closedDirectory.json)}`);
    }
    const lateJoin = await postJson('/api/rooms/join', {
      roomCode,
      companyName: 'Late Plant',
      userName: `Late-${Date.now()}`,
    });
    if (lateJoin.status !== 404 || lateJoin.json.error !== 'Комната недоступна') {
      throw new Error(`New cloud student joined after start: ${lateJoin.status} ${JSON.stringify(lateJoin.json)}`);
    }
    const reconnected = await postJson('/api/rooms/join', {
      roomCode,
      companyName: 'Student Plant',
      userName: studentUserName,
      sessionToken: joined.json.sessionToken,
    });
    if (reconnected.status !== 201 || reconnected.json.playerId !== joined.json.playerId) {
      throw new Error(`Existing cloud student could not reconnect after start: ${reconnected.status} ${JSON.stringify(reconnected.json)}`);
    }

    const forcedEvent = await postJson('/api/teacher/action', {
      action: 'force-event',
      roomCode,
      value: 'factory_supplier_delay',
    }, { token: teacherToken });
    if (forcedEvent.status !== 200 || forcedEvent.json.result?.status !== 'running') {
      throw new Error(`Teacher force-event failed: ${forcedEvent.status} ${JSON.stringify(forcedEvent.json)}`);
    }

    const overview = await getJson('/api/teacher/overview', { token: teacherToken });
    const smokeRoom = overview.json.overview?.rooms?.find(room => room.code === roomCode);
    if (overview.status !== 200 || !smokeRoom) throw new Error('Teacher overview did not include cloud room.');
    if (smokeRoom.humanCount !== 2 || smokeRoom.readyCount !== 2) {
      throw new Error(`Teacher host leaked into class readiness: ${JSON.stringify(smokeRoom)}`);
    }
    if (!smokeRoom.players?.some(player => player.companyName === 'Student Plant')) {
      throw new Error('Teacher overview did not include joined student.');
    }
    if (smokeRoom.activeEvent?.key !== 'factory_supplier_delay') {
      throw new Error(`Teacher overview did not expose forced crisis card: ${JSON.stringify(smokeRoom.activeEvent)}`);
    }
    if (!smokeRoom.teacherControls?.actions?.forceEvent) {
      throw new Error(`Teacher overview did not expose crisis card controls: ${JSON.stringify(smokeRoom.teacherControls)}`);
    }
    if (smokeRoom.teacherControls?.lifecycle?.contract !== 'teacher-lifecycle-v1') {
      throw new Error(`Teacher overview did not expose lifecycle contract: ${JSON.stringify(smokeRoom.teacherControls)}`);
    }

    const badTeacher = await postJson('/api/teacher/action', {
      action: 'pause-game',
      roomCode,
    }, { token: 'wrong-token' });
    if (badTeacher.status !== 403) throw new Error(`Invalid teacher token was not rejected: ${badTeacher.status}`);

    const invalidResume = await postJson('/api/teacher/action', {
      action: 'resume-game',
      roomCode,
    }, { token: teacherToken });
    if (invalidResume.status !== 400) {
      throw new Error(`Teacher resumed a running cloud match: ${invalidResume.status} ${JSON.stringify(invalidResume.json)}`);
    }

    const paused = await postJson('/api/teacher/action', {
      action: 'pause-game',
      roomCode,
    }, { token: teacherToken });
    if (paused.status !== 200 || paused.json.result?.lifecycle?.phase !== 'paused' || paused.json.result?.lifecycle?.primaryAction !== 'resume-game') {
      throw new Error(`Teacher pause lifecycle failed: ${paused.status} ${JSON.stringify(paused.json)}`);
    }

    const pausedOverview = await getJson('/api/teacher/overview', { token: teacherToken });
    const pausedRoom = pausedOverview.json.overview?.rooms?.find(room => room.code === roomCode);
    if (pausedRoom?.teacherControls?.lifecycle?.phase !== 'paused') {
      throw new Error(`Teacher reconnect overview lost paused lifecycle: ${JSON.stringify(pausedRoom)}`);
    }

    const resumed = await postJson('/api/teacher/action', {
      action: 'resume-game',
      roomCode,
    }, { token: teacherToken });
    if (resumed.status !== 200 || resumed.json.result?.lifecycle?.phase !== 'running') {
      throw new Error(`Teacher resume lifecycle failed: ${resumed.status} ${JSON.stringify(resumed.json)}`);
    }

    const nextTurn = await postJson('/api/teacher/action', {
      action: 'next-turn',
      roomCode,
    }, { token: teacherToken });
    if (nextTurn.status !== 200 || nextTurn.json.result?.day !== 2) {
      throw new Error(`Teacher next-turn lifecycle failed: ${nextTurn.status} ${JSON.stringify(nextTurn.json)}`);
    }

    const finished = await postJson('/api/teacher/action', {
      action: 'finish-room',
      roomCode,
    }, { token: teacherToken });
    if (finished.status !== 200 || finished.json.result?.lifecycle?.phase !== 'finished' || !finished.json.result?.lifecycle?.canOpenDebrief) {
      throw new Error(`Teacher finish lifecycle failed: ${finished.status} ${JSON.stringify(finished.json)}`);
    }

    const finalOverview = await getJson('/api/teacher/overview', { token: teacherToken });
    const finalRoom = finalOverview.json.overview?.rooms?.find(room => room.code === roomCode);
    if (finalRoom?.teacherControls?.lifecycle?.phase !== 'finished' || finalRoom?.teacherControls?.lifecycle?.nextExpectedPhase !== 'debrief') {
      throw new Error(`Teacher final overview did not expose debrief lifecycle: ${JSON.stringify(finalRoom)}`);
    }

    const finalStudentState = await getJson(
      `/api/state?view=student&playerId=${encodeURIComponent(joined.json.playerId)}`,
      { playerToken: joined.json.sessionToken }
    );
    if (finalStudentState.json.room?.classDebrief || !finalStudentState.json.player?.playerDebrief) {
      throw new Error(`Student final state crossed debrief role boundary: ${JSON.stringify(finalStudentState.json)}`);
    }

    const result = {
      ok: true,
      deployment: metaPayload.meta.deployment,
      storageBackend: metaPayload.meta.storage.backend,
      dataDir: DATA_DIR,
      roomCode,
      teacherAuth: true,
      studentJoin: true,
      thinState: true,
      studentViewEscalationClosed: true,
      unchangedState: true,
      localAdminEndpointsClosed: true,
      anonymousRoomCreationClosed: true,
      anonymousAccountLookupClosed: true,
      anonymousRoomDiscoveryClosed: true,
      codeOnlyLobbyHidden: true,
      publicDirectorySafe: true,
      directoryConfirmationRequired: true,
      lateJoinRejected: true,
      activeReconnectAccepted: true,
      securityHeaders: true,
      legacyWebsocketAuthRejected: true,
      websocketInvalidation: true,
      teacherOverview: true,
      cloudCrisisCards: true,
      teacherLifecycle: true,
      teacherReconnectPaused: true,
      teacherDebrief: true,
      studentDebriefBoundary: true,
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (ws) ws.close();
    child.kill();
    if (SHOULD_CLEAN_DATA_DIR) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
