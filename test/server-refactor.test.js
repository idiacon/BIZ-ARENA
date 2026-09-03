const test = require('node:test');
const assert = require('node:assert/strict');
const { URL } = require('node:url');

const { createRoomActionHandler } = require('../server/room/actions');
const { createApiRouter } = require('../server/http/routes');
const bizArena = require('../server');

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
    forceRoomEvent: () => {},
    setPhaseLock: () => {},
    handleBusinessAction: () => {
      throw new Error('business fallback should not run');
    },
  });

  const room = { status: 'lobby', players: new Map() };
  const player = { id: 'p1', userName: 'Alex', ready: false, lastAction: '' };

  handler(room, player, { action: 'toggle-ready' });

  assert.equal(player.ready, true);
  assert.equal(player.lastAction, '\u0418\u0433\u0440\u043e\u043a \u0433\u043e\u0442\u043e\u0432 \u043a \u0441\u0442\u0430\u0440\u0442\u0443');
  assert.deepEqual(log, ['Alex \u0433\u043e\u0442\u043e\u0432 \u043a \u043c\u0430\u0442\u0447\u0443.']);
});

test('createApiRouter does not expose legacy account lookup in cloud deployment', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    ensureAccount: () => { throw new Error('cloud account lookup must not create or read an account'); },
    accountSummary: () => { throw new Error('cloud account lookup must not expose an account'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', headers: {} },
    {},
    new URL('https://arena.example/api/account?userName=BizPlayer')
  ), true);

  assert.equal(calls[0].status, 404);
});

test('createApiRouter hides room discovery from anonymous cloud state requests', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map([['ABCDE', { code: 'ABCDE', name: 'Private class', status: 'lobby', players: new Map() }]]) },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', headers: {} },
    {},
    new URL('https://arena.example/api/state')
  ), true);

  assert.deepEqual(calls, [{
    status: 200,
    payload: { room: null, player: null, account: null, rooms: [] },
  }]);
});

test('createApiRouter never exposes room codes through anonymous state requests', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map([['ABCDE', { code: 'ABCDE', name: 'Private class', status: 'lobby', players: new Map() }]]) },
    getRuntimeMeta: () => ({ deployment: 'local' }),
  });

  await routeApiRequest(
    { method: 'GET', headers: {} },
    {},
    new URL('http://localhost/api/state')
  );

  assert.deepEqual(calls, [{
    status: 200,
    payload: { room: null, player: null, account: null, rooms: [] },
  }]);
});

test('createApiRouter serves the dedicated public lobby directory contract', async () => {
  const calls = [];
  const listedRooms = [{
    directoryId: 'd_7hJpQX8kLmN2rStUvWxY',
    name: 'Economics 101',
    status: 'open',
    requiresCode: true,
    playerCount: 4,
    maxPlayers: 30,
    scenarioLabel: 'Motorcycles',
  }];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map() },
    publicRoomDirectory: () => listedRooms,
  });

  await routeApiRequest(
    { method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.10' } },
    {},
    new URL('https://arena.example/api/rooms/directory')
  );

  assert.deepEqual(calls, [{
    status: 200,
    payload: { contract: 'public-room-directory-v1', rooms: listedRooms },
  }]);
  assert.deepEqual(Object.keys(calls[0].payload.rooms[0]).sort(), [
    'directoryId',
    'maxPlayers',
    'name',
    'playerCount',
    'requiresCode',
    'scenarioLabel',
    'status',
  ]);
});

test('createApiRouter forwards directory selection and room code only to join handling', async () => {
  const calls = [];
  const joined = [];
  const room = { code: 'ABCDE', version: 1 };
  const player = { id: 'student_1', userName: 'Student', sessionToken: 'session_1', version: 1 };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({ roomCode: 'ABCDE', directoryId: 'd_7hJpQX8kLmN2rStUvWxY', userName: 'Student', companyName: 'Team' }),
    state: { rooms: new Map([['ABCDE', room]]) },
    joinRoom: body => {
      joined.push(body);
      return { room, player };
    },
    roomSummary: () => ({ summaryContract: 'student-v2' }),
    playerStateSummary: () => ({ playerContract: 'student-player-v2' }),
    ensureAccount: () => ({ id: 'account_1' }),
    accountSummary: () => ({ id: 'account_1' }),
  });

  await routeApiRequest(
    { method: 'POST', headers: {}, socket: { remoteAddress: '203.0.113.10' } },
    {},
    new URL('https://arena.example/api/rooms/join')
  );

  assert.deepEqual(joined, [{ roomCode: 'ABCDE', directoryId: 'd_7hJpQX8kLmN2rStUvWxY', userName: 'Student', companyName: 'Team' }]);
  assert.equal(calls[0].status, 201);
  assert.equal(calls[0].payload.stateContract, 'student-state-v2');
});

