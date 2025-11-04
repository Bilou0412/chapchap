const SessionManager = require('../src/sessionManager');

describe('SessionManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createIoMock = () => {
    const emit = jest.fn();
    const io = {
      to: jest.fn().mockReturnValue({ emit })
    };
    return { io, emit };
  };

  test('creates a session and counts clicks while running', () => {
    const { io, emit } = createIoMock();
    const manager = new SessionManager({ durationMs: 1000, tickMs: 100, io });

    const session = manager.createSession();
    expect(session.status).toBe('running');

    const clickResult = manager.registerClick(session.sessionId);
    expect(clickResult.success).toBe(true);

    const stored = manager.sessions.get(session.sessionId);
    expect(stored.clicks).toBe(1);
    expect(emit).toHaveBeenCalledWith('session:update', expect.objectContaining({
      sessionId: session.sessionId,
      clicks: 1
    }));

    manager.shutdown();
  });

  test('stops counting once the session finishes', () => {
    const { io } = createIoMock();
    const manager = new SessionManager({ durationMs: 1000, tickMs: 100, io });

    const session = manager.createSession();

    jest.advanceTimersByTime(1100);

    const stored = manager.sessions.get(session.sessionId);
    expect(stored.status).toBe('finished');

    const clickResult = manager.registerClick(session.sessionId);
    expect(clickResult.success).toBe(false);
    expect(clickResult.reason).toMatch(/finished/);

    const result = manager.getResult(session.sessionId);
    expect(result).not.toBeNull();
    expect(result.status).toBe('finished');
    expect(result.remainingMs).toBe(0);

    manager.shutdown();
  });
});
