import { io } from 'socket.io-client';
import { getStoredUser, getToken } from './session';

// Адрес Socket.IO-сервера. Отличие от REST API (база /api/v1): Socket.IO
// работает по своим путям (/socket.io/*) прямо на корне сервера — порт тот же.
//
// Значение берётся из переменной VITE_SOCKET_URL (my-app/.env) и «зашивается»
// Vite в бандл на этапе сборки:
//   • http://localhost:3000            — локальная разработка (dev-сервер :5173);
//   • "same-origin" (или пусто, или "/") — тот же origin: в Docker-сборке запросы
//     проксирует nginx (reverse-proxy /socket.io/ → backend:5000, ЛР №8).
// При значении «same-origin» адрес = undefined, и socket.io-client сам берёт
// window.location.
const configuredUrl = import.meta.env.VITE_SOCKET_URL;
const useSameOrigin = configuredUrl === 'same-origin' || configuredUrl === '' || configuredUrl === '/';

export const SOCKET_URL = useSameOrigin ? undefined : configuredUrl || 'http://localhost:3000';

// Человекочитаемый адрес для подписи в интерфейсе
export const SOCKET_DISPLAY_URL = SOCKET_URL
  || (typeof window !== 'undefined' ? window.location.origin : 'same-origin');

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
