const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { SessionManager } = require('./sessionManager');

const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(helmet());
app.use(cors({ origin: ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ORIGIN,
    methods: ['GET', 'POST'],
  },
});

const sessionManager = new SessionManager(io);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/session', (_req, res) => {
  const session = sessionManager.startSession();
  res.status(201).json(session);
});

app.get('/session/:id/result', (req, res) => {
  const { id } = req.params;
  const result = sessionManager.getResult(id);
  if (!sessionManager.getSessionState(id)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!result) {
    return res.status(202).json({ status: 'running' });
  }
  return res.json(result);
});

app.get('/stats/recent', (_req, res) => {
  res.json({ sessions: sessionManager.getRecentHistory() });
});

io.on('connection', (socket) => {
  socket.on('joinSession', ({ sessionId }) => {
    if (!sessionId) {
      socket.emit('sessionError', { message: 'Session ID is required' });
      return;
    }
    sessionManager.joinSession(sessionId, socket);
  });

  socket.on('leaveSession', ({ sessionId }) => {
    if (!sessionId) return;
    socket.leave(sessionId);
  });

  socket.on('registerClick', ({ sessionId }) => {
    if (!sessionId) return;
    const accepted = sessionManager.registerClick(sessionId);
    if (!accepted) {
      socket.emit('sessionError', { message: 'Session is no longer active' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
