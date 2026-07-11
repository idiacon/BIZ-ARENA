const test = require('node:test');
const assert = require('node:assert/strict');

const { createRealtimeTicketStore } = require('../server/security/realtime-tickets');

test('realtime ticket is single-use and carries only scoped identity', () => {
  const store = createRealtimeTicketStore({ ttlMs: 15_000 });
  const ticket = store.issue({ roomCode: 'ABCDE', playerId: 'player_1' });

  assert.match(ticket, /^[a-zA-Z0-9_-]{24,}$/);
  assert.deepEqual(store.consume(ticket), { roomCode: 'ABCDE', playerId: 'player_1' });
  assert.throws(() => store.consume(ticket), error => error.status === 403);
});

test('realtime ticket expires before it can authenticate a websocket', () => {
  let now = 1_000;
  const store = createRealtimeTicketStore({ ttlMs: 5_000, now: () => now });
  const ticket = store.issue({ teacherAccountId: 'teacher_1' });

  now += 5_001;
  assert.throws(() => store.consume(ticket), error => error.status === 403);
});

test('realtime ticket rejects mixed or incomplete identities', () => {
  const store = createRealtimeTicketStore();

  assert.throws(() => store.issue({}), /identity/i);
  assert.throws(
    () => store.issue({ teacherAccountId: 'teacher_1', roomCode: 'ABCDE', playerId: 'player_1' }),
    /identity/i
  );
  assert.throws(() => store.issue({ roomCode: 'ABCDE' }), /identity/i);
});

test('realtime ticket store bounds global and per-identity pending tickets', () => {
  const store = createRealtimeTicketStore({ maxTickets: 3, maxTicketsPerIdentity: 2 });

  store.issue({ roomCode: 'ABCDE', playerId: 'player_1' });
  store.issue({ roomCode: 'ABCDE', playerId: 'player_1' });
  assert.throws(
    () => store.issue({ roomCode: 'ABCDE', playerId: 'player_1' }),
    error => error.status === 429
  );

  store.issue({ roomCode: 'ABCDE', playerId: 'player_2' });
  assert.equal(store.size(), 3);
  assert.throws(
    () => store.issue({ teacherAccountId: 'teacher_1' }),
    error => error.status === 503
  );
});