test('createApiRouter rate limits failed joins by forwarded client address', async () => {
  let currentTime = 1000;
  let joinAttempts = 0;
  let requestBody = { roomCode: 'ABCDE', userName: 'Student One' };
  const routeApiRequest = createApiRouter({
    sendJson: () => { throw new Error('a failed join must not return a success payload'); },
    parseBody: async () => requestBody,
    state: { rooms: new Map() },
    joinRoom: () => {
      joinAttempts += 1;
      throw Object.assign(new Error('Комната недоступна'), { status: 404 });
    },
    now: () => currentTime,
  });
  const url = new URL('https://arena.example/api/rooms/join');
  const proxiedRequest = address => ({
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': `198.51.100.99, ${address}` },
  });

  for (let index = 0; index < 8; index += 1) {
    await assert.rejects(() => routeApiRequest(proxiedRequest('203.0.113.10'), {}, url), error => error.status === 404);
  }
  await assert.rejects(
    () => routeApiRequest(proxiedRequest('203.0.113.10'), {}, url),
    error => error.status === 429 && error.retryAfterSeconds === 60
  );
  requestBody = { roomCode: 'ABCDE', userName: 'Student Two' };
  await assert.rejects(() => routeApiRequest(proxiedRequest('203.0.113.10'), {}, url), error => error.status === 404);
  await assert.rejects(() => routeApiRequest(proxiedRequest('203.0.113.11'), {}, url), error => error.status === 404);
  assert.equal(joinAttempts, 10);

  currentTime += 60_001;
  requestBody = { roomCode: 'ABCDE', userName: 'Student One' };
  await assert.rejects(() => routeApiRequest(proxiedRequest('203.0.113.10'), {}, url), error => error.status === 404);
  assert.equal(joinAttempts, 11);
});

test('createApiRouter rate limits public lobby directory requests', async () => {
  let currentTime = 1000;
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map() },
    publicRoomDirectory: () => [],
    now: () => currentTime,
  });
  const req = { method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.10' } };
  const url = new URL('https://arena.example/api/rooms/directory');

  for (let index = 0; index < 120; index += 1) await routeApiRequest(req, {}, url);
  await assert.rejects(
    () => routeApiRequest(req, {}, url),
    error => error.status === 429 && error.retryAfterSeconds === 60
  );
  assert.equal(calls.length, 120);

  currentTime += 60_001;
  await routeApiRequest(req, {}, url);
  assert.equal(calls.length, 121);
});

test('publicRoomDirectory includes only listed non-full lobby rooms without room codes', () => {
  const originalRooms = new Map(bizArena.state.rooms);
  try {
    bizArena.state.rooms.clear();
    const makeRoom = ({ code, directoryId, visibility, status = 'lobby', players = 1, maxPlayers = 3 }) => ({
      code,
      directoryId,
      lobbyVisibility: visibility,
      name: `${code} classroom`,
      status,
      players: new Map(Array.from({ length: players }, (_, index) => [`p_${index}`, { id: `p_${index}`, isBot: false, isTeacherHost: false }])),
      settings: { maxPlayers, scenarioKey: 'standard', difficulty: 'normal' },
    });
    bizArena.state.rooms.set('ABCDE', makeRoom({
      code: 'ABCDE',
      directoryId: 'd_7hJpQX8kLmN2rStUvWxY',
      visibility: 'listed',
    }));
    bizArena.state.rooms.set('BCDEF', makeRoom({
      code: 'BCDEF',
      directoryId: 'd_privateRoomOnly_12345',
      visibility: 'code-only',
    }));
    bizArena.state.rooms.set('CDEFG', makeRoom({
      code: 'CDEFG',
      directoryId: 'd_runningRoomOnly_12345',
      visibility: 'listed',
      status: 'running',
    }));
    bizArena.state.rooms.set('DEFGH', makeRoom({
      code: 'DEFGH',
      directoryId: 'd_fullRoomOnly_123456789',
      visibility: 'listed',
      players: 3,
    }));

    assert.deepEqual(bizArena.publicRoomDirectory(), [{
      directoryId: 'd_7hJpQX8kLmN2rStUvWxY',
      name: 'ABCDE classroom',
      status: 'open',
      requiresCode: true,
      playerCount: 1,
      maxPlayers: 3,
      scenarioLabel: 'Balanced growth',
    }]);
  } finally {
    bizArena.state.rooms.clear();
    originalRooms.forEach((room, code) => bizArena.state.rooms.set(code, room));
  }
});

