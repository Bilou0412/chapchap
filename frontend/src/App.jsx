import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createSocket } from './socket.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const formatTime = (ms) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.max(totalSeconds % 60, 0)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const initialState = {
  sessionId: null,
  status: 'idle',
  clicks: 0,
  remainingMs: 60000
};

function App() {
  const [sessionId, setSessionId] = useState(initialState.sessionId);
  const [status, setStatus] = useState(initialState.status);
  const [clicks, setClicks] = useState(initialState.clicks);
  const [remainingMs, setRemainingMs] = useState(initialState.remainingMs);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const socketRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/stats/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load history', err);
    }
  }, []);

  useEffect(() => {
    const socket = createSocket(API_URL);
    socketRef.current = socket;

    const handleUpdate = (payload) => {
      setSessionId(payload.sessionId);
      setStatus(payload.status);
      setClicks(payload.clicks);
      setRemainingMs(payload.remainingMs);
    };

    const handleFinished = (payload) => {
      setStatus('finished');
      setClicks(payload.clicks);
      setRemainingMs(0);
      fetchHistory();
    };

    const handleError = (payload) => {
      setError(payload.message || 'Une erreur est survenue.');
    };

    socket.on('session:update', handleUpdate);
    socket.on('session:finished', handleFinished);
    socket.on('session:error', handleError);

    fetchHistory();

    return () => {
      socket.off('session:update', handleUpdate);
      socket.off('session:finished', handleFinished);
      socket.off('session:error', handleError);
      socket.disconnect();
    };
  }, [fetchHistory]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !sessionId) {
      return;
    }
    socket.emit('session:join', { sessionId });
  }, [sessionId]);

  const startSession = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/session`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Impossible de démarrer la session');
      }
      const data = await response.json();
      setSessionId(data.sessionId);
      setStatus(data.status);
      setClicks(data.clicks);
      setRemainingMs(data.remainingMs ?? data.durationMs ?? 60000);

      const socket = socketRef.current;
      if (socket) {
        socket.emit('session:join', { sessionId: data.sessionId });
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const resetSession = useCallback(() => {
    setSessionId(initialState.sessionId);
    setStatus(initialState.status);
    setClicks(initialState.clicks);
    setRemainingMs(initialState.remainingMs);
    setError(null);
  }, []);

  const handleClick = useCallback(() => {
    if (status !== 'running') {
      return;
    }

    const socket = socketRef.current;
    if (socket && sessionId) {
      socket.emit('session:click', { sessionId });
    }
  }, [sessionId, status]);

  const statusText = {
    idle: 'Cliquez sur « Start » pour commencer une session de 60 secondes.',
    running: 'Session en cours. Cliquez autant que possible pendant la minute !',
    finished: 'Session terminée. Cliquez sur Reset pour recommencer.'
  }[status];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Minute Click Challenge</h1>
        <p className="status-text">{statusText}</p>
        {error && <p role="alert">{error}</p>}
      </header>

      <section>
        <div className="timer-display" aria-live="polite">
          {formatTime(remainingMs)}
        </div>
        <div className="counter-display" aria-live="polite">
          Total de clics : {clicks}
        </div>
      </section>

      <div className="button-group">
        <button
          className="primary"
          type="button"
          onClick={handleClick}
          disabled={status !== 'running'}
        >
          Click!
        </button>
        <button
          className="secondary"
          type="button"
          onClick={startSession}
          disabled={status === 'running'}
        >
          Start
        </button>
        <button
          className="secondary"
          type="button"
          onClick={resetSession}
          disabled={status !== 'finished'}
        >
          Reset
        </button>
      </div>

      <section className="history">
        <h2>Sessions récentes</h2>
        {history.length === 0 ? (
          <p>Aucune session terminée pour le moment.</p>
        ) : (
          <ul>
            {history.map((item) => (
              <li key={item.sessionId}>
                <strong>{item.clicks} clics</strong> — {new Date(item.finishedAt || item.startedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;

