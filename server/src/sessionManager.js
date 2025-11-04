const { v4: uuid } = require('uuid');

const STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  FINISHED: 'finished',
};

class SessionManager {
  constructor(io, options = {}) {
    this.io = io;
    this.sessions = new Map();
    this.history = [];
    this.durationSeconds = options.durationSeconds || 60;
  }

  startSession() {
    const sessionId = uuid();
    const startedAt = Date.now();
    const endsAt = startedAt + this.durationSeconds * 1000;
    const session = {
      sessionId,
      clicks: 0,
      startedAt,
      endsAt,
      status: STATUS.RUNNING,
      timer: null,
      endedAt: null,
    };

    session.timer = setInterval(() => {
      this.tick(sessionId);
    }, 1000);

    this.sessions.set(sessionId, session);
    this.emitUpdate(sessionId);

    return this.serializeSession(session);
  }

  tick(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.status !== STATUS.RUNNING) {
      return;
    }

    const remainingSeconds = this.getRemainingSeconds(session);

    if (remainingSeconds <= 0) {
      this.finishSession(sessionId);
    } else {
      this.emitUpdate(sessionId);
    }
  }

  getRemainingSeconds(session) {
    const diff = Math.ceil((session.endsAt - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }

  emitUpdate(sessionId, targetSocket) {
    const snapshot = this.getSessionState(sessionId);
    if (!snapshot) return;

    if (targetSocket) {
      targetSocket.emit('sessionUpdate', snapshot);
    } else {
      this.io.to(sessionId).emit('sessionUpdate', snapshot);
    }
  }

  finishSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }

    if (session.status === STATUS.FINISHED) {
      return;
    }

    session.status = STATUS.FINISHED;
    session.endedAt = Date.now();
    const snapshot = this.serializeSession(session);
    this.history.unshift({
      sessionId: snapshot.sessionId,
      clicks: snapshot.clicks,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.endedAt,
    });
    this.history = this.history.slice(0, 50);

    this.io.to(sessionId).emit('sessionUpdate', snapshot);
  }

  registerClick(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.status !== STATUS.RUNNING) {
      return false;
    }

    if (this.getRemainingSeconds(session) <= 0) {
      this.finishSession(sessionId);
      return false;
    }

    session.clicks += 1;
    this.emitUpdate(sessionId);
    return true;
  }

  joinSession(sessionId, socket) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      socket.emit('sessionError', { message: 'Session not found' });
      return;
    }

    socket.join(sessionId);
    this.emitUpdate(sessionId, socket);
  }

  getSessionState(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return this.serializeSession(session);
  }

  getResult(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.status !== STATUS.FINISHED) return null;
    return this.serializeSession(session);
  }

  getRecentHistory() {
    return [...this.history];
  }

  serializeSession(session) {
    return {
      sessionId: session.sessionId,
      clicks: session.clicks,
      remainingSeconds: session.status === STATUS.FINISHED ? 0 : this.getRemainingSeconds(session),
      status: session.status,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      endedAt: session.endedAt,
    };
  }
}

module.exports = { SessionManager, STATUS };