test('serializeRoom persists the opaque directory identifier and visibility', () => {
  const snapshot = bizArena.serializeRoom({
    code: 'ABCDE',
    name: 'Room',
    hostPlayerId: 'host_1',
    teacherAccountId: '',
    directoryId: 'd_7hJpQX8kLmN2rStUvWxY',
    lobbyVisibility: 'listed',
    version: 1,
    status: 'lobby',
    day: 1,
    tick: 0,
    winnerPlayerId: null,
    finishReason: null,
    startedAt: null,
    finishedAt: null,
    completedSessionId: '',
    log: [],
    adminSnapshots: [],
    helpRequests: [],
    pauseRequest: null,
    marketHistory: [],
    segmentSnapshots: [],
    settings: {},
    teacherState: {},
    activeEvent: null,
    contractBoard: [],
    factoryScenario: null,
    lastSavedAt: null,
    turnStartedAt: null,
    pausedRemainingMs: null,
    players: new Map(),
  });

  assert.equal(snapshot.directoryId, 'd_7hJpQX8kLmN2rStUvWxY');
  assert.equal(snapshot.lobbyVisibility, 'listed');
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
    getRuntimeMeta: () => ({ version: '0.1.0', appMode: 'server', desktopShell: false, port: 3000, localUrls: ['http://127.0.0.1:3000'], lanUrls: [] }),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: () => { throw new Error('not needed'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  const handled = await routeApiRequest({ method: 'GET' }, {}, new URL('http://localhost/api/meta'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [{ status: 200, payload: { meta: { version: '0.1.0', appMode: 'server', desktopShell: false, port: 3000, localUrls: ['http://127.0.0.1:3000'], lanUrls: [] } } }]);
});

test('createApiRouter serves health and server overview endpoints', async () => {
  const calls = [];
  const overview = { roomCount: 1, rooms: [{ code: 'ABCDE' }] };
  const health = { ok: true, status: 'healthy', diagnostics: { websocketConnections: 2 } };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({}),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => { throw new Error('not needed'); },
    getPlayer: () => { throw new Error('not needed'); },
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0', appMode: 'server', port: 3000, localUrls: [], lanUrls: [] }),
    getRuntimeHealth: () => health,
    serverOverview: () => overview,
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: () => { throw new Error('not needed'); },
    requirePlayerSession: () => { throw new Error('not needed'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  assert.equal(await routeApiRequest({ method: 'GET' }, {}, new URL('http://localhost/api/health')), true);
  assert.equal(await routeApiRequest({ method: 'GET' }, {}, new URL('http://localhost/api/server/overview')), true);
  assert.equal(calls[0].status, 200);
  assert.deepEqual(calls[0].payload, health);
  assert.deepEqual(calls[1], { status: 200, payload: { overview } });
});

test('createApiRouter rate limits teacher authentication attempts by address', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({ email: 'teacher@example.com', password: 'wrong-password' }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({}),
    loginTeacher: () => { throw Object.assign(new Error('bad credentials'), { status: 403 }); },
    teacherSummary: value => value,
  });
  const req = { method: 'POST', socket: { remoteAddress: '203.0.113.10' } };
  const url = new URL('http://localhost/api/teacher/login');

  for (let index = 0; index < 10; index += 1) {
    await assert.rejects(() => routeApiRequest(req, {}, url), error => error.status === 403);
  }
  await assert.rejects(() => routeApiRequest(req, {}, url), error => error.status === 429);
  assert.equal(calls.length, 0);
});

test('createApiRouter separates teacher auth limits by client behind local nginx', async () => {
  const routeApiRequest = createApiRouter({
    sendJson: () => {},
    parseBody: async () => ({ email: 'teacher@example.com', password: 'wrong-password' }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    loginTeacher: () => { throw Object.assign(new Error('bad credentials'), { status: 403 }); },
    teacherSummary: value => value,
  });
  const url = new URL('http://localhost/api/teacher/login');
  const proxiedRequest = address => ({
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': `198.51.100.99, ${address}` },
  });

  for (let index = 0; index < 10; index += 1) {
    await assert.rejects(
      () => routeApiRequest(proxiedRequest('203.0.113.10'), {}, url),
      error => error.status === 403
    );
  }
  await assert.rejects(
    () => routeApiRequest(proxiedRequest('203.0.113.10'), {}, url),
    error => error.status === 429
  );
  await assert.rejects(
    () => routeApiRequest(proxiedRequest('203.0.113.11'), {}, url),
    error => error.status === 403
  );
});

test('createApiRouter serves QR SVG and local network diagnostics', async () => {
  const calls = [];
  let svgWritten = '';
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({}),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => { throw new Error('not needed'); },
    getPlayer: () => { throw new Error('not needed'); },
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0', appMode: 'server', port: 3000, localUrls: [], lanUrls: [] }),
    serverOverview: () => ({}),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: () => { throw new Error('not needed'); },
    requirePlayerSession: () => { throw new Error('not needed'); },
    createQrSvg: async data => `<svg>${data}</svg>`,
    checkNetworkHealthUrl: async checkedUrl => ({ ok: true, url: checkedUrl, elapsedMs: 12 }),
    serveStatic: () => { throw new Error('not needed'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'GET' },
    { writeHead: () => {}, end: value => { svgWritten = value; } },
    new URL('http://localhost/api/qr?data=http%3A%2F%2F192.168.0.10%3A3000%2Fclient')
  ), true);
  assert.equal(svgWritten, '<svg>http://192.168.0.10:3000/client</svg>');

  assert.equal(await routeApiRequest(
    { method: 'GET', socket: { remoteAddress: '127.0.0.1' } },
    {},
    new URL('http://localhost/api/network/check?url=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fhealth')
  ), true);

  assert.deepEqual(calls, [{
    status: 200,
    payload: { result: { ok: true, url: 'http://127.0.0.1:3000/api/health', elapsedMs: 12 } },
  }]);
});

test('createApiRouter keeps network diagnostics host-local', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({}),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => { throw new Error('not needed'); },
    getPlayer: () => { throw new Error('not needed'); },
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0', appMode: 'server', port: 3000, localUrls: [], lanUrls: [] }),
    serverOverview: () => ({}),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: () => { throw new Error('not needed'); },
    requirePlayerSession: () => { throw new Error('not needed'); },
    checkNetworkHealthUrl: async () => { throw new Error('remote diagnostics should not run'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', socket: { remoteAddress: '192.168.0.20' } },
    {},
    new URL('http://localhost/api/network/check?url=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fhealth')
  ), true);
  assert.equal(calls[0].status, 403);
});

test('createApiRouter allows server admin actions only from localhost', async () => {
  const calls = [];
  const adminCalls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({ roomCode: 'ABCDE', action: 'pause-game' }),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => { throw new Error('not needed'); },
    getPlayer: () => { throw new Error('not needed'); },
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0', appMode: 'server', port: 3000, localUrls: [], lanUrls: [] }),
    serverOverview: () => ({}),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    handleRoomAction: () => { throw new Error('not needed'); },
    handleServerAdminAction: body => {
      adminCalls.push(body);
      return { ok: true };
    },
    requirePlayerSession: () => { throw new Error('not needed'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  assert.equal(await routeApiRequest({ method: 'POST', socket: { remoteAddress: '::ffff:127.0.0.1' } }, {}, new URL('http://localhost/api/server/action')), true);
  assert.equal(await routeApiRequest({ method: 'POST', socket: { remoteAddress: '192.168.0.20' } }, {}, new URL('http://localhost/api/server/action')), true);

  assert.deepEqual(adminCalls, [{ roomCode: 'ABCDE', action: 'pause-game' }]);
  assert.equal(calls[0].status, 200);
  assert.equal(calls[1].status, 403);
});

test('createApiRouter never exposes local server admin actions in cloud deployment', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => { throw new Error('cloud request must be rejected before body parsing'); },
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    handleServerAdminAction: () => { throw new Error('cloud request must not reach local admin action'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'POST', socket: { remoteAddress: '127.0.0.1' } },
    {},
    new URL('https://arena.example/api/server/action')
  ), true);

  assert.equal(calls[0].status, 403);
});

test('createApiRouter exposes server overview only on the host computer', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({}),
    serverOverview: () => ({ rooms: [{ code: 'ABCDE' }] }),
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', socket: { remoteAddress: '127.0.0.1' } },
    {},
    new URL('http://localhost/api/server/overview')
  ), true);
  assert.equal(await routeApiRequest(
    { method: 'GET', socket: { remoteAddress: '192.168.0.20' } },
    {},
    new URL('http://localhost/api/server/overview')
  ), true);

  assert.equal(calls[0].status, 200);
  assert.deepEqual(calls[0].payload.overview.rooms, [{ code: 'ABCDE' }]);
  assert.equal(calls[1].status, 403);
});

