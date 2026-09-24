import { io } from 'socket.io-client';
import { getStoredUser, getToken } from './session';

// Адрес Socket.IO-сервера. В отличие от REST API (база /api/v1), Socket.IO
// работает по своим путям (/socket.io/*) прямо на корне сервера — порт тот же 3000.
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

// Создаёт Socket.IO-соединение с сервером (ЛР №7).
// JWT из ЛР №3 передаём в auth рукопожатия: заголовки в WebSocket недоступны,
// поэтому сервер читает токен из socket.handshake.auth.token (см. socket/auth.js).
// Имя нужно только гостям — авторизованному пользователю сервер берёт email из токена.
export function createSocket() {
  const token = getToken();
  const user = getStoredUser();

  return io(SOCKET_URL, {
    auth: {
      token: token || undefined,
      name: user?.email || undefined,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
}

// События протокола (список — в шпаргалке scripts/selfcheck-socket.js)
export const SOCKET_EVENTS = {
  // клиент → сервер
  join: 'room:join',
  leave: 'room:leave',
  message: 'chat:message',
  typing: 'chat:typing',
  privateMessage: 'chat:private',
  react: 'chat:react',
  // сервер → клиент
  rooms: 'rooms:list',
  presence: 'presence:list',
  notice: 'system:notice',
  messageUpdate: 'chat:message:update',
};
