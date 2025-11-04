const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

const SESSION_DURATION_MS = 60 * 1000;

class SessionManager extends EventEmitter {
  constructor({ tickIntervalMs = 1000 } = {}) {
    super();
    this.sessions = new Map();
    this.tickIntervalMs = tickIntervalMs;
  }

  createSession(durationMs = SESSION_DURATION_MS) {
    const id = uuidv4();
    const startTime = Date.now();
    const endTime = startTime + durationMs;
    const session = {
      id,
      startTime,
      endTime,
      durationMs,
      clicks: 0,
      status: 'running',
      interval: null
    };

    session.interval = setInterval(() => {
      this.tick(id);
    }, this.tickIntervalMs);

    this.sessions.set(id, session);
    this.emit('sessionCreated', this.serialize(session));
    return this.serialize(session);
  }

  getSession(id) {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }
    return this.serialize(session);
  }

  tick(id) {
    const session = this.sessions.get(id);
    if (!session) return;

    const now = Date.now();
    if (session.status !== 'running') {
      this.emit('sessionUpdate', this.serialize(session));
      return;
    }

    if (now >= session.endTime) {
      session.status = 'finished';
      clearInterval(session.interval);
      session.remainingMs = 0;
      this.emit('sessionFinished', this.serialize(session));
    } else {
      session.remainingMs = session.endTime - now;
      this.emit('sessionUpdate', this.serialize(session));
    }
  }

  recordClick(id) {
    const session = this.sessions.get(id);
    if (!session) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    if (session.status !== 'running') {
      return { success: false, reason: 'FINISHED', session: this.serialize(session) };
    }

    const now = Date.now();
    if (now >= session.endTime) {
      session.status = 'finished';
      clearInterval(session.interval);
      session.remainingMs = 0;
      this.emit('sessionFinished', this.serialize(session));
      return { success: false, reason: 'FINISHED', session: this.serialize(session) };
    }

    session.clicks += 1;
    session.remainingMs = session.endTime - now;
    const serialized = this.serialize(session);
    this.emit('sessionUpdate', serialized);
    return { success: true, session: serialized };
  }

  serialize(session) {
    const now = Date.now();
    const remainingMs = Math.max(0, session.endTime - now);
    return {
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMs: session.durationMs,
      clicks: session.clicks,
      status: session.status,
      remainingMs: session.status === 'finished' ? 0 : remainingMs
    };
  }
}

module.exports = { SessionManager, SESSION_DURATION_MS };