test('createApiRouter scopes completed session history to localhost or teacher owner', async () => {
  const localCalls = [];
  const localFilters = [];
  const localRouter = createApiRouter({
    sendJson: (_res, status, payload) => localCalls.push({ status, payload }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'local' }),
    listCompletedSessions: filter => {
      localFilters.push(filter);
      return [{ id: 'local-session', roomCode: 'LOCAL' }];
    },
  });

  await localRouter(
    { method: 'GET', socket: { remoteAddress: '127.0.0.1' } },
    {},
    new URL('http://localhost/api/server/sessions?limit=10')
  );
  await localRouter(
    { method: 'GET', socket: { remoteAddress: '192.168.1.20' } },
    {},
    new URL('http://localhost/api/server/sessions')
  );
  assert.deepEqual(localFilters, [{ teacherAccountId: '' }]);
  assert.equal(localCalls[0].payload.items[0].id, 'local-session');
  assert.equal(localCalls[1].status, 403);

  const cloudCalls = [];
  const teacherFilters = [];
  const cloudRouter = createApiRouter({
    sendJson: (_res, status, payload) => cloudCalls.push({ status, payload }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    resolveTeacherRequest: () => ({ account: { id: 'teacher-1' } }),
    listCompletedSessions: filter => {
      teacherFilters.push(filter);
      return [{ id: 'teacher-session', roomCode: 'CLOUD' }];
    },
  });
  await cloudRouter(
    { method: 'GET', socket: { remoteAddress: '198.51.100.4' }, headers: {} },
    {},
    new URL('https://arena.example/api/teacher/sessions')
  );
  assert.deepEqual(teacherFilters, [{ teacherAccountId: 'teacher-1' }]);
  assert.equal(cloudCalls[0].payload.items[0].id, 'teacher-session');
});

