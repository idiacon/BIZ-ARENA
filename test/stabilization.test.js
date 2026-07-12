const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-tests-'));
process.env.BIZ_ARENA_DATA_DIR = dataDir;

const bizArena = require('../server');

function resetRuntime() {
  bizArena.stopRoomTicker();
  bizArena.state.rooms.clear();
  bizArena.state.playerRoomIndex.clear();
  bizArena.state.db = bizArena.createEmptyDb();
}

function sourceFunctionBlock(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `Missing function ${functionName}`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function readPublicStyles() {
  return ['styles.css', path.join('styles', 'runtime.css')]
    .map(relativePath => fs.readFileSync(path.join(__dirname, '..', 'public', relativePath), 'utf8'))
    .join('\n');
}

function readPublicAppSources() {
  return [
    path.join('ui', 'role-contracts.js'),
    'app.js',
    path.join('ui', 'server-admin-ui.js'),
    path.join('ui', 'student-ui.js'),
    path.join('ui', 'teacher-ui.js'),
    'app-bootstrap.js',
  ].map(relativePath => fs.readFileSync(path.join(__dirname, '..', 'public', relativePath), 'utf8')).join('\n');
}

function readPersistenceFixture(fileName) {
  return JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'persistence', fileName),
    'utf8'
  ));
}

function createStartedRoom() {
  resetRuntime();
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Test Room',
    companyName: 'Host Corp',
    userName: 'Host',
  });
  const { player: guest } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
  });

  bizArena.handleRoomAction(room, host, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, guest, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, host, { action: 'start-game' });

  return { room, host, guest };
}

function createStartedFactoryRoom(scenarioKey = 'motorcycles') {
  resetRuntime();
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Factory Room',
    companyName: 'Host Plant',
    userName: 'Host',
    scenarioKey,
  });
  const { player: guest } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Plant',
    userName: 'Guest',
  });

  bizArena.handleRoomAction(room, host, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, guest, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, host, { action: 'start-game' });

  return { room, host, guest };
}

test.beforeEach(() => {
  resetRuntime();
});

test.after(() => {
  resetRuntime();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('runtime hardening: player-facing names strip unsafe HTML characters', () => {
  const { room, player } = bizArena.createRoom({
    roomName: '<b>Audit Room</b>',
    companyName: '<img src=x onerror=alert(1)>',
    userName: 'Host <script>',
  });

  assert.equal(room.name.includes('<'), false);
  assert.equal(room.name.includes('>'), false);
  assert.equal(player.name.includes('<'), false);
  assert.equal(player.name.includes('>'), false);
  assert.equal(player.userName.includes('<'), false);
  assert.equal(player.userName.includes('>'), false);
  assert.match(player.name, /img src=x/);
});

test('A1 room lifecycle transitions stay coherent through join, ready, start, pause, resume, and reset', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Lifecycle Room',
    companyName: 'Host Corp',
    userName: 'Host',
  });
  const { player: guest } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
  });

  assert.equal(room.status, 'lobby');
  assert.equal(room.players.size, 2);

  bizArena.handleRoomAction(room, host, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, guest, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, host, { action: 'start-game' });
  assert.equal(room.status, 'running');

  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  assert.equal(room.status, 'paused');

  bizArena.handleRoomAction(room, host, { action: 'resume-game' });
  assert.equal(room.status, 'running');

  bizArena.handleRoomAction(room, host, { action: 'reset-room' });
  assert.equal(room.status, 'lobby');
  assert.equal(room.day, 1);
  assert.equal(room.tick, 0);
  assert.equal(room.players.size, 2);
  assert.equal(room.players.get(host.id).ready, false);
});

test('A1 teacher lifecycle contract is authoritative across start, pause, resume, next turn, and finish', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Lifecycle Contract',
    companyName: 'Host Corp',
    userName: 'Host',
  });
  const { player: guest } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
  });

  let lifecycle = bizArena.roomSummary(room, host.id).teacherControls.lifecycle;
  assert.equal(lifecycle.contract, 'teacher-lifecycle-v1');
  assert.equal(lifecycle.phase, 'lobby');
  assert.equal(lifecycle.canStart, false);
  assert.equal(lifecycle.primaryAction, '');

  assert.throws(
    () => bizArena.handleRoomAction(room, host, { action: 'pause-game' }),
    /только во время игры/i
  );

  bizArena.handleRoomAction(room, host, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, guest, { action: 'toggle-ready' });
  bizArena.handleRoomAction(room, host, { action: 'start-game' });
  lifecycle = bizArena.roomSummary(room, host.id).teacherControls.lifecycle;
  assert.equal(lifecycle.phase, 'running');
  assert.equal(lifecycle.canPause, true);
  assert.equal(lifecycle.canAdvance, true);
  assert.equal(lifecycle.canResume, false);

  assert.throws(
    () => bizArena.handleRoomAction(room, host, { action: 'resume-game' }),
    /стоит на паузе/i
  );

  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  lifecycle = bizArena.roomSummary(room, host.id).teacherControls.lifecycle;
  assert.equal(lifecycle.phase, 'paused');
  assert.equal(lifecycle.primaryAction, 'resume-game');
  assert.equal(lifecycle.nextExpectedPhase, 'running');
  assert.equal(lifecycle.canResume, true);

  bizArena.handleRoomAction(room, host, { action: 'resume-game' });
  const dayBefore = room.day;
  bizArena.handleRoomAction(room, host, { action: 'next-turn' });
  assert.equal(room.day, dayBefore + 1);

  bizArena.handleRoomAction(room, host, { action: 'finish-room' });
  lifecycle = bizArena.roomSummary(room, host.id).teacherControls.lifecycle;
  assert.equal(lifecycle.phase, 'finished');
  assert.equal(lifecycle.canOpenDebrief, true);
  assert.equal(lifecycle.nextExpectedPhase, 'debrief');
  assert.equal(lifecycle.finishReason, 'teacher_stopped');
  assert.equal(lifecycle.canFinish, false);
  assert.throws(
    () => bizArena.handleRoomAction(room, host, { action: 'pause-game' }),
    /только во время игры/i
  );
});

test('A2 business action plus tick mutates state and produces tick telemetry', () => {
  const { room, host } = createStartedRoom();

  const rawBeforeBuy = host.rawStock;
  bizArena.handleBusinessAction(room, host, { action: 'buy-raw', value: 20 });
  assert.equal(host.rawStock, rawBeforeBuy + 20);

  bizArena.advanceRoom(room);

  assert.equal(room.day, 2);
  assert.equal(room.tick, 1);
  assert.equal(room.marketHistory.length, 1);
  assert.ok(host.producedLastTick >= 0);
  assert.ok(host.soldLastTick >= 0);
  assert.ok(host.lastTickBreakdown);
  assert.equal(typeof host.lastTickBreakdown.revenue, 'number');
});

test('runtime hardening: turn-based mode advances only when host triggers next turn', () => {
  const { room, host } = createStartedRoom();

  assert.equal(room.settings.tickMode, 'manual');
  assert.equal(room.settings.dayLimit, 30);
  assert.equal(room.tick, 0);
  assert.equal(bizArena.roomSummary(room, host.id).turnDurationMs, 30 * 60 * 1000);
  assert.ok(room.nextTickAt > Date.now());

  bizArena.handleBusinessAction(room, host, { action: 'buy-raw', value: 20 });
  bizArena.handleRoomAction(room, host, { action: 'next-turn' });

  assert.equal(room.tick, 1);
  assert.equal(room.day, 2);
  assert.ok(room.nextTickAt > Date.now());
});

test('runtime hardening: manual timer pause and resume affect the whole room', () => {
  const { room, host, guest } = createStartedRoom();

  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  assert.equal(room.status, 'paused');
  assert.equal(room.nextTickAt, null);
  assert.ok(room.pausedRemainingMs > 0);
  assert.equal(bizArena.roomSummary(room, guest.id).status, 'paused');

  bizArena.handleRoomAction(room, host, { action: 'resume-game' });
  assert.equal(room.status, 'running');
  assert.ok(room.nextTickAt > Date.now());
  assert.equal(room.pausedRemainingMs, null);
});

test('classroom pause request: a student can pause the shared turn while the teacher decides', () => {
  const { room, host, guest } = createStartedRoom();

  bizArena.handleRoomAction(room, guest, { action: 'request-pause' });

  assert.equal(room.status, 'paused');
  assert.equal(room.nextTickAt, null);
  assert.equal(room.pauseRequest.status, 'pending');
  assert.equal(room.pauseRequest.playerId, guest.id);
  assert.ok(room.pauseRequest.expiresAt > Date.now());
  assert.equal(bizArena.roomSummary(room, guest.id, { view: 'student' }).pauseRequest.status, 'pending');
  assert.equal(bizArena.roomSummary(room, host.id).pauseRequest.playerId, guest.id);
});

test('classroom pause request: the teacher accepts it and the requesting student can resume', () => {
  const { room, host, guest } = createStartedRoom();

  bizArena.handleRoomAction(room, guest, { action: 'request-pause' });
  bizArena.handleRoomAction(room, host, { action: 'accept-pause-request' });

  assert.equal(room.pauseRequest.status, 'accepted');
  assert.equal(bizArena.roomSummary(room, host.id).teacherControls.actions.acceptPauseRequest, false);

  bizArena.handleRoomAction(room, guest, { action: 'resume-game' });
  assert.equal(room.status, 'running');
  assert.equal(room.pauseRequest, null);
  assert.ok(room.nextTickAt > Date.now());
});

test('classroom pause request: an unanswered request automatically resumes the shared turn', () => {
  const { room, guest } = createStartedRoom();

  bizArena.handleRoomAction(room, guest, { action: 'request-pause' });
  const expiresAt = room.pauseRequest.expiresAt;
  bizArena.processRoomTimers(expiresAt + 1);

  assert.equal(room.status, 'running');
  assert.equal(room.pauseRequest, null);
  assert.equal(room.pausedRemainingMs, null);
  assert.ok(room.nextTickAt > expiresAt);
});

test('runtime hardening: manual timer expiry pauses match for all players', () => {
  const { room, host, guest } = createStartedRoom();

  room.nextTickAt = Date.now() - 1;
  bizArena.processRoomTimers(Date.now());

  assert.equal(room.status, 'paused');
  assert.equal(room.nextTickAt, null);
  assert.equal(room.pausedRemainingMs, 0);
  assert.equal(room.tick, 0);
  assert.equal(room.teacherState.phaseLock, 'review');
  assert.equal(bizArena.roomSummary(room, guest.id).status, 'paused');
});

test('A3 player summary exposes actionable intel and execution queue metadata', () => {
  const { room, host } = createStartedRoom();

  host.rawStock = 4;
  host.debt = 120000;
  host.money = 60000;
  host.focusCityKey = 'capital';
  host.focusProductKey = 'electronics';
  host.cityKey = 'regional';
  host.productKey = 'food';
  room.contractBoard = [{
    id: 'focus_contract',
    title: 'Electronics in Capital',
    cityKey: 'capital',
    cityLabel: 'Capital',
    productKey: 'electronics',
    productLabel: 'Electronics',
    targetSales: 40,
    progress: 0,
    reward: 24000,
    reputationReward: 4,
    expiresDay: room.day + 3,
    assignedPlayerId: null,
    assignedPlayerName: '',
    completed: false,
  }];

  const summary = bizArena.playerSummary(room, host, host.id);

  assert.equal(summary.intel.riskLevel, 'high');
  assert.ok(summary.intel.recommendations.includes('buy_raw'));
  assert.ok(summary.executionPlan.some(item => item.actionable && item.action === 'buy-raw'));
  assert.ok(summary.executionPlan.some(item => item.actionable && item.action === 'repay-loan'));
  assert.ok(summary.executionPlan.some(item => item.actionable && item.action === 'start-research'));
});

test('A4 room summary includes winner and leaderboard after season end', () => {
  const { room, host, guest } = createStartedRoom();

  room.settings.dayLimit = 2;
  host.money = 180000;
  guest.money = 90000;

  bizArena.advanceRoom(room);
  assert.equal(room.status, 'running');
  assert.equal(room.tick, 1);

  bizArena.advanceRoom(room);

  const summary = bizArena.roomSummary(room, host.id);
  assert.equal(room.status, 'finished');
  assert.equal(room.tick, 2);
  assert.equal(summary.status, 'finished');
  assert.equal(summary.winnerPlayerId, host.id);
  assert.equal(summary.finishReason, 'turn_limit');
  assert.equal(summary.leaderboard[0].id, host.id);
  assert.equal(summary.classDebrief.status, 'final');
  assert.ok(summary.classDebrief.classMetrics.some(item => item.key === 'avg_score'));
  assert.ok(summary.classDebrief.discussionPrompts.length >= 2);
  assert.match(summary.classDebrief.winnerReason, /Host Corp|лидирует|Лидер/);
});

test('game finish: 30th turn ends the classroom match with a finish reason', () => {
  const { room, host } = createStartedRoom();

  room.settings.dayLimit = 30;
  room.tick = 29;
  room.day = 30;
  host.money = 180000;

  bizArena.advanceRoom(room);

  const summary = bizArena.roomSummary(room, host.id);
  assert.equal(room.tick, 30);
  assert.equal(room.status, 'finished');
  assert.equal(summary.finishReason, 'turn_limit');
});

test('regression: contract progress, research completion, and operating-plan automation survive a tick', () => {
  const { room, host } = createStartedRoom();

  host.strategyKey = 'contracts';
  host.cityKey = 'capital';
  host.productKey = 'electronics';
  host.money = 90000;
  host.rawStock = 80;
  room.contractBoard = [{
    id: 'contract_tick',
    title: 'Electronics in Capital',
    cityKey: 'capital',
    cityLabel: 'Capital',
    productKey: 'electronics',
    productLabel: 'Electronics',
    targetSales: 5,
    progress: 0,
    reward: 20000,
    reputationReward: 4,
    expiresDay: room.day + 4,
    assignedPlayerId: null,
    assignedPlayerName: '',
    completed: false,
  }];

  bizArena.advanceRoom(room);

  assert.equal(room.contractBoard[0].assignedPlayerId, host.id);
  assert.equal(room.contractBoard[0].completed, true);
  assert.ok(host.completedContracts >= 1);

  bizArena.handleBusinessAction(room, host, { action: 'start-research', value: 'retail_ai' });
  host.research.progress = 33;
  host.automation = 3;
  host.quality = 3;
  host.staff = 20;

  bizArena.advanceRoom(room);

  assert.ok(host.research.completed.includes('retail_ai'));
  assert.equal(host.research.activeKey, '');
  assert.ok(host.completedContracts >= 1 || room.contractBoard.find(contract => contract.id === 'contract_tick')?.progress > 0);
});

test('regression: save/load restores room state with schema versioning', () => {
  const { room, host } = createStartedRoom();

  host.money = 135432;
  host.rawStock = 77;
  host.focusCityKey = 'capital';
  bizArena.handleRoomAction(room, host, { action: 'set-phase-lock', value: 'review' });
  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  bizArena.saveRoomSnapshot(room, host);

  const saved = bizArena.state.db.savedRooms[room.code];
  assert.equal(saved.meta.schemaVersion, 3);
  assert.equal(saved.snapshot.schemaVersion, 3);

  host.money = 1;
  host.rawStock = 0;
  host.focusCityKey = 'regional';

  const loadedRoom = bizArena.loadRoomSnapshot(room);
  const loadedHost = loadedRoom.players.get(host.id);

  assert.equal(loadedHost.money, 135432);
  assert.equal(loadedHost.rawStock, 77);
  assert.equal(loadedHost.focusCityKey, 'capital');
  assert.equal(loadedRoom.teacherState.phaseLock, 'review');
  assert.equal(loadedRoom.settings.dayLimit, room.settings.dayLimit);
});

test('teacher controls: host can lock decisions, force an event, and expose class snapshot', () => {
  const { room, host, guest } = createStartedFactoryRoom('motorcycles');
  const componentKey = room.factoryScenario.components[0].key;

  bizArena.handleRoomAction(room, host, { action: 'set-phase-lock', value: 'review' });
  assert.equal(room.teacherState.phaseLock, 'review');
  assert.throws(
    () => bizArena.handleBusinessAction(room, guest, { action: 'buy-component', value: { componentKey, quantity: 1 } }),
    /Преподаватель/
  );

  bizArena.handleRoomAction(room, host, { action: 'set-phase-lock', value: 'open' });
  bizArena.handleRoomAction(room, host, { action: 'force-event', value: 'factory_demand_surge' });
  bizArena.handleRoomAction(room, host, {
    action: 'run-experiment',
    value: { parameter: 'basePrice', values: '5600,6400,7200', turns: 5, seed: 42 },
  });

  const summary = bizArena.roomSummary(room, host.id);
  assert.equal(summary.teacherControls.canManage, true);
  assert.equal(summary.teacherControls.phaseLock, 'open');
  assert.equal(summary.teacherControls.lifecycle.contract, 'teacher-lifecycle-v1');
  assert.equal(summary.teacherControls.lifecycle.phase, 'running');
  assert.ok(summary.teacherControls.eventCatalog.some(item => item.key === 'factory_demand_surge'));
  assert.ok(summary.teacherControls.eventCatalog.some(item => item.key === 'factory_supplier_delay'));
  assert.ok(summary.teacherControls.eventCatalog.some(item => item.key === 'factory_payroll_pressure'));
  assert.equal(summary.teacherControls.actions.finish, true);
  assert.equal(summary.teacherControls.actions.runExperiment, true);
  assert.equal(summary.scenarioExperiment.parameter, 'basePrice');
  assert.equal(summary.scenarioExperiment.rows.length, 3);
  assert.ok(summary.scenarioExperiment.best);
  assert.ok(summary.classSnapshot.rows.length >= 2);
  assert.equal(summary.classSnapshot.rows[0].rank, 1);
  assert.equal(summary.activeEvent.key, 'factory_demand_surge');
  assert.ok(room.log.some(entry => /Crisis Card «Резкий всплеск спроса»/.test(entry)));
});

test('teacher controls: host can finish the match from the in-game teacher panel action', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');

  bizArena.handleRoomAction(room, host, { action: 'finish-room' });

  assert.equal(room.status, 'finished');
  assert.equal(room.finishReason, 'teacher_stopped');
  assert.ok(room.winnerPlayerId);
  assert.ok(room.log.some(entry => entry.includes('завершил матч из панели преподавателя')));
});

test('teacher help queue: student owns one request and teacher can acknowledge and resolve it', () => {
  const { room, host, guest } = createStartedFactoryRoom('motorcycles');

  bizArena.handleRoomAction(room, guest, {
    action: 'request-teacher-help',
    value: { category: 'assembly', message: '<b>Не хватает ресурсов</b>' },
  });

  const studentState = bizArena.roomSummary(room, guest.id, { view: 'student' });
  const teacherState = bizArena.roomSummary(room, host.id);
  const request = teacherState.helpRequests[0];
  assert.equal(studentState.helpRequest.category, 'assembly');
  assert.equal(studentState.helpRequest.message.includes('<'), false);
  assert.equal(bizArena.roomSummary(room, host.id, { view: 'student' }).helpRequest, null);
  assert.equal(teacherState.helpRequests.length, 1);
  assert.throws(
    () => bizArena.handleRoomAction(room, guest, { action: 'request-teacher-help', value: { category: 'turn' } }),
    error => error.status === 409
  );

  bizArena.handleRoomAction(room, host, { action: 'acknowledge-help-request', requestId: request.id });
  assert.equal(bizArena.roomSummary(room, guest.id, { view: 'student' }).helpRequest.status, 'acknowledged');
  bizArena.handleRoomAction(room, host, { action: 'resolve-help-request', requestId: request.id });
  assert.equal(bizArena.roomSummary(room, host.id).helpRequests.length, 0);
  assert.equal(bizArena.roomSummary(room, guest.id, { view: 'student' }).helpRequest.status, 'resolved');
});

test('completed sessions: finish archives a safe immutable summary and CSV export', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');
  const playerToken = host.sessionToken;

  bizArena.handleRoomAction(room, host, { action: 'finish-room' });
  const sessions = bizArena.listCompletedSessions({ teacherAccountId: '' });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, room.completedSessionId);
  assert.equal(sessions[0].roomCode, room.code);
  assert.equal(sessions[0].standings.length, 2);
  assert.equal(JSON.stringify(sessions[0]).includes(playerToken), false);
  assert.equal(Object.hasOwn(sessions[0], 'players'), false);
  assert.match(bizArena.completedSessionCsv(sessions[0]), /Место.*Компания/);

  const archivedRoomName = sessions[0].roomName;
  room.name = 'Changed after finish';
  assert.equal(bizArena.getCompletedSession(room.completedSessionId).roomName, archivedRoomName);

  bizArena.archiveCompletedSession(room);
  assert.equal(bizArena.listCompletedSessions({ teacherAccountId: '' }).length, 1);
});

