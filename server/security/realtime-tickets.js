const crypto = require('crypto');

function createRealtimeTicketStore(options = {}) {
  const ttlMs = Math.max(1_000, Number(options.ttlMs || 15_000));
  const maxTickets = Math.max(1, Number(options.maxTickets || 2_048) || 2_048);
  const maxTicketsPerIdentity = Math.max(1, Number(options.maxTicketsPerIdentity || 4) || 4);
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const tickets = new Map();

  function pruneExpired() {
    const currentTime = now();
    tickets.forEach((entry, ticket) => {
      if (entry.expiresAt <= currentTime) tickets.delete(ticket);
    });
  }

  function normalizeIdentity(identity = {}) {
    const teacherAccountId = String(identity.teacherAccountId || '').trim();
    const roomCode = String(identity.roomCode || '').trim();
    const playerId = String(identity.playerId || '').trim();
    const isTeacher = Boolean(teacherAccountId && !roomCode && !playerId);
    const isPlayer = Boolean(!teacherAccountId && roomCode && playerId);
    if (!isTeacher && !isPlayer) {
      throw Object.assign(new Error('Realtime ticket requires one scoped identity.'), { status: 400 });
    }
    return isTeacher ? { teacherAccountId } : { roomCode, playerId };
  }

  function identityKey(identity) {
    return identity.teacherAccountId
      ? `teacher:${identity.teacherAccountId}`
      : `player:${identity.roomCode}:${identity.playerId}`;
  }

  function issue(identity) {
    pruneExpired();
    const normalizedIdentity = normalizeIdentity(identity);
    const scopedKey = identityKey(normalizedIdentity);
    const scopedTicketCount = [...tickets.values()]
      .filter(entry => entry.identityKey === scopedKey)
      .length;
    if (scopedTicketCount >= maxTicketsPerIdentity) {
      throw Object.assign(new Error('Too many active realtime tickets for this identity.'), { status: 429 });
    }
    if (tickets.size >= maxTickets) {
      throw Object.assign(new Error('Realtime ticket capacity is temporarily exhausted.'), { status: 503 });
    }
    const ticket = crypto.randomBytes(24).toString('base64url');
    tickets.set(ticket, {
      identity: normalizedIdentity,
      identityKey: scopedKey,
      expiresAt: now() + ttlMs,
    });
    return ticket;
  }

  function consume(rawTicket) {
    pruneExpired();
    const ticket = String(rawTicket || '').trim();
    const entry = tickets.get(ticket);
    if (!entry) {
      throw Object.assign(new Error('Realtime ticket is invalid or expired.'), { status: 403 });
    }
    tickets.delete(ticket);
    return { ...entry.identity };
  }

  return { issue, consume, size: () => tickets.size };
}

module.exports = { createRealtimeTicketStore };