test('createApiRouter never exposes local server overview in cloud deployment', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    serverOverview: () => { throw new Error('cloud request must not reach local server overview'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', socket: { remoteAddress: '::ffff:127.0.0.1' } },
    {},
    new URL('https://arena.example/api/server/overview')
  ), true);

  assert.equal(calls[0].status, 403);
});

test('createApiRouter requires teacher flow to create rooms in cloud deployment', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => { throw new Error('cloud request must be rejected before body parsing'); },
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    createRoom: () => { throw new Error('anonymous cloud room creation must not run'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'POST', socket: { remoteAddress: '127.0.0.1' } },
    {},
    new URL('https://arena.example/api/rooms/create')
  ), true);

  assert.equal(calls[0].status, 403);
  assert.match(calls[0].payload.error, /teacher/i);
});

test('createApiRouter keeps local room creation on the host computer', async () => {
  const calls = [];
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => { throw new Error('remote local request must be rejected before body parsing'); },
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'local' }),
    createRoom: () => { throw new Error('remote local room creation must not run'); },
  });

  assert.equal(await routeApiRequest(
    { method: 'POST', headers: {}, socket: { remoteAddress: '192.168.0.25' } },
    {},
    new URL('http://arena.local/api/rooms/create')
  ), true);

  assert.deepEqual(calls, [{
    status: 403,
    payload: { error: 'Создавать комнаты можно только на компьютере преподавателя.' },
  }]);
});

