const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_DURATION_MS = 60 * 1000;

class RoomManager extends EventEmitter {
  constructor({ tickIntervalMs = 1000 } = {}) {
    super();
    this.rooms = new Map();
    this.tickIntervalMs = tickIntervalMs;
  }

  createRoom({ name, durationMs } = {}) {
    const roomId = uuidv4();
    const roomName = (name || 'Room').trim();
    const parsedDuration = Number(durationMs);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : DEFAULT_DURATION_MS;

    const room = {
      id: roomId,
      name: roomName,
      durationMs: duration,
      status: 'waiting',
      clicks: 0,
      players: new Map(),
      startTime: null,
      endTime: null,
      remainingMs: duration,
      interval: null
    };

    this.rooms.set(roomId, room);
    const serialized = this.serialize(room);
    this.emit('roomCreated', serialized);
    this.emit('roomsUpdated', this.listRooms());
    return serialized;
  }

  listRooms() {
    return Array.from(this.rooms.values()).map((room) => this.serialize(room));
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    return this.serialize(room);
  }

  addPlayer(roomId, player) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    const { id, name } = player;
    if (!id || !name) {
      return { success: false, reason: 'INVALID_PLAYER' };
    }

    room.players.set(id, { id, name: name.trim() });
    const serialized = this.serialize(room);
    this.emit('roomUpdated', serialized);
    this.emit('roomsUpdated', this.listRooms());
    return { success: true, room: serialized };
  }

  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    const removed = room.players.delete(playerId);
    if (!removed) {
      return { success: false, reason: 'PLAYER_NOT_IN_ROOM' };
    }

    const serialized = this.serialize(room);
    this.emit('roomUpdated', serialized);
    this.emit('roomsUpdated', this.listRooms());
    return { success: true, room: serialized };
  }

  startRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    if (room.status === 'running') {
      return { success: false, reason: 'ALREADY_RUNNING', room: this.serialize(room) };
    }

    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    room.status = 'running';
    room.clicks = 0;
    room.startTime = Date.now();
    room.endTime = room.startTime + room.durationMs;
    room.remainingMs = room.durationMs;

    room.interval = setInterval(() => {
      this.tick(roomId);
    }, this.tickIntervalMs);

    const serialized = this.serialize(room);
    this.emit('roomUpdated', serialized);
    this.emit('roomsUpdated', this.listRooms());
    return { success: true, room: serialized };
  }

  resetRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    room.status = 'waiting';
    room.clicks = 0;
    room.startTime = null;
    room.endTime = null;
    room.remainingMs = room.durationMs;

    const serialized = this.serialize(room);
    this.emit('roomUpdated', serialized);
    this.emit('roomsUpdated', this.listRooms());
    return { success: true, room: serialized };
  }

  recordClick(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    if (room.status !== 'running') {
      return { success: false, reason: 'NOT_RUNNING', room: this.serialize(room) };
    }

    const now = Date.now();
    if (now >= room.endTime) {
      this.finishRoom(roomId);
      return { success: false, reason: 'FINISHED', room: this.serialize(room) };
    }

    room.clicks += 1;
    room.remainingMs = Math.max(0, room.endTime - now);
    const serialized = this.serialize(room);
    this.emit('roomUpdated', serialized);
    return { success: true, room: serialized };
  }

  tick(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'running') {
      return;
    }

    const now = Date.now();
    if (now >= room.endTime) {
      this.finishRoom(roomId);
      return;
    }

    room.remainingMs = Math.max(0, room.endTime - now);
    this.emit('roomUpdated', this.serialize(room));
  }

  finishRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    if (room.interval) {
      clearInterval(room.interval);
      room.interval = null;
    }

    room.status = 'finished';
    room.remainingMs = 0;
    const serialized = this.serialize(room);
    this.emit('roomFinished', serialized);
    this.emit('roomUpdated', serialized);
    this.emit('roomsUpdated', this.listRooms());
  }

  serialize(room) {
    const now = Date.now();
    let remaining = room.remainingMs;

    if (room.status === 'running') {
      remaining = Math.max(0, room.endTime - now);
    } else if (room.status === 'waiting') {
      remaining = room.durationMs;
    } else {
      remaining = 0;
    }

    return {
      id: room.id,
      name: room.name,
      durationMs: room.durationMs,
      status: room.status,
      clicks: room.clicks,
      startTime: room.startTime,
      endTime: room.endTime,
      remainingMs: remaining,
      players: Array.from(room.players.values())
    };
  }
}

module.exports = { RoomManager, DEFAULT_DURATION_MS };