test('completed sessions: SQLite persistence restores history and enforces owner filtering', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');
  bizArena.handleRoomAction(room, host, { action: 'finish-room' });
  const sqlitePath = path.join(dataDir, 'completed-sessions.sqlite');
  bizArena.persistDbToSqlite(bizArena.state.db, sqlitePath);
  const loaded = bizArena.loadDbFromSqlite(sqlitePath);
  const sessionId = room.completedSessionId;

  assert.equal(loaded.completedSessions[sessionId].roomCode, room.code);
  bizArena.state.db = loaded;
  assert.equal(bizArena.getCompletedSession(sessionId, { teacherAccountId: '' }).id, sessionId);
  assert.throws(
    () => bizArena.getCompletedSession(sessionId, { teacherAccountId: 'another-teacher' }),
    error => error.status === 404
  );
});

test('teacher controls: non-host cannot lock phase or force classroom events', () => {
  const { room, guest } = createStartedFactoryRoom('motorcycles');

  assert.throws(
    () => bizArena.handleRoomAction(room, guest, { action: 'set-phase-lock', value: 'review' }),
    /host|хост/i
  );
  assert.throws(
    () => bizArena.handleRoomAction(room, guest, { action: 'force-event', value: 'factory_demand_surge' }),
    /host|хост/i
  );
  assert.throws(
    () => bizArena.handleRoomAction(room, guest, { action: 'run-experiment', value: { parameter: 'basePrice', values: [5600] } }),
    /host|хост/i
  );
});

test('runtime hardening: loadDbFromDisk recovers from backup and normalizes schema', () => {
  const filePath = path.join(dataDir, 'recovery-db.json');
  const backupPath = `${filePath}.bak`;

  fs.writeFileSync(backupPath, JSON.stringify({
    accounts: { host: { id: 'acct_1', userName: 'Host' } },
    savedRooms: {},
  }, null, 2));
  fs.writeFileSync(filePath, '{"broken":');

  const recovered = bizArena.loadDbFromDisk(filePath);

  assert.equal(recovered.schemaVersion, 4);
  assert.equal(recovered.accounts.host.userName, 'Host');
  assert.equal(fs.existsSync(filePath), true);
});

test('runtime hardening: malformed active room recovers from the previous JSON database', () => {
  const filePath = path.join(dataDir, 'active-room-recovery.json');
  const backupPath = `${filePath}.bak`;
  const { room } = bizArena.createRoom({
    roomName: 'Recovered Active Room',
    companyName: 'Host Corp',
    userName: 'Host',
  });
  const validDb = bizArena.createEmptyDb();
  validDb.activeRooms[room.code] = bizArena.serializeRoom(room);
  const invalidDb = structuredClone(validDb);
  invalidDb.activeRooms[room.code].players = 'corrupted';

  fs.writeFileSync(backupPath, JSON.stringify(validDb));
  fs.writeFileSync(filePath, JSON.stringify(invalidDb));

  const recovered = bizArena.loadDbFromDisk(filePath);

  assert.equal(recovered.activeRooms[room.code].name, 'Recovered Active Room');
  assert.equal(Array.isArray(recovered.activeRooms[room.code].players), true);
});

test('schema migration: unversioned legacy database upgrades through the v1 contract', () => {
  const legacyDb = readPersistenceFixture('db-v1-unversioned.json');
  const normalized = bizArena.normalizeDb(legacyDb);
  const savedRoom = normalized.savedRooms.V1ROOM;

  assert.equal(normalized.schemaVersion, 4);
  assert.equal(normalized.accounts.legacy_student.gamesPlayed, 2);
  assert.deepEqual(normalized.teacherAccounts, {});
  assert.deepEqual(normalized.teacherSessions, {});
  assert.deepEqual(normalized.activeRooms, {});
  assert.equal(savedRoom.snapshot.schemaVersion, 3);
  assert.equal(savedRoom.snapshot.players[0].userName, 'Legacy Student');
  assert.equal(savedRoom.snapshot.teacherState.phaseLock, 'open');
  assert.equal(savedRoom.snapshot.version, 1);
  assert.equal(Object.hasOwn(legacyDb, 'schemaVersion'), false);
  assert.equal(Object.hasOwn(legacyDb.savedRooms.V1ROOM.snapshot, 'schemaVersion'), false);
});

test('schema migration: retained v2 database upgrades without losing room state', () => {
  const versionTwoDb = readPersistenceFixture('db-v2.json');
  const normalized = bizArena.normalizeDb(versionTwoDb);
  const snapshot = normalized.savedRooms.V2ROOM.snapshot;

  assert.equal(normalized.schemaVersion, 4);
  assert.equal(normalized.accounts.v2_student.gamesPlayed, 4);
  assert.deepEqual(normalized.teacherAccounts, {});
  assert.deepEqual(normalized.teacherSessions, {});
  assert.deepEqual(normalized.activeRooms, {});
  assert.equal(snapshot.schemaVersion, 3);
  assert.equal(snapshot.status, 'paused');
  assert.equal(snapshot.day, 3);
  assert.equal(snapshot.tick, 7);
  assert.equal(snapshot.players[0].money, 275000);
  assert.equal(snapshot.teacherAccountId, '');
  assert.equal(snapshot.teacherState.phaseLock, 'open');
  assert.equal(snapshot.finishReason, null);
  assert.deepEqual(snapshot.adminSnapshots, []);
  assert.equal(versionTwoDb.schemaVersion, 2);
  assert.equal(versionTwoDb.savedRooms.V2ROOM.snapshot.schemaVersion, 2);
});

test('schema migration: future database and room schemas fail closed', () => {
  assert.throws(
    () => bizArena.normalizeDb({ ...bizArena.createEmptyDb(), schemaVersion: 5 }),
    error => error?.code === 'BIZ_ARENA_UNSUPPORTED_SCHEMA'
  );
  assert.throws(
    () => bizArena.migrateRoomSnapshot({
      schemaVersion: 4,
      code: 'FUTURE',
      name: 'Future Room',
      players: [],
      settings: {},
    }),
    error => error?.code === 'BIZ_ARENA_UNSUPPORTED_SCHEMA'
  );
});

test('schema migration: malformed explicit versions are rejected', () => {
  assert.throws(
    () => bizArena.normalizeDb({ schemaVersion: 0 }),
    error => error?.code === 'BIZ_ARENA_INVALID_SCHEMA'
  );
  assert.throws(
    () => bizArena.migrateRoomSnapshot({ schemaVersion: 2.5 }),
    error => error?.code === 'BIZ_ARENA_INVALID_SCHEMA'
  );
});

test('schema migration: future saved snapshot does not downgrade to previous data', () => {
  const versionTwoDb = readPersistenceFixture('db-v2.json');
  const validSnapshot = bizArena.normalizeDb(versionTwoDb).savedRooms.V2ROOM.snapshot;
  const db = bizArena.createEmptyDb();
  db.savedRooms.V2ROOM = {
    meta: { roomCode: 'V2ROOM' },
    snapshot: { ...validSnapshot, schemaVersion: 4 },
    previousSnapshot: validSnapshot,
  };

  assert.throws(
    () => bizArena.normalizeDb(db),
    error => error?.code === 'BIZ_ARENA_UNSUPPORTED_SCHEMA'
  );

  bizArena.state.db = db;
  assert.throws(
    () => bizArena.loadRoomSnapshot({ code: 'V2ROOM' }),
    error => error?.code === 'BIZ_ARENA_UNSUPPORTED_SCHEMA'
  );
});

test('schema migration: malformed player roster uses previous saved snapshot', () => {
  const { room, host } = createStartedRoom();
  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  bizArena.saveRoomSnapshot(room, host);

  const entry = bizArena.state.db.savedRooms[room.code];
  const validSnapshot = entry.snapshot;
  entry.previousSnapshot = validSnapshot;
  entry.snapshot = { ...validSnapshot, players: 'corrupted' };

  const loadedRoom = bizArena.loadRoomSnapshot(room);
  assert.equal(loadedRoom.players.get(host.id).id, host.id);
});

test('schema migration: malformed database collections fail closed', () => {
  for (const key of ['accounts', 'teacherAccounts', 'teacherSessions', 'activeRooms', 'savedRooms']) {
    const db = bizArena.createEmptyDb();
    db[key] = [];
    assert.throws(
      () => bizArena.normalizeDb(db),
      error => error?.code === 'BIZ_ARENA_INVALID_PERSISTED_DATA',
      key
    );
  }
});

test('schema migration: malformed saved room entry is not silently discarded', () => {
  const db = bizArena.createEmptyDb();
  db.savedRooms.BROKEN = { meta: { roomCode: 'BROKEN' }, snapshot: 'corrupted' };

  assert.throws(
    () => bizArena.normalizeDb(db),
    error => error?.code === 'BIZ_ARENA_INVALID_PERSISTED_DATA'
  );
});

test('schema migration: malformed active room snapshot fails closed instead of being discarded', () => {
  const db = bizArena.createEmptyDb();
  db.activeRooms.BROKEN = { schemaVersion: 3, code: 'BROKEN', players: 'corrupted' };

  assert.throws(
    () => bizArena.normalizeDb(db),
    error => error?.code === 'BIZ_ARENA_INVALID_PERSISTED_DATA' && error?.roomCode === 'BROKEN'
  );
});

test('runtime hardening: SQLite storage adapter persists normalized active room snapshots', () => {
  const sqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-sqlite-'));
  const sqlitePath = path.join(sqliteDir, 'biz-arena.sqlite');
  const { room } = bizArena.createRoom({
    roomName: 'SQLite Room',
    companyName: 'Host Corp',
    userName: 'Host',
    scenarioKey: 'motorcycles',
  });

  const db = bizArena.createEmptyDb();
  db.activeRooms[room.code] = bizArena.serializeRoom(room);
  db.teacherAccounts.teacher_1 = {
    id: 'teacher_1',
    email: 'sqlite@example.com',
    displayName: 'SQLite Teacher',
    passwordHash: 'scrypt$test',
    createdAt: new Date().toISOString(),
  };

  const persisted = bizArena.persistDbToSqlite(db, sqlitePath);
  const loaded = bizArena.loadDbFromSqlite(sqlitePath);

  assert.equal(persisted.schemaVersion, 4);
  assert.equal(loaded.schemaVersion, 4);
  assert.equal(loaded.teacherAccounts.teacher_1.email, 'sqlite@example.com');
  assert.equal(loaded.activeRooms[room.code].code, room.code);
  assert.equal(loaded.activeRooms[room.code].name, 'SQLite Room');
  assert.equal(fs.existsSync(sqlitePath), true);

  fs.rmSync(sqliteDir, { recursive: true, force: true });
});

test('runtime hardening: loadRoomSnapshot falls back to previous snapshot when latest snapshot is invalid', () => {
  const { room, host } = createStartedRoom();

  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  bizArena.saveRoomSnapshot(room, host);

  const entry = bizArena.state.db.savedRooms[room.code];
  entry.previousSnapshot = entry.snapshot;
  entry.snapshot = { schemaVersion: 2, code: room.code, players: 'corrupted' };

  const loadedRoom = bizArena.loadRoomSnapshot(room);
  const loadedHost = loadedRoom.players.get(host.id);

  assert.equal(loadedRoom.code, room.code);
  assert.equal(loadedHost.id, host.id);
});

test('runtime hardening: persisted room can be reloaded after runtime reset and resume ticking', () => {
  const { room, host } = createStartedRoom();

  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  bizArena.saveRoomSnapshot(room, host);

  const persistedDb = JSON.parse(JSON.stringify(bizArena.state.db));
  const roomCode = room.code;
  const hostId = host.id;

  bizArena.state.rooms.clear();
  bizArena.state.playerRoomIndex.clear();
  bizArena.state.db = persistedDb;

  const reloadedRoom = bizArena.loadRoomSnapshot({ code: roomCode });
  reloadedRoom.status = 'running';
  bizArena.advanceRoom(reloadedRoom);

  assert.equal(reloadedRoom.day, 2);
  assert.equal(reloadedRoom.tick, 1);
  assert.equal(bizArena.state.playerRoomIndex.get(hostId), roomCode);
});

test('runtime hardening: refresh/reload keeps host and viewer scoped state aligned', () => {
  const { room, host } = createStartedRoom();

  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  bizArena.saveRoomSnapshot(room, host);

  const reloadedRoom = bizArena.loadRoomSnapshot(room);
  const summary = bizArena.roomSummary(reloadedRoom, host.id);
  const viewer = summary.players.find(player => player.id === host.id);

  assert.equal(summary.hostPlayerId, host.id);
  assert.equal(viewer.isHost, true);
  assert.equal(viewer.isViewer, true);
  assert.equal(viewer.id, host.id);
});

test('runtime hardening: reconnect requires the existing player session token', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Reconnect Room',
    companyName: 'Host Corp',
    userName: 'Host',
  });

  const firstJoin = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
  });

  assert.throws(() => bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
  }), error => error.status === 403);

  assert.throws(() => bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
    sessionToken: 'wrong-session-token',
  }), error => error.status === 403);

  const secondJoin = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
    sessionToken: firstJoin.player.sessionToken,
  });

  assert.equal(room.players.size, 2);
  assert.equal(firstJoin.player.id, secondJoin.player.id);
  assert.equal(firstJoin.player.sessionToken, secondJoin.player.sessionToken);
  assert.equal(bizArena.roomSummary(room, host.id).humanCount, 2);
});

test('room lifecycle: business actions are rejected outside a running match', () => {
  const { room, player } = bizArena.createRoom({
    roomName: 'Lifecycle Guard Room',
    companyName: 'Host Corp',
    userName: 'Host',
  });
  const initialMoney = player.money;

  assert.throws(
    () => bizArena.handleBusinessAction(room, player, { action: 'take-loan', value: 10_000 }),
    error => error.status === 409
  );
  assert.equal(player.money, initialMoney);

  const started = createStartedRoom();
  bizArena.handleBusinessAction(started.room, started.host, { action: 'take-loan', value: 10_000 });
  assert.equal(started.host.money, initialMoney + 10_000);

  started.room.status = 'paused';
  assert.throws(
    () => bizArena.handleBusinessAction(started.room, started.host, { action: 'take-loan', value: 10_000 }),
    error => error.status === 409
  );

  started.room.status = 'finished';
  assert.throws(
    () => bizArena.handleBusinessAction(started.room, started.host, { action: 'take-loan', value: 10_000 }),
    error => error.status === 409
  );
});

test('runtime hardening: repeated join with the same username but different company is rejected', () => {
  const { room } = bizArena.createRoom({
    roomName: 'Identity Room',
    companyName: 'Host Corp',
    userName: 'Host',
  });

  bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Guest Corp',
    userName: 'Guest',
  });

  assert.throws(() => bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Other Corp',
    userName: 'Guest',
  }), error => error.status === 409);
});

test('secure protocol: session token owns identity instead of trusting claimed playerId', () => {
  const { room, host, guest } = createStartedFactoryRoom();

  assert.equal(bizArena.resolvePlayerSession(host.sessionToken, host.id).player.id, host.id);
  assert.throws(
    () => bizArena.resolvePlayerSession(host.sessionToken, guest.id),
    /Сессия не совпадает с игроком/
  );
  assert.equal(host.security.rejectedActionCount, 1);
  assert.equal(room.players.get(host.id).security.lastRejectReason, 'playerId mismatch');
});

test('cloud classroom: teacher accounts store scrypt hashes and create teacher sessions', () => {
  const account = bizArena.createTeacherAccount({
    email: 'Teacher@Example.COM',
    password: 'correct-horse-42',
    displayName: 'Cloud Teacher',
  });

  assert.equal(account.email, 'teacher@example.com');
  assert.equal(account.password, undefined);
  assert.match(account.passwordHash, /^scrypt\$/);
  assert.doesNotMatch(account.passwordHash, /correct-horse-42/);

  assert.throws(
    () => bizArena.createTeacherAccount({ email: 'weak@example.com', password: 'short', displayName: 'Weak' }),
    error => error.status === 400
  );

  const login = bizArena.loginTeacher({ email: 'teacher@example.com', password: 'correct-horse-42' });
  assert.equal(login.account.id, account.id);
  assert.ok(login.sessionToken);
  assert.equal(bizArena.resolveTeacherSessionToken(login.sessionToken).account.id, account.id);
  bizArena.state.db.teacherSessions[login.sessionToken].createdAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
  bizArena.state.db.teacherSessions[login.sessionToken].lastSeenAt = Date.now() - (8 * 24 * 60 * 60 * 1000);
  assert.throws(
    () => bizArena.resolveTeacherSessionToken(login.sessionToken),
    error => error.status === 401 && /истекла/.test(error.message)
  );
  assert.equal(bizArena.state.db.teacherSessions[login.sessionToken], undefined);
  assert.throws(
    () => bizArena.loginTeacher({ email: 'teacher@example.com', password: 'wrong-password' }),
    error => error.status === 403
  );
});

test('cloud classroom: teacher-owned room hides teacher host and rejects other teachers', () => {
  const owner = bizArena.createTeacherAccount({
    email: 'owner@example.com',
    password: 'correct-horse-42',
    displayName: 'Owner Teacher',
  });
  const other = bizArena.createTeacherAccount({
    email: 'other@example.com',
    password: 'correct-horse-42',
    displayName: 'Other Teacher',
  });

  const created = bizArena.handleTeacherAction(owner, {
    action: 'create-room',
    roomName: 'Cloud Unit',
    companyName: 'Teacher Console',
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
  });
  const room = bizArena.state.rooms.get(created.roomCode);
  const teacherHost = room.players.get(room.hostPlayerId);
  assert.equal(room.teacherAccountId, owner.id);
  assert.equal(teacherHost.isTeacherHost, true);
  assert.equal(teacherHost.ready, true);

  const { player: student } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Student Plant',
    userName: 'Student One',
  });
  bizArena.handleRoomAction(room, student, { action: 'toggle-ready' });
  const cloudGate = bizArena.roomStartGate(room);
  assert.equal(cloudGate.teacherOnlyHost, true);
  assert.equal(cloudGate.minimumClassPlayers, 1);
  assert.equal(cloudGate.classPlayerCount, 1);
  assert.equal(cloudGate.canStart, true);

  const start = bizArena.handleTeacherAction(owner, { action: 'start-game', roomCode: room.code });
  assert.equal(start.status, 'running');

  assert.throws(
    () => bizArena.handleTeacherAction(other, { action: 'pause-game', roomCode: room.code }),
    error => error.status === 403
  );
  assert.throws(
    () => bizArena.handleTeacherAction(other, {
      action: 'force-event',
      roomCode: room.code,
      value: 'factory_supplier_delay',
    }),
    error => error.status === 403
  );

  const forcedEvent = bizArena.handleTeacherAction(owner, {
    action: 'force-event',
    roomCode: room.code,
    value: 'factory_supplier_delay',
  });
  assert.equal(forcedEvent.status, 'running');
  assert.equal(room.activeEvent.key, 'factory_supplier_delay');
  assert.match(room.log[0], /Crisis Card/);

  const overview = bizArena.cloudTeacherOverview(owner);
  const overviewRoom = overview.rooms.find(item => item.code === room.code);
  assert.equal(overviewRoom.humanCount, 1);
  assert.equal(overviewRoom.readyCount, 1);
  assert.equal(overviewRoom.players.length, 1);
  assert.equal(overviewRoom.players[0].companyName, 'Student Plant');
  assert.equal(overviewRoom.activeEvent.key, 'factory_supplier_delay');
  assert.ok(overviewRoom.teacherControls.actions.forceEvent);
  assert.ok(overviewRoom.teacherControls.eventCatalog.some(event => event.key === 'factory_supplier_delay'));

  const fullSummary = bizArena.roomSummary(room, student.id);
  const studentSummary = bizArena.roomSummary(room, student.id, { view: 'student' });
  assert.equal(studentSummary.summaryView, 'student');
  assert.equal(studentSummary.summaryContract, 'student-v2');
  assert.equal(studentSummary.teacherAccountId, '');
  assert.deepEqual(studentSummary.teacherControls, { canManage: false, actions: {} });
  assert.equal(studentSummary.teacherControls.eventCatalog, undefined);
  assert.equal(studentSummary.classSnapshot, null);
  assert.equal(studentSummary.classReadiness, null);
  assert.equal(studentSummary.classDashboard, null);
  assert.equal(studentSummary.classDebrief, null);
  assert.equal(studentSummary.scenarioLab, null);
  assert.equal(studentSummary.scenarioExperiment, null);
  assert.equal(studentSummary.adminSnapshots, undefined);
  assert.equal(studentSummary.players.some(player => player.isTeacherHost), false);
  assert.equal(studentSummary.players.some(player => player.factory), false);
  assert.equal(studentSummary.players.some(player => player.turnGuide), false);
  assert.deepEqual(studentSummary.cityCatalog, []);
  assert.deepEqual(studentSummary.specializationCatalog, []);
  assert.deepEqual(studentSummary.boardPolicyCatalog, []);
  assert.deepEqual(studentSummary.strategyCatalog, []);
  assert.deepEqual(studentSummary.researchCatalog, []);
  assert.deepEqual(studentSummary.contractBoard, []);
  assert.ok(fullSummary.players.find(player => player.id === student.id)?.factory);
  assert.ok(JSON.stringify(studentSummary).length < JSON.stringify(fullSummary).length * 0.8);
  assert.ok(bizArena.playerSummary(room, student, student.id).factory);
  assert.ok(studentSummary.factoryScenario?.supplierOffers);

  const fullPlayer = bizArena.playerSummary(room, student, student.id);
  const studentPlayer = bizArena.playerStateSummary(room, student, student.id, { view: 'student' });
  assert.equal(studentPlayer.playerView, 'student');
  assert.equal(studentPlayer.playerContract, 'student-player-v2');
  assert.equal(studentPlayer.isTeacherHost, false);
  assert.ok(studentPlayer.factory);
  assert.ok(studentPlayer.turnGuide);
  assert.ok(studentPlayer.purchaseHints);
  assert.ok(studentPlayer.personnelHints);
  assert.ok(studentPlayer.personnelHints.candidates.length <= 3);
  assert.ok(studentPlayer.unitEconomics);
  assert.equal(studentPlayer.playerDebrief, null);
  assert.equal(studentPlayer.executionPlan, undefined);
  assert.equal(studentPlayer.intel, undefined);
  assert.equal(studentPlayer.focusPlan, undefined);
  assert.equal(studentPlayer.pivotPreview, undefined);
  assert.equal(studentPlayer.operatingPlanPreview, undefined);
  assert.equal(studentPlayer.researchEffects, undefined);
  assert.ok(JSON.stringify(studentPlayer).length < JSON.stringify(fullPlayer).length * 0.92);
});