test('createApiRouter rate limits bursts of local room creation', async () => {
  const calls = [];
  let roomNumber = 0;
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({ roomName: 'Room' }),
    state: { rooms: new Map() },
    getRuntimeMeta: () => ({ deployment: 'local' }),
    createRoom: () => {
      roomNumber += 1;
      return {
        room: { code: `ROOM${roomNumber}`, version: 1 },
        player: { id: `player-${roomNumber}`, sessionToken: `token-${roomNumber}`, userName: 'Teacher' },
      };
    },
    roomSummary: room => ({ code: room.code }),
    playerStateSummary: (_room, player) => ({ id: player.id }),
    accountSummary: account => account,
    ensureAccount: userName => ({ userName }),
    now: () => 1_000,
  });

  for (let index = 0; index < 5; index += 1) {
    assert.equal(await routeApiRequest(
      { method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      {},
      new URL('http://localhost/api/rooms/create')
    ), true);
  }

  await assert.rejects(
    () => routeApiRequest(
      { method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      {},
      new URL('http://localhost/api/rooms/create')
    ),
    error => error.status === 429 && error.retryAfterSeconds === 600
  );
  assert.equal(calls.length, 5);
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
    forceRoomEvent: () => {},
    setPhaseLock: () => {},
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
    forceRoomEvent: () => {},
    setPhaseLock: () => {},
    handleBusinessAction: () => {},
  });

  const room = { status: 'lobby', players: new Map(), settings: {}, winnerPlayerId: null };
  const player = { id: 'host_1', userName: 'Host' };

  assert.throws(() => handler(room, player, { action: 'start-game' }), /\u0412\u0441\u0435 \u0438\u0433\u0440\u043e\u043a\u0438 \u0434\u043e\u043b\u0436\u043d\u044b \u043e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0433\u043e\u0442\u043e\u0432\u043d\u043e\u0441\u0442\u044c/);
});

test('createRoomActionHandler rejects pause and resume outside their authoritative lifecycle phases', () => {
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
    forceRoomEvent: () => {},
    setPhaseLock: () => {},
    handleBusinessAction: () => {},
    advanceRoom: () => {},
  });

  const player = { id: 'host_1', userName: 'Host' };
  const lobbyRoom = { status: 'lobby', settings: {}, players: new Map() };
  const runningRoom = { status: 'running', settings: {}, players: new Map() };
  assert.throws(() => handler(lobbyRoom, player, { action: 'pause-game' }), /только во время игры/i);
  assert.throws(() => handler(runningRoom, player, { action: 'resume-game' }), /стоит на паузе/i);
});

test('createApiRouter serves player-scoped state payloads', async () => {
  const calls = [];
  const room = { code: 'ABCDE', name: 'Room', status: 'running' };
  const player = { id: 'p_1', userName: 'BizPlayer', sessionToken: 'token_1' };
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
    roomSummary: (resolvedRoom, viewerId, options) => ({ code: resolvedRoom.code, viewerId, view: options.view }),
    playerSummary: (_room, resolvedPlayer, viewerId) => ({ id: resolvedPlayer.id, viewerId }),
    requirePlayerSession: (resolvedPlayer, token) => {
      assert.equal(resolvedPlayer, player);
      assert.equal(token, 'token_1');
    },
    handleRoomAction: () => { throw new Error('not needed'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  const handled = await routeApiRequest(
    { method: 'GET', headers: { 'x-player-session': 'token_1' } },
    {},
    new URL('http://localhost/api/state?playerId=p_1&view=student')
  );

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    status: 200,
    payload: {
      stateContract: 'student-state-v2',
      room: { code: 'ABCDE', viewerId: 'p_1', view: 'student' },
      player: { id: 'p_1', viewerId: 'p_1' },
      account: { id: 'acct_1', userName: 'BizPlayer' },
      roomVersion: 1,
      playerVersion: 1,
    },
  }]);
});

