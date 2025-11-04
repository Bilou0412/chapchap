const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const SessionManager = require('./sessionManager');

const app = express();
const port = process.env.PORT || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const sessionManager = new SessionManager({ io });

app.post('/session', (req, res) => {
  const session = sessionManager.createSession();
  res.status(201).json(session);
});

app.get('/session/:id/result', (req, res) => {
  const result = sessionManager.getResult(req.params.id);
  if (!result) {
    return res.status(404).json({ message: 'Session not found or not finished yet' });
  }
  return res.json(result);
});

app.get('/stats/history', (req, res) => {
  res.json({ sessions: sessionManager.getHistory() });
});

io.on('connection', (socket) => {
  socket.on('session:join', ({ sessionId }) => {
    if (!sessionId) {
      socket.emit('session:error', { message: 'Session id is required' });
      return;
    }
    sessionManager.addClient(sessionId, socket);
  });

  socket.on('session:click', ({ sessionId }) => {
    if (!sessionId) {
      socket.emit('session:error', { message: 'Session id is required' });
      return;
    }

    const result = sessionManager.registerClick(sessionId);
    if (!result.success) {
      socket.emit('session:error', { message: result.reason });
    }
  });

  socket.on('disconnect', () => {
    // No-op for now, but a place to clean up resources if needed.
  });
});

const start = () => {
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

if (require.main === module) {
  start();
}

module.exports = { app, start, server, io };
