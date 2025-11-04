const express = require('express');
const cors = require('cors');
const http = require('http');
const createError = require('http-errors');
const { Server } = require('socket.io');
const { SessionManager, SESSION_DURATION_MS } = require('./sessionManager');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const originValidator = (origin, callback) => {
  if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(createError(403, 'Origin not allowed by CORS'));
  }
};

const app = express();
app.use(cors({ origin: originValidator, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST']
  }
});

const sessionManager = new SessionManager();

io.on('connection', (socket) => {
  let joinedSessionId = null;

  socket.on('joinSession', ({ sessionId }) => {
    if (!sessionId) return;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      socket.emit('session:error', { message: 'Session not found.' });
      return;
    }
    socket.join(sessionId);
    joinedSessionId = sessionId;
    socket.emit('session:update', session);
  });

  socket.on('click', ({ sessionId }) => {
    if (!sessionId) return;
    const result = sessionManager.recordClick(sessionId);
    if (!result.success) {
      socket.emit('session:error', { message: 'Unable to record click', reason: result.reason });
    }
  });

  socket.on('disconnect', () => {
    if (joinedSessionId) {
      socket.leave(joinedSessionId);
    }
  });
});

sessionManager.on('sessionUpdate', (session) => {
  io.to(session.id).emit('session:update', session);
});

sessionManager.on('sessionFinished', (session) => {
  io.to(session.id).emit('session:finished', session);
  io.to(session.id).emit('session:update', session);
});

app.post('/session', (req, res, next) => {
  try {
    const { durationMs } = req.body || {};
    const session = sessionManager.createSession(durationMs || SESSION_DURATION_MS);
    res.status(201).json({ sessionId: session.id, durationSeconds: Math.round(session.durationMs / 1000) });
  } catch (error) {
    next(error);
  }
});

app.get('/session/:id', (req, res, next) => {
  try {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      return next(createError(404, 'Session not found'));
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.get('/session/:id/result', (req, res, next) => {
  try {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      return next(createError(404, 'Session not found'));
    }
    if (session.status !== 'finished') {
      return res.status(202).json({ status: 'running', message: 'Session still running', session });
    }
    res.json({ status: 'finished', clicks: session.clicks, durationSeconds: Math.round(session.durationMs / 1000) });
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

server.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Server listening on port ${PORT}`);
  /* eslint-enable no-console */
});

module.exports = { app, server, sessionManager };
