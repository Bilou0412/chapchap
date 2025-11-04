const { SessionManager, STATUS } = require('../src/sessionManager');

describe('SessionManager', () => {
  let io;
  beforeEach(() => {
    jest.useFakeTimers();
    io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const createManager = (durationSeconds = 5) => new SessionManager(io, { durationSeconds });

  it('creates a running session with the expected duration', () => {
    const manager = createManager();
    const session = manager.startSession();
    expect(session.status).toBe(STATUS.RUNNING);
    expect(session.remainingSeconds).toBe(5);
  });

  it('increments clicks for running sessions', () => {
    const manager = createManager();
    const session = manager.startSession();
    const accepted = manager.registerClick(session.sessionId);
    expect(accepted).toBe(true);
    const snapshot = manager.getSessionState(session.sessionId);
    expect(snapshot.clicks).toBe(1);
  });

  it('stops counting clicks once the session has finished', () => {
    const manager = createManager();
    const session = manager.startSession();
    jest.advanceTimersByTime(5000);
    const result = manager.getResult(session.sessionId);
    expect(result.status).toBe(STATUS.FINISHED);
    const accepted = manager.registerClick(session.sessionId);
    expect(accepted).toBe(false);
    const snapshot = manager.getSessionState(session.sessionId);
    expect(snapshot.clicks).toBe(0);
  });
});
