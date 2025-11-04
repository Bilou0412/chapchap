const { SessionManager, SESSION_DURATION_MS } = require('../src/sessionManager');

describe('SessionManager', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('creates session with default duration and counts clicks', () => {
    const manager = new SessionManager();
    const session = manager.createSession();
    expect(session.durationMs).toBe(SESSION_DURATION_MS);

    const result = manager.recordClick(session.id);
    expect(result.success).toBe(true);
    expect(result.session.clicks).toBe(1);
  });

  it('stops counting clicks after duration', () => {
    const manager = new SessionManager({ tickIntervalMs: 100 });
    const session = manager.createSession(500);

    expect(manager.recordClick(session.id).success).toBe(true);

    jest.advanceTimersByTime(600);

    const result = manager.recordClick(session.id);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('FINISHED');
  });

  it('emits update events on click and finish', () => {
    const manager = new SessionManager({ tickIntervalMs: 100 });
    const session = manager.createSession(300);
    const updates = [];
    const finishes = [];

    manager.on('sessionUpdate', (payload) => {
      updates.push(payload);
    });

    manager.on('sessionFinished', (payload) => {
      finishes.push(payload);
    });

    manager.recordClick(session.id);
    jest.advanceTimersByTime(400);

    expect(updates.some((u) => u.clicks === 1)).toBe(true);
    expect(finishes.length).toBe(1);
  });
});
