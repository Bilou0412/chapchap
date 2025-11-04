import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SessionContext = createContext(null);

const defaultSocketFactory = (url, options) => io(url, options);

export function SessionProvider({ children, apiBaseUrl = 'http://localhost:4000', socketFactory = defaultSocketFactory }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  const apiUrl = useMemo(() => apiBaseUrl.replace(/\/$/, ''), [apiBaseUrl]);

  useEffect(() => {
    const socket = socketFactory(apiUrl, { transports: ['websocket'], autoConnect: true });
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleRoomsUpdate = (payload) => {
      setRooms(payload);
      setActiveRoom((current) => {
        if (!current) return current;
        const updated = payload.find((room) => room.id === current.id);
        return updated || current;
      });
    };

    const handleRoomUpdate = (room) => {
      setRooms((previous) => {
        const index = previous.findIndex((item) => item.id === room.id);
        if (index === -1) {
          return [...previous, room];
        }
        const clone = [...previous];
        clone[index] = room;
        return clone;
      });
      setActiveRoom((current) => (current?.id === room.id ? room : current));
      setError(null);
    };

    const handleRoomJoined = (room) => {
      setActiveRoom(room);
      setError(null);
    };

    const handleRoomLeft = () => {
      setActiveRoom(null);
    };

    const handleRoomFinished = (room) => {
      setActiveRoom(room);
    };

    const handleRoomError = (payload) => {
      if (payload?.message) {
        setError(payload.message);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('rooms:update', handleRoomsUpdate);
    socket.on('room:update', handleRoomUpdate);
    socket.on('room:joined', handleRoomJoined);
    socket.on('room:left', handleRoomLeft);
    socket.on('room:finished', handleRoomFinished);
    socket.on('room:error', handleRoomError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('rooms:update', handleRoomsUpdate);
      socket.off('room:update', handleRoomUpdate);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:left', handleRoomLeft);
      socket.off('room:finished', handleRoomFinished);
      socket.off('room:error', handleRoomError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiUrl, socketFactory]);

  const ensureSocket = () => {
    if (!socketRef.current) {
      return null;
    }
    if (!socketRef.current.connected) {
      socketRef.current.connect();
    }
    return socketRef.current;
  };

  const refreshRooms = async () => {
    const response = await fetch(`${apiUrl}/rooms`);
    if (!response.ok) {
      throw new Error('Unable to fetch rooms');
    }
    const data = await response.json();
    setRooms(data);
    setActiveRoom((current) => {
      if (!current) return current;
      const updated = data.find((room) => room.id === current.id);
      return updated || current;
    });
    return data;
  };

  useEffect(() => {
    refreshRooms().catch(() => {
      // noop: handled by UI when rooms stay empty
    });
  }, [apiUrl]);

  const updatePlayerName = (name) => {
    setPlayerName(name.trim());
  };

  const createRoom = async (name, durationMs) => {
    setError(null);
    const payload = {};
    if (name) payload.name = name;
    if (Number.isFinite(durationMs)) payload.durationMs = durationMs;

    const response = await fetch(`${apiUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setError('Impossible de créer la salle.');
      throw new Error('Unable to create room');
    }

    const room = await response.json();
    setRooms((previous) => {
      const exists = previous.some((item) => item.id === room.id);
      if (exists) {
        return previous.map((item) => (item.id === room.id ? room : item));
      }
      return [...previous, room];
    });
    return room;
  };

  const joinRoom = (roomId, name) => {
    const finalName = (name || playerName || '').trim();
    if (!finalName) {
      setError('Veuillez choisir un pseudo avant de rejoindre.');
      return Promise.reject(new Error('Missing player name'));
    }

    setPlayerName(finalName);
    setError(null);
    const socket = ensureSocket();
    if (!socket) {
      setError('Connexion temps réel indisponible.');
      return Promise.reject(new Error('Socket unavailable'));
    }

    socket.emit('joinRoom', { roomId, name: finalName });
    return Promise.resolve();
  };

  const leaveRoom = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('leaveRoom');
    }
    setActiveRoom(null);
  };

  const startSession = async (roomId) => {
    const targetRoomId = roomId || activeRoom?.id;
    if (!targetRoomId) {
      setError('Aucune salle sélectionnée.');
      throw new Error('No room selected');
    }

    setError(null);
    const response = await fetch(`${apiUrl}/rooms/${targetRoomId}/start`, {
      method: 'POST'
    });

    if (!response.ok) {
      const message = response.status === 409 ? 'La session est déjà en cours.' : 'Impossible de démarrer la session.';
      setError(message);
      throw new Error('Unable to start session');
    }

    const room = await response.json();
    setActiveRoom(room);
    return room;
  };

  const resetSession = async (roomId) => {
    const targetRoomId = roomId || activeRoom?.id;
    if (!targetRoomId) {
      setError('Aucune salle sélectionnée.');
      throw new Error('No room selected');
    }

    setError(null);
    const response = await fetch(`${apiUrl}/rooms/${targetRoomId}/reset`, {
      method: 'POST'
    });

    if (!response.ok) {
      setError('Impossible de réinitialiser la session.');
      throw new Error('Unable to reset session');
    }

    const room = await response.json();
    setActiveRoom(room);
    return room;
  };

  const recordClick = () => {
    if (!activeRoom?.id) {
      return;
    }
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.emit('click', { roomId: activeRoom.id });
  };

  const contextValue = {
    rooms,
    activeRoom,
    playerName,
    setPlayerName: updatePlayerName,
    createRoom,
    joinRoom,
    leaveRoom,
    startSession,
    resetSession,
    recordClick,
    refreshRooms,
    error,
    isConnected
  };

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
