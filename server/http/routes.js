const { forwardedClientAddress } = require('./client-address');

function createApiRouter({
  sendJson,
  parseBody,
  state,
  getRoomByPlayerId,
  getPlayer,
  ensureAccount,
  accountSummary,
  getRuntimeMeta,
  getRuntimeHealth,
  serverOverview,
  createRoom,
  joinRoom,
  roomSummary,
  playerSummary,
  playerStateSummary,
  handleRoomAction,
  handleServerAdminAction,
  requirePlayerSession,
  resolvePlayerSession,
  verifyClientActionEnvelope,
  registerTeacher,
  loginTeacher,
  teacherSummary,
  teacherOverview,
  resolveTeacherRequest,
  handleTeacherAction,
  listCompletedSessions,
  getCompletedSession,
  completedSessionCsv,
  issueRealtimeTicket,
  onRoomMutation,
  createQrSvg,
  checkNetworkHealthUrl,
  serveStatic,
}) {
  const teacherAuthAttempts = new Map();

  function isLocalRequest(req) {
    const address = String(req.socket?.remoteAddress || '');
    return address === '127.0.0.1'
      || address === '::1'
      || address === '::ffff:127.0.0.1'
      || address === '';
  }

  function isCloudDeployment() {
    return getRuntimeMeta?.()?.deployment === 'cloud';
  }

  function isLocalAdminRequest(req) {
    return !isCloudDeployment() && isLocalRequest(req);
  }

  function enforceTeacherAuthRateLimit(req) {
    const key = forwardedClientAddress(req);
    const now = Date.now();
    const recent = (teacherAuthAttempts.get(key) || []).filter(timestamp => now - timestamp < 60_000);
    if (recent.length >= 10) {
      throw Object.assign(new Error('Слишком много попыток входа. Повторите через минуту.'), { status: 429 });
    }
    recent.push(now);
    teacherAuthAttempts.set(key, recent);
  }

  function hasTeacherAuthHeader(req) {
    const authorization = String(req.headers?.authorization || '');
    return authorization.toLowerCase().startsWith('bearer ')
      || Boolean(String(req.headers?.['x-teacher-session'] || '').trim());
  }

  function resolvePlayerStateView(room, player, requestedView) {
    if (requestedView === 'student') return 'student';
    if (isCloudDeployment()) return 'student';
    if (room?.hostPlayerId !== player?.id) return 'student';
    return requestedView === 'teacher' ? 'teacher' : 'full';
  }

  function buildPlayerState(room, player, viewerId, view) {
    const summaryBuilder = playerStateSummary || playerSummary;
    return summaryBuilder(room, player, viewerId, { view });
  }

  function sessionPage(url, sessions) {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20) || 20));
    const offset = Math.max(0, Number(url.searchParams.get('cursor') || 0) || 0);
    const items = sessions.slice(offset, offset + limit);
    return {
      items,
      nextCursor: offset + items.length < sessions.length ? String(offset + items.length) : null,
      total: sessions.length,
    };
  }

  function sendSessionExport(res, session, format) {
    if (format === 'csv') {
      const filename = `biz-arena-${session.roomCode}-${session.id}.csv`;
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(completedSessionCsv(session));
      return;
    }
    sendJson(res, 200, { session });
  }

  return async function routeApiRequest(req, res, url) {
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const playerId = url.searchParams.get('playerId');
      const sessionToken = req.headers['x-player-session'] || '';
      const requestedView = url.searchParams.get('view') || '';
      const sinceRoomVersion = Number(url.searchParams.get('sinceRoomVersion') || 0);
      const sincePlayerVersion = Number(url.searchParams.get('sincePlayerVersion') || 0);
      if (!playerId) {
        sendJson(res, 200, {
          room: null,
          player: null,
          account: null,
          rooms: isCloudDeployment()
            ? []
            : [...state.rooms.values()].map(room => ({ code: room.code, name: room.name, status: room.status, players: room.players.size })),
        });
        return true;
      }
      const resolved = resolvePlayerSession
        ? resolvePlayerSession(sessionToken, playerId)
        : { room: getRoomByPlayerId(playerId), player: getPlayer(getRoomByPlayerId(playerId), playerId) };
      const room = resolved.room;
      const player = resolved.player;
      requirePlayerSession(player, sessionToken);
      const view = resolvePlayerStateView(room, player, requestedView);
      const roomVersion = Math.max(1, Number(room.version) || 1);
      const playerVersion = Math.max(1, Number(player.version) || 1);
      if (
        sinceRoomVersion
        && sincePlayerVersion
        && roomVersion === sinceRoomVersion
        && playerVersion === sincePlayerVersion
      ) {
        sendJson(res, 200, {
          unchanged: true,
          roomVersion,
          playerVersion,
        });
        return true;
      }
      const account = ensureAccount(player.userName);
      const playerPayload = buildPlayerState(room, player, player.id, view);
      sendJson(res, 200, {
        stateContract: view === 'student' ? 'student-state-v2' : 'full-state-v1',
        room: roomSummary(room, player.id, { view }),
        player: playerPayload,
        account: accountSummary(account),
        roomVersion,
        playerVersion,
      });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      sendJson(res, 200, { meta: getRuntimeMeta() });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, getRuntimeHealth ? getRuntimeHealth() : { ok: true, meta: getRuntimeMeta() });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/realtime/ticket') {
      if (!issueRealtimeTicket) {
        sendJson(res, 404, { error: 'Realtime tickets are not available' });
        return true;
      }
      const body = await parseBody(req);
      if (hasTeacherAuthHeader(req)) {
        const payload = resolveTeacherRequest(req, url);
        sendJson(res, 201, { ticket: issueRealtimeTicket({ teacherAccountId: payload.account.id }) });
        return true;
      }
      const sessionToken = req.headers?.['x-player-session'] || '';
      const resolved = resolvePlayerSession(sessionToken, body.playerId || '');
      requirePlayerSession(resolved.player, sessionToken);
      sendJson(res, 201, {
        ticket: issueRealtimeTicket({ roomCode: resolved.room.code, playerId: resolved.player.id }),
      });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/qr') {
      if (!createQrSvg) {
        sendJson(res, 404, { error: 'QR generation is not available' });
        return true;
      }
      const svg = await createQrSvg(url.searchParams.get('data') || '');
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(svg);
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/network/check') {
      if (!isLocalAdminRequest(req)) {
        sendJson(res, 403, { error: 'Network diagnostics are available only on the host computer.' });
        return true;
      }
      if (!checkNetworkHealthUrl) {
        sendJson(res, 404, { error: 'Network diagnostics are not available' });
        return true;
      }
      const result = await checkNetworkHealthUrl(url.searchParams.get('url') || '');
      sendJson(res, result.ok ? 200 : 502, { result });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/server/overview') {
      if (!isLocalAdminRequest(req)) {
        sendJson(res, 403, { error: 'Server overview is available only on the host computer.' });
        return true;
      }
      sendJson(res, 200, { overview: serverOverview() });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/server/action') {
      if (!isLocalAdminRequest(req)) {
        sendJson(res, 403, { error: 'Server admin actions are available only on the host computer.' });
        return true;
      }
      const body = await parseBody(req);
      const result = handleServerAdminAction(body);
      if (onRoomMutation && result?.roomCode) onRoomMutation(state.rooms.get(result.roomCode), { source: 'server-admin', action: result.action });
      sendJson(res, 200, { ok: true, result });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/teacher/register') {
      if (!registerTeacher) {
        sendJson(res, 404, { error: 'Teacher registration is not available' });
        return true;
      }
      enforceTeacherAuthRateLimit(req);
      const body = await parseBody(req);
      const payload = registerTeacher(body);
      sendJson(res, 201, {
        teacher: teacherSummary(payload.account),
        teacherSessionToken: payload.sessionToken,
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/teacher/login') {
      if (!loginTeacher) {
        sendJson(res, 404, { error: 'Teacher login is not available' });
        return true;
      }
      enforceTeacherAuthRateLimit(req);
      const body = await parseBody(req);
      const payload = loginTeacher(body);
      sendJson(res, 200, {
        teacher: teacherSummary(payload.account),
        teacherSessionToken: payload.sessionToken,
      });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/teacher/me') {
      const payload = resolveTeacherRequest(req, url);
      sendJson(res, 200, { teacher: teacherSummary(payload.account) });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/teacher/overview') {
      const payload = resolveTeacherRequest(req, url);
      sendJson(res, 200, { overview: teacherOverview(payload.account) });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/teacher/sessions') {
      const payload = resolveTeacherRequest(req, url);
      sendJson(res, 200, sessionPage(url, listCompletedSessions({ teacherAccountId: payload.account.id })));
      return true;
    }

    const teacherSessionMatch = url.pathname.match(/^\/api\/teacher\/sessions\/([^/]+?)(\/export)?$/);
    if (req.method === 'GET' && teacherSessionMatch) {
      const payload = resolveTeacherRequest(req, url);
      const session = getCompletedSession(decodeURIComponent(teacherSessionMatch[1]), { teacherAccountId: payload.account.id });
      if (teacherSessionMatch[2]) sendSessionExport(res, session, url.searchParams.get('format') || 'json');
      else sendJson(res, 200, { session });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/server/sessions') {
      if (!isLocalAdminRequest(req)) {
        sendJson(res, 403, { error: 'Local server session history is available only on the host computer.' });
        return true;
      }
      sendJson(res, 200, sessionPage(url, listCompletedSessions({ teacherAccountId: '' })));
      return true;
    }

    const serverSessionMatch = url.pathname.match(/^\/api\/server\/sessions\/([^/]+?)(\/export)?$/);
    if (req.method === 'GET' && serverSessionMatch) {
      if (!isLocalAdminRequest(req)) {
        sendJson(res, 403, { error: 'Local server session history is available only on the host computer.' });
        return true;
      }
      const session = getCompletedSession(decodeURIComponent(serverSessionMatch[1]), { teacherAccountId: '' });
      if (serverSessionMatch[2]) sendSessionExport(res, session, url.searchParams.get('format') || 'json');
      else sendJson(res, 200, { session });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/teacher/action') {
      const payload = resolveTeacherRequest(req, url);
      const body = await parseBody(req);
      const result = handleTeacherAction(payload.account, body);
      if (onRoomMutation && result?.roomCode) onRoomMutation(state.rooms.get(result.roomCode), { source: 'teacher', action: result.action });
      sendJson(res, 200, { ok: true, result });
      return true;
    }

    if (req.method === 'GET' && url.pathname === '/api/account') {
      if (isCloudDeployment()) {
        sendJson(res, 404, { error: 'Not found' });
        return true;
      }
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
      if (isCloudDeployment()) {
        sendJson(res, 403, { error: 'Cloud rooms must be created through the authenticated teacher API.' });
        return true;
      }
      const body = await parseBody(req);
      const payload = createRoom(body);
      if (onRoomMutation) onRoomMutation(payload.room, { source: 'room-create' });
      sendJson(res, 201, {
        playerId: payload.player.id,
        sessionToken: payload.player.sessionToken,
        roomCode: payload.room.code,
        stateContract: 'full-state-v1',
        room: roomSummary(payload.room, payload.player.id),
        player: buildPlayerState(payload.room, payload.player, payload.player.id, 'full'),
        account: accountSummary(ensureAccount(payload.player.userName)),
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/rooms/join') {
      const body = await parseBody(req);
      const payload = joinRoom(body);
      if (onRoomMutation) onRoomMutation(payload.room, { source: 'room-join' });
      sendJson(res, 201, {
        playerId: payload.player.id,
        sessionToken: payload.player.sessionToken,
        roomCode: payload.room.code,
        stateContract: 'student-state-v2',
        room: roomSummary(payload.room, payload.player.id, { view: 'student' }),
        player: buildPlayerState(payload.room, payload.player, payload.player.id, 'student'),
        account: accountSummary(ensureAccount(payload.player.userName)),
      });
      return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/action') {
      const body = await parseBody(req);
      const sessionToken = body.sessionToken || req.headers['x-player-session'] || '';
      const resolved = resolvePlayerSession
        ? resolvePlayerSession(sessionToken, body.playerId || '')
        : { room: getRoomByPlayerId(body.playerId), player: getPlayer(getRoomByPlayerId(body.playerId), body.playerId) };
      const room = resolved.room;
      const player = resolved.player;
      requirePlayerSession(player, sessionToken);
      const safeBody = verifyClientActionEnvelope
        ? verifyClientActionEnvelope(room, player, body, req)
        : body;
      handleRoomAction(room, player, safeBody);
      if (onRoomMutation) onRoomMutation(room, { source: 'player-action', action: safeBody.action, player });
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