test('local classroom: server host is a teacher console, not a competing company', () => {
  const { room, player: teacherHost } = bizArena.createRoom({
    roomName: 'Local Classroom',
    companyName: 'Teacher Console',
    userName: 'Local Teacher',
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
    teacherHost: true,
  });

  assert.equal(room.teacherAccountId, '');
  assert.equal(teacherHost.isTeacherHost, true);
  assert.equal(teacherHost.factory, null);
  assert.equal(bizArena.roomStartGate(room).teacherOnlyHost, true);
  assert.equal(bizArena.resolvePlayerSession(teacherHost.sessionToken, teacherHost.id).player.id, teacherHost.id);

  const { player: student } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Student Plant',
    userName: 'Student One',
  });
  bizArena.handleRoomAction(room, student, { action: 'toggle-ready' });

  const gate = bizArena.roomStartGate(room);
  const teacherSummary = bizArena.roomSummary(room, teacherHost.id);
  assert.equal(gate.minimumClassPlayers, 1);
  assert.equal(gate.classPlayerCount, 1);
  assert.equal(gate.canStart, true);
  assert.deepEqual(teacherSummary.classReadiness.rows.map(row => row.playerId), [student.id]);
  assert.deepEqual(teacherSummary.classSnapshot.rows.map(row => row.playerId), [student.id]);
  assert.deepEqual(teacherSummary.classDashboard.rows.map(row => row.playerId), [student.id]);
  assert.equal(teacherSummary.classDashboard.metrics.find(metric => metric.key === 'teams')?.value, 1);
});

test('cloud classroom: active rooms persist and hydrate with teacher ownership', () => {
  const teacher = bizArena.createTeacherAccount({
    email: 'persist@example.com',
    password: 'correct-horse-42',
    displayName: 'Persistent Teacher',
  });
  const created = bizArena.handleTeacherAction(teacher, {
    action: 'create-room',
    roomName: 'Persistent Cloud',
    companyName: 'Teacher Console',
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
  });
  const roomCode = created.roomCode;
  const room = bizArena.state.rooms.get(roomCode);
  const { player } = bizArena.joinRoom({
    roomCode,
    companyName: 'Restart Plant',
    userName: 'Restart Student',
  });
  bizArena.handleRoomAction(room, player, { action: 'toggle-ready' });
  bizArena.flushRuntimeState();

  const persistedDb = bizArena.loadDbFromDisk(path.join(dataDir, 'biz-arena-db.json'));
  resetRuntime();
  bizArena.state.db = persistedDb;
  bizArena.restoreActiveRoomsFromDb();

  const restored = bizArena.state.rooms.get(roomCode);
  assert.ok(restored);
  assert.equal(restored.teacherAccountId, teacher.id);
  assert.equal(restored.players.get(restored.hostPlayerId).isTeacherHost, true);
  assert.equal([...restored.players.values()].filter(player => !player.isTeacherHost).length, 1);
});

test('secure protocol: repeated actionId is rejected before action execution', () => {
  const { room, host } = createStartedFactoryRoom();
  const first = bizArena.verifyClientActionEnvelope(room, host, {
    actionId: 'act_test_0001',
    playerId: host.id,
    sessionToken: host.sessionToken,
    action: 'toggle-ready',
  });

  assert.equal(first.playerId, host.id);
  assert.equal(first.sessionToken, host.sessionToken);
  assert.equal(host.security.acceptedActionCount, 1);
  assert.throws(
    () => bizArena.verifyClientActionEnvelope(room, host, {
      actionId: 'act_test_0001',
      playerId: host.id,
      sessionToken: host.sessionToken,
      action: 'toggle-ready',
    }),
    /Повторное действие отклонено/
  );
  assert.equal(host.security.rejectedActionCount, 1);
  assert.equal(host.security.lastRejectReason, 'replay actionId');
});

test('secure protocol: action rate limit rejects bursts from one player', () => {
  const { room, host } = createStartedFactoryRoom();
  for (let index = 0; index < 20; index += 1) {
    bizArena.verifyClientActionEnvelope(room, host, {
      actionId: `act_burst_${index}`,
      playerId: host.id,
      sessionToken: host.sessionToken,
      action: 'toggle-ready',
    });
  }

  assert.throws(
    () => bizArena.verifyClientActionEnvelope(room, host, {
      actionId: 'act_burst_21',
      playerId: host.id,
      sessionToken: host.sessionToken,
      action: 'toggle-ready',
    }),
    /Слишком много действий/
  );
  assert.equal(host.security.lastRejectReason, 'rate limit');
});

test('server overview exposes room players, readiness and host role for admin panel', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Admin Room',
    companyName: 'Host Corp',
    userName: 'Teacher',
  });
  const { player: student } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Student Corp',
    userName: 'Student A',
  });
  bizArena.handleRoomAction(room, student, { action: 'toggle-ready' });

  const overview = bizArena.serverOverview();
  const overviewRoom = overview.rooms.find(candidate => candidate.code === room.code);
  const hostRow = overviewRoom.players.find(player => player.id === host.id);
  const studentRow = overviewRoom.players.find(player => player.id === student.id);

  assert.equal(overviewRoom.readyCount, 1);
  assert.equal(hostRow.isHost, true);
  assert.equal(hostRow.ready, false);
  assert.equal(studentRow.userName, 'Student A');
  assert.equal(studentRow.companyName, 'Student Corp');
  assert.equal(studentRow.ready, true);
  assert.equal(typeof studentRow.marketOfferValue, 'number');
  assert.equal(typeof studentRow.payroll, 'number');
  assert.equal(typeof studentRow.capacity, 'number');
  assert.equal(typeof studentRow.finishedGoods, 'number');
  assert.equal(typeof studentRow.rawStock, 'number');
  assert.equal(typeof studentRow.profitLastTurn, 'number');
  assert.equal(typeof overviewRoom.classStats.totalCapital, 'number');
  assert.equal(typeof overviewRoom.classStats.totalPayroll, 'number');
  assert.equal(typeof overviewRoom.classStats.totalRejectedActions, 'number');
  assert.equal(typeof hostRow.rejectedActionCount, 'number');
  assert.equal(typeof hostRow.acceptedActionCount, 'number');
  assert.ok(Array.isArray(overviewRoom.players));
});

test('server admin action controls a room through the host player', () => {
  const { room } = createStartedFactoryRoom('motorcycles');
  assert.equal(room.status, 'running');

  bizArena.handleServerAdminAction({ roomCode: room.code, action: 'pause-game' });
  assert.equal(room.status, 'paused');

  bizArena.handleServerAdminAction({ roomCode: room.code, action: 'force-event', value: 'factory_demand_surge' });
  assert.equal(room.activeEvent.key, 'factory_demand_surge');

  bizArena.handleServerAdminAction({ roomCode: room.code, action: 'finish-room' });
  assert.equal(room.status, 'finished');
  assert.equal(room.finishReason, 'teacher_stopped');
});

test('server overview keeps admin day snapshots after resolved turns', () => {
  const { room, host } = createStartedFactoryRoom();
  host.factory.finishedGoods = 2;
  host.factory.saleOffer = { price: 6400, quantity: 2 };

  bizArena.handleRoomAction(room, host, { action: 'next-turn' });
  const overview = bizArena.serverOverview();
  const overviewRoom = overview.rooms.find(candidate => candidate.code === room.code);
  const daySnapshot = overviewRoom.adminDays.find(day => day.day === 2);

  assert.ok(daySnapshot);
  assert.ok(Array.isArray(daySnapshot.players));
  assert.equal(typeof daySnapshot.classStats.totalCapital, 'number');
});

test('factory scenario: motorcycles gives every player the same plant and a shared candidate pool', () => {
  const { room, host, guest } = createStartedFactoryRoom();
  const summary = bizArena.roomSummary(room, host.id);
  const hostSummary = summary.players.find(player => player.id === host.id);
  const guestSummary = summary.players.find(player => player.id === guest.id);

  assert.equal(summary.factoryScenario.key, 'motorcycles');
  assert.equal(hostSummary.factory.productLabel, 'Мотоциклы');
  assert.equal(guestSummary.factory.productLabel, 'Мотоциклы');
  assert.deepEqual(
    hostSummary.factory.components.map(component => component.key),
    guestSummary.factory.components.map(component => component.key)
  );
  assert.ok(summary.factoryScenario.candidates.length >= 6);
});

test('factory scenario: lower price clears first in the order book', () => {
  const { room, host, guest } = createStartedFactoryRoom();

  const hostCandidate = bizArena.roomSummary(room, host.id).factoryScenario.candidates[0];
  bizArena.handleBusinessAction(room, host, { action: 'hire-worker', value: hostCandidate.id });
  const guestCandidate = bizArena.roomSummary(room, guest.id).factoryScenario.candidates[0];
  bizArena.handleBusinessAction(room, guest, { action: 'hire-worker', value: guestCandidate.id });

  ['frames', 'engines', 'wheels', 'electronics'].forEach(componentKey => {
    const quantity = componentKey === 'wheels' ? 4 : 2;
    bizArena.handleBusinessAction(room, host, { action: 'buy-component', value: { componentKey, quantity } });
    bizArena.handleBusinessAction(room, guest, { action: 'buy-component', value: { componentKey, quantity } });
  });

  bizArena.handleBusinessAction(room, host, { action: 'assemble-product', value: 1 });
  bizArena.handleBusinessAction(room, guest, { action: 'assemble-product', value: 1 });
  bizArena.handleBusinessAction(room, host, { action: 'set-sale-offer', value: { price: 5900, quantity: 1 } });
  bizArena.handleBusinessAction(room, guest, { action: 'set-sale-offer', value: { price: 5400, quantity: 1 } });

  room.day = 1;
  room.tick = 0;
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    bizArena.advanceRoom(room);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(room.factoryScenario.marketBook[0].playerId, guest.id);
  assert.equal(room.factoryScenario.marketBook[0].sold, 1);
  assert.equal(room.marketHistory.length, 1);
});

test('factory scenario: supplier offer is shared and disappears after purchase', () => {
  const { room, host, guest } = createStartedFactoryRoom();
  const offer = bizArena.roomSummary(room, host.id).factoryScenario.supplierOffers
    .find(item => item.componentKey === 'frames');
  assert.ok(offer);

  const beforeFrames = host.factory.inventory.frames;
  bizArena.handleBusinessAction(room, host, {
    action: 'buy-supplier-offer',
    value: { offerId: offer.id, quantity: offer.quantity },
  });

  assert.equal(host.factory.inventory.frames, beforeFrames + offer.quantity);
  assert.equal(
    bizArena.roomSummary(room, guest.id).factoryScenario.supplierOffers.some(item => item.id === offer.id),
    false
  );
  assert.throws(
    () => bizArena.handleBusinessAction(room, guest, {
      action: 'buy-supplier-offer',
      value: { offerId: offer.id, quantity: offer.quantity },
    }),
    error => error.status === 404
  );
});

test('factory scenario: purchase hints explain the cheapest useful supplier lot', () => {
  const { room, host } = createStartedFactoryRoom();
  const summary = bizArena.playerSummary(room, host, host.id);
  const hint = summary.purchaseHints.find(item => item.recommendedOfferId);

  assert.ok(hint);
  assert.ok(hint.missingForBatch > 0);
  assert.ok(hint.recommendedQuantity > 0);
  assert.match(hint.studentText, /купите/i);

  const offers = room.factoryScenario.supplierOffers
    .filter(offer => offer.componentKey === hint.key)
    .sort((left, right) => Number(left.unitPrice || 0) - Number(right.unitPrice || 0));
  assert.equal(hint.recommendedOfferId, offers[0].id);
  assert.equal(hint.bestPrice, offers[0].unitPrice);

  bizArena.handleBusinessAction(room, host, {
    action: 'buy-supplier-offer',
    value: { offerId: hint.recommendedOfferId, quantity: hint.recommendedQuantity },
  });

  const afterPurchase = bizArena.playerSummary(room, host, host.id);
  const updatedHint = afterPurchase.purchaseHints.find(item => item.key === hint.key);
  assert.ok(updatedHint.stock >= hint.stock + hint.recommendedQuantity);
  assert.equal(
    room.factoryScenario.supplierOffers.some(offer => offer.id === hint.recommendedOfferId),
    false
  );
});

test('factory scenario: personnel hints explain who to hire and why', () => {
  const { room, host } = createStartedFactoryRoom();
  const summary = bizArena.playerSummary(room, host, host.id);
  const hints = summary.personnelHints;
  const recommended = hints.candidates[0];

  assert.ok(hints.summary);
  assert.equal(hints.summary.bottleneck, 'people');
  assert.equal(hints.summary.recommendedCandidateId, recommended.id);
  assert.ok(recommended.score > 0);
  assert.ok(recommended.signOnCost > recommended.expectedSalary);
  assert.ok(recommended.linePowerGain >= 0);
  assert.equal(recommended.affordable, true);
  assert.match(recommended.studentText, /Наймите|запасной/i);

  bizArena.handleBusinessAction(room, host, {
    action: 'hire-worker',
    value: recommended.id,
  });

  const afterHire = bizArena.playerSummary(room, host, host.id);
  assert.equal(afterHire.factory.workerCount, 1);
  assert.equal(
    room.factoryScenario.candidates.some(candidate => candidate.id === recommended.id),
    false
  );
  assert.ok(afterHire.personnelHints.summary.currentPayroll > 0);
});

test('factory scenario: assembly hints explain people and component bottlenecks', () => {
  const { room, host } = createStartedFactoryRoom();

  let summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.assemblyHints.bottleneck, 'people');
  assert.equal(summary.assemblyHints.maxAssembly, 0);
  assert.equal(summary.assemblyHints.nextAction.department, 'workforce');

  const candidate = bizArena.roomSummary(room, host.id).factoryScenario.candidates[0];
  bizArena.handleBusinessAction(room, host, { action: 'hire-worker', value: candidate.id });
  summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.assemblyHints.bottleneck, 'ready');
  assert.ok(summary.assemblyHints.maxAssembly > 0);
  assert.equal(summary.assemblyHints.nextAction.action, 'assemble-product');

  Object.keys(host.factory.inventory).forEach(key => {
    host.factory.inventory[key] = 0;
  });
  summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.assemblyHints.bottleneck, 'components');
  assert.equal(summary.assemblyHints.maxAssembly, 0);
  assert.equal(summary.assemblyHints.nextAction.tab, 'purchase');
  assert.ok(summary.assemblyHints.componentRows.some(item => item.status === 'blocked'));
});

test('game feel: turn guide combines purchase, personnel, assembly, market, and finish steps', () => {
  const { room, host } = createStartedFactoryRoom();
  let summary = bizArena.playerSummary(room, host, host.id);

  assert.equal(summary.turnGuide.steps.length, 5);
  assert.deepEqual(
    summary.turnGuide.steps.map(step => step.key),
    ['purchase', 'personnel', 'assembly', 'market', 'finish']
  );
  assert.ok(summary.turnGuide.primaryKey);
  assert.ok(summary.turnGuide.target.tab || summary.turnGuide.target.action);

  const candidate = bizArena.roomSummary(room, host.id).factoryScenario.candidates[0];
  bizArena.handleBusinessAction(room, host, { action: 'hire-worker', value: candidate.id });
  Object.keys(host.factory.inventory).forEach(key => {
    host.factory.inventory[key] = 20;
  });
  bizArena.handleBusinessAction(room, host, { action: 'assemble-product', value: 1 });
  summary = bizArena.playerSummary(room, host, host.id);
  bizArena.handleBusinessAction(room, host, {
    action: 'set-sale-offer',
    value: { price: summary.price, quantity: 1 },
  });

  summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.turnGuide.primaryKey, 'finish');
  assert.equal(summary.turnGuide.target.action, 'next-turn');
  assert.equal(summary.turnGuide.progress.ready, 5);
});

test('factory scenario: drones exposes scenario metadata and component portfolio in room summary', () => {
  const { room, host, guest } = createStartedFactoryRoom('drones');
  const summary = bizArena.roomSummary(room, host.id);
  const hostSummary = summary.players.find(player => player.id === host.id);
  const guestSummary = summary.players.find(player => player.id === guest.id);

  assert.equal(summary.factoryScenario.key, 'drones');
  assert.equal(summary.factoryScenario.productLabel, 'Дроны');
  assert.equal(summary.factoryScenario.baseDemandMin, 10);
  assert.equal(summary.factoryScenario.baseDemandMax, 18);
  assert.equal(summary.factoryScenario.upkeep, 5500);
  assert.deepEqual(
    summary.factoryScenario.components.map(component => component.key),
    ['motors', 'batteries', 'controllers', 'cameras', 'frames']
  );
  assert.ok(summary.factoryScenario.roles.includes('Калибровщик'));
  assert.equal(hostSummary.factory.productLabel, 'Дроны');
  assert.equal(guestSummary.factory.productLabel, 'Дроны');
});

test('difficulty settings default old rooms to normal and expose UI rules', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Default Difficulty',
    companyName: 'Host Corp',
    userName: 'Host',
    scenarioKey: 'motorcycles',
  });
  const defaultSummary = bizArena.roomSummary(room, host.id);
  assert.equal(defaultSummary.difficulty, 'normal');
  assert.equal(defaultSummary.visibleUiMode, 'standard');
  assert.ok(defaultSummary.difficultyRules.advancedTabs.includes('intel'));

  resetRuntime();
  const { room: easyRoom, player: easyHost } = bizArena.createRoom({
    roomName: 'Easy Difficulty',
    companyName: 'Easy Plant',
    userName: 'Host',
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
  });
  const easySummary = bizArena.roomSummary(easyRoom, easyHost.id);
  assert.equal(easySummary.difficulty, 'easy');
  assert.equal(easySummary.visibleUiMode, 'guided');
  assert.ok(easyHost.money > host.money);
  assert.ok(easySummary.difficultyRules.costMultiplier < 1);
  assert.ok(!easySummary.difficultyRules.visibleTabs.includes('intel'));

  resetRuntime();
  const { room: hardRoom, player: hardHost } = bizArena.createRoom({
    roomName: 'Hard Difficulty',
    companyName: 'Hard Plant',
    userName: 'Host',
    scenarioKey: 'motorcycles',
    difficulty: 'hard',
  });
  const hardSummary = bizArena.roomSummary(hardRoom, hardHost.id);
  assert.equal(hardSummary.difficulty, 'hard');
  assert.equal(hardSummary.visibleUiMode, 'advanced');
  assert.ok(hardHost.money < host.money);
  assert.ok(hardSummary.difficultyRules.costMultiplier > 1);
  assert.ok(hardSummary.difficultyRules.visibleTabs.includes('intel'));
});

test('difficulty can be changed in lobby and rebalances factory starters', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Difficulty Lobby',
    companyName: 'Host Plant',
    userName: 'Host',
    scenarioKey: 'motorcycles',
  });
  const normalMoney = host.money;

  bizArena.handleRoomAction(room, host, {
    action: 'update-room-settings',
    maxPlayers: 8,
    demandProfile: 'standard',
    scenarioKey: 'motorcycles',
    dayLimit: 14,
    difficulty: 'easy',
  });

  const summary = bizArena.roomSummary(room, host.id);
  assert.equal(summary.difficulty, 'easy');
  assert.equal(summary.visibleUiMode, 'guided');
  assert.ok(host.money > normalMoney);
});