test('createApiRouter downgrades student-requested teacher state to the student contract', async () => {
  const calls = [];
  const room = { code: 'ABCDE', hostPlayerId: 'host_1', version: 3 };
  const player = { id: 'student_1', userName: 'Student', version: 2 };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map([['ABCDE', room]]) },
    getRuntimeMeta: () => ({ deployment: 'cloud' }),
    resolvePlayerSession: (token, playerId) => {
      assert.equal(token, 'student-token');
      assert.equal(playerId, 'student_1');
      return { room, player };
    },
    requirePlayerSession: (resolvedPlayer, token) => {
      assert.equal(resolvedPlayer, player);
      assert.equal(token, 'student-token');
    },
    ensureAccount: () => ({ id: 'acct_1' }),
    accountSummary: () => ({ id: 'acct_1' }),
    roomSummary: (_room, _viewerId, options) => ({ summaryView: options.view }),
    playerSummary: () => ({ id: player.id, legacy: true }),
    playerStateSummary: (_room, resolvedPlayer, _viewerId, options) => ({
      id: resolvedPlayer.id,
      playerView: options.view,
    }),
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', headers: { 'x-player-session': 'student-token' } },
    {},
    new URL('https://arena.example/api/state?playerId=student_1&view=teacher')
  ), true);

  assert.equal(calls[0].payload.room.summaryView, 'student');
  assert.equal(calls[0].payload.stateContract, 'student-state-v2');
  assert.equal(calls[0].payload.player.playerView, 'student');
});

test('createApiRouter preserves full state only for the local room host', async () => {
  const calls = [];
  const room = { code: 'ABCDE', hostPlayerId: 'host_1', version: 3 };
  const player = { id: 'host_1', userName: 'Teacher', version: 2 };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    state: { rooms: new Map([['ABCDE', room]]) },
    getRuntimeMeta: () => ({ deployment: 'local' }),
    resolvePlayerSession: () => ({ room, player }),
    requirePlayerSession: () => {},
    ensureAccount: () => ({ id: 'acct_1' }),
    accountSummary: () => ({ id: 'acct_1' }),
    roomSummary: (_room, _viewerId, options) => ({ summaryView: options.view }),
    playerSummary: () => ({ id: player.id, legacy: true }),
    playerStateSummary: (_room, resolvedPlayer, _viewerId, options) => ({
      id: resolvedPlayer.id,
      playerView: options.view,
    }),
  });

  assert.equal(await routeApiRequest(
    { method: 'GET', headers: { 'x-player-session': 'host-token' } },
    {},
    new URL('http://localhost/api/state?playerId=host_1&view=full')
  ), true);

  assert.equal(calls[0].payload.room.summaryView, 'full');
  assert.equal(calls[0].payload.stateContract, 'full-state-v1');
  assert.equal(calls[0].payload.player.playerView, 'full');
});

test('createApiRouter does not accept player session tokens from the state URL', async () => {
  const room = { code: 'ABCDE', version: 1 };
  const player = { id: 'p_1', userName: 'BizPlayer', version: 1 };
  const routeApiRequest = createApiRouter({
    sendJson: () => { throw new Error('state request must not succeed with a URL token'); },
    state: { rooms: new Map([['ABCDE', room]]) },
    resolvePlayerSession: token => {
      assert.equal(token, '');
      throw Object.assign(new Error('missing player session'), { status: 403 });
    },
  });

  await assert.rejects(
    () => routeApiRequest(
      { method: 'GET', headers: {} },
      {},
      new URL('http://localhost/api/state?playerId=p_1&sessionToken=token_1&view=student')
    ),
    error => error.status === 403
  );
});

