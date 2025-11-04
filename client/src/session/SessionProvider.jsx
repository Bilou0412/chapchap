import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const SessionContext = createContext(null);

const initialState = {
  sessionId: null,
  clicks: 0,
  remainingSeconds: 60,
  status: 'idle',
  startedAt: null,
  endsAt: null,
  endedAt: null,
  error: null,
};

export function SessionProvider({ children }) {
  const [session, setSession] = useState(initialState);
  const socketRef = useRef(null);
  const currentSessionId = useRef(null);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const handleUpdate = (payload) => {
      if (!payload) return;
      if (currentSessionId.current !== payload.sessionId) {
        return;
      }
      setSession((prev) => ({
        ...prev,
        sessionId: payload.sessionId,
        clicks: payload.clicks,
        remainingSeconds: payload.remainingSeconds,
        status: payload.status,
        startedAt: payload.startedAt,
        endsAt: payload.endsAt,
        endedAt: payload.endedAt,
        error: null,
      }));
    };

    const handleError = (payload) => {
      const message = payload?.message || 'Unknown session error';
      if (message.toLowerCase().includes('not found')) {
        currentSessionId.current = null;
        setSession({ ...initialState, error: message });
        return;
      }
      setSession((prev) => ({
        ...prev,
        error: message,
      }));
    };

    socket.on('sessionUpdate', handleUpdate);
    socket.on('sessionError', handleError);

    return () => {
      socket.off('sessionUpdate', handleUpdate);
      socket.off('sessionError', handleError);
      socket.disconnect();
    };
  }, []);

  const startSession = async () => {
    const response = await fetch(`${API_URL}/session`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Unable to start session');
    }
    const payload = await response.json();
    currentSessionId.current = payload.sessionId;
    if (socketRef.current) {
      socketRef.current.emit('joinSession', { sessionId: payload.sessionId });
    }
    setSession({
      sessionId: payload.sessionId,
      clicks: 0,
      remainingSeconds: payload.remainingSeconds,
      status: payload.status,
      startedAt: payload.startedAt,
      endsAt: payload.endsAt,
      endedAt: payload.endedAt,
      error: null,
    });
    return payload;
  };

  const joinSession = (sessionId) => {
    if (!sessionId) return;
    currentSessionId.current = sessionId;
    if (socketRef.current) {
      socketRef.current.emit('joinSession', { sessionId });
    }
    setSession((prev) => ({
      ...prev,
      sessionId,
      status: 'loading',
      error: null,
    }));
  };

  const registerClick = () => {
    if (!currentSessionId.current || !socketRef.current) return;
    socketRef.current.emit('registerClick', { sessionId: currentSessionId.current });
  };

  const resetSession = () => {
    if (currentSessionId.current && socketRef.current) {
      socketRef.current.emit('leaveSession', { sessionId: currentSessionId.current });
    }
    currentSessionId.current = null;
    setSession({ ...initialState });
  };

  const value = useMemo(
    () => ({
      session,
      startSession,
      joinSession,
      registerClick,
      resetSession,
    }),
    [session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return context;
}
