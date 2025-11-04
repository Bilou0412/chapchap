const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor({ durationMs = 60000, tickMs = 1000, io = null } = {}) {
    this.durationMs = durationMs;
    this.tickMs = tickMs;
    this.io = io;
    this.sessions = new Map();
    this.history = [];
  }

  setIo(io) {
    this.io = io;
  }

  createSession() {
    const id = uuidv4();
    const startTime = Date.now();
    const endTime = startTime + this.durationMs;

    const session = {
      id,
      clicks: 0,
      startTime,
      endTime,
      status: 'running',
      timer: null,
      finishedAt: null
    };

    session.timer = setInterval(() => this.tick(id), this.tickMs);
    this.sessions.set(id, session);

    return this.serializeSession(session);
  }

  addClient(sessionId, socket) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      socket.emit('session:error', { message: 'Session not found' });
      return;
    }

    socket.join(sessionId);
    socket.emit('session:update', this.serializeSession(session));
  }

  registerClick(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, reason: 'Session not found' };
    }

    if (session.status !== 'running') {
      return { success: false, reason: 'Session finished' };
    }

    const now = Date.now();
    if (now >= session.endTime) {
      this.finishSession(session);
      return { success: false, reason: 'Session finished' };
    }

    session.clicks += 1;
    this.broadcastUpdate(session);
    return { success: true, clicks: session.clicks };
  }

  getResult(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      const historical = this.history.find((entry) => entry.id === sessionId);
      return historical ? this.serializeHistoryEntry(historical) : null;
    }

    if (session.status !== 'finished') {
      return null;
    }

    return this.serializeSession(session);
  }

  getHistory() {
    return this.history.map((entry) => this.serializeHistoryEntry(entry));
  }

  tick(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const remainingMs = Math.max(0, session.endTime - Date.now());
    if (remainingMs <= 0) {
      this.finishSession(session);
    }
    this.broadcastUpdate(session);
  }

  finishSession(session) {
    if (!session || session.status === 'finished') {
      return;
    }

    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }

    session.status = 'finished';
    session.finishedAt = Date.now();

    const serialized = this.serializeSession(session);

    if (this.io) {
      this.io.to(session.id).emit('session:update', serialized);
      this.io.to(session.id).emit('session:finished', serialized);
    }

    this.history.push({ ...session });
  }

  broadcastUpdate(session) {
    if (!session) {
      return;
    }

    if (this.io) {
      this.io
        .to(session.id)
        .emit('session:update', this.serializeSession(session));
    }
  }

  serializeSession(session) {
    const remainingMs = session.status === 'finished'
      ? 0
      : Math.max(0, session.endTime - Date.now());

    return {
      sessionId: session.id,
      clicks: session.clicks,
      status: session.status,
      remainingMs,
      durationMs: this.durationMs,
      startedAt: session.startTime,
      finishedAt: session.finishedAt
    };
  }

  serializeHistoryEntry(entry) {
    return {
      sessionId: entry.id,
      clicks: entry.clicks,
      startedAt: entry.startTime,
      finishedAt: entry.finishedAt
    };
  }

  shutdown() {
    for (const session of this.sessions.values()) {
      if (session.timer) {
        clearInterval(session.timer);
      }
    }
    this.sessions.clear();
  }
}

module.exports = SessionManager;