test('room settings cap season length at 30 turns', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Season Cap',
    companyName: 'Host Plant',
    userName: 'Host',
    scenarioKey: 'motorcycles',
  });

  bizArena.handleRoomAction(room, host, {
    action: 'update-room-settings',
    maxPlayers: 8,
    demandProfile: 'standard',
    scenarioKey: 'motorcycles',
    dayLimit: 99,
    turnDurationMs: 10 * 60 * 1000,
    difficulty: 'easy',
  });

  assert.equal(room.settings.dayLimit, 30);
  assert.equal(room.settings.turnDurationMs, 10 * 60 * 1000);
  assert.equal(bizArena.roomSummary(room, host.id).turnDurationMs, 10 * 60 * 1000);
});

test('lobby permissions: non-host cannot edit settings or start match', () => {
  const { room } = bizArena.createRoom({
    roomName: 'Host Permissions',
    companyName: 'Host Plant',
    userName: 'Host',
    scenarioKey: 'motorcycles',
  });
  const { player: student } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Student Plant',
    userName: 'Student',
  });

  assert.throws(() => bizArena.handleRoomAction(room, student, {
    action: 'update-room-settings',
    dayLimit: 10,
    turnDurationMs: 5 * 60 * 1000,
  }), /Только хост/);
  assert.throws(() => bizArena.handleRoomAction(room, student, { action: 'start-game' }), /Только хост/);
});

test('server authority: classroom start requires at least one student team', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Classroom Gate',
    companyName: 'Host Plant',
    userName: 'Host',
    scenarioKey: 'motorcycles',
  });

  bizArena.handleRoomAction(room, host, { action: 'toggle-ready' });
  let gate = bizArena.roomStartGate(room);
  assert.equal(gate.practiceMode, '');
  assert.equal(gate.teacherOnlyHost, false);
  assert.equal(gate.minimumClassPlayers, 2);
  assert.equal(gate.classPlayerCount, 1);
  assert.equal(gate.readyCount, 1);
  assert.equal(gate.canStart, false);
  assert.equal(bizArena.canStartMatch(room), false);
  let summary = bizArena.roomSummary(room, host.id);
  assert.equal(summary.teacherControls.startGate.canStart, false);
  assert.equal(summary.teacherControls.actions.startGame, false);
  assert.throws(
    () => bizArena.handleRoomAction(room, host, { action: 'start-game' }),
    error => error.status === 400
  );

  const { player: student } = bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Student Plant',
    userName: 'Student',
  });
  gate = bizArena.roomStartGate(room);
  assert.equal(gate.classPlayerCount, 2);
  assert.equal(gate.readyCount, 1);
  assert.equal(gate.canStart, false);

  bizArena.handleRoomAction(room, student, { action: 'toggle-ready' });
  gate = bizArena.roomStartGate(room);
  assert.equal(gate.readyCount, 2);
  assert.equal(gate.canStart, true);
  assert.equal(bizArena.canStartMatch(room), true);
  summary = bizArena.roomSummary(room, host.id);
  assert.equal(summary.teacherControls.startGate.canStart, true);
  assert.equal(summary.teacherControls.actions.startGame, true);
});

test('server authority: practice rooms may start with one ready player', () => {
  const { room, player: host } = bizArena.createRoom({
    roomName: 'Tutorial Gate',
    companyName: 'Host Academy',
    userName: 'Host',
    scenarioKey: 'motorcycles',
    practiceMode: 'tutorial',
  });

  assert.equal(room.settings.practiceMode, 'tutorial');
  bizArena.handleRoomAction(room, host, { action: 'toggle-ready' });

  const gate = bizArena.roomStartGate(room);
  assert.equal(gate.practiceMode, 'tutorial');
  assert.equal(gate.teacherOnlyHost, false);
  assert.equal(gate.minimumClassPlayers, 1);
  assert.equal(gate.classPlayerCount, 1);
  assert.equal(gate.readyCount, 1);
  assert.equal(gate.canStart, true);

  bizArena.handleRoomAction(room, host, { action: 'start-game' });
  assert.equal(room.status, 'running');
});

