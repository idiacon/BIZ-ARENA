function createRoomActionHandler({
  ensureLobby,
  ensureHost,
  canStartMatch,
  refreshContracts,
  ensureSeasonGoal,
  addRoomLog,
  resetRoom,
  addBot,
  saveRoomSnapshot,
  ensureLoadable,
  loadRoomSnapshot,
  removePlayer,
  updateRoomSettings,
  handleBusinessAction,
  advanceRoom,
  forceRoomEvent,
  setPhaseLock,
  runScenarioExperiment,
  finishRoom,
}) {
  const manualTurnMs = 30 * 60 * 1000;
  const pauseRequestTimeoutMs = 30 * 1000;
  const turnDurationMs = room => (
    (room.settings?.tickMode || 'manual') === 'manual'
      ? Number(room.settings?.turnDurationMs) || manualTurnMs
      : Number(room.settings?.tickIntervalMs) || 7000
  );

  return function handleRoomAction(room, player, body) {
    switch (body.action) {
      case 'request-pause': {
        if (player.isTeacherHost || player.isBot) {
          throw Object.assign(new Error('Only a student can request a pause.'), { status: 403 });
        }
        if (room.status !== 'running') {
          throw Object.assign(new Error('A pause can be requested only during an active turn.'), { status: 400 });
        }
        if (room.pauseRequest && ['pending', 'accepted'].includes(room.pauseRequest.status)) {
          throw Object.assign(new Error('The room already has an active pause request.'), { status: 409 });
        }
        const now = Date.now();
        room.pausedRemainingMs = room.nextTickAt
          ? Math.max(0, room.nextTickAt - now)
          : turnDurationMs(room);
        room.status = 'paused';
        room.nextTickAt = null;
        room.pauseRequest = {
          id: `pause_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          playerId: player.id,
          status: 'pending',
          requestedAt: now,
          expiresAt: now + pauseRequestTimeoutMs,
          acceptedAt: null,
          updatedAt: now,
        };
        player.lastAction = 'Requested a classroom pause.';
        addRoomLog(room, `${player.userName} requested a pause. The teacher has 30 seconds to accept it.`);
        return;
      }
      case 'accept-pause-request': {
        ensureHost(room, player.id);
        const request = room.pauseRequest;
        if (room.status !== 'paused' || !request || request.status !== 'pending') {
          throw Object.assign(new Error('No active pause request can be accepted.'), { status: 404 });
        }
        const now = Date.now();
        if (Number(request.expiresAt) <= now) {
          throw Object.assign(new Error('The pause request has already expired.'), { status: 409 });
        }
        request.status = 'accepted';
        request.acceptedAt = now;
        request.updatedAt = now;
        const requester = room.players.get(request.playerId);
        addRoomLog(room, `${player.userName} accepted the pause request from ${requester?.userName || 'a student'}.`);
        return;
      }
      case 'request-teacher-help': {
        if (player.isTeacherHost || player.isBot) {
          throw Object.assign(new Error('Запрос помощи доступен только ученику.'), { status: 403 });
        }
        if (room.status === 'finished') {
          throw Object.assign(new Error('Матч уже завершен.'), { status: 400 });
        }
        const payload = body.value && typeof body.value === 'object' ? body.value : body;
        const allowedCategories = new Set(['purchase', 'staff', 'assembly', 'sale', 'turn', 'other']);
        const category = allowedCategories.has(payload.category) ? payload.category : 'other';
        const message = String(payload.message || '').replace(/[<>&"']/g, '').trim().slice(0, 160);
        room.helpRequests = Array.isArray(room.helpRequests) ? room.helpRequests : [];
        const activeRequest = room.helpRequests.find(request => (
          request.playerId === player.id && ['open', 'acknowledged'].includes(request.status)
        ));
        if (activeRequest) {
          throw Object.assign(new Error('У вас уже есть активный запрос преподавателю.'), { status: 409 });
        }
        const now = new Date().toISOString();
        room.helpRequests.push({
          id: `help_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          playerId: player.id,
          category,
          message,
          status: 'open',
          createdAt: now,
          updatedAt: now,
          acknowledgedAt: null,
          resolvedAt: null,
        });
        room.helpRequests = room.helpRequests.slice(-120);
        player.lastAction = 'Запрошена помощь преподавателя';
        addRoomLog(room, `${player.userName} попросил помощи преподавателя.`);
        return;
      }
      case 'cancel-teacher-help': {
        room.helpRequests = Array.isArray(room.helpRequests) ? room.helpRequests : [];
        const request = room.helpRequests.find(item => (
          item.playerId === player.id && ['open', 'acknowledged'].includes(item.status)
        ));
        if (!request) throw Object.assign(new Error('Активный запрос помощи не найден.'), { status: 404 });
        request.status = 'cancelled';
        request.updatedAt = new Date().toISOString();
        addRoomLog(room, `${player.userName} отменил запрос помощи.`);
        return;
      }
      case 'acknowledge-help-request':
      case 'resolve-help-request': {
        ensureHost(room, player.id);
        room.helpRequests = Array.isArray(room.helpRequests) ? room.helpRequests : [];
        const payload = body.value && typeof body.value === 'object' ? body.value : body;
        const requestId = String(payload.requestId || body.value || '');
        const request = room.helpRequests.find(item => item.id === requestId);
        if (!request) throw Object.assign(new Error('Запрос помощи не найден.'), { status: 404 });
        const now = new Date().toISOString();
        if (body.action === 'acknowledge-help-request') {
          if (request.status !== 'open') throw Object.assign(new Error('Запрос уже обработан.'), { status: 409 });
          request.status = 'acknowledged';
          request.acknowledgedAt = now;
        } else {
          if (!['open', 'acknowledged'].includes(request.status)) throw Object.assign(new Error('Запрос уже закрыт.'), { status: 409 });
          request.status = 'resolved';
          request.resolvedAt = now;
        }
        request.updatedAt = now;
        const requester = room.players.get(request.playerId);
        addRoomLog(room, `Преподаватель ${body.action === 'acknowledge-help-request' ? 'принял' : 'закрыл'} запрос ${requester?.userName || 'ученика'}.`);
        return;
      }
      case 'toggle-ready':
        ensureLobby(room);
        player.ready = !player.ready;
        player.lastAction = player.ready ? 'Игрок готов к старту' : 'Игрок снял готовность';
        addRoomLog(room, `${player.userName} ${player.ready ? 'готов к матчу' : 'снял готовность'}.`);
        return;
      case 'update-room-settings':
        ensureHost(room, player.id);
        ensureLobby(room);
        updateRoomSettings(room, body);
        addRoomLog(room, `${player.userName} обновил настройки комнаты.`);
        return;
      case 'start-game':
        ensureHost(room, player.id);
        ensureLobby(room);
        if (!canStartMatch(room)) {
          throw Object.assign(new Error('Все игроки должны отметить готовность перед стартом'), { status: 400 });
        }
        const startDurationMs = turnDurationMs(room);
        room.status = 'running';
        room.turnStartedAt = Date.now();
        room.nextTickAt = Date.now() + startDurationMs;
        room.pausedRemainingMs = null;
        room.winnerPlayerId = null;
        room.finishReason = null;
        room.startedAt = new Date().toISOString();
        room.finishedAt = null;
        room.completedSessionId = '';
        refreshContracts(room, true);
        room.players.forEach(entry => ensureSeasonGoal(entry));
        addRoomLog(room, `${player.userName} запустил матч.`);
        return;
      case 'pause-game':
        ensureHost(room, player.id);
        if (room.status !== 'running') {
          throw Object.assign(new Error('Поставить матч на паузу можно только во время игры.'), { status: 400 });
        }
        room.pausedRemainingMs = room.nextTickAt
          ? Math.max(0, room.nextTickAt - Date.now())
          : turnDurationMs(room);
        room.status = 'paused';
        room.nextTickAt = null;
        room.pauseRequest = null;
        addRoomLog(room, `${player.userName} поставил матч на паузу.`);
        return;
      case 'resume-game':
        if (room.status !== 'paused') {
          throw Object.assign(new Error('Продолжить можно только матч, который стоит на паузе.'), { status: 400 });
        }
        if (room.pauseRequest?.status === 'pending') {
          throw Object.assign(new Error('Wait for the teacher to decide on the pause request.'), { status: 409 });
        }
        if (room.hostPlayerId !== player.id && !(room.pauseRequest?.status === 'accepted' && room.pauseRequest.playerId === player.id)) {
          throw Object.assign(new Error('Only the teacher or the student with an accepted pause request can resume the match.'), { status: 403 });
        }
        const resumeDurationMs = turnDurationMs(room);
        const remainingMs = Math.max(1000, Math.min(resumeDurationMs, Number(room.pausedRemainingMs) || resumeDurationMs));
        const resumedManualTurn = (room.settings?.tickMode || 'manual') === 'manual';
        room.status = 'running';
        room.turnStartedAt = Date.now() - (resumeDurationMs - remainingMs);
        room.nextTickAt = Date.now() + remainingMs;
        room.pausedRemainingMs = null;
        room.pauseRequest = null;
        if (resumedManualTurn && room.teacherState) {
          room.teacherState.phaseLock = 'open';
          room.teacherState.updatedAt = Date.now();
          room.teacherState.actorPlayerId = player.id;
        }
        addRoomLog(room, `${player.userName} снял матч с паузы.`);
        return;
      case 'next-turn':
        ensureHost(room, player.id);
        if (room.status !== 'running') {
          throw Object.assign(new Error('Следующий ход доступен только во время матча.'), { status: 400 });
        }
        if ((room.settings?.tickMode || 'manual') === 'manual' && (room.teacherState?.phaseLock || 'open') !== 'open') {
          throw Object.assign(new Error('Сначала откройте фазу решений для следующего хода.'), { status: 400 });
        }
        advanceRoom(room);
        if (room.status === 'running') {
          const nextDurationMs = turnDurationMs(room);
          room.turnStartedAt = Date.now();
          room.nextTickAt = Date.now() + nextDurationMs;
          room.pausedRemainingMs = null;
        }
        return;
      case 'finish-room': {
        ensureHost(room, player.id);
        if (!['running', 'paused'].includes(room.status)) {
          throw Object.assign(new Error('Завершить можно только запущенный или приостановленный матч.'), { status: 400 });
        }
        if (!finishRoom) {
          throw Object.assign(new Error('Завершение матча не настроено.'), { status: 500 });
        }
        const winner = [...room.players.values()]
          .filter(entry => !entry.bankrupt)
          .sort((left, right) => (
            (right.simulationScore?.total || 0) - (left.simulationScore?.total || 0)
              || (right.netWorth || right.money || 0) - (left.netWorth || left.money || 0)
          ))[0] || null;
        finishRoom(room, winner, 'teacher_stopped');
        addRoomLog(room, `${player.userName} завершил матч из панели преподавателя.`);
        return;
      }
      case 'set-speed': {
        ensureHost(room, player.id);
        const presets = { slow: 10000, normal: 7000, fast: 4000 };
        const tickIntervalMs = presets[body.value] || room.settings.tickIntervalMs || 7000;
        room.settings.tickIntervalMs = tickIntervalMs;
        if (room.status === 'running') room.nextTickAt = Date.now() + room.settings.tickIntervalMs;
        addRoomLog(room, `${player.userName} изменил скорость матча на ${body.value || 'normal'}.`);
        return;
      }
      case 'set-phase-lock':
        ensureHost(room, player.id);
        setPhaseLock(room, player, body.value);
        return;
      case 'force-event':
        ensureHost(room, player.id);
        forceRoomEvent(room, player, body.value);
        return;
      case 'run-experiment':
        ensureHost(room, player.id);
        if (!runScenarioExperiment) {
          throw Object.assign(new Error('Experiment runner is not configured.'), { status: 500 });
        }
        runScenarioExperiment(room, player, body.value || {});
        return;
      case 'reset-room':
        ensureHost(room, player.id);
        resetRoom(room);
        addRoomLog(room, `${player.userName} сбросил матч.`);
        return;
      case 'add-bot':
        ensureHost(room, player.id);
        if (room.players.size >= room.settings.maxPlayers) {
          throw Object.assign(new Error('Комната заполнена'), { status: 400 });
        }
        addBot(room);
        return;
      case 'save-room':
        ensureHost(room, player.id);
        saveRoomSnapshot(room, player);
        addRoomLog(room, `${player.userName} сохранил комнату на день ${room.day}.`);
        return;
      case 'load-room': {
        ensureHost(room, player.id);
        ensureLoadable(room);
        const loadedRoom = loadRoomSnapshot(room);
        addRoomLog(loadedRoom, `${player.userName} загрузил последнее сохранение.`);
        return;
      }
      case 'leave-room':
        removePlayer(player.id);
        return;
      default:
        handleBusinessAction(room, player, body);
    }
  };
}

module.exports = {
  createRoomActionHandler,
};
