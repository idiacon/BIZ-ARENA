const crypto = require('crypto');

function createClassroomIdentity(options) {
  const {
    getRooms,
    getDb,
    persistRuntimeState,
    persistDbDebounced,
    isClassPlayer,
    isPlayerSessionParticipant = isClassPlayer,
    safeName,
    uid,
    allowRegistration = true,
    teacherSessionTtlMs,
  } = options;

  function createSessionToken() {
    return crypto.randomBytes(24).toString('base64url');
  }

  function ensurePlayerSessionToken(player) {
    if (!player || player.isBot) return '';
    if (!player.sessionToken) player.sessionToken = createSessionToken();
    return player.sessionToken;
  }

  function requirePlayerSession(player, providedToken) {
    const expected = ensurePlayerSessionToken(player);
    if (!expected || providedToken !== expected) {
      throw Object.assign(new Error('Сессия игрока не подтверждена. Войдите в комнату заново.'), { status: 403 });
    }
  }

  function ensurePlayerSecurityState(player) {
    if (!player) return null;
    if (!player.security || typeof player.security !== 'object') player.security = {};
    if (!Array.isArray(player.security.seenActionIds)) player.security.seenActionIds = [];
    if (!Array.isArray(player.security.actionTimestamps)) player.security.actionTimestamps = [];
    if (!Number.isFinite(Number(player.security.acceptedActionCount))) player.security.acceptedActionCount = 0;
    if (!Number.isFinite(Number(player.security.rejectedActionCount))) player.security.rejectedActionCount = 0;
    if (!Number.isFinite(Number(player.security.lastActionAt))) player.security.lastActionAt = 0;
    player.security.lastRejectReason = player.security.lastRejectReason || '';
    return player.security;
  }

  function resolvePlayerSession(providedToken, claimedPlayerId = '') {
    const token = String(providedToken || '').trim();
    if (!token) throw Object.assign(new Error('Сессия игрока не подтверждена. Войдите в комнату заново.'), { status: 403 });
    let resolved = null;
    getRooms().forEach(room => {
      room.players.forEach(player => {
        if (isPlayerSessionParticipant(player) && ensurePlayerSessionToken(player) === token) resolved = { room, player };
      });
    });
    if (!resolved) throw Object.assign(new Error('Сессия игрока не подтверждена. Войдите в комнату заново.'), { status: 403 });
    if (claimedPlayerId && String(claimedPlayerId) !== resolved.player.id) {
      const security = ensurePlayerSecurityState(resolved.player);
      security.rejectedActionCount += 1;
      security.lastRejectReason = 'playerId mismatch';
      throw Object.assign(new Error('Сессия не совпадает с игроком. Действие отклонено.'), { status: 403 });
    }
    return resolved;
  }

  function normalizeClientActionId(value) {
    const id = String(value || '').trim();
    if (!id) return '';
    return /^[a-zA-Z0-9._:-]{8,96}$/.test(id) ? id : '';
  }

  function verifyClientActionEnvelope(room, player, body, req = {}) {
    const security = ensurePlayerSecurityState(player);
    const actionId = normalizeClientActionId(body.actionId);
    const now = Date.now();
    security.actionTimestamps = security.actionTimestamps
      .map(value => Number(value || 0))
      .filter(value => now - value <= 2000);
    if (security.actionTimestamps.length >= 20) {
      security.rejectedActionCount += 1;
      security.lastRejectReason = 'rate limit';
      throw Object.assign(new Error('Слишком много действий подряд. Подождите секунду и повторите.'), { status: 429 });
    }
    if (actionId) {
      if (security.seenActionIds.includes(actionId)) {
        security.rejectedActionCount += 1;
        security.lastRejectReason = 'replay actionId';
        throw Object.assign(new Error('Повторное действие отклонено сервером.'), { status: 409 });
      }
      security.seenActionIds.push(actionId);
      if (security.seenActionIds.length > 80) security.seenActionIds.splice(0, security.seenActionIds.length - 80);
    }
    security.actionTimestamps.push(now);
    security.acceptedActionCount += 1;
    security.lastActionAt = now;
    security.lastRemoteAddress = String(req.socket?.remoteAddress || '');
    return { ...body, playerId: player.id, sessionToken: player.sessionToken, actionId };
  }

  function normalizeTeacherEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function teacherAccountKey(email) {
    return normalizeTeacherEmail(email).replace(/[^a-z0-9@._-]/g, '').slice(0, 120);
  }

  function hashTeacherPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
    const hash = crypto.scryptSync(String(password || ''), salt, 32).toString('base64url');
    return `scrypt$${salt}$${hash}`;
  }

  function verifyTeacherPassword(password, storedHash) {
    const [scheme, salt, hash] = String(storedHash || '').split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const candidate = crypto.scryptSync(String(password || ''), salt, 32);
    const expected = Buffer.from(hash, 'base64url');
    return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
  }

  function publicTeacherAccount(account) {
    if (!account) return null;
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt || null,
    };
  }

  function createTeacherAccount({ email, password, displayName }) {
    if (!allowRegistration) {
      throw Object.assign(new Error('Регистрация преподавателей отключена на этом сервере.'), { status: 403 });
    }
    const normalizedEmail = normalizeTeacherEmail(email);
    const key = teacherAccountKey(normalizedEmail);
    if (!key || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      throw Object.assign(new Error('Укажите корректный email преподавателя.'), { status: 400 });
    }
    if (String(password || '').length < 8) {
      throw Object.assign(new Error('Пароль преподавателя должен быть не короче 8 символов.'), { status: 400 });
    }
    const db = getDb();
    if (db.teacherAccounts[key]) {
      throw Object.assign(new Error('Преподаватель с таким email уже зарегистрирован.'), { status: 409 });
    }
    const account = {
      id: uid('teacher'),
      email: normalizedEmail,
      displayName: safeName(displayName || normalizedEmail.split('@')[0], 'Преподаватель'),
      passwordHash: hashTeacherPassword(password),
      createdAt: Date.now(),
      lastLoginAt: null,
    };
    db.teacherAccounts[key] = account;
    persistRuntimeState({ immediate: true });
    return account;
  }

  function createTeacherSession(account) {
    const token = createSessionToken();
    const now = Date.now();
    account.lastLoginAt = now;
    getDb().teacherSessions[token] = { token, accountId: account.id, createdAt: now, lastSeenAt: now };
    persistRuntimeState({ immediate: true });
    return token;
  }

  function loginTeacher({ email, password }) {
    const account = getDb().teacherAccounts[teacherAccountKey(email)];
    if (!account || !verifyTeacherPassword(password, account.passwordHash)) {
      throw Object.assign(new Error('Email или пароль преподавателя неверны.'), { status: 403 });
    }
    return { account, sessionToken: createTeacherSession(account) };
  }

  function teacherById(accountId) {
    return Object.values(getDb().teacherAccounts || {}).find(account => account.id === accountId) || null;
  }

  function resolveTeacherSessionToken(token) {
    const sessionToken = String(token || '').trim();
    const db = getDb();
    const session = db.teacherSessions?.[sessionToken];
    if (!session) throw Object.assign(new Error('Сессия преподавателя не подтверждена. Войдите заново.'), { status: 403 });
    const lastActivityAt = Math.max(Number(session.lastSeenAt || 0), Number(session.createdAt || 0));
    if (!lastActivityAt || Date.now() - lastActivityAt > teacherSessionTtlMs) {
      delete db.teacherSessions[sessionToken];
      persistRuntimeState({ immediate: true });
      throw Object.assign(new Error('Сессия преподавателя истекла. Войдите заново.'), { status: 401 });
    }
    const account = teacherById(session.accountId);
    if (!account) {
      delete db.teacherSessions[sessionToken];
      persistRuntimeState({ immediate: true });
      throw Object.assign(new Error('Аккаунт преподавателя не найден.'), { status: 403 });
    }
    session.lastSeenAt = Date.now();
    persistDbDebounced();
    return { account, sessionToken };
  }

  function teacherTokenFromRequest(req, url) {
    const header = String(req.headers?.authorization || '');
    if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
    return String(req.headers?.['x-teacher-session'] || '').trim();
  }

  function resolveTeacherRequest(req, url) {
    return resolveTeacherSessionToken(teacherTokenFromRequest(req, url));
  }

  return {
    player: {
      createSessionToken,
      ensureSessionToken: ensurePlayerSessionToken,
      requireSession: requirePlayerSession,
      ensureSecurityState: ensurePlayerSecurityState,
      resolveSession: resolvePlayerSession,
      verifyActionEnvelope: verifyClientActionEnvelope,
    },
    teacher: {
      publicAccount: publicTeacherAccount,
      createAccount: createTeacherAccount,
      createSession: createTeacherSession,
      login: loginTeacher,
      resolveSessionToken: resolveTeacherSessionToken,
      resolveRequest: resolveTeacherRequest,
    },
  };
}

module.exports = { createClassroomIdentity };
