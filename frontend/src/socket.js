import { io } from 'socket.io-client';

export const createSocket = (url) =>
  io(url, {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true
  });
