function createApiRouter({
  sendJson,
  parseBody,
  state,
  getRoomByPlayerId,
  getPlayer,
  ensureAccount,
  accountSummary,
  getRuntimeMeta,
  createRoom,
  joinRoom,
  roomSummary,
  playerSummary,
  handleRoomAction,
  serveStatic,
}) {
  return async function routeApiRequest(req, res, url) {
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const playerId = url.searchParams.get('playerId');
      if (!playerId) {
        sendJson(res, 200, {
          room: null,
          player: null,
          account: null,
          rooms: [...state.rooms.values()].map(room => ({ code: room.code, name: room.name, status: room.status, players: room.players.size })),
        });
        return true;
      }
      const room = getRoomByPlayerId(playerId);
      const player = getPlayer(room, playerId);
      const account = ensureAccount(player.userName);
      sendJson(res, 200, { room: roomSummary(room, playerId), player: playerSummary(room, player, playerId), account: accountSummary(account) });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      sendJson(res, 200, { meta: getRuntimeMeta() });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/account') {
      const userName = url.searchParams.get('userName');
      if (!userName) {
        sendJson(res, 400, { error: 'userName is required' });
        return true;
      }
      const account = ensureAccount(userName);
      sendJson(res, 200, { account: accountSummary(account) });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/rooms/create') {
      const body = await parseBody(req);
      const payload = createRoom(body);
      sendJson(res, 201, {
        playerId: payload.player.id,
        roomCode: payload.room.code,
        room: roomSummary(payload.room, payload.player.id),
        player: playerSummary(payload.room, payload.player, payload.player.id),
        account: accountSummary(ensureAccount(payload.player.userName)),
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/rooms/join') {
      const body = await parseBody(req);
      const payload = joinRoom(body);
      sendJson(res, 201, {
        playerId: payload.player.id,
        roomCode: payload.room.code,
        room: roomSummary(payload.room, payload.player.id),
        player: playerSummary(payload.room, payload.player, payload.player.id),
        account: accountSummary(ensureAccount(payload.player.userName)),
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/action') {
      const body = await parseBody(req);
      const room = getRoomByPlayerId(body.playerId);
      const player = getPlayer(room, body.playerId);
      handleRoomAction(room, player, body);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === 'GET') {
      serveStatic(res, url.pathname);
      return true;
    }

    return false;
  };
}

module.exports = {
  createApiRouter,
};