test('createApiRouter issues websocket tickets only after header authentication', async () => {
  const calls = [];
  const issued = [];
  const room = { code: 'ABCDE' };
  const player = { id: 'p_1', sessionToken: 'player-token' };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async req => req.body || {},
    state: { rooms: new Map([['ABCDE', room]]) },
    resolvePlayerSession: (token, playerId) => {
      assert.equal(token, 'player-token');
      assert.equal(playerId, 'p_1');
      return { room, player };
    },
    requirePlayerSession: (resolvedPlayer, token) => {
      assert.equal(resolvedPlayer, player);
      assert.equal(token, 'player-token');
    },
    resolveTeacherRequest: req => {
      assert.equal(req.headers.authorization, 'Bearer teacher-token');
      return { account: { id: 'teacher_1' } };
    },
    issueRealtimeTicket: identity => {
      issued.push(identity);
      return `ticket-${issued.length}`;
    },
  });

  assert.equal(await routeApiRequest(
    { method: 'POST', headers: { 'x-player-session': 'player-token' }, body: { playerId: 'p_1' } },
    {},
    new URL('http://localhost/api/realtime/ticket')
  ), true);
  assert.equal(await routeApiRequest(
    { method: 'POST', headers: { authorization: 'Bearer teacher-token' }, body: {} },
    {},
    new URL('http://localhost/api/realtime/ticket')
  ), true);

  assert.deepEqual(issued, [
    { roomCode: 'ABCDE', playerId: 'p_1' },
    { teacherAccountId: 'teacher_1' },
  ]);
  assert.deepEqual(calls, [
    { status: 201, payload: { ticket: 'ticket-1' } },
    { status: 201, payload: { ticket: 'ticket-2' } },
  ]);
});

test('createApiRouter dispatches action requests through room and player lookup', async () => {
  const calls = [];
  const room = { code: 'ABCDE' };
  const player = { id: 'p_1', sessionToken: 'token_1' };
  const routeApiRequest = createApiRouter({
    sendJson: (_res, status, payload) => calls.push({ status, payload }),
    parseBody: async () => ({ playerId: 'p_1', sessionToken: 'token_1', action: 'buy-raw', value: 20 }),
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
    requirePlayerSession: (resolvedPlayer, token) => {
      assert.equal(resolvedPlayer, player);
      assert.equal(token, 'token_1');
    },
    handleRoomAction: (resolvedRoom, resolvedPlayer, body) => calls.push({ resolvedRoom, resolvedPlayer, body }),
    serveStatic: () => { throw new Error('not needed'); },
  });

  const handled = await routeApiRequest({ method: 'POST', headers: {} }, {}, new URL('http://localhost/api/action'));

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    { resolvedRoom: room, resolvedPlayer: player, body: { playerId: 'p_1', sessionToken: 'token_1', action: 'buy-raw', value: 20 } },
    { status: 200, payload: { ok: true } },
  ]);
});

test('createApiRouter rejects action requests with an invalid player session token', async () => {
  const room = { code: 'ABCDE' };
  const player = { id: 'p_1', sessionToken: 'token_1' };
  const routeApiRequest = createApiRouter({
    sendJson: () => { throw new Error('sendJson should not be called after auth failure'); },
    parseBody: async () => ({ playerId: 'p_1', sessionToken: 'wrong', action: 'buy-raw', value: 20 }),
    state: { rooms: new Map() },
    getRoomByPlayerId: () => room,
    getPlayer: () => player,
    ensureAccount: () => { throw new Error('not needed'); },
    accountSummary: () => { throw new Error('not needed'); },
    getRuntimeMeta: () => ({ version: '0.1.0' }),
    createRoom: () => { throw new Error('not needed'); },
    joinRoom: () => { throw new Error('not needed'); },
    roomSummary: () => { throw new Error('not needed'); },
    playerSummary: () => { throw new Error('not needed'); },
    requirePlayerSession: () => {
      throw Object.assign(new Error('Сессия игрока не подтверждена. Войдите в комнату заново.'), { status: 403 });
    },
    handleRoomAction: () => { throw new Error('action should not run without auth'); },
    serveStatic: () => { throw new Error('not needed'); },
  });

  await assert.rejects(
    () => routeApiRequest({ method: 'POST', headers: {} }, {}, new URL('http://localhost/api/action')),
    /Сессия игрока не подтверждена/
  );
});
