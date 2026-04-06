const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-tests-'));
process.env.BIZ_ARENA_DATA_DIR = dataDir;

const bizArena = require('../server');

function resetRuntime() {
  bizArena.stopRoomTicker();
  bizArena.state.rooms.clear();
  bizArena.state.playerRoomIndex.clear();
  bizArena.state.db = bizArena.createEmptyDb();
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

test.beforeEach(() => {
  resetRuntime();
});

test.after(() => {
  resetRuntime();
  fs.rmSync(dataDir, { recursive: true, force: true });
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

  const summary = bizArena.roomSummary(room, host.id);
  assert.equal(room.status, 'finished');
  assert.equal(summary.status, 'finished');
  assert.equal(summary.winnerPlayerId, host.id);
  assert.equal(summary.leaderboard[0].id, host.id);
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
  bizArena.handleRoomAction(room, host, { action: 'pause-game' });
  bizArena.saveRoomSnapshot(room, host);

  const saved = bizArena.state.db.savedRooms[room.code];
  assert.equal(saved.meta.schemaVersion, 2);
  assert.equal(saved.snapshot.schemaVersion, 2);

  host.money = 1;
  host.rawStock = 0;
  host.focusCityKey = 'regional';

  const loadedRoom = bizArena.loadRoomSnapshot(room);
  const loadedHost = loadedRoom.players.get(host.id);

  assert.equal(loadedHost.money, 135432);
  assert.equal(loadedHost.rawStock, 77);
  assert.equal(loadedHost.focusCityKey, 'capital');
  assert.equal(loadedRoom.settings.dayLimit, room.settings.dayLimit);
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

  assert.equal(recovered.schemaVersion, 2);
  assert.equal(recovered.accounts.host.userName, 'Host');
  assert.equal(fs.existsSync(filePath), true);
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
