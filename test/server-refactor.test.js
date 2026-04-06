const test = require('node:test');
const assert = require('node:assert/strict');
const { URL } = require('node:url');

const { createRoomActionHandler } = require('../server/room/actions');
const { createApiRouter } = require('../server/http/routes');

test('createRoomActionHandler toggles ready state through extracted dispatcher', () => {
  const log = [];
  const handler = createRoomActionHandler({
    ensureLobby: room => assert.equal(room.status, 'lobby'),
    ensureHost: () => {},
    canStartMatch: () => true,
    refreshContracts: () => {},
    ensureSeasonGoal: () => {},
    addRoomLog: (_room, message) => log.push(message),
    resetRoom: () => {},
    addBot: () => {},
    saveRoomSnapshot: () => {},
    ensureLoadable: () => {},
    loadRoomSnapshot: room => room,
    removePlayer: () => {},
    updateRoomSettings: () => {},
    handleBusinessAction: () => {
      throw new Error('business fallback should not run');
    },
  });

  const room = { status: 'lobby', players: new Map() };
  const player = { id: 'p1', userName: 'Alex', ready: false, lastAction: '' };

  handler(room, player, { action: 'toggle-ready' });

  assert.equal(player.ready, true);
  assert.equal(player.lastAction, 'Игрок готов к старту');
  assert.deepEqual(log, ['Alex готов к матчу.']);
});

test('createApiRouter serves extracted account endpoint', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({}),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => {
      throw new Error('not needed');
    },
    getPlayer: () => {
      throw new Error('not needed');
    },
    ensureAccount: userName => ({ id: 'acct_1', userName }),
    accountSummary: account => ({ id: account.id, userName: account.userName }),
    createRoom: () => {
      throw new Error('not needed');
    },
    joinRoom: () => {
      throw new Error('not needed');
    },
    roomSummary: () => {
      throw new Error('not needed');
    },
    playerSummary: () => {
      throw new Error('not needed');
    },
    handleRoomAction: () => {
      throw new Error('not needed');
    },
    serveStatic: () => {
      throw new Error('not needed');
    },
  });

  const handled = await routeApiRequest({ method: 'GET' }, {}, new URL('http://localhost/api/account?userName=BizPlayer'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [{ status: 200, payload: { account: { id: 'acct_1', userName: 'BizPlayer' } } }]);
});

test('createApiRouter serves runtime metadata endpoint', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({}),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => { throw new Error('not needed'); },
    getPlayer: () => { throw new Error('not needed'); },
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0', desktopShell: false, port: 3000, localUrls: ['http://127.0.0.1:3000'], lanUrls: [] }),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: () => { throw new Error('not needed'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  const handled = await routeApiRequest({ method: 'GET' }, {}, new URL('http://localhost/api/meta'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [{ status: 200, payload: { meta: { version: '0.1.0', desktopShell: false, port: 3000, localUrls: ['http://127.0.0.1:3000'], lanUrls: [] } } }]);
});

test('createRoomActionHandler forwards unknown actions to business handlers', () => {
  const calls = [];
  const handler = createRoomActionHandler({
    ensureLobby: () => {},
    ensureHost: () => {},
    canStartMatch: () => true,
    refreshContracts: () => {},
    ensureSeasonGoal: () => {},
    addRoomLog: () => {},
    resetRoom: () => {},
    addBot: () => {},
    saveRoomSnapshot: () => {},
    ensureLoadable: () => {},
    loadRoomSnapshot: room => room,
    removePlayer: () => {},
    updateRoomSettings: () => {},
    handleBusinessAction: (room, player, body) => calls.push({ room, player, body }),
  });

  const room = { status: 'running', players: new Map() };
  const player = { id: 'p1', userName: 'Alex' };
  const body = { action: 'buy-raw', value: 20 };

  handler(room, player, body);

  assert.deepEqual(calls, [{ room, player, body }]);
});

test('createRoomActionHandler rejects start-game when readiness gate fails', () => {
  const handler = createRoomActionHandler({
    ensureLobby: () => {},
    ensureHost: () => {},
    canStartMatch: () => false,
    refreshContracts: () => {},
    ensureSeasonGoal: () => {},
    addRoomLog: () => {},
    resetRoom: () => {},
    addBot: () => {},
    saveRoomSnapshot: () => {},
    ensureLoadable: () => {},
    loadRoomSnapshot: room => room,
    removePlayer: () => {},
    updateRoomSettings: () => {},
    handleBusinessAction: () => {},
  });

  const room = { status: 'lobby', players: new Map(), settings: {}, winnerPlayerId: null };
  const player = { id: 'host_1', userName: 'Host' };

  assert.throws(() => handler(room, player, { action: 'start-game' }), /Все игроки должны отметить готовность/);
});

test('createApiRouter serves player-scoped state payloads', async () => {
  const calls = [];
  const room = { code: 'ABCDE', name: 'Room', status: 'running' };
  const player = { id: 'p_1', userName: 'BizPlayer' };
  const account = { id: 'acct_1', userName: 'BizPlayer' };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({}),
    state: { rooms: new Map([['ABCDE', room]]) },
    getRoomByPlayerId: playerId => {
      assert.equal(playerId, 'p_1');
      return room;
    },
    getPlayer: (resolvedRoom, playerId) => {
      assert.equal(resolvedRoom, room);
      assert.equal(playerId, 'p_1');
      return player;
    },
    ensureAccount: userName => {
      assert.equal(userName, 'BizPlayer');
      return account;
    },
    accountSummary: value => ({ id: value.id, userName: value.userName }),
    getRuntimeMeta: () => ({ version: '0.1.0' }),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: (resolvedRoom, viewerId) => ({ code: resolvedRoom.code, viewerId }),
    playerSummary: (_room, resolvedPlayer, viewerId) => ({ id: resolvedPlayer.id, viewerId }),
    handleRoomAction: () => { throw new Error('not needed'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  const handled = await routeApiRequest({ method: 'GET' }, {}, new URL('http://localhost/api/state?playerId=p_1'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    status: 200,
    payload: {
      room: { code: 'ABCDE', viewerId: 'p_1' },
      player: { id: 'p_1', viewerId: 'p_1' },
      account: { id: 'acct_1', userName: 'BizPlayer' },
    },
  }]);
});

test('createApiRouter dispatches action requests through room and player lookup', async () => {
  const calls = [];
  const room = { code: 'ABCDE' };
  const player = { id: 'p_1' };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({ playerId: 'p_1', action: 'buy-raw', value: 20 }),
    state: { rooms: new Map() },
    getRoomByPlayerId: playerId => {
      assert.equal(playerId, 'p_1');
      return room;
    },
    getPlayer: (resolvedRoom, playerId) => {
      assert.equal(resolvedRoom, room);
      assert.equal(playerId, 'p_1');
      return player;
    },
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0' }),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: (resolvedRoom, resolvedPlayer, body) => calls.push({ resolvedRoom, resolvedPlayer, body }),
    serveStatic: () => { throw new Error('not needed'); },
  });

  const handled = await routeApiRequest({ method: 'POST' }, {}, new URL('http://localhost/api/action'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    { resolvedRoom: room, resolvedPlayer: player, body: { playerId: 'p_1', action: 'buy-raw', value: 20 } },
    { status: 200, payload: { ok: true } },
  ]);
});
