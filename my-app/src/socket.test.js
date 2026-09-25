import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSocket, SOCKET_EVENTS, SOCKET_URL } from './socket';

// Проверяем рукопожатие Socket.IO: JWT из ЛР №3 должен уходить на сервер
// в auth (заголовки в WebSocket недоступны) — см. socket/auth.js на сервере.
const mocks = vi.hoisted(() => ({ io: vi.fn(() => ({ id: 'fake-socket' })) }));

vi.mock('socket.io-client', () => ({ io: mocks.io }));

beforeEach(() => {
  localStorage.clear();
  mocks.io.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('socket: соединение с сервером Socket.IO', () => {
  it('передаёт JWT и email пользователя в auth рукопожатия', () => {
    localStorage.setItem('token', 'jwt-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'me@example.com', role: 'user' }));

    createSocket();

    expect(mocks.io).toHaveBeenCalledTimes(1);
    expect(mocks.io.mock.calls[0][0]).toBe(SOCKET_URL);
    expect(mocks.io.mock.calls[0][1]).toMatchObject({
      auth: { token: 'jwt-token', name: 'me@example.com' },
    });
  });

  it('без сохранённой сессии подключается гостем (auth пустой)', () => {
    createSocket();

    expect(mocks.io.mock.calls[0][1].auth).toEqual({ token: undefined, name: undefined });
  });

  it('адрес Socket.IO — тот же порт, что у REST API, но без /api/v1', () => {
    expect(SOCKET_URL).not.toMatch(/\/api\//);
    expect(SOCKET_EVENTS).toMatchObject({
      join: 'room:join',
      message: 'chat:message',
      react: 'chat:react',
      presence: 'presence:list',
    });
  });
});