test('UI smoke: create-room difficulty, visual presets, and single game navigation are wired', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const appJs = readPublicAppSources();
  const appRuntimeJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app-runtime.js'), 'utf8');
  const styles = readPublicStyles();
  const gameIcons = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'game-icons.svg'), 'utf8');
  const desktopMain = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const packageJson = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');

  assert.match(indexHtml, /id="server-home-screen"/);
  assert.match(indexHtml, /id="server-client-url"/);
  assert.match(indexHtml, /id="server-admin-overview"/);
  assert.match(indexHtml, /teacher-start-deck/);
  assert.match(indexHtml, /data-server-exit/);
  assert.match(indexHtml, /id="join-user-name"/);
  assert.match(indexHtml, /data-client-entry-note/);
  assert.match(indexHtml, /Режим ученика/);
  assert.match(indexHtml, /data-server-copy="client"/);
  assert.match(indexHtml, /id="create-difficulty-select"/);
  assert.match(indexHtml, /create-room-blueprint/);
  assert.match(indexHtml, /id="create-room-live-summary"/);
  assert.match(indexHtml, /Маршрут запуска занятия/);
  assert.match(indexHtml, /data-create-difficulty="easy"/);
  assert.match(indexHtml, /id="difficulty-select"/);
  assert.match(indexHtml, /id="turn-duration-select"/);
  assert.match(indexHtml, /id="visual-preset-select"/);
  assert.doesNotMatch(indexHtml, /id="advanced-tabs"/);
  assert.doesNotMatch(indexHtml, /class="ghost tab-button/);
  assert.match(indexHtml, /\/assets\/game-icons\.svg#icon-production/);
  assert.match(indexHtml, /\/assets\/game-icons\.svg#icon-cabinet/);
  assert.match(indexHtml, /\/assets\/game-icons\.svg#icon-join/);
  assert.match(indexHtml, /\/assets\/game-icons\.svg#icon-external/);
  assert.match(indexHtml, /\/assets\/game-icons\.svg#icon-theme/);
  assert.match(indexHtml, /\/assets\/game-icons\.svg#icon-chevron/);
  assert.match(indexHtml, /topbar-icon-button"[^>]*aria-label="[^"]*"[^>]*>[\s\S]*\/assets\/game-icons\.svg#icon-info/);
  assert.match(indexHtml, /topbar-icon-button"[^>]*aria-label="[^"]*"[^>]*>[\s\S]*\/assets\/game-icons\.svg#icon-theme/);
  assert.doesNotMatch(indexHtml, /id="game-copy-student-link"[\s\S]*>↗<\/button>/);
  assert.doesNotMatch(indexHtml, /topbar-icon-button"[^>]*>\?<\/button>/);
  assert.doesNotMatch(indexHtml, /<span class="chevron" aria-hidden="true">[^<]/);
  assert.doesNotMatch(indexHtml, /<span aria-hidden="true">[TOPSCMR]<\/span>/);
  assert.doesNotMatch(indexHtml, /class="(?:command-icon|kpi-icon|cycle-icon|play-command-icon)" aria-hidden="true">[^<]/);
  assert.match(gameIcons, /<symbol id="icon-production"/);
  assert.match(gameIcons, /<symbol id="icon-market"/);
  assert.match(gameIcons, /<symbol id="icon-warehouse"/);
  assert.match(gameIcons, /<symbol id="icon-cash"/);
  assert.match(gameIcons, /<symbol id="icon-quality"/);
  assert.match(gameIcons, /<symbol id="icon-ship"/);
  assert.match(gameIcons, /<symbol id="icon-pause"/);
  assert.match(gameIcons, /<symbol id="icon-next"/);
  assert.match(gameIcons, /<symbol id="icon-finish"/);
  assert.match(gameIcons, /<symbol id="icon-crisis"/);
  assert.match(gameIcons, /<symbol id="icon-check"/);
  assert.match(gameIcons, /<symbol id="icon-alert"/);
  assert.match(gameIcons, /<symbol id="icon-external"/);
  assert.match(gameIcons, /<symbol id="icon-theme"/);
  assert.match(gameIcons, /<symbol id="icon-chevron"/);
  assert.match(appJs, /function requestedAppMode/);
  assert.match(appJs, /function gameIcon/);
  assert.match(appJs, /icon: 'warehouse'/);
  assert.match(appJs, /factory-node-icon">\$\{gameIcon\(department\.icon/);
  assert.match(appJs, /function isServerMode/);
  assert.match(appJs, /function isClientMode/);
  assert.match(appJs, /function applyAppMode/);
  assert.match(appJs, /function currentPlayerRole/);
  assert.match(appJs, /function syncBodyContext/);
  assert.match(appJs, /dataset\.playerRole/);
  assert.match(appJs, /function clientLaunchParams/);
  assert.match(appJs, /function applyClientLaunchParams/);
  assert.match(appJs, /function friendlyConnectionError/);
  assert.match(appJs, /function maybeAutoJoinFromClientLaunch/);
  assert.match(appJs, /function renderServerHome/);
  assert.match(appJs, /function renderNetworkDoctor/);
  assert.match(appJs, /function networkDoctorUrlInfo/);
  assert.match(appJs, /function renderConnectionModeCards/);
  assert.match(appJs, /function runNetworkHealthCheck/);
  assert.match(appJs, /function isLiteClientMode/);
  assert.match(appJs, /function copyServerAddress/);
  assert.match(appJs, /function renderServerAdminOverview/);
  assert.match(appJs, /function serverAdminMetricOptions/);
  assert.match(appJs, /function serverAdminHelpQueue/);
  assert.match(appJs, /function serverAdminSecurityQueue/);
  assert.match(appJs, /function serverAdminClassSummary/);
  assert.match(appJs, /function renderServerAdminClassSummary/);
  assert.match(appJs, /function renderServerAdminLessonPlan/);
  assert.match(appJs, /function serverAdminQuickLinks/);
  assert.match(appJs, /function serverAdminControlButtons/);
  assert.match(appJs, /function renderLiveMetricCard/);
  assert.match(appJs, /function renderReadinessGauge/);
  assert.match(appJs, /function renderMetricSparkline/);
  assert.doesNotMatch(appJs, /function renderTeacherLiveMetrics|function teacherBlockerMarkup/);
  assert.doesNotMatch(appJs, /function serverDashboardIcon/);
  assert.doesNotMatch(appJs, /function renderServerDashboardShell/);
  assert.doesNotMatch(appJs, /server-dashboard-/);
  assert.match(appJs, /function runServerAdminAction/);
  assert.match(appJs, /function exportServerAdminSnapshot/);
  assert.match(appJs, /server-admin-room-select/);
  assert.match(appJs, /server-admin-player-select/);
  assert.match(appJs, /server-admin-metric-select/);
  assert.match(appJs, /server-admin-day-select/);
  assert.match(appJs, /data-server-admin-export/);
  assert.match(appJs, /data-server-admin-lesson-plan/);
  assert.match(appJs, /Сценарий занятия/);
  assert.match(appJs, /Подозрительные действия/);
  assert.match(appJs, /data-network-doctor/);
  assert.match(appJs, /data-network-check/);
  assert.match(appJs, /\/api\/qr\?data=/);
  assert.match(appJs, /\/api\/network\/check\?url=/);
  assert.match(appJs, /Отдельная сеть/);
  assert.match(appJs, /одна общая сеть/);
  assert.match(appJs, /CLIENT_LITE_REFRESH_INTERVAL_MS/);
  assert.match(appJs, /CLIENT_LITE_REFRESH_INTERVAL_MS = 12000/);
  assert.match(appJs, /HIDDEN_REFRESH_INTERVAL_MS = 20000/);
  assert.match(appJs, /CLOUD_REFRESH_INTERVAL_MS = 8000/);
  assert.match(appJs, /bizArenaPerformanceMode/);
  assert.match(appJs, /bizArenaRefreshCadence/);
  assert.match(appJs, /bizArenaAnimationMode/);
  assert.match(appJs, /function currentRefreshIntervalMs/);
  assert.match(appJs, /function animationsDisabled/);
  assert.match(appJs, /function scheduleRefreshLoop/);
  assert.match(appJs, /refreshDebounceHandle/);
  assert.match(appJs, /refreshPendingAfterFlight/);
  assert.match(appJs, /function scheduleRealtimeRefresh/);
  assert.match(appRuntimeJs, /payload\.type === 'room-updated'/);
  assert.match(appJs, /onRoomUpdated: \(\) => scheduleRealtimeRefresh\(\)/);
  assert.match(appJs, /performanceRuntimeProfile\(\)\.realtimeDebounceMs/);
  assert.match(appJs, /if \(state\.refreshInFlight\) \{[\s\S]*state\.refreshPendingAfterFlight = true/);
  assert.match(appJs, /finally \{[\s\S]*state\.refreshInFlight = false/);
  assert.match(appJs, /dataset\.performanceMode/);
  assert.match(appJs, /dataset\.animationMode/);
  assert.match(indexHtml, /id="performance-mode-select"/);
  assert.match(indexHtml, /id="refresh-cadence-select"/);
  assert.match(indexHtml, /id="animation-mode-select"/);
  assert.match(appJs, /client isolation/);
  assert.match(appJs, /\/api\/server\/action/);
  assert.match(appJs, /\/api\/server\/overview/);
  assert.match(appJs, /function copyTextToClipboard/);
  assert.match(appJs, /\/client/);
  assert.match(appJs, /function renderTeacherDashboard/);
  assert.match(appJs, /function renderTeacherCockpit/);
  assert.match(appJs, /function teacherNextAction/);
  assert.match(appJs, /function teacherPrimaryHostAction/);
  assert.match(appJs, /function teacherPriorityHelpMarkup/);
  const teacherCockpit = sourceFunctionBlock(appJs, 'renderTeacherCockpit');
  const teacherHostControls = sourceFunctionBlock(appJs, 'renderTeacherHostControls');
  const teacherNowCard = sourceFunctionBlock(appJs, 'renderTeacherNowCard');
  assert.match(teacherCockpit, /Состояние класса[\s\S]*renderTeacherClassReadiness/);
  assert.match(teacherCockpit, /readyLabel = inMatch \? 'готовы к ходу' : 'готовы к старту'/);
  assert.doesNotMatch(teacherCockpit, /teacher-action-board|teacher-cockpit-quick-actions|teacher-cockpit-focus-row|data-host-action/);
  assert.match(teacherHostControls, /data-host-action="pause-game"[\s\S]*data-host-action="resume-game"[\s\S]*data-host-action="next-turn"[\s\S]*data-host-action="finish-room"/);
  assert.match(teacherHostControls, /data-teacher-lifecycle-contract/);
  assert.match(teacherHostControls, /data-teacher-phase/);
  assert.match(teacherHostControls, /data-teacher-primary-action/);
  assert.match(teacherHostControls, /data-teacher-next-phase/);
  assert.match(teacherNowCard, /Что сделать сейчас[\s\S]*teacherNextAction/);
  assert.match(teacherNowCard, /Команды без закупок[\s\S]*Команды без сотрудников[\s\S]*Застрявшие команды[\s\S]*Риск банкротства/);
  assert.doesNotMatch(appJs, new RegExp('value: `\\\\$\\\\{noPurchase\\\\}/\\\\$\\\\{noWorkers\\\\}/\\\\$\\\\{noProduction\\\\}/\\\\$\\\\{noSaleOffer\\\\}`'));
  assert.match(appJs, /function renderServerAdminPriorityStrip/);
  assert.match(appJs, /function renderStudentRouteFlowline/);
  assert.match(appJs, /function teacherStartGateInfo/);
  assert.match(appJs, /function renderTeacherLobbyCommandCard/);
  const createDemoSession = sourceFunctionBlock(appJs, 'createDemoSession');
  const createTutorialSession = sourceFunctionBlock(appJs, 'createTutorialSession');
  assert.match(createDemoSession, /practiceMode: 'demo'/);
  assert.match(createTutorialSession, /practiceMode: 'tutorial'/);
  assert.match(appJs, /data-uiux-slice="teacher-lobby-command"/);
  assert.match(appJs, /Командный центр запуска/);
  assert.match(appJs, /Что сделать преподавателю сейчас/);
  assert.match(appJs, /teacher-lobby-start-button/);
  assert.match(appJs, /teacher-lobby-roster-board/);
  assert.match(appJs, /Кто вошел \/ кто готов/);
  assert.match(appJs, /Кого ждем/);
  assert.match(appJs, /student-lobby-route/);
  assert.match(appJs, /student-lobby-params/);
  assert.match(appJs, /student-lobby-status-strip/);
  assert.match(appJs, /student-lobby-ready-card/);
  assert.match(appJs, /Статус ученика/);
  assert.match(appJs, /Вы готовы к старту/);
  assert.match(appJs, /До старта матча/);
  assert.match(appJs, /Параметры занятия/);
  assert.match(appJs, /teacher-lobby-stepper/);
  assert.match(appJs, /teacher-lobby-preflight/);
  assert.match(appJs, /teacher-lobby-start-gate/);
  assert.match(appJs, /Проверка перед занятием/);
  assert.match(appJs, /key: 'session'[\s\S]*key: 'student-link'[\s\S]*key: 'students'[\s\S]*key: 'readiness'[\s\S]*key: 'settings'/);
  assert.match(appJs, /data-preflight-ready/);
  assert.match(appJs, /data-preflight-next/);
  assert.match(appJs, /data-preflight-step/);
  assert.match(appJs, /data-start-gate-reason/);
  assert.match(appJs, /data-start-gate-can-start/);
  assert.match(appJs, /data-preflight-action="start-match"/);
  assert.match(appJs, /const preflightReady = launchSteps\.every\(step => step\.done\) && startGateInfo\.canStart/);
  assert.match(appJs, /teacher-lobby-launch-strip/);
  assert.match(appJs, /renderTeacherLobbyCommandCard\(studentLink, studentQrSrc/);
  assert.match(appJs, /teacher-lobby-share-panel/);
  assert.match(appJs, /teacher-lobby-qr/);
  assert.match(appJs, /teacher-lobby-student-link/);
  assert.match(appJs, /Ссылка для студентов/);
  assert.match(appJs, /data-uiux-slice="classroom-cockpit"/);
  assert.match(appJs, /data-uiux-slice="live-class-metrics"/);
  assert.doesNotMatch(appJs, /data-uiux-slice="teacher-live-metrics"/);
  assert.match(appJs, /server-admin-cockpit/);
  assert.doesNotMatch(appJs, /function studentRouteIcon/);
  assert.doesNotMatch(appJs, /data-uiux-upgrade="server-dashboard-shell"/);
  assert.doesNotMatch(appJs, /data-uiux-upgrade="student-dashboard-route"/);
  assert.match(appJs, /data-uiux-slice="student-first-turn-2"/);
  assert.match(appJs, /data-uiux-slice="teacher-cockpit-2"/);
  assert.match(appJs, /teacher-workspace-grid/);
  assert.match(appJs, /teacher-workspace-main/);
  assert.match(appJs, /teacher-workspace-side/);
  assert.match(appJs, /teacher-crisis-drawer/);
  assert.match(appJs, /teacher-phase-card/);
  assert.match(appJs, /teacher-readiness-compact/);
  assert.match(appJs, /student-route-flowline/);
  assert.match(appJs, /data-student-flow-contract="first-turn-v2"/);
  assert.match(appJs, /data-student-primary-step/);
  assert.match(appJs, /data-student-route-ready/);
  assert.match(appJs, /data-student-route-step/);
  assert.match(appJs, /student-focus-strip/);
  assert.match(appJs, /Короткий статус первого хода/);
  assert.match(appJs, /student-route-status-strip/);
  assert.match(appJs, /function renderStudentStatusMetric/);
  assert.match(appJs, /student-route-status-card/);
  assert.match(appJs, /live-metric-icon/);
  assert.doesNotMatch(appJs, /student-route-current/);
  assert.match(appJs, /student-route-live-meter/);
  assert.match(appJs, /studentRouteStatusLabel/);
  assert.match(appJs, /studentRouteDisplayLabel/);
  assert.match(appJs, /studentRouteDisplayHint/);
  assert.match(appJs, /student-primary-next-action/);
  assert.doesNotMatch(appJs, /student-primary-next-action-inline|student-action-band/);
  const factoryShellIndex = appJs.indexOf('<div class="factory-map-shell">');
  const studentRouteIndex = appJs.indexOf('${renderStudentRoutePanel()}', factoryShellIndex);
  const factoryHeaderIndex = appJs.indexOf('<div class="factory-map-header">', factoryShellIndex);
  assert.ok(factoryShellIndex >= 0 && studentRouteIndex > factoryShellIndex && factoryHeaderIndex > studentRouteIndex, 'student first-turn route renders before factory map header');
  const commandPanelIndex = appJs.indexOf('function renderStudentCommandPanel');
  const flowlineIndex = appJs.indexOf('${renderStudentRouteFlowline(routeItems)}', commandPanelIndex);
  const focusStripIndex = appJs.indexOf('<div class="student-focus-strip"', commandPanelIndex);
  const primaryActionIndex = appJs.indexOf('class="student-primary-next-action"', commandPanelIndex);
  assert.ok(commandPanelIndex >= 0 && primaryActionIndex > commandPanelIndex && flowlineIndex > primaryActionIndex && focusStripIndex > flowlineIndex, 'student primary action renders before route details');
  assert.match(appJs, /Шаг \$\{activeRouteIndex \+ 1\} из \$\{safeTotal\}/);
  assert.match(appJs, /Маршрут хода/);
  assert.match(appJs, /Купить → Нанять → Собрать → Продать → Завершить ход/);
  assert.match(appJs, /Перейти: \$\{route\[activeIndex\]\?\.label/);
  assert.match(appJs, /const CRISIS_CARDS/);
  assert.match(appJs, /function renderCrisisCards/);
  assert.match(appJs, /function iconButtonLabel/);
  assert.match(appJs, /function teacherHostActionIcon/);
  assert.match(appJs, /function crisisCardIcon/);
  assert.match(appJs, /Crisis Cards/);
  assert.match(appJs, /Резкий всплеск спроса/);
  assert.match(appJs, /Срыв поставок/);
  assert.match(appJs, /Давление зарплат/);
  assert.match(appJs, /data-crisis-card-event/);
  assert.match(appJs, /Запустить карточку/);
  assert.match(appJs, /data-crisis-card-key/);
  assert.match(appJs, /teacher-control-head/);
  assert.match(appJs, /teacher-control-state/);
  assert.match(appJs, /teacher-now-copy/);
  assert.match(appJs, /teacher-now-count/);
  assert.match(appJs, /crisis-card-icon/);
  assert.match(appJs, /teacher-now-icon/);
  assert.match(appJs, /id="teacher-dashboard-sort"/);
  assert.match(appJs, /teacher-cockpit-card/);
  assert.match(appJs, /teacher-cockpit-priority/);
  assert.match(appJs, /primary-teacher-action/);
  assert.match(appJs, /teacher-cockpit-crisis/);
  assert.match(appJs, /data-host-action="finish-room"/);
  assert.match(appJs, /Кто вошел \/ кто готов/);
  assert.match(appJs, /Что сделать сейчас/);
  assert.match(appJs, /Без закупки/);
  assert.match(appJs, /Без работников/);
  assert.match(appJs, /Без сборки/);
  assert.match(appJs, /Без заявки/);
  assert.match(appJs, /function currentDifficultyConfig/);
  assert.match(appJs, /function isAdvancedUiVisible/);
  assert.match(appJs, /function renderGuidedAction/);
  assert.match(appJs, /function renderDifficultyPreview/);
  assert.match(appJs, /function captureFocusedTradeInput/);
  assert.match(appJs, /function restoreFocusedTradeInput/);
  assert.match(appJs, /function stableRenderSignature/);
  assert.match(appJs, /function hasRenderSignatureChanged/);
  assert.match(appJs, /function resetRenderCache/);
  assert.match(appJs, /function roomStateRenderSignature/);
  assert.match(appJs, /state\.renderCache/);
  assert.match(appJs, /hasRenderSignatureChanged\('roomStateRoot'/);
  assert.match(appJs, /hasRenderSignatureChanged\('teacherPanel'/);
  assert.match(appJs, /hasRenderSignatureChanged\('serverAdminOverview'/);
  assert.match(appJs, /hasRenderSignatureChanged\('cloudTeacherOverview'/);
  assert.match(appJs, /data-cloud-teacher-value/);
  assert.match(appJs, /value: button\.dataset\.cloudTeacherValue \|\| ''/);
  assert.match(appJs, /body: JSON\.stringify\(\{ roomCode, action, value \}\)/);
  assert.match(appJs, /state\.player\?\.turnGuide/);
  assert.match(appJs, /guideTarget/);
  assert.match(appJs, /target\.progress\.ready/);
  assert.match(appJs, /bizArenaSessionToken/);
  assert.match(appJs, /sessionToken:\s*state\.sessionToken/);
  assert.match(appJs, /function shouldInvalidatePlayerSession/);
  assert.match(appJs, /\[401, 403, 404, 410\]\.includes/);
  assert.match(appJs, /function shouldInvalidateTeacherSession/);
  assert.match(appRuntimeJs, /requestError\.status = response\.status/);
  assert.match(indexHtml, /src="\/app-runtime\.js"/);
  assert.match(indexHtml, /href="\/styles\/runtime\.css"/);
  const refreshState = sourceFunctionBlock(appJs, 'refreshState');
  assert.match(refreshState, /if \(shouldInvalidatePlayerSession\(error\)\)[\s\S]*clearSession\(\)/);
  const fetchRuntimeMeta = sourceFunctionBlock(appJs, 'fetchRuntimeMeta');
  assert.match(fetchRuntimeMeta, /shouldInvalidateTeacherSession\(error\)[\s\S]*persistTeacherSession\(''\)/);
  assert.match(appJs, /payload\.turnDurationMs/);
  assert.match(appJs, /function renderCreateRoomLiveSummary/);
  assert.match(appJs, /createRoomLiveSummary/);
  assert.match(styles, /body\[data-app-mode="client"\]/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \.panel/);
  assert.match(styles, /html\[data-animation-mode="off"\]/);
  assert.match(styles, /settings-helper/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="student"\] \.lobby-settings-panel/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="student"\] \.lobby-leaderboard-panel/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="student"\] \.lobby-events-panel/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="student"\] \.lobby-classroom-hero/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="teacher"\] #toggle-ready[\s\S]*display: none !important/);
  assert.match(styles, /student-entry-note/);
  assert.match(styles, /server-home-shell/);
  assert.match(styles, /teacher-start-deck/);
  assert.match(styles, /create-room-live-summary/);
  assert.match(styles, /server-student-link-card/);
  assert.match(styles, /server-copy-button/);
  assert.match(styles, /network-doctor-panel/);
  assert.match(styles, /network-doctor-grid/);
  assert.match(styles, /connection-mode-grid/);
  assert.match(styles, /network-doctor-share/);
  assert.match(styles, /data-performance-mode="lite"/);
  assert.match(styles, /server-admin-overview/);
  assert.doesNotMatch(styles, /server-dashboard-/);
  assert.match(styles, /server-health-grid/);
  assert.match(styles, /server-admin-controls/);
  assert.match(styles, /server-admin-kpi-grid/);
  assert.match(styles, /server-admin-ranking/);
  assert.match(styles, /server-admin-command-panel/);
  assert.match(styles, /server-admin-cockpit/);
  assert.match(styles, /server-admin-cockpit-main/);
  assert.match(styles, /server-admin-cockpit-side/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /server-admin-priority-strip/);
  assert.match(styles, /student-route-flowline/);
  assert.doesNotMatch(styles, /student-route-dashboard/);
  assert.doesNotMatch(styles, /student-route-icon/);
  assert.match(styles, /student-route-panel-v2/);
  assert.match(styles, /student-route-status-strip/);
  assert.match(styles, /student-route-status-card/);
  assert.match(styles, /student-status-icon/);
  assert.match(styles, /live-metric-icon/);
  assert.match(styles, /student-route-flowline b[\s\S]*grid-row: 1 \/ span 2/);
  assert.match(styles, /student-route-flowline strong,[\s\S]*grid-column: 2/);
  assert.doesNotMatch(styles, /student-route-current/);
  assert.match(styles, /student-route-track/);
  assert.match(styles, /student-primary-next-action/);
  assert.match(styles, /student-route-detail-title/);
  assert.match(styles, /\.student-primary-next-action::after/);
  assert.match(styles, /teacher-workspace-grid/);
  assert.match(styles, /teacher-workspace-main/);
  assert.match(styles, /teacher-workspace-side/);
  assert.match(styles, /teacher-phase-card/);
  assert.match(styles, /teacher-phase-metrics/);
  assert.match(styles, /teacher-readiness-compact/);
  assert.match(styles, /button:focus-visible/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \*:hover/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \.student-route-panel/);
  assert.match(styles, /server-admin-help-panel/);
  assert.match(styles, /server-admin-security-panel/);
  assert.match(styles, /server-admin-class-summary/);
  assert.match(indexHtml, /game-topbar-chip/);
  assert.match(indexHtml, /game-chip-label/);
  assert.match(indexHtml, /data-status="offline"/);
  assert.match(appJs, /statusTone/);
  assert.match(appJs, /closest\('\.game-server-chip'\)\?\.setAttribute\('data-status', statusTone\)/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.shell[\s\S]*padding: 8px 12px 12px 180px/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.app-sidebar[\s\S]*width: 160px/);
  assert.match(styles, /\.game-ui-icon[\s\S]*width: 20px/);
  assert.match(styles, /\.logo-symbol\s*{[\s\S]*width: 68px/);
  assert.match(styles, /\.hero-blueprint\s*{[\s\S]*object-fit: cover/);
  assert.match(styles, /\.icon-frame svg\s*{[\s\S]*width: 22px/);
  assert.match(styles, /\.feature-grid\s*{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.command-action\s*{[\s\S]*grid-template-columns: 44px minmax\(0, 1fr\) 28px/);
  assert.match(styles, /\.command-action-primary\s*{[\s\S]*rgba\(244, 114, 182, 0\.6\)/);
  assert.match(styles, /\.topbar-icon-button \.game-ui-icon\s*{[\s\S]*width: 18px/);
  assert.match(styles, /\.topbar-status svg\s*{[\s\S]*width: 22px/);
  assert.match(styles, /\.match-preview-grid\s*{[\s\S]*grid-template-columns: minmax\(260px, 0\.38fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.team-list > div\s*{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.kpi-grid\s*{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.cycle-steps\s*{[\s\S]*repeat\(5, minmax\(130px, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*\.match-preview-grid[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /\.game-chip-label[\s\S]*inline-flex/);
  assert.match(styles, /\.game-server-chip\[data-status="online"\] \.game-chip-label \.game-ui-icon/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.game-control-panel[\s\S]*position: sticky/);
  assert.match(styles, /\.command-icon,[\s\S]*\.play-command-icon[\s\S]*place-items: center/);
  assert.match(styles, /\.factory-node-icon \.game-ui-icon,[\s\S]*width: 18px/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.app-sidebar-link[\s\S]*grid-template-columns: 22px minmax\(0, 1fr\)/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.app-sidebar-link > \.game-ui-icon[\s\S]*justify-self: center/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.app-sidebar-link > strong[\s\S]*white-space: normal/);
  assert.match(styles, /body\[data-screen="game-screen"\] \.app-sidebar-link\.active::before/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*body\[data-screen="game-screen"\] \.shell[\s\S]*padding: 8px/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*body\[data-screen="game-screen"\s*\][\s\S]*overflow-x: hidden/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*body\[data-screen="game-screen"\] \.game-panel,[\s\S]*body\[data-screen="game-screen"\] \.game-side-rail[\s\S]*max-width: 100%/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar[\s\S]*position: sticky/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-nav[\s\S]*overflow-x: auto/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*body\[data-game-tab="teacher"\] \.teacher-workspace-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*body\[data-screen="game-screen"\] \.game-student-link-chip[\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-nav[\s\S]*flex-wrap: nowrap/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-nav[\s\S]*overflow-x: auto/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-link[\s\S]*flex: 0 0 auto/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-link[\s\S]*width: max-content/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-link[\s\S]*min-width: 112px/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.game-topbar[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\]\[data-player-role="student"\] \.game-topbar[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\]\[data-player-role="student"\] \.game-next-action-chip[\s\S]*display: none/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\]\[data-player-role="student"\] \.student-command-support,[\s\S]*display: none/);
  assert.doesNotMatch(styles, /student-primary-next-action-inline|student-action-band/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="student"\] \.teacher-tab-button[\s\S]*display: none !important/);
  assert.match(styles, /live-classroom-strip/);
  assert.match(styles, /live-metric-card/);
  assert.match(styles, /live-readiness-gauge/);
  assert.match(styles, /live-sparkline/);
  assert.match(styles, /live-meter/);
  assert.match(styles, /liveTicker/);
  assert.match(styles, /liveSheen/);
  assert.match(styles, /server-admin-quick-links/);
  assert.match(styles, /server-admin-lesson-plan/);
  assert.match(styles, /server-admin-lesson-steps/);
  assert.match(styles, /teacher-dashboard-card/);
  assert.match(styles, /teacher-dashboard-row/);
  assert.match(styles, /teacher-cockpit-card/);
  assert.doesNotMatch(styles, /teacher-live-metrics/);
  assert.match(styles, /student-route-live-meter/);
  assert.match(styles, /student-command-kpis[\s\S]*repeat\(auto-fit, minmax\(132px, 1fr\)\)/);
  assert.match(styles, /student-command-kpis \.live-metric-card strong[\s\S]*overflow-wrap: anywhere/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="student"\] \.game-topbar[\s\S]*minmax\(150px, 0\.8fr\)/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="student"\] \.game-student-link-chip[\s\S]*display: none/);
  assert.match(styles, /body\[data-game-tab="operations"\] \.student-route-status-strip[\s\S]*repeat\(auto-fit, minmax\(136px, 1fr\)\)/);
  assert.match(styles, /body\[data-game-tab="operations"\] \.student-route-flowline\.student-route-track[\s\S]*repeat\(auto-fit, minmax\(148px, 1fr\)\)/);
  assert.match(styles, /body\[data-game-tab="operations"\] \.student-route-flowline strong[\s\S]*text-overflow: clip/);
  assert.match(styles, /body\[data-game-tab="operations"\] \.student-route-flowline strong[\s\S]*word-break: normal/);
  assert.match(styles, /body\[data-game-tab="operations"\] \.student-command-kpis[\s\S]*repeat\(auto-fit, minmax\(104px, 1fr\)\)/);
  assert.match(styles, /body\[data-game-tab="operations"\] \.student-command-support[\s\S]*repeat\(auto-fit, minmax\(190px, 1fr\)\)/);
  assert.match(styles, /student-mini-stats[\s\S]*repeat\(auto-fit, minmax\(86px, 1fr\)\)/);
  assert.match(styles, /student-market-stat/);
  assert.match(styles, /student-market-stat-icon/);
  assert.match(styles, /student-mini-stats b[\s\S]*text-overflow: clip/);
  assert.match(styles, /market-decision-grid[\s\S]*repeat\(auto-fit, minmax\(96px, 1fr\)\)/);
  assert.match(styles, /market-decision-grid b,[\s\S]*text-overflow: clip/);
  assert.match(styles, /teacher-lobby-command-card/);
  assert.match(styles, /teacher-lobby-command-actions/);
  assert.match(styles, /teacher-lobby-start-button/);
  assert.match(styles, /teacher-lobby-roster-board/);
  assert.match(styles, /teacher-lobby-waiting-list/);
  assert.match(styles, /teacher-lobby-share-panel/);
  assert.match(styles, /teacher-lobby-qr/);
  assert.match(styles, /teacher-lobby-student-link/);
  assert.match(styles, /create-room-blueprint/);
  assert.match(indexHtml, /create-room-metrics/);
  assert.match(indexHtml, /create-room-side/);
  assert.match(indexHtml, /create-room-flow-list/);
  assert.match(appJs, /create-room-mini-chart/);
  assert.match(styles, /\.create-room-classroom\s*{[\s\S]*width: min\(1280px, 100%\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(320px, 0\.42fr\)/);
  assert.match(styles, /\.create-room-side\s*{[\s\S]*display: grid/);
  assert.match(styles, /\.create-room-metrics\s*{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /#create-room-screen \.stack-form > \.difficulty-picker\s*{[\s\S]*grid-column: 1 \/ span 2[\s\S]*grid-row: 3 \/ span 2/);
  assert.match(styles, /#create-room-screen \.stack-form > \.create-room-submit-band\s*{[\s\S]*grid-column: 3 \/ -1[\s\S]*grid-row: 3/);
  assert.match(styles, /#create-room-screen \.difficulty-card\s*{[\s\S]*display: grid/);
  assert.match(styles, /\.create-room-mini-chart\s*{[\s\S]*background-size: 52px 52px/);
  assert.match(styles, /\.create-room-flow-list article\s*{[\s\S]*grid-template-columns: 32px minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*\.create-room-classroom[\s\S]*grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*#create-room-screen \.stack-form > \.difficulty-picker,[\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /student-lobby-route/);
  assert.match(styles, /student-lobby-params/);
  assert.match(styles, /student-lobby-status-strip/);
  assert.match(styles, /student-lobby-ready-card/);
  assert.match(styles, /teacher-lobby-stepper/);
  assert.match(styles, /teacher-lobby-preflight/);
  assert.match(styles, /teacher-lobby-preflight-head/);
  assert.match(styles, /teacher-lobby-start-gate/);
  assert.match(styles, /teacher-lobby-start-gate\.ok/);
  assert.match(styles, /teacher-lobby-start-gate\.warn/);
  assert.match(styles, /teacher-lobby-launch-strip/);
  assert.match(styles, /primary-teacher-action/);
  assert.match(styles, /teacher-cockpit-priority-list/);
  assert.match(styles, /crisis-card-panel/);
  assert.match(styles, /crisis-card-grid/);
  assert.match(styles, /crisis-card-icon/);
  assert.match(styles, /teacher-crisis-drawer/);
  assert.match(styles, /teacher-panel-icon/);
  assert.match(styles, /teacher-control-head/);
  assert.match(styles, /teacher-control-state/);
  assert.match(styles, /teacher-button-icon/);
  assert.match(styles, /teacher-now-icon/);
  assert.match(styles, /teacher-cockpit-actions/);
  assert.doesNotMatch(styles, /teacher-cockpit-quick-actions/);
  assert.doesNotMatch(styles, /teacher-cockpit-focus-row/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.teacher-cockpit-card\s*{[\s\S]*overflow: visible/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.teacher-workspace-side\s*{[\s\S]*overflow: visible/);
  assert.doesNotMatch(styles, /teacher-action-board/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.teacher-launch-status[\s\S]*grid-template-columns: minmax\(0, 1fr\) 18px/);
  assert.match(styles, /teacher-now-copy/);
  assert.match(styles, /teacher-now-count/);
  assert.match(styles, /teacher-cockpit-blockers/);
  assert.match(styles, /teacher-cockpit-roster/);
  assert.match(styles, /student-focus-strip[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /teacher-tab-button/);
  assert.match(styles, /teacher-turn-route > div[\s\S]*repeat\(auto-fit, minmax\(108px, 1fr\)\)/);
  assert.match(styles, /teacher-turn-route article b[\s\S]*grid-row: 1 \/ span 2/);
  assert.match(styles, /teacher-game-kpis[\s\S]*repeat\(auto-fit, minmax\(120px, 1fr\)\)/);
  assert.match(styles, /teacher-game-bottom[\s\S]*repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.teacher-game-bottom[\s\S]*repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
  assert.match(styles, /teacher-progress-list article[\s\S]*grid-template-columns: 24px minmax\(0, 1fr\)/);
  assert.match(styles, /teacher-mini-leaderboard article[\s\S]*grid-template-columns: 24px minmax\(0, 1fr\) auto/);
  assert.match(styles, /teacher-market-stats[\s\S]*repeat\(auto-fit, minmax\(92px, 1fr\)\)/);
  assert.match(styles, /teacher-market-stats b[\s\S]*text-overflow: clip/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.crisis-card-title[\s\S]*grid-template-columns: 28px minmax\(0, 1fr\) auto/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.crisis-card\[data-crisis-card-key="factory_demand_surge"\]/);
  assert.match(styles, /body\[data-game-tab="teacher"\] \.crisis-card-title strong,[\s\S]*text-overflow: clip/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'public', 'translations.js'), 'utf8'), /Следуйте маршруту хода/);
  assert.match(desktopMain, /function normalizeDesktopMode/);
  assert.match(desktopMain, /function inferDesktopMode/);
  assert.match(desktopMain, /function loadClientConnectionScreen/);
  assert.match(desktopMain, /function loadClassroomClientConnectionScreen/);
  assert.match(desktopMain, /BizArena Client/);
  assert.match(desktopMain, /roomCode/);
  assert.match(desktopMain, /userName/);
  assert.match(desktopMain, /companyName/);
  assert.match(desktopMain, /autojoin/);
  assert.match(desktopMain, /BIZ_ARENA_SERVER_URL/);
  assert.match(desktopMain, /BIZ_ARENA_APP_MODE:\s*DESKTOP_MODE/);
  assert.match(packageJson, /"dev:server"/);
  assert.match(packageJson, /"dev:client"/);
  assert.match(packageJson, /"desktop:server"/);
  assert.match(packageJson, /"desktop:client"/);
  assert.match(packageJson, /"dist:server"/);
  assert.match(packageJson, /"dist:client"/);
  assert.match(packageJson, /"dist:classroom"/);
});

test('Electron release contract: native rebuild runs once before packaging and keeps Windows metadata', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const buildScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-desktop-mode.js'), 'utf8');

  assert.match(buildScript, /electronRebuildCli/);
  assert.match(buildScript, /--which-module[\s\S]*better-sqlite3/);
  assert.match(buildScript, /--force/);
  assert.match(buildScript, /--version[\s\S]*electronVersion/);
  assert.doesNotMatch(buildScript, /installAppDepsCli/);
  assert.match(buildScript, /--config\.npmRebuild=false/);
  assert.match(buildScript, /--config\.win\.signExecutable=false/);
  assert.doesNotMatch(buildScript, /signAndEditExecutable=false/);
  assert.match(packageJson.scripts.dist, /--config\.win\.signExecutable=false/);
  assert.match(packageJson.scripts['dist:win'], /--config\.win\.signExecutable=false/);
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /signAndEditExecutable=false/);
});

test('UI contract: server/admin and client/student modes stay separated', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const roleContract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ui-role-contract-v1.md'), 'utf8');

  assert.match(indexHtml, /id="server-home-screen"[\s\S]*id="server-admin-overview"/);
  assert.match(indexHtml, /id="join-room-screen"[\s\S]*id="join-form"/);
  assert.match(indexHtml, /id="toggle-ready"/);
  assert.match(indexHtml, /data-navigation-surface="game-sidebar"/);
  assert.doesNotMatch(indexHtml, /data-navigation-surface="legacy-tab-strip"/);
  assert.equal((indexHtml.match(/data-navigation-surface="game-sidebar"/g) || []).length, 1);
  assert.match(indexHtml, /data-role-navigation="teacher"[\s\S]*data-game-tab="teacher"[\s\S]*data-game-tab="overview"[\s\S]*data-game-tab="competitors"[\s\S]*data-game-tab="market"[\s\S]*data-game-tab="events"[\s\S]*data-game-tab="statistics"[\s\S]*data-open-screen="settings-screen"/);
  assert.match(indexHtml, /data-role-navigation="student"[\s\S]*data-game-tab="overview"[\s\S]*data-game-tab="purchase"[\s\S]*data-game-tab="operations"[\s\S]*data-game-tab="market"[\s\S]*data-game-tab="competitors"[\s\S]*data-game-tab="events"/);
  assert.doesNotMatch(indexHtml, /data-role-tab="shared"/);
  assert.doesNotMatch(styles, /\.game-tabs/);
  assert.doesNotMatch(styles, /\.advanced-tabs/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="teacher"\] \[data-role-navigation="teacher"\][\s\S]*display: grid/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="student"\] \[data-role-navigation="student"\][\s\S]*display: grid/);
  assert.match(roleContract, /Server\/Admin/);
  assert.match(roleContract, /Teacher In-Game/);
  assert.match(roleContract, /Student/);
  assert.match(roleContract, /GAME_TAB_ROLE_CONTRACT\.student/);
  assert.match(roleContract, /Teacher Lobby Preflight Contract/);
  assert.match(roleContract, /`session`[\s\S]*`student-link`[\s\S]*`students`[\s\S]*`readiness`[\s\S]*`settings`/);
  assert.match(roleContract, /data-preflight-action="start-match"/);
  assert.match(roleContract, /Server Start Gate Contract/);
  assert.match(roleContract, /Local classroom rooms require two ready class players/);
  assert.match(roleContract, /Cloud teacher rooms require one ready class player/);

  assert.match(appJs, /const GAME_TAB_ROLE_CONTRACT = Object\.freeze/);
  assert.match(appJs, /student: Object\.freeze\(\['overview', 'purchase', 'operations', 'market', 'competitors', 'events'\]\)/);
  assert.match(appJs, /teacher: Object\.freeze\(\['teacher', 'overview', 'competitors', 'market', 'events', 'statistics'\]\)/);
  const roleGameTabsForCurrentViewer = sourceFunctionBlock(appJs, 'roleGameTabsForCurrentViewer');
  assert.match(roleGameTabsForCurrentViewer, /state\.player\?\.isHost && !isClientMode\(\)/);
  assert.match(roleGameTabsForCurrentViewer, /GAME_TAB_ROLE_CONTRACT\.teacher/);
  assert.match(roleGameTabsForCurrentViewer, /GAME_TAB_ROLE_CONTRACT\.student/);

  const applyAppMode = sourceFunctionBlock(appJs, 'applyAppMode');
  assert.match(applyAppMode, /isClientMode\(\)[\s\S]*showScreen\('join-room-screen'/);
  assert.match(applyAppMode, /isServerMode\(\)[\s\S]*showScreen\('server-home-screen'/);
  assert.match(applyAppMode, /document\.documentElement\.dataset\.performanceMode = resolvedPerformanceMode\(\)/);

  const applyClientLaunchParams = sourceFunctionBlock(appJs, 'applyClientLaunchParams');
  assert.match(applyClientLaunchParams, /if \(!isClientMode\(\) \|\| state\.clientLaunchParamsApplied\) return/);
  assert.doesNotMatch(applyClientLaunchParams, /\/api\/server\/action|\/api\/teacher\/action|data-crisis-card-event/);

  const maybeAutoJoinFromClientLaunch = sourceFunctionBlock(appJs, 'maybeAutoJoinFromClientLaunch');
  assert.match(maybeAutoJoinFromClientLaunch, /if \(!isClientMode\(\)\) return/);
  assert.match(maybeAutoJoinFromClientLaunch, /if \(!launch\.autojoin \|\| !launch\.roomCode \|\| !launch\.companyName \|\| state\.playerId\) return/);
  assert.doesNotMatch(maybeAutoJoinFromClientLaunch, /\/api\/server\/action|\/api\/teacher\/action|data-crisis-card-event/);

  const renderRoomOverview = sourceFunctionBlock(appJs, 'renderRoomOverview');
  assert.match(renderRoomOverview, /const isHost = state\.player\.isHost && !isClientMode\(\)/);
  assert.match(renderRoomOverview, /state\.room\.status === 'lobby' && !isHost[\s\S]*renderStudentLobbyCard/);
  assert.match(renderRoomOverview, /state\.room\.status === 'lobby' && isHost[\s\S]*renderTeacherLobbyCommandCard/);
  assert.match(renderRoomOverview, /state\.room\.status !== 'lobby' \? `<section class="lobby-classroom-hero"/);
  assert.doesNotMatch(renderRoomOverview, /client-readonly-note|data-host-action="start-game"/);
  assert.match(appJs, /elements\.saveRoomButton\.disabled = !player\.isHost \|\| isClientMode\(\)/);

  const renderTeacherLobbyCommandCard = sourceFunctionBlock(appJs, 'renderTeacherLobbyCommandCard');
  const teacherStartGateInfo = sourceFunctionBlock(appJs, 'teacherStartGateInfo');
  const teacherNextAction = sourceFunctionBlock(appJs, 'teacherNextAction');
  const teacherPrimaryHostAction = sourceFunctionBlock(appJs, 'teacherPrimaryHostAction');
  const renderTeacherClassReadiness = sourceFunctionBlock(appJs, 'renderTeacherClassReadiness');
  assert.match(teacherStartGateInfo, /teacherControls\?\.startGate/);
  assert.match(teacherStartGateInfo, /reasonKey: 'students'/);
  assert.match(teacherStartGateInfo, /reasonKey: 'readiness'/);
  assert.match(renderTeacherLobbyCommandCard, /data-preflight-ready/);
  assert.match(renderTeacherLobbyCommandCard, /data-preflight-next/);
  assert.match(renderTeacherLobbyCommandCard, /data-preflight-step/);
  assert.match(renderTeacherLobbyCommandCard, /data-preflight-done/);
  assert.match(renderTeacherLobbyCommandCard, /const startGateInfo = teacherStartGateInfo\(room\)/);
  assert.match(renderTeacherLobbyCommandCard, /data-start-gate-reason/);
  assert.match(renderTeacherLobbyCommandCard, /data-start-gate-can-start/);
  assert.match(renderTeacherLobbyCommandCard, /startGateInfo\.canStart/);
  assert.match(renderTeacherLobbyCommandCard, /data-preflight-action="start-match"/);
  assert.match(teacherNextAction, /const startGateInfo = teacherStartGateInfo\(room\)/);
  assert.match(teacherPrimaryHostAction, /teacherStartGateInfo\(room\)\.canStart/);
  assert.match(renderTeacherClassReadiness, /const startGateInfo = teacherStartGateInfo\(room\)/);

  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const roomStartGate = sourceFunctionBlock(serverJs, 'roomStartGate');
  const canStartMatch = sourceFunctionBlock(serverJs, 'canStartMatch');
  const publicTeacherControls = sourceFunctionBlock(serverJs, 'publicTeacherControls');
  const teacherLifecycleContract = sourceFunctionBlock(serverJs, 'teacherLifecycleContract');
  assert.match(roomStartGate, /minimumClassPlayers = practiceMode \|\| teacherOnlyHost \? 1 : 2/);
  assert.match(canStartMatch, /roomStartGate\(room\)\.canStart/);
  assert.match(publicTeacherControls, /const startGate = roomStartGate\(room\)/);
  assert.match(publicTeacherControls, /const lifecycle = teacherLifecycleContract/);
  assert.match(publicTeacherControls, /startGame: lifecycle\.canStart/);
  assert.match(teacherLifecycleContract, /contract: 'teacher-lifecycle-v1'/);
  assert.match(teacherLifecycleContract, /canOpenDebrief: phase === 'finished'/);
  assert.match(teacherLifecycleContract, /phaseLock === 'open'/);

  const populateSelectors = sourceFunctionBlock(appJs, 'populateSelectors');
  assert.match(populateSelectors, /hasRenderSignatureChanged\('roomSelectors'/);
  const renderCareer = sourceFunctionBlock(appJs, 'renderCareer');
  assert.match(renderCareer, /hasRenderSignatureChanged\('careerOverview'/);
  const renderAchievements = sourceFunctionBlock(appJs, 'renderAchievements');
  assert.match(renderAchievements, /hasRenderSignatureChanged\('achievementList'/);
});

test('UI contract: role phases, navigation, history and help controls are explicit', () => {
  const appJs = readPublicAppSources();
  assert.match(appJs, /SCREEN_PHASE_CONTRACT[\s\S]*'entry'[\s\S]*'lobby'[\s\S]*'active'[\s\S]*'finished'/);
  assert.match(appJs, /ROLE_NAVIGATION_CONTRACT[\s\S]*teacher[\s\S]*student/);
  assert.match(appJs, /История занятий/);
  assert.match(appJs, /data-session-export="json"/);
  assert.match(appJs, /data-session-export="csv"/);
  assert.match(appJs, /request-teacher-help/);
  assert.match(appJs, /acknowledge-help-request/);
  assert.match(appJs, /resolve-help-request/);
});

test('UI quality contract: Full, Standard and Lite share one role-based product structure', () => {
  const publicRoot = path.join(__dirname, '..', 'public');
  const roleContractsSource = fs.readFileSync(path.join(publicRoot, 'ui', 'role-contracts.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(publicRoot, 'app.js'), 'utf8');
  const styles = readPublicStyles();
  const sandbox = { window: {} };

  vm.runInNewContext(roleContractsSource, sandbox);
  const profiles = sandbox.window.BizArenaUiContracts.visualQuality;
  const navigation = sandbox.window.BizArenaUiContracts.navigation;

  assert.deepEqual(Object.keys(profiles), ['full', 'standard', 'lite']);
  assert.equal(profiles.full.teacherExperience, 'operations-center');
  assert.equal(profiles.full.studentExperience, 'isometric-tycoon-2.5d');
  Object.values(profiles).forEach(profile => {
    assert.equal(profile.preserveInformation, true);
    assert.equal(profile.preserveControlPlacement, true);
  });
  assert.deepEqual(Array.from(navigation.teacher), ['cabinet', 'room', 'teams', 'market', 'events', 'results', 'settings']);
  assert.deepEqual(Array.from(navigation.student), ['overview', 'purchase', 'production', 'market', 'team', 'report']);

  assert.match(indexHtml, /<option value="standard">Standard · 8 ГБ<\/option>/);
  assert.match(appJs, /const PERFORMANCE_MODES = \['auto', 'full', 'standard', 'lite'\]/);
  assert.match(appJs, /function resolvedPerformanceMode/);
  assert.match(appJs, /dataset\.performanceMode = resolvedPerformanceMode\(\)/);
  assert.match(styles, /--surface-canvas:/);
  assert.match(styles, /--motion-fast:/);
  assert.match(styles, /html\[data-performance-mode="standard"\]/);
});

test('UI performance contract: profiles scale runtime cost without removing classroom controls', () => {
  const publicRoot = path.join(__dirname, '..', 'public');
  const roleContractsSource = fs.readFileSync(path.join(publicRoot, 'ui', 'role-contracts.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const sandbox = { window: {} };

  vm.runInNewContext(roleContractsSource, sandbox);
  const profiles = sandbox.window.BizArenaUiContracts.visualQuality;
  assert.equal(profiles.full.fallbackPollingMs, 5000);
  assert.equal(profiles.standard.fallbackPollingMs, 8000);
  assert.equal(profiles.lite.fallbackPollingMs, 12000);
  assert.equal(profiles.full.realtimeDebounceMs, 180);
  assert.equal(profiles.standard.realtimeDebounceMs, 280);
  assert.equal(profiles.lite.realtimeDebounceMs, 450);

  const detectAutomaticPerformanceMode = sourceFunctionBlock(appJs, 'detectAutomaticPerformanceMode');
  const requestedPerformanceMode = sourceFunctionBlock(appJs, 'requestedPerformanceMode');
  const currentRefreshIntervalMs = sourceFunctionBlock(appJs, 'currentRefreshIntervalMs');
  const scheduleRealtimeRefresh = sourceFunctionBlock(appJs, 'scheduleRealtimeRefresh');
  const animationsDisabled = sourceFunctionBlock(appJs, 'animationsDisabled');
  assert.match(detectAutomaticPerformanceMode, /navigator\.deviceMemory/);
  assert.match(detectAutomaticPerformanceMode, /navigator\.hardwareConcurrency/);
  assert.match(requestedPerformanceMode, /params\.get\('quality'\)/);
  assert.match(requestedPerformanceMode, /params\.get\('lite'\) === '1'/);
  assert.match(currentRefreshIntervalMs, /performanceRuntimeProfile\(\)/);
  assert.match(scheduleRealtimeRefresh, /performanceRuntimeProfile\(\)\.realtimeDebounceMs/);
  assert.match(animationsDisabled, /if \(isLiteClientMode\(\)\) return true/);

  assert.match(indexHtml, /id="performance-mode-summary"[^>]*aria-live="polite"/);
  assert.match(indexHtml, /Full · 16 ГБ/);
  assert.match(indexHtml, /Standard · 8 ГБ/);
  assert.match(indexHtml, /Lite · 6 ГБ/);
  assert.match(styles, /html\[data-performance-mode="standard"\] \.student-factory-scene-floor/);
  assert.match(styles, /html\[data-performance-mode="standard"\] \.exchange-mini-chart polyline/);
  assert.match(styles, /html\[data-performance-mode="lite"\] body \*/);
});

test('UI contract: teacher pre-game is create-or-exit and lobby is an operations center', () => {
  const publicRoot = path.join(__dirname, '..', 'public');
  const indexHtml = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(publicRoot, 'app.js'), 'utf8');
  const styles = readPublicStyles();
  const teacherEntry = indexHtml.match(/<section id="server-home-screen"[\s\S]*?<\/section>\s*<section id="main-menu-screen"/i)?.[0] || '';
  const lobbyMaxPlayers = indexHtml.match(/<select id="max-players-select">[\s\S]*?<\/select>/i)?.[0] || '';

  assert.match(teacherEntry, /data-teacher-entry-contract="create-or-exit"/);
  assert.equal((teacherEntry.match(/data-teacher-entry-action=/g) || []).length, 2);
  assert.match(teacherEntry, /data-teacher-entry-action="create"[^>]*data-open-screen="create-room-screen"/);
  assert.match(teacherEntry, /data-teacher-entry-action="exit"[^>]*data-server-exit/);
  assert.match(indexHtml, /id="room-name"[^>]*value="Аудитория"/);
  assert.match(indexHtml, /id="create-company-name"[^>]*value="Команда преподавателя"/);
  assert.match(lobbyMaxPlayers, /<option value="30">30<\/option>/);
  assert.match(appJs, /data-lobby-secondary-details/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="teacher"\] \.lobby-brief-panel\s*{[\s\S]*?grid-column: 1 \/ -1/);
  assert.match(styles, /\.teacher-lobby-secondary\s*{[\s\S]*?border:/);
  assert.match(styles, /\.lobby-roster-panel \.leader,[\s\S]*?\.lobby-leaderboard-panel \.leader\s*{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.lobby-events-panel \.report-event-row\s*{[\s\S]*?grid-template-columns: 28px minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.lobby-leaderboard-panel \.leader > div:last-child\s*{[\s\S]*?display: grid/);
});

test('UI contract: restored teacher room can resume from the server home', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const appJs = readPublicAppSources();
  const teacherEntry = indexHtml.match(/<section id="server-home-screen"[\s\S]*?<\/section>\s*<section id="main-menu-screen"/i)?.[0] || '';
  const renderServerHome = sourceFunctionBlock(appJs, 'renderServerHome');

  assert.match(teacherEntry, /id="teacher-resume-room"[^>]*hidden[^>]*data-open-screen="lobby-screen"/);
  assert.match(appJs, /teacherResumeRoom:\s*document\.querySelector\('#teacher-resume-room'\)/);
  assert.match(renderServerHome, /gameIsFinished\(\)\s*\?\s*'results-screen'/);
  assert.match(renderServerHome, /teacherResumeRoom\.hidden = !canResumeRoom/);
  assert.equal((teacherEntry.match(/data-teacher-entry-action=/g) || []).length, 2);
});

test('frontend architecture: role modules load before bootstrap and own their rendering', () => {
  const publicRoot = path.join(__dirname, '..', 'public');
  const indexHtml = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  const appCore = fs.readFileSync(path.join(publicRoot, 'app.js'), 'utf8');
  const roleContracts = fs.readFileSync(path.join(publicRoot, 'ui', 'role-contracts.js'), 'utf8');
  const serverAdminUi = fs.readFileSync(path.join(publicRoot, 'ui', 'server-admin-ui.js'), 'utf8');
  const studentUi = fs.readFileSync(path.join(publicRoot, 'ui', 'student-ui.js'), 'utf8');
  const teacherUi = fs.readFileSync(path.join(publicRoot, 'ui', 'teacher-ui.js'), 'utf8');
  const appBootstrap = fs.readFileSync(path.join(publicRoot, 'app-bootstrap.js'), 'utf8');
  const scriptOrder = [
    '/ui/role-contracts.js',
    '/app-runtime.js',
    '/app.js',
    '/ui/server-admin-ui.js',
    '/ui/student-ui.js',
    '/ui/teacher-ui.js',
    '/app-bootstrap.js',
  ].map(source => indexHtml.indexOf(`src="${source}"`));

  assert.equal(scriptOrder.every(index => index >= 0), true);
  assert.deepEqual([...scriptOrder].sort((left, right) => left - right), scriptOrder);
  assert.match(roleContracts, /BizArenaUiContracts/);
  assert.match(serverAdminUi, /server-admin-ui-v1/);
  assert.match(serverAdminUi, /function renderServerAdminOverview/);
  assert.match(studentUi, /student-ui-v1/);
  assert.match(studentUi, /function renderStudentRoutePanel/);
  assert.match(studentUi, /function renderStudentLobbyCard/);
  assert.match(teacherUi, /teacher-ui-v1/);
  assert.match(teacherUi, /function renderTeacherLobbyCommandCard/);
  assert.match(teacherUi, /function renderTeacherPanel/);
  assert.match(appBootstrap, /bootstrap\(\)/);
  assert.doesNotMatch(appCore, /function (renderServerAdminOverview|renderStudentRoutePanel|renderStudentLobbyCard|renderTeacherLobbyCommandCard|renderTeacherPanel)/);
  assert.ok(appCore.split(/\r?\n/).length < 6500, 'shared app core should stay below the pre-split monolith size');

  const declarations = new Map();
  for (const [file, source] of [
    ['app.js', appCore],
    ['server-admin-ui.js', serverAdminUi],
    ['student-ui.js', studentUi],
    ['teacher-ui.js', teacherUi],
  ]) {
    for (const match of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
      const owners = declarations.get(match[1]) || [];
      owners.push(file);
      declarations.set(match[1], owners);
    }
  }
  const duplicates = [...declarations].filter(([, owners]) => owners.length > 1);
  assert.deepEqual(duplicates, []);
});

test('classroom capacity supports 30 student teams', () => {
  const { room } = bizArena.createRoom({
    roomName: 'Full Classroom',
    companyName: 'Teacher Console',
    userName: 'Teacher',
    scenarioKey: 'motorcycles',
    maxPlayers: 30,
    teacherAccountId: 'teacher_capacity',
  });

  for (let index = 1; index <= 30; index += 1) {
    bizArena.joinRoom({
      roomCode: room.code,
      companyName: `Team ${index}`,
      userName: `Student ${index}`,
    });
  }

  assert.equal(room.settings.maxPlayers, 30);
  assert.equal([...room.players.values()].filter(player => !player.isTeacherHost).length, 30);
  assert.throws(() => bizArena.joinRoom({
    roomCode: room.code,
    companyName: 'Overflow Team',
    userName: 'Overflow Student',
  }), /Комната заполнена/);
});

test('UI contract: market replay is visible and exportable', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();

  const buildMarketReplaySummary = sourceFunctionBlock(appJs, 'buildMarketReplaySummary');
  assert.match(buildMarketReplaySummary, /marketHints/);
  assert.match(buildMarketReplaySummary, /turnReview/);
  assert.match(buildMarketReplaySummary, /marketBook/);

  assert.match(appJs, /renderMarketReplayPanel\(\)/);
  assert.match(appJs, /data-market-replay-export/);
  assert.match(appJs, /function renderMarketReplayMetric/);
  assert.match(appJs, /function marketHintIcon/);
  assert.match(appJs, /market-hint-icon/);
  assert.match(appJs, /market-hint-badge/);

  const exportMarketReplayReport = sourceFunctionBlock(appJs, 'exportMarketReplayReport');
  assert.match(exportMarketReplayReport, /type:\s*'market-replay'/);
  assert.match(exportMarketReplayReport, /buildMarketReplaySummary\(\)/);

  assert.match(appJs, /marketReplay/);
  assert.match(appJs, /replay:/);
  assert.match(appJs, /function buildClassroomReportPack/);
  assert.match(appJs, /function renderClassroomReportPack/);
  assert.match(appJs, /classroomReportPack/);
  assert.match(appJs, /data-teacher-debrief-contract="class-debrief-v1"/);
  assert.match(appJs, /student-results-v1/);
  assert.match(appJs, /state\.player\?\.isHost && !isClientMode\(\)/);
  assert.match(appJs, /teacherReportPack/);
  assert.match(appJs, /data-results-export-inline/);
  assert.match(appJs, /Пакет отчета преподавателя/);

  assert.match(styles, /\.market-replay-panel/);
  assert.match(styles, /\.results-market-replay-card/);
  assert.match(styles, /\.classroom-report-pack/);
  assert.match(styles, /\.classroom-report-evidence/);
  assert.match(styles, /\.classroom-report-body/);
  assert.match(styles, /\.classroom-report-actions/);
  assert.match(styles, /market-replay-metric/);
  assert.match(styles, /market-replay-metric-icon/);
  assert.match(styles, /market-hint-icon/);
  assert.match(styles, /market-hint-badge/);
  assert.match(styles, /body\[data-game-tab="market"\] #market-overview[\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /body\[data-game-tab="market"\] #market-overview[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /market-replay-metrics[\s\S]*repeat\(auto-fit, minmax\(126px, 1fr\)\)/);
});

test('UI contract: student turn review separates outcome, cause, and next checks', () => {
  const appJs = readPublicAppSources();
  const renderTurnReviewCard = sourceFunctionBlock(appJs, 'renderTurnReviewCard');

  assert.match(renderTurnReviewCard, /review\.outcomes/);
  assert.match(renderTurnReviewCard, /review\.reasons/);
  assert.match(renderTurnReviewCard, /review\.checks/);
  assert.match(renderTurnReviewCard, /Что произошло/);
  assert.match(renderTurnReviewCard, /Почему/);
  assert.match(renderTurnReviewCard, /Что проверить/);
});

test('QA contract: classroom E2E covers the supported desktop viewport range', () => {
  const e2eScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'e2e-classroom-flows.js'), 'utf8');

  assert.match(e2eScript, /width:\s*1000,\s*height:\s*760/);
  assert.match(e2eScript, /width:\s*1440,\s*height:\s*900/);
  assert.match(e2eScript, /width:\s*1920,\s*height:\s*1080/);
  assert.match(e2eScript, /width:\s*2560,\s*height:\s*1440/);
  assert.match(e2eScript, /width:\s*3440,\s*height:\s*1440/);
});

test('UI contract: factory last action messages are localized before rendering', () => {
  const appJs = readPublicAppSources();
  const localizedLastAction = sourceFunctionBlock(appJs, 'localizedLastAction');

  assert.match(localizedLastAction, /Held inventory and waited for the next turn/);
  assert.match(localizedLastAction, /Товар оставлен на складе до следующего хода/);
  assert.match(appJs, /localizedLastAction\(state\.player\.lastAction/);
});

test('UI contract: teacher results are a classroom debrief without host personal cards', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();

  const teacherResults = sourceFunctionBlock(appJs, 'renderTeacherResultsOverview');
  assert.match(teacherResults, /data-teacher-results-contract="classroom-results-v2"/);
  assert.match(teacherResults, /teacher-results-leaderboard/);
  assert.match(teacherResults, /renderTeacherResultsMarketReplayCard/);
  assert.match(teacherResults, /renderClassroomReportPack/);
  assert.doesNotMatch(teacherResults, /personal-path-card|score-breakdown-card|renderPlayerDebriefCard/);

  const classroomReport = sourceFunctionBlock(appJs, 'renderClassroomReportPack');
  assert.match(classroomReport, /classroom-report-focus/);

  const renderResults = sourceFunctionBlock(appJs, 'renderResultsOverview');
  assert.match(renderResults, /if \(teacherViewer\)/);
  assert.match(renderResults, /renderTeacherResultsOverview\(summary, classroomReportPack\)/);

  assert.match(styles, /\.teacher-results-grid/);
  assert.match(styles, /\.teacher-results-leaderboard/);
  assert.match(styles, /body\[data-screen="results-screen"\]\[data-player-role="teacher"\]/);
});

test('UI contract: market side rail is rendered from live game state', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.match(appJs, /gameMarketRail:\s*document\.querySelector\('\.game-market-rail'\)/);
  assert.match(appJs, /function renderGameMarketRail\(\)/);
  assert.match(appJs, /renderGameMarketRail\(\)/);

  const renderGameMarketRail = sourceFunctionBlock(appJs, 'renderGameMarketRail');
  assert.match(renderGameMarketRail, /room\.market/);
  assert.match(renderGameMarketRail, /room\.contractBoard/);
  assert.match(renderGameMarketRail, /data-rail-action/);
  assert.match(renderGameMarketRail, /data-rail-game-tab/);
  assert.match(renderGameMarketRail, /sendAction\(button\.dataset\.railAction\)/);
  assert.match(renderGameMarketRail, /setGameTab\(button\.dataset\.railGameTab\)/);

  assert.match(styles, /\.rail-live-market-card/);
  assert.match(styles, /\.market-rail-stats/);
  assert.match(styles, /\.rail-control-grid/);
  assert.match(indexHtml, /<aside class="game-market-rail" aria-label="Рынок и контракты"><\/aside>/);
  assert.doesNotMatch(indexHtml, /class="game-side-rail"/);
});

test('UI contract: teacher market and events use classroom state instead of player controls', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const renderMarketStart = appJs.indexOf('function renderMarket()');
  assert.notEqual(renderMarketStart, -1, 'Missing function renderMarket');
  const renderMarketEnd = appJs.indexOf('\nfunction ', renderMarketStart + 1);
  const renderMarket = appJs.slice(renderMarketStart, renderMarketEnd === -1 ? appJs.length : renderMarketEnd);
  const renderTeacherMarketOverview = sourceFunctionBlock(appJs, 'renderTeacherMarketOverview');
  const renderGameMarketRail = sourceFunctionBlock(appJs, 'renderGameMarketRail');
  const renderTeacherEventSummary = sourceFunctionBlock(appJs, 'renderTeacherEventSummary');
  const formatRoomLogEntry = sourceFunctionBlock(appJs, 'formatRoomLogEntry');
  const renderLog = sourceFunctionBlock(appJs, 'renderLog');

  assert.match(renderMarket, /state\.player\?\.isTeacherHost/);
  assert.match(renderMarket, /renderTeacherMarketOverview\(\)/);
  assert.match(renderTeacherMarketOverview, /room\.classDashboard/);
  assert.match(renderTeacherMarketOverview, /room\.market/);
  assert.match(renderTeacherMarketOverview, /room\.contractBoard/);
  assert.match(renderTeacherMarketOverview, /room\.segments/);
  assert.doesNotMatch(renderTeacherMarketOverview, /sendAction\('accept-contract'/);
  assert.match(renderGameMarketRail, /state\.player\?\.isTeacherHost[\s\S]*innerHTML = ''[\s\S]*return/);

  assert.match(renderTeacherEventSummary, /room\.classDashboard/);
  assert.match(renderTeacherEventSummary, /room\.helpRequests/);
  assert.match(renderTeacherEventSummary, /room\.activeEvent/);
  assert.match(formatRoomLogEntry, /joined the room with company/);
  assert.match(formatRoomLogEntry, /created room/);
  assert.match(formatRoomLogEntry, /Room created/);
  assert.match(formatRoomLogEntry, /Invite players/);
  assert.match(renderLog, /formatRoomLogEntry\(entry\)/);

  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="teacher"\] \.game-market-rail\s*\{[\s\S]*display: none/);
  assert.match(styles, /body\[data-player-role="teacher"\]\[data-game-tab="market"\] \.game-panel\[data-game-panel="market"\][\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /body\[data-player-role="teacher"\]\[data-game-tab="events"\] \.game-panel\[data-game-panel="events"\][\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /\.teacher-market-team-table/);
  assert.match(styles, /\.teacher-event-brief/);
});

test('UI contract: teacher guidance and mobile controls follow the teacher role', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const renderGameNextAction = sourceFunctionBlock(appJs, 'renderGameNextAction');
  const activateGameNextAction = sourceFunctionBlock(appJs, 'activateGameNextAction');

  assert.match(renderGameNextAction, /const isTeacherView = Boolean\(state\.player\?\.isHost && !isClientMode\(\)\)/);
  assert.match(renderGameNextAction, /teacherNextAction\(state\.room, readiness, helpQueue\)/);
  assert.match(renderGameNextAction, /tab: 'teacher'/);
  assert.match(activateGameNextAction, /elements\.gameNextActionChip\?\.dataset/);
  assert.match(appJs, /teacherHost: overrides\.teacherHost \?\? isServerMode\(\)/);
  assert.match(appJs, /elements\.createForm\.addEventListener\('submit',[\s\S]*createRoom\(\{ teacherHost: true \}\)/);
  assert.match(appJs, /<details class="teacher-crisis-drawer" open>/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="teacher"\] \.game-market-rail\s*\{[\s\S]*display: none/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.teacher-workspace-side\s*{[\s\S]*order: 0/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.teacher-cockpit-card\s*{[\s\S]*order: 1/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.teacher-workspace-main\s*{[\s\S]*order: 2/);
});

test('UI contract: student lobby separates readiness from the complete first-turn route', () => {
  const appJs = readPublicAppSources();
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const styles = readPublicStyles();
  const renderStudentLobbyCard = sourceFunctionBlock(appJs, 'renderStudentLobbyCard');
  const joinRoom = sourceFunctionBlock(appJs, 'joinRoom');

  assert.match(renderStudentLobbyCard, /После старта: Купить → Нанять → Собрать → Продать → Завершить ход/);
  assert.doesNotMatch(renderStudentLobbyCard, /data-open-game \$\{room\.status === 'running' \? '' : 'disabled'\}/);
  assert.doesNotMatch(renderStudentLobbyCard, /class="student-lobby-meta"/);
  assert.doesNotMatch(renderStudentLobbyCard, /\.slice\(0, 5\)/);
  assert.match(renderStudentLobbyCard, /data-lobby-ready-state=/);
  assert.match(joinRoom, /const joinUserName = elements\.joinUserName\?\.value\.trim\(\) \|\| ''/);
  assert.match(appJs, /async function submitLobbyReadiness/);
  assert.match(appJs, /state\.room\.status === 'lobby' && !isHost\s*\? ''/);
  assert.match(indexHtml, /id="join-form"[^>]*novalidate/);
  assert.match(indexHtml, /id="join-form-status"[^>]*aria-live="polite"/);
  assert.match(styles, /body\[data-screen="lobby-screen"\]\[data-player-role="student"\] \.lobby-roster-panel/);
});

test('UI contract: full student operations use a live 2.5D factory stage without changing controls across profiles', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const renderStudentFactoryScene = sourceFunctionBlock(appJs, 'renderStudentFactoryScene');
  const renderStudentCommandPanel = sourceFunctionBlock(appJs, 'renderStudentCommandPanel');

  assert.match(renderStudentFactoryScene, /data-student-factory-scene="live"/);
  assert.match(renderStudentFactoryScene, /data-student-route-tab="purchase"/);
  assert.match(renderStudentFactoryScene, /data-student-route-department="workforce"/);
  assert.match(renderStudentFactoryScene, /data-student-route-department="assembly"/);
  assert.match(renderStudentFactoryScene, /data-student-route-tab="market"/);
  assert.match(renderStudentFactoryScene, /componentStock/);
  assert.match(renderStudentFactoryScene, /workers\.length/);
  assert.match(renderStudentFactoryScene, /factory\.finishedGoods/);
  assert.match(renderStudentFactoryScene, /factory\.saleOffer\?\.quantity/);
  assert.match(renderStudentCommandPanel, /renderStudentFactoryScene\(routeItems\)/);
  assert.match(styles, /factory-blueprint\.png/);
  assert.match(styles, /html\[data-performance-mode="full"\] \.student-factory-scene/);
  assert.match(styles, /html\[data-performance-mode="standard"\] \.student-factory-scene/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \.student-factory-node/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \.student-factory-scene[\s\S]*min-height: 0/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \.student-factory-scene-grid[\s\S]*min-height: 0/);
  assert.match(styles, /html\[data-performance-mode="lite"\] \.student-command-stage[\s\S]*align-items: start/);
  assert.match(styles, /body\[data-screen="game-screen"\]\[data-player-role="student"\]\[data-game-tab="operations"\] \.game-market-rail/);
});

test('UI contract: mobile game navigation exposes the active role links as one compact horizontal rail', () => {
  const styles = readPublicStyles();
  const appJs = readPublicAppSources();

  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\]\[data-player-role="student"\] \[data-role-navigation="student"\][\s\S]*display: contents/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-nav[\s\S]*overflow-x: auto/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-link[\s\S]*flex: 0 0 auto/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*body\[data-screen="game-screen"\] \.app-sidebar-link[\s\S]*width: max-content/);
  assert.match(appJs, /function revealActiveGameTab\(button\)/);
});

test('UI contract: students do not see an empty strategic decision card', () => {
  const appJs = readPublicAppSources();
  const renderDecisionRoundCard = sourceFunctionBlock(appJs, 'renderDecisionRoundCard');

  assert.match(renderDecisionRoundCard, /if \(!round && !latest && !canForceRound\) return '';/);
});

test('UI contract: strategic decisions use a localized responsive decision surface', () => {
  const appJs = readPublicAppSources();
  const styles = readPublicStyles();
  const translations = fs.readFileSync(path.join(__dirname, '..', 'public', 'translations.js'), 'utf8');
  const renderDecisionRoundCard = sourceFunctionBlock(appJs, 'renderDecisionRoundCard');

  assert.match(renderDecisionRoundCard, /data-decision-round-contract="decision-round-v2"/);
  assert.match(renderDecisionRoundCard, /class="decision-option-effect"/);
  assert.match(renderDecisionRoundCard, /data-decision-option-index=/);
  assert.match(styles, /\.decision-option-grid[\s\S]*grid-template-columns/);
  assert.match(styles, /\.decision-option-item[\s\S]*min-width: 0/);
  assert.match(styles, /@media \(max-width: 920px\)[\s\S]*\.decision-option-grid/);
  assert.match(translations, /"decision_round_card_title": "Стратегическая дилемма"/);
  assert.match(translations, /"decision_round_choose": "Выбрать решение"/);
  assert.match(translations, /"decision_round_workforce_title": "Политика персонала"/);
});

test('UI contract: entry screens show only real navigation and room actions', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.doesNotMatch(indexHtml, /Предпросмотр активного матча/);
  assert.doesNotMatch(indexHtml, /Команда Альфа \(вы\)/);
  assert.doesNotMatch(indexHtml, /Мои комнаты|История матчей/);
  assert.match(indexHtml, /id="play-menu-screen"/);
  assert.match(indexHtml, /data-open-screen="create-room-screen"/);
  assert.match(indexHtml, /data-open-screen="join-room-screen"/);
  assert.match(indexHtml, /id="student-demo-start-button"/);
  assert.match(indexHtml, /class="role-entry-shell"/);
  assert.match(indexHtml, /data-entry-role="teacher"[\s\S]*data-open-screen="server-home-screen"/);
  assert.match(indexHtml, /data-entry-role="student"[\s\S]*data-open-screen="join-room-screen"/);
  assert.match(indexHtml, /class="hero hero-single legacy-main-menu" hidden/);
});

test('classroom package includes LAN diagnostics helpers and readable README text', () => {
  const packageScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-classroom-package.js'), 'utf8');
  const firewallHelper = fs.readFileSync(path.join(__dirname, '..', 'tools', 'Allow-BizArena-Firewall.ps1'), 'utf8');
  const lanCheckHelper = fs.readFileSync(path.join(__dirname, '..', 'tools', 'Check-BizArena-LAN.ps1'), 'utf8');

  assert.match(packageScript, /Allow-BizArena-Firewall\.ps1/);
  assert.match(packageScript, /Check-BizArena-LAN\.ps1/);
  assert.match(packageScript, /README-classroom\.md/);
  assert.match(packageScript, /Windows Firewall/);
  assert.match(packageScript, /\/api\/health/);
  assert.match(packageScript, /LAN-first/);
  assert.match(packageScript, /Что запускать/);
  assert.match(packageScript, /отдельному роутеру/);
  assert.match(packageScript, /Имя ученика/);
  assert.doesNotMatch(packageScript, /Cloudflare/);
  assert.match(firewallHelper, /RemoteAddress LocalSubnet/);
  assert.match(firewallHelper, /Private', 'Public/);
  assert.match(firewallHelper, /BizArena-Classroom-Program/);
  assert.doesNotMatch(firewallHelper, /-Profile Any/);
  assert.equal(packageScript.includes(String.fromCharCode(0x0420, 0x0455, 0x0421)), false);
  assert.equal(packageScript.includes(String.fromCharCode(0x0420, 0x045f)), false);
  assert.match(firewallHelper, /New-NetFirewallRule/);
  assert.match(firewallHelper, /3000/);
  assert.match(firewallHelper, /3099/);
  assert.doesNotMatch(firewallHelper, /Cloudflare/);
  assert.match(lanCheckHelper, /Invoke-WebRequest/);
  assert.match(lanCheckHelper, /\/api\/health/);
  assert.match(lanCheckHelper, /\/client/);
  assert.match(lanCheckHelper, /\/api\/meta/);
  assert.doesNotMatch(lanCheckHelper, /Cloudflare/);
});

test('release hardening keeps public handoff away from legacy tunnel path', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  const teacherDefenseBrief = fs.readFileSync(path.join(__dirname, '..', 'docs', 'teacher-defense-brief.md'), 'utf8');
  const securityThreatModel = fs.readFileSync(path.join(__dirname, '..', 'docs', 'security-threat-model.md'), 'utf8');
  const defenseBundleScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-defense-bundle.js'), 'utf8');
  const cloudPackageScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-cloud-package.js'), 'utf8');
  const desktopMain = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const desktopPreload = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'preload.js'), 'utf8');
  const publicApp = readPublicAppSources();

  assert.equal(Object.hasOwn(packageJson.scripts, 'internet:tunnel'), false);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'start-internet-room.js')), false);
  assert.doesNotMatch(readme, /Рџ|РЎ|Рќ|Рґ|Р Р|вЂ|в‚|Ð|Ñ/u);
  assert.doesNotMatch(teacherDefenseBrief, /Рџ|РЎ|Рќ|Рґ|Р Р|вЂ|в‚|Ð|Ñ|Cloudflare/u);
  assert.doesNotMatch(securityThreatModel, /Cloudflare|quick tunnel|cloudflared/u);
  assert.doesNotMatch(defenseBundleScript, /Start-Internet-Room|internet-room-cloudflare/u);
  assert.doesNotMatch(desktopMain, /cloudflared|internet-room:/u);
  assert.doesNotMatch(desktopPreload, /internet-room:|InternetRoom/u);
  assert.doesNotMatch(publicApp, /internetRoom|internet-room/u);
  assert.match(cloudPackageScript, /BIZ_ARENA_ALLOW_REGISTRATION=false/);
});

test('vps release profile is primary while oracle remains archive-only', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const oraclePackageScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-oracle-package.js'), 'utf8');
  const oracleSmokeScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke-oracle-profile.js'), 'utf8');
  const durableSmokeScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke-durable-cloud-profile.js'), 'utf8');
  const vpsSmokeScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke-vps-profile.js'), 'utf8');
  const vpsPackageScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-vps-package.js'), 'utf8');
  const runbook = fs.readFileSync(path.join(__dirname, '..', 'docs', 'cloud-hosting-runbook.md'), 'utf8');
  const handoff = fs.readFileSync(path.join(__dirname, '..', 'docs', 'oracle-cloud-classroom-handoff.md'), 'utf8');

  assert.equal(Object.hasOwn(packageJson.scripts, 'smoke:oracle'), false);
  assert.equal(Object.hasOwn(packageJson.scripts, 'release:oracle-package'), false);
  assert.equal(packageJson.scripts['smoke:vps'], 'node scripts/smoke-vps-profile.js');
  assert.equal(packageJson.scripts['release:vps-package'], 'node scripts/build-vps-package.js');
  assert.equal(packageJson.scripts['release:kai-server-package'], 'npm run release:vps-package && node scripts/build-kai-server-package.js');
  assert.match(packageJson.scripts.check, /smoke-vps-profile\.js/);
  assert.match(packageJson.scripts.check, /smoke-durable-cloud-profile\.js/);
  assert.match(packageJson.scripts.check, /build-oracle-package\.js/);
  assert.match(vpsSmokeScript, /BIZ_ARENA_SMOKE_PROFILE/);
  assert.match(vpsSmokeScript, /smoke-durable-cloud-profile/);
  assert.match(vpsPackageScript, /scripts\/smoke-vps-profile\.js/);
  assert.match(vpsPackageScript, /scripts\/smoke-durable-cloud-profile\.js/);
  assert.doesNotMatch(vpsPackageScript, /scripts\/smoke-oracle-profile\.js/);
  assert.match(oracleSmokeScript, /Oracle archive/);
  assert.match(oracleSmokeScript, /smoke-durable-cloud-profile/);
  assert.match(durableSmokeScript, /BIZ_ARENA_STORAGE:\s*'sqlite'/);
  assert.match(durableSmokeScript, /BIZ_ARENA_ALLOW_REGISTRATION:\s*allowRegistration/);
  assert.match(durableSmokeScript, /Registration lock did not reject new teacher/);
  assert.match(durableSmokeScript, /Persisted room was not restored/);
  assert.match(oraclePackageScript, /BizArena-Oracle/);
  assert.match(oraclePackageScript, /deploy\/oracle\/bizarena\.service/);
  assert.match(oraclePackageScript, /deploy\/oracle\/nginx-bizarena\.conf/);
  assert.match(oraclePackageScript, /BIZ_ARENA_SQLITE_PATH=\/var\/lib\/bizarena\/biz-arena\.sqlite/);
  assert.match(runbook, /Oracle VM Optional Archive/);
  assert.match(runbook, /release:kai-server-package/);
  assert.doesNotMatch(runbook, /npm run smoke:oracle/);
  assert.doesNotMatch(runbook, /npm run release:oracle-package/);
  assert.match(runbook, /Render Demo/);
  assert.match(runbook, /P2P\/WebRTC is unsupported for v0\.7/);
  assert.match(handoff, /BIZ_ARENA_ALLOW_REGISTRATION=false/);
  assert.match(handoff, /\/api\/health/);
  assert.match(handoff, /\/api\/meta/);
});

test('UI navigation: backing out of an active room suppresses automatic room reopen', () => {
  const appJs = readPublicAppSources();

  assert.match(appJs, /roomAutoOpenDismissed:\s*false/);
  assert.match(appJs, /state\.roomAutoOpenDismissed\s*=\s*true/);
  assert.match(appJs, /!state\.roomAutoOpenDismissed/);
  assert.match(appJs, /const viewer = state\.player\s*\|\|[\s\S]*leaderboard\.find/);
});

test('factory scenario: market surge event raises demand and appears in room summary', () => {
  const { room, host } = createStartedFactoryRoom();
  room.day = 2;
  room.tick = 2;

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    bizArena.advanceRoom(room);
  } finally {
    Math.random = originalRandom;
  }

  const latest = room.marketHistory[0];
  const summary = bizArena.roomSummary(room, host.id);

  assert.equal(room.activeEvent.key, 'factory_demand_surge');
  assert.equal(summary.activeEvent.key, 'factory_demand_surge');
  assert.equal(latest.baseDemand, 10);
  assert.equal(latest.demandMultiplier, 1.35);
  assert.ok(latest.demand > latest.baseDemand);
});

test('factory scenario: room summary exposes factory stats with empty and resolved states', () => {
  const { room, host } = createStartedFactoryRoom();
  const emptySummary = bizArena.roomSummary(room, host.id);
  assert.equal(emptySummary.factoryStats.hasData, false);
  assert.equal(emptySummary.factoryStats.topSeller, null);

  host.factory.finishedGoods = 3;
  host.productStock = 3;
  host.factory.saleOffer = { price: 5600, quantity: 2 };

  room.day = 1;
  room.tick = 1;
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    bizArena.advanceRoom(room);
  } finally {
    Math.random = originalRandom;
  }

  const summary = bizArena.roomSummary(room, host.id);

  assert.equal(summary.factoryStats.hasData, true);
  assert.equal(summary.factoryStats.latest.totalSales, 2);
  assert.equal(summary.factoryStats.topSeller.playerId, host.id);
  assert.equal(summary.factoryStats.topSeller.sold, 2);
  assert.ok(summary.factoryStats.sellThroughPct > 0);
  assert.ok(summary.factoryStats.playerProfit > 0);
  assert.equal(summary.factoryStats.recentHistory.length, 1);
});

test('game feel: factory checklist changes after staffing, assembly, and sale offer', () => {
  const { room, host } = createStartedFactoryRoom();

  let summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.turnChecklist.find(item => item.key === 'workforce').status, 'attention');
  assert.equal(summary.turnChecklist.find(item => item.key === 'sale').status, 'blocked');

  const candidate = bizArena.roomSummary(room, host.id).factoryScenario.candidates[0];
  bizArena.handleBusinessAction(room, host, { action: 'hire-worker', value: candidate.id });
  summary.factory.components.forEach(component => {
    bizArena.handleBusinessAction(room, host, {
      action: 'buy-component',
      value: { componentKey: component.key, quantity: Math.max(component.recipe, 1) },
    });
  });
  bizArena.handleBusinessAction(room, host, { action: 'assemble-product', value: 1 });

  summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.turnChecklist.find(item => item.key === 'workforce').status, 'ready');
  assert.equal(summary.turnChecklist.find(item => item.key === 'assembly').status, 'ready');
  assert.equal(summary.turnChecklist.find(item => item.key === 'sale').status, 'attention');

  bizArena.handleBusinessAction(room, host, {
    action: 'set-sale-offer',
    value: { price: summary.price, quantity: 1 },
  });

  summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.turnChecklist.find(item => item.key === 'sale').status, 'ready');
});

test('game feel: unit economics explains break-even price, margin, and supplier shortage', () => {
  const { room, host } = createStartedFactoryRoom();
  const summary = bizArena.playerSummary(room, host, host.id);

  assert.ok(summary.unitEconomics);
  assert.ok(summary.unitEconomics.materialUnitCost > 0);
  assert.ok(summary.unitEconomics.overheadPerUnit > 0);
  assert.equal(summary.unitEconomics.breakEvenPrice, summary.unitEconomics.materialUnitCost + summary.unitEconomics.overheadPerUnit);
  assert.equal(summary.unitEconomics.salePrice, summary.factory.saleOffer.price);
  assert.ok(summary.unitEconomics.recommendedFloorPrice > summary.unitEconomics.breakEvenPrice);
  assert.ok(['loss', 'thin', 'ok', 'strong'].includes(summary.unitEconomics.status));
  assert.equal(summary.unitEconomics.componentBreakdown.length, summary.factory.components.length);

  const shortageComponent = summary.factory.components[0].key;
  room.factoryScenario.supplierOffers = (room.factoryScenario.supplierOffers || [])
    .filter(offer => offer.componentKey !== shortageComponent);
  const shortageSummary = bizArena.playerSummary(room, host, host.id);

  assert.equal(shortageSummary.unitEconomics.hasSupplierShortage, true);
  assert.ok(shortageSummary.unitEconomics.supplyCoverage < 100);
  assert.ok(shortageSummary.unitEconomics.componentBreakdown.some(item => item.key === shortageComponent && !item.enoughSupply));
});

test('game feel: turn review appears after next turn and market hints warn about weak offers', () => {
  const { room, host } = createStartedFactoryRoom();
  const initialSummary = bizArena.playerSummary(room, host, host.id);

  host.factory.finishedGoods = 2;
  host.productStock = 2;

  let summary = bizArena.playerSummary(room, host, host.id);
  assert.ok(summary.marketHints.some(hint => hint.tone === 'danger' && /0/.test(hint.metric)));

  const requestedHighPrice = initialSummary.factory.saleOffer.price * 2;
  bizArena.handleBusinessAction(room, host, {
    action: 'set-sale-offer',
    value: { price: requestedHighPrice, quantity: 1 },
  });
  summary = bizArena.playerSummary(room, host, host.id);
  assert.ok(summary.marketHints.some(hint => hint.tone === 'warn'));
  assert.ok(summary.marketHints.some(hint => hint.kind === 'decision'));
  const decisionHint = summary.marketHints.find(hint => hint.kind === 'decision');
  assert.equal(decisionHint.saleRisk, 'high');
  assert.equal(decisionHint.currentPrice, summary.factory.saleOffer.price);
  assert.ok(decisionHint.currentPrice <= requestedHighPrice);
  assert.ok(decisionHint.bestPrice > 0);
  assert.ok(decisionHint.expectedUnits >= 0);

  room.day = 1;
  room.tick = 0;
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    bizArena.handleRoomAction(room, host, { action: 'next-turn' });
  } finally {
    Math.random = originalRandom;
  }

  summary = bizArena.playerSummary(room, host, host.id);
  assert.equal(summary.turnReview.state, 'resolved');
  assert.ok(summary.turnReview.highlights.length > 0);
});

test('game feel: player debrief explains personal result and next focus', () => {
  const { room, host } = createStartedFactoryRoom();
  const candidate = bizArena.roomSummary(room, host.id).factoryScenario.candidates[0];

  bizArena.handleBusinessAction(room, host, { action: 'hire-worker', value: candidate.id });
  Object.keys(host.factory.inventory).forEach(key => {
    host.factory.inventory[key] = 20;
  });
  bizArena.handleBusinessAction(room, host, { action: 'assemble-product', value: 2 });

  let summary = bizArena.playerSummary(room, host, host.id);
  bizArena.handleBusinessAction(room, host, {
    action: 'set-sale-offer',
    value: { price: summary.price, quantity: 2 },
  });

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    bizArena.handleRoomAction(room, host, { action: 'next-turn' });
  } finally {
    Math.random = originalRandom;
  }

  summary = bizArena.playerSummary(room, host, host.id);
  assert.ok(summary.playerDebrief);
  assert.equal(summary.playerDebrief.title, 'Личный разбор результата');
  assert.ok(summary.playerDebrief.metrics.some(item => item.key === 'profit'));
  assert.ok(summary.playerDebrief.metrics.some(item => item.key === 'sales'));
  assert.ok(summary.playerDebrief.actionItems.length >= 3);
  assert.match(summary.playerDebrief.nextMatchFocus, /матч|Фокус/i);
});

test('game feel: host room summary exposes class readiness and factory event catalog', () => {
  const { room, host } = createStartedFactoryRoom();
  Object.keys(host.factory.inventory).forEach(key => {
    host.factory.inventory[key] = 0;
  });

  const summary = bizArena.roomSummary(room, host.id);
  assert.equal(summary.classReadiness.total, 2);
  assert.ok(Array.isArray(summary.classReadiness.rows));
  assert.ok(Array.isArray(summary.classReadiness.helpQueue));
  assert.ok(Array.isArray(summary.classReadiness.stepMap));
  assert.deepEqual(
    summary.classReadiness.stepMap.map(step => step.key),
    ['purchase', 'personnel', 'assembly', 'market', 'finish']
  );
  assert.ok(summary.classReadiness.routeSummary.primaryStep);
  assert.ok(summary.classReadiness.stepMap.some(step => step.stuck > 0));
  assert.ok(summary.classReadiness.rows.every(row => row.routeProgressTotal === 5));
  assert.equal(summary.classReadiness.briefing.status, 'blocked');
  assert.equal(summary.classReadiness.briefing.canAdvanceTurn, false);
  assert.match(summary.classReadiness.briefing.recommendedAction, /Подойдите к/);
  assert.ok(summary.classReadiness.briefing.discussionPrompts.length >= 2);
  assert.ok(summary.classReadiness.helpQueue.length > 0);
  assert.equal(summary.classDebrief.status, 'in_progress');
  assert.ok(summary.classDebrief.summary.includes('средний балл'));
  assert.ok(Array.isArray(summary.classDebrief.commonIssues));
  assert.ok(summary.classReadiness.noPurchase >= 1);
  assert.ok(summary.classReadiness.noWorkers >= 1);
  assert.ok(summary.classReadiness.rows.some(row => row.noProduction));
  assert.ok(summary.classDashboard);
  assert.ok(summary.classDashboard.sortOptions.some(option => option.key === 'lastProfit'));
  assert.ok(summary.classDashboard.sortOptions.some(option => option.key === 'readyForTurn'));
  assert.ok(summary.classDashboard.metrics.some(metric => metric.key === 'ready'));
  assert.equal(summary.classDashboard.rows.length, summary.players.length);
  assert.ok(summary.classDashboard.rows.some(row => row.nextAction && Number.isFinite(row.lastProfit)));
  assert.equal(summary.lessonPlan.scenarioKey, 'motorcycles');
  assert.ok(summary.lessonPlan.objectives.some(item => /производственный цикл/i.test(item)));
  assert.ok(summary.lessonPlan.firstSteps.length >= 3);
  assert.ok(summary.lessonPlan.metrics.some(item => /спрос/i.test(item)));
  assert.ok(summary.scenarioLab);
  assert.equal(summary.scenarioLab.validation.valid, true);
  assert.ok(summary.scenarioLab.parameters.some(item => item.key === 'demand'));
  assert.ok(summary.scenarioLab.experimentAxes.some(item => item.key === 'price_strategy'));
  assert.ok(summary.teacherControls.eventCatalog.some(item => item.key === 'factory_supplier_delay'));
  assert.ok(summary.teacherControls.eventCatalog.some(item => item.key === 'factory_payroll_pressure'));
});

test('game feel: student learning hints and server copy are readable Russian', () => {
  const { room, host } = createStartedFactoryRoom();

  const summary = bizArena.playerSummary(room, host, host.id);
  assert.ok(Array.isArray(summary.learningHints));
  assert.ok(summary.learningHints.length > 0);
  assert.ok(summary.marketHints.some(hint => hint.studentText));

  const visibleCopy = JSON.stringify({
    checklist: summary.turnChecklist,
    marketHints: summary.marketHints,
    turnReview: summary.turnReview,
    learningHints: summary.learningHints,
  });
  assert.doesNotMatch(visibleCopy, /[РС][\u0080-\u00BF\u0400-\u040F\u0450-\u045F]/u);
});

test('strategic rounds: motorcycles creates a pending decision round for human players', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');

  bizArena.advanceRoom(room);

  assert.equal(room.day, 2);
  assert.ok(host.decisionRound);
  assert.equal(host.decisionRound.status, 'pending');
  assert.ok(host.decisionRound.options.length >= 2);
});

test('strategic rounds: drones creates and resolves a pending decision round', () => {
  const { room, host } = createStartedFactoryRoom('drones');

  bizArena.advanceRoom(room);

  assert.equal(room.day, 2);
  assert.ok(host.decisionRound);
  assert.equal(host.decisionRound.scenarioKey, 'drones');
  assert.equal(host.decisionRound.status, 'pending');

  const option = host.decisionRound.options[0];
  bizArena.handleBusinessAction(room, host, {
    action: 'resolve-decision-round',
    value: { roundId: host.decisionRound.id, optionKey: option.key },
  });

  assert.equal(host.decisionRound.status, 'resolved');
  assert.equal(host.decisionRound.selectedOptionKey, option.key);
  assert.equal(host.decisionHistory[0].scenarioKey, 'drones');
});

test('strategic rounds: host can force a demo round before scheduled day', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');
  assert.equal(room.day, 1);
  assert.equal(host.decisionRound, null);

  bizArena.handleBusinessAction(room, host, { action: 'force-decision-round' });

  assert.ok(host.decisionRound);
  assert.equal(host.decisionRound.status, 'pending');
  assert.equal(host.decisionRound.scenarioKey, 'motorcycles');
  assert.ok(room.log.some(entry => entry.includes('forced a strategic round for demo')));
});

test('strategic rounds: non-host cannot force a demo round', () => {
  const { room, guest } = createStartedFactoryRoom('motorcycles');
  assert.throws(
    () => bizArena.handleBusinessAction(room, guest, { action: 'force-decision-round' }),
    /Only host can force strategic rounds/
  );
});

test('strategic rounds: resolve-decision-round applies chosen option and writes log', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');
  bizArena.advanceRoom(room);

  const round = host.decisionRound;
  const choice = round.options.find(option => option.key !== round.defaultOptionKey) || round.options[0];
  const moneyBefore = host.money;
  const debtBefore = host.debt;
  const reputationBefore = host.reputation;

  bizArena.handleBusinessAction(room, host, {
    action: 'resolve-decision-round',
    value: { roundId: round.id, optionKey: choice.key },
  });

  assert.equal(host.decisionRound.status, 'resolved');
  assert.equal(host.decisionRound.selectedOptionKey, choice.key);
  assert.equal(host.decisionHistory[0].resolution, 'manual');
  assert.ok(
    host.money !== moneyBefore
      || host.debt !== debtBefore
      || host.reputation !== reputationBefore
  );
  assert.ok(room.log.some(entry => entry.includes('resolved strategic round')));
});

test('strategic rounds: pending dilemma auto-resolves with safe option on next turn', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');
  bizArena.advanceRoom(room);

  const pendingRoundId = host.decisionRound.id;
  const defaultOptionKey = host.decisionRound.defaultOptionKey;

  bizArena.advanceRoom(room);

  assert.equal(room.day, 3);
  assert.equal(host.decisionRound.id, pendingRoundId);
  assert.equal(host.decisionRound.status, 'auto_resolved');
  assert.equal(host.decisionRound.selectedOptionKey, defaultOptionKey);
  assert.equal(host.decisionHistory[0].roundId, pendingRoundId);
  assert.equal(host.decisionHistory[0].resolution, 'auto_safe');
});

test('strategic rounds: playerSummary exposes decisionRound and decisionHistory fields', () => {
  const { room, host } = createStartedFactoryRoom('motorcycles');
  bizArena.advanceRoom(room);

  const pendingSummary = bizArena.playerSummary(room, host, host.id);
  assert.ok(pendingSummary.decisionRound);
  assert.ok(Array.isArray(pendingSummary.decisionRound.options));
  assert.ok(Array.isArray(pendingSummary.decisionHistory));

  bizArena.handleBusinessAction(room, host, {
    action: 'resolve-decision-round',
    value: {
      roundId: host.decisionRound.id,
      optionKey: host.decisionRound.options[0].key,
    },
  });

  const resolvedSummary = bizArena.playerSummary(room, host, host.id);
  assert.equal(resolvedSummary.decisionRound.status, 'resolved');
  assert.ok(resolvedSummary.decisionHistory.length >= 1);
});

test('strategic rounds: no creation for bot, bankrupt player, paused room, or finished room', () => {
  const running = createStartedFactoryRoom('motorcycles');
  bizArena.handleRoomAction(running.room, running.host, { action: 'add-bot' });
  const bot = [...running.room.players.values()].find(player => player.isBot);
  bizArena.advanceRoom(running.room);
  assert.ok(bot);
  assert.equal(bot.decisionRound, null);

  const bankruptCase = createStartedFactoryRoom('motorcycles');
  bankruptCase.host.bankrupt = true;
  bizArena.advanceRoom(bankruptCase.room);
  assert.equal(bankruptCase.host.decisionRound, null);

  const pausedCase = createStartedFactoryRoom('motorcycles');
  pausedCase.room.status = 'paused';
  bizArena.advanceRoom(pausedCase.room);
  assert.equal(pausedCase.room.day, 1);
  assert.equal(pausedCase.host.decisionRound, null);

  const finishedCase = createStartedFactoryRoom('motorcycles');
  finishedCase.room.status = 'finished';
  bizArena.advanceRoom(finishedCase.room);
  assert.equal(finishedCase.room.day, 1);
  assert.equal(finishedCase.host.decisionRound, null);
});
