const express = require('express');
const cors = require('cors');
const http = require('http');
const createError = require('http-errors');
const { Server } = require('socket.io');
const { RoomManager } = require('./roomManager');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const allowedOrigins = CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes('*');

const originValidator = (origin, callback) => {
  if (allowAllOrigins || !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(createError(403, 'Origin not allowed by CORS'));
  }
};

const app = express();
const corsOptions = allowAllOrigins
  ? { origin: true, credentials: true }
  : { origin: originValidator, credentials: true };
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowAllOrigins ? true : allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
  socket.emit('rooms:update', roomManager.listRooms());

  socket.on('joinRoom', ({ roomId, name }) => {
    const trimmedName = (name || socket.data.playerName || '').trim();
    if (!roomId) {
      socket.emit('room:error', { message: 'Room ID is required.' });
      return;
    }

    if (!trimmedName) {
      socket.emit('room:error', { message: 'Un pseudo est requis pour rejoindre une salle.' });
      return;
    }

    socket.data.playerName = trimmedName;

    if (socket.data.roomId && socket.data.roomId !== roomId) {
      roomManager.removePlayer(socket.data.roomId, socket.id);
      socket.leave(socket.data.roomId);
    }

    const result = roomManager.addPlayer(roomId, { id: socket.id, name: trimmedName });
    if (!result.success) {
      const message =
        result.reason === 'NOT_FOUND'
          ? "Salle introuvable."
          : "Impossible de rejoindre la salle.";
      socket.emit('room:error', { message });
      return;
    }

    socket.data.roomId = roomId;
    socket.join(roomId);
    socket.emit('room:joined', result.room);
  });

  socket.on('leaveRoom', () => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      return;
    }

    roomManager.removePlayer(roomId, socket.id);
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.emit('room:left');
  });

  socket.on('startSession', ({ roomId }) => {
    const targetRoomId = roomId || socket.data.roomId;
    if (!targetRoomId) {
      socket.emit('room:error', { message: 'Aucune salle sélectionnée.' });
      return;
    }

    const result = roomManager.startRoom(targetRoomId);
    if (!result.success) {
      const messages = {
        NOT_FOUND: 'Salle introuvable.',
        ALREADY_RUNNING: 'La session est déjà en cours.'
      };
      socket.emit('room:error', { message: messages[result.reason] || 'Impossible de démarrer la session.' });
    }
  });

  socket.on('resetSession', ({ roomId }) => {
    const targetRoomId = roomId || socket.data.roomId;
    if (!targetRoomId) {
      socket.emit('room:error', { message: 'Aucune salle sélectionnée.' });
      return;
    }

    const result = roomManager.resetRoom(targetRoomId);
    if (!result.success) {
      const message = result.reason === 'NOT_FOUND' ? 'Salle introuvable.' : 'Impossible de réinitialiser la session.';
      socket.emit('room:error', { message });
    }
  });

  socket.on('click', ({ roomId }) => {
    const targetRoomId = roomId || socket.data.roomId;
    if (!targetRoomId) {
      socket.emit('room:error', { message: 'Aucune salle sélectionnée.' });
      return;
    }

    const result = roomManager.recordClick(targetRoomId);
    if (!result.success && result.reason !== 'NOT_RUNNING') {
      const messages = {
        NOT_FOUND: 'Salle introuvable.',
        FINISHED: 'La session est terminée.'
      };
      socket.emit('room:error', { message: messages[result.reason] || 'Impossible d\'enregistrer le clic.' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      roomManager.removePlayer(socket.data.roomId, socket.id);
      socket.data.roomId = null;
    }
  });
});

roomManager.on('roomsUpdated', (rooms) => {
  io.emit('rooms:update', rooms);
});

roomManager.on('roomUpdated', (room) => {
  io.to(room.id).emit('room:update', room);
});

roomManager.on('roomFinished', (room) => {
  io.to(room.id).emit('room:finished', room);
});

app.get('/rooms', (req, res) => {
  res.json(roomManager.listRooms());
});

app.post('/rooms', (req, res, next) => {
  try {
    const { name, durationMs } = req.body || {};
    const room = roomManager.createRoom({ name, durationMs });
    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
});

app.get('/rooms/:id', (req, res, next) => {
  try {
    const room = roomManager.getRoom(req.params.id);
    if (!room) {
      return next(createError(404, 'Room not found'));
    }
    res.json(room);
  } catch (error) {
    next(error);
  }
});

app.post('/rooms/:id/start', (req, res, next) => {
  try {
    const result = roomManager.startRoom(req.params.id);
    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        return next(createError(404, 'Room not found'));
      }
      if (result.reason === 'ALREADY_RUNNING') {
        return next(createError(409, 'Room already running'));
      }
      return next(createError(400, 'Unable to start room'));
    }
    res.json(result.room);
  } catch (error) {
    next(error);
  }
});

app.post('/rooms/:id/reset', (req, res, next) => {
  try {
    const result = roomManager.resetRoom(req.params.id);
    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        return next(createError(404, 'Room not found'));
      }
      return next(createError(400, 'Unable to reset room'));
    }
    res.json(result.room);
  } catch (error) {
    next(error);
  }
});

app.get('/rooms/:id/result', (req, res, next) => {
  try {
    const room = roomManager.getRoom(req.params.id);
    if (!room) {
      return next(createError(404, 'Room not found'));
    }
    if (room.status !== 'finished') {
      return res.status(202).json({ status: 'running', message: 'Room is still running', room });
    }
    res.json({ status: 'finished', clicks: room.clicks, durationMs: room.durationMs });
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  next(createError(404, 'Not Found'));
});

app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

server.listen(PORT, '0.0.0.0', () => {
  /* eslint-disable no-console */
  console.log(`Server listening on port ${PORT}`);
  /* eslint-enable no-console */
});

module.exports = { app, server, roomManager };
