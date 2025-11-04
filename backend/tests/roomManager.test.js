const { RoomManager, DEFAULT_DURATION_MS } = require('../src/roomManager');

describe('RoomManager', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('creates rooms with default duration and tracks players', () => {
    const manager = new RoomManager();
    const room = manager.createRoom({ name: 'Salon test' });

    expect(room.durationMs).toBe(DEFAULT_DURATION_MS);
    expect(room.status).toBe('waiting');

    const addResult = manager.addPlayer(room.id, { id: 'socket-1', name: 'Alice' });
    expect(addResult.success).toBe(true);
    expect(addResult.room.players).toEqual([{ id: 'socket-1', name: 'Alice' }]);
  });

  it('starts a room, counts clicks and finishes after duration', () => {
    const manager = new RoomManager({ tickIntervalMs: 50 });
    const room = manager.createRoom({ name: 'Salon chrono', durationMs: 200 });

    manager.addPlayer(room.id, { id: 'socket-1', name: 'Bob' });

    const startResult = manager.startRoom(room.id);
    expect(startResult.success).toBe(true);
    expect(startResult.room.status).toBe('running');

    expect(manager.recordClick(room.id).success).toBe(true);

    jest.advanceTimersByTime(250);

    const clickAfterFinish = manager.recordClick(room.id);
    expect(clickAfterFinish.success).toBe(false);
    expect(clickAfterFinish.reason).toBe('FINISHED');

    const finishedRoom = manager.getRoom(room.id);
    expect(finishedRoom.status).toBe('finished');
    expect(finishedRoom.clicks).toBe(1);
  });

  it('emits updates and finished events', () => {
    const manager = new RoomManager({ tickIntervalMs: 50 });
    const room = manager.createRoom({ durationMs: 100 });

    const updates = [];
    const finishes = [];

    manager.on('roomUpdated', (payload) => {
      updates.push(payload);
    });

    manager.on('roomFinished', (payload) => {
      finishes.push(payload);
    });

    manager.startRoom(room.id);
    manager.recordClick(room.id);

    jest.advanceTimersByTime(150);

    expect(updates.length).toBeGreaterThan(0);
    expect(finishes.length).toBe(1);
    expect(finishes[0].status).toBe('finished');
  });
});
