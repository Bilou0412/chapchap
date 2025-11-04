import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SessionContext = createContext(null);

const defaultSocketFactory = (url, options) => io(url, options);

export function SessionProvider({ children, apiBaseUrl = 'http://localhost:4000', socketFactory = defaultSocketFactory }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectSocket = (sessionId) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = socketFactory(apiBaseUrl, {
      transports: ['websocket'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('joinSession', { sessionId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('session:update', (payload) => {
      setSession(payload);
      setError(null);
    });

    socket.on('session:finished', (payload) => {
      setSession(payload);
      setError(null);
    });

    socket.on('session:error', (payload) => {
      setError(payload.message);
    });
  };

  const startSession = async () => {
    setError(null);
    const response = await fetch(`${apiBaseUrl}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      setError('Impossible de démarrer la session');
      throw new Error('Unable to start session');
    }
    const data = await response.json();
    setSession({ id: data.sessionId, clicks: 0, status: 'running', durationMs: data.durationSeconds * 1000, remainingMs: data.durationSeconds * 1000 });
    connectSocket(data.sessionId);
    return data.sessionId;
  };

  const joinSession = async (sessionId) => {
    setError(null);
    const response = await fetch(`${apiBaseUrl}/session/${sessionId}`);
    if (!response.ok) {
      setError('Session introuvable');
      throw new Error('Session not found');
    }
    const data = await response.json();
    setSession(data);
    connectSocket(sessionId);
    return data;
  };

  const recordClick = () => {
    if (!session?.id || !socketRef.current) return;
    socketRef.current.emit('click', { sessionId: session.id });
  };

  const reset = () => {
    setSession(null);
    setError(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  useEffect(() => () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  return (
    <SessionContext.Provider value={{ session, startSession, joinSession, recordClick, error, isConnected, reset }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
