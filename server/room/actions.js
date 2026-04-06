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
}) {
  return function handleRoomAction(room, player, body) {
    switch (body.action) {
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
        if (!canStartMatch(room)) throw Object.assign(new Error('Все игроки должны отметить готовность перед стартом'), { status: 400 });
        room.status = 'running';
        room.winnerPlayerId = null;
        refreshContracts(room, true);
        room.players.forEach(entry => ensureSeasonGoal(entry));
        addRoomLog(room, `${player.userName} запустил матч.`);
        return;
      case 'pause-game':
        ensureHost(room, player.id);
        room.status = 'paused';
        addRoomLog(room, `${player.userName} поставил матч на паузу.`);
        return;
      case 'resume-game':
        ensureHost(room, player.id);
        room.status = 'running';
        addRoomLog(room, `${player.userName} снял матч с паузы.`);
        return;
      case 'reset-room':
        ensureHost(room, player.id);
        resetRoom(room);
        addRoomLog(room, `${player.userName} сбросил матч.`);
        return;
      case 'add-bot':
        ensureHost(room, player.id);
        if (room.players.size >= room.settings.maxPlayers) throw Object.assign(new Error('Комната заполнена'), { status: 400 });
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
