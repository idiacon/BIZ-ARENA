const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3099);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = process.env.BIZ_ARENA_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-lan-smoke-'));
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
  throw new Error(`Server did not answer at ${BASE_URL}`);
}

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function main() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      BIZ_ARENA_APP_MODE: 'server',
      BIZ_ARENA_DATA_DIR: DATA_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', chunk => process.stdout.write(`[server] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[server] ${chunk}`));

  try {
    const metaPayload = await waitForMeta();
    const health = await fetch(`${BASE_URL}/api/health`).then(response => response.json());
    if (!health.ok) throw new Error('/api/health did not return ok.');
    const qrResponse = await fetch(`${BASE_URL}/api/qr?data=${encodeURIComponent(`${BASE_URL}/client`)}`);
    const qrSvg = await qrResponse.text();
    if (!qrResponse.ok || !qrSvg.includes('<svg')) throw new Error('/api/qr did not return SVG.');
    const networkCheckResponse = await fetch(`${BASE_URL}/api/network/check?url=${encodeURIComponent(`${BASE_URL}/api/health`)}`);
    const networkCheck = await networkCheckResponse.json();
    if (!networkCheckResponse.ok || !networkCheck.result?.ok) {
      throw new Error(`/api/network/check did not confirm local health: ${JSON.stringify(networkCheck)}`);
    }
    const created = await post('/api/rooms/create', {
      roomName: 'LAN Smoke',
      companyName: 'Host Plant',
      userName: `Host-${Date.now()}`,
      scenarioKey: 'motorcycles',
      difficulty: 'easy',
      lobbyVisibility: 'listed',
    });
    if (created.status !== 201 || !created.json.sessionToken) {
      throw new Error(`Create room failed: ${created.status} ${JSON.stringify(created.json)}`);
    }

    const anonymousState = await fetch(`${BASE_URL}/api/state`).then(response => response.json());
    if (anonymousState.rooms?.length !== 0 || JSON.stringify(anonymousState).includes(created.json.roomCode)) {
      throw new Error(`Anonymous state leaked room discovery data: ${JSON.stringify(anonymousState)}`);
    }
    const directoryResponse = await fetch(`${BASE_URL}/api/rooms/directory`);
    const directory = await directoryResponse.json();
    const directoryRoom = directory.rooms?.[0];
    const expectedDirectoryKeys = ['directoryId', 'maxPlayers', 'name', 'playerCount', 'requiresCode', 'scenarioLabel', 'status'];
    if (directoryResponse.status !== 200 || directory.contract !== 'public-room-directory-v1' || directory.rooms?.length !== 1) {
      throw new Error(`Listed LAN room did not appear in the public directory: ${JSON.stringify(directory)}`);
    }
    if (JSON.stringify(directory).includes(created.json.roomCode)
      || JSON.stringify(Object.keys(directoryRoom || {}).sort()) !== JSON.stringify(expectedDirectoryKeys)) {
      throw new Error(`LAN directory crossed its public field boundary: ${JSON.stringify(directoryRoom)}`);
    }

    const wrongDirectoryJoin = await post('/api/rooms/join', {
      roomCode: created.json.roomCode,
      directoryId: 'different_directory_identifier',
      companyName: 'Wrong Directory Plant',
      userName: `Wrong-${Date.now()}`,
    });
    if (wrongDirectoryJoin.status !== 404 || wrongDirectoryJoin.json.error !== 'Комната недоступна') {
      throw new Error(`Mismatched directory confirmation was not rejected neutrally: ${wrongDirectoryJoin.status} ${JSON.stringify(wrongDirectoryJoin.json)}`);
    }

    const badAction = await post('/api/action', {
      playerId: created.json.playerId,
      sessionToken: 'wrong-token',
      action: 'toggle-ready',
    });
    if (badAction.status !== 403) {
      throw new Error(`Invalid token was not rejected: ${badAction.status}`);
    }

    const goodAction = await post('/api/action', {
      playerId: created.json.playerId,
      sessionToken: created.json.sessionToken,
      action: 'toggle-ready',
    });
    if (goodAction.status !== 200) {
      throw new Error(`Valid action failed: ${goodAction.status} ${JSON.stringify(goodAction.json)}`);
    }

    const soloAdminStart = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'start-game',
    });
    if (soloAdminStart.status !== 400) {
      throw new Error(`Server admin allowed solo classroom start: ${soloAdminStart.status} ${JSON.stringify(soloAdminStart.json)}`);
    }

    const studentUserName = `Student-${Date.now()}`;
    const joined = await post('/api/rooms/join', {
      roomCode: created.json.roomCode,
      directoryId: directoryRoom.directoryId,
      companyName: 'Student Plant',
      userName: studentUserName,
    });
    if (joined.status !== 201 || !joined.json.sessionToken) {
      throw new Error(`Student join failed: ${joined.status} ${JSON.stringify(joined.json)}`);
    }
    if (joined.json.stateContract !== 'student-state-v2') {
      throw new Error(`Student join did not return student-state-v2: ${JSON.stringify(joined.json)}`);
    }
    if (joined.json.room?.summaryContract !== 'student-v2' || joined.json.player?.playerContract !== 'student-player-v2') {
      throw new Error(`Student join did not return thin student contracts: ${JSON.stringify(joined.json)}`);
    }

    const studentReady = await post('/api/action', {
      playerId: joined.json.playerId,
      sessionToken: joined.json.sessionToken,
      action: 'toggle-ready',
    });
    if (studentReady.status !== 200) {
      throw new Error(`Student ready failed: ${studentReady.status} ${JSON.stringify(studentReady.json)}`);
    }

    const adminStart = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'start-game',
    });
    if (adminStart.status !== 200 || adminStart.json.result?.status !== 'running') {
      throw new Error(`Server admin start failed: ${adminStart.status} ${JSON.stringify(adminStart.json)}`);
    }
    if (adminStart.json.result?.lifecycle?.contract !== 'teacher-lifecycle-v1' || adminStart.json.result?.lifecycle?.phase !== 'running') {
      throw new Error(`Server admin start did not return lifecycle contract: ${JSON.stringify(adminStart.json.result)}`);
    }

    const closedDirectory = await fetch(`${BASE_URL}/api/rooms/directory`).then(response => response.json());
    if (closedDirectory.rooms?.some(room => room.directoryId === directoryRoom.directoryId)) {
      throw new Error(`Running LAN room remained in the public directory: ${JSON.stringify(closedDirectory)}`);
    }
    const lateJoin = await post('/api/rooms/join', {
      roomCode: created.json.roomCode,
      companyName: 'Late Plant',
      userName: `Late-${Date.now()}`,
    });
    if (lateJoin.status !== 404 || lateJoin.json.error !== 'Комната недоступна') {
      throw new Error(`New LAN student joined after start: ${lateJoin.status} ${JSON.stringify(lateJoin.json)}`);
    }
    const reconnected = await post('/api/rooms/join', {
      roomCode: created.json.roomCode,
      companyName: 'Student Plant',
      userName: studentUserName,
      sessionToken: joined.json.sessionToken,
    });
    if (reconnected.status !== 201 || reconnected.json.playerId !== joined.json.playerId) {
      throw new Error(`Existing LAN student could not reconnect after start: ${reconnected.status} ${JSON.stringify(reconnected.json)}`);
    }

    const stateResponse = await fetch(
      `${BASE_URL}/api/state?playerId=${encodeURIComponent(created.json.playerId)}`,
      { headers: { 'X-Player-Session': created.json.sessionToken } }
    );
    const statePayload = await stateResponse.json();
    if (!statePayload.player?.ready) throw new Error('Player state did not update after valid action.');
    const overview = await fetch(`${BASE_URL}/api/server/overview`).then(response => response.json());
    if (!overview.overview?.rooms?.some(room => room.code === created.json.roomCode)) {
      throw new Error('Server overview does not include created room.');
    }
    const smokeRoom = overview.overview.rooms.find(room => room.code === created.json.roomCode);
    if (!smokeRoom.players?.some(player => player.userName.startsWith('Host-') && player.ready)) {
      throw new Error('Server overview does not include player readiness details.');
    }
    if (!smokeRoom.classStats || typeof smokeRoom.classStats.totalCapital !== 'number') {
      throw new Error('Server overview does not include admin class statistics.');
    }
    if (!Array.isArray(smokeRoom.adminDays) || !smokeRoom.adminDays.length) {
      throw new Error('Server overview does not include admin day snapshots.');
    }
    if (smokeRoom.teacherControls?.lifecycle?.contract !== 'teacher-lifecycle-v1') {
      throw new Error(`Server overview does not include teacher lifecycle contract: ${JSON.stringify(smokeRoom.teacherControls)}`);
    }

    const serverHtml = await fetch(`${BASE_URL}/server`).then(response => response.text());
    const clientHtml = await fetch(`${BASE_URL}/client`).then(response => response.text());
    if (!serverHtml.includes('server-home-screen')) throw new Error('/server did not serve server home.');
    if (!clientHtml.includes('join-room-screen')) throw new Error('/client did not serve client join screen.');
    if (!clientHtml.includes('data-client-entry-note')) throw new Error('/client did not serve student entry note.');

    const invalidResume = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'resume-game',
    });
    if (invalidResume.status !== 400) {
      throw new Error(`Server admin resumed a running match: ${invalidResume.status} ${JSON.stringify(invalidResume.json)}`);
    }

    const paused = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'pause-game',
    });
    if (paused.status !== 200 || paused.json.result?.lifecycle?.phase !== 'paused' || paused.json.result?.lifecycle?.primaryAction !== 'resume-game') {
      throw new Error(`Server admin pause lifecycle failed: ${paused.status} ${JSON.stringify(paused.json)}`);
    }

    const resumed = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'resume-game',
    });
    if (resumed.status !== 200 || resumed.json.result?.lifecycle?.phase !== 'running') {
      throw new Error(`Server admin resume lifecycle failed: ${resumed.status} ${JSON.stringify(resumed.json)}`);
    }

    const nextTurn = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'next-turn',
    });
    if (nextTurn.status !== 200 || nextTurn.json.result?.day !== 2) {
      throw new Error(`Server admin next-turn lifecycle failed: ${nextTurn.status} ${JSON.stringify(nextTurn.json)}`);
    }

    const finished = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'finish-room',
    });
    if (finished.status !== 200 || finished.json.result?.lifecycle?.phase !== 'finished' || !finished.json.result?.lifecycle?.canOpenDebrief) {
      throw new Error(`Server admin finish lifecycle failed: ${finished.status} ${JSON.stringify(finished.json)}`);
    }

    const finalTeacherStateResponse = await fetch(
      `${BASE_URL}/api/state?view=full&playerId=${encodeURIComponent(created.json.playerId)}`,
      { headers: { 'X-Player-Session': created.json.sessionToken } }
    );
    const finalTeacherState = await finalTeacherStateResponse.json();
    if (!finalTeacherState.room?.classDebrief || finalTeacherState.room?.teacherControls?.lifecycle?.phase !== 'finished') {
      throw new Error(`Teacher final state did not expose debrief lifecycle: ${JSON.stringify(finalTeacherState.room)}`);
    }

    const finalStudentStateResponse = await fetch(
      `${BASE_URL}/api/state?view=student&playerId=${encodeURIComponent(joined.json.playerId)}`,
      { headers: { 'X-Player-Session': joined.json.sessionToken } }
    );
    const finalStudentState = await finalStudentStateResponse.json();
    if (finalStudentState.room?.classDebrief || !finalStudentState.player?.playerDebrief) {
      throw new Error(`Student final state crossed debrief role boundary: ${JSON.stringify(finalStudentState)}`);
    }

    const closed = await post('/api/server/action', {
      roomCode: created.json.roomCode,
      action: 'close-room',
    });
    if (closed.status !== 200 || closed.json.result?.status !== 'closed') {
      throw new Error(`Server admin close lifecycle failed: ${closed.status} ${JSON.stringify(closed.json)}`);
    }
    const overviewAfterClose = await fetch(`${BASE_URL}/api/server/overview`).then(response => response.json());
    const sessionsAfterClose = await fetch(`${BASE_URL}/api/server/sessions`).then(response => response.json());
    if (overviewAfterClose.overview?.rooms?.some(room => room.code === created.json.roomCode)) {
      throw new Error('Closed LAN room remained in the live overview.');
    }
    if (!sessionsAfterClose.items?.some(session => session.roomCode === created.json.roomCode)) {
      throw new Error('Closing the LAN room removed its completed-session history.');
    }

    const result = {
      ok: true,
      appMode: metaPayload.meta.appMode,
      lanUrls: metaPayload.meta.lanUrls,
      roomCode: created.json.roomCode,
      healthOk: true,
      qrOk: true,
      networkCheckOk: true,
      publicDirectorySafe: true,
      directoryConfirmationRequired: true,
      lateJoinRejected: true,
      activeReconnectAccepted: true,
      overviewRooms: overview.overview.rooms.length,
      overviewPlayers: smokeRoom.players.length,
      invalidTokenRejected: true,
      validActionAccepted: true,
      soloClassroomStartRejected: true,
      studentJoinAccepted: true,
      serverAdminActionAccepted: true,
      teacherLifecycle: true,
      teacherDebrief: true,
      studentDebriefBoundary: true,
      roomClosePreservesHistory: true,
      serverScreen: true,
      clientScreen: true,
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    child.kill();
    if (SHOULD_CLEAN_DATA_DIR) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
