import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatRoom from './ChatRoom';

// ---------- Фейковый Socket.IO-клиент ----------
// Реализует только нужный компоненту минимум: on/off, emit с ack,
// removeAllListeners, disconnect и ручное «проигрывание» серверных событий.
class FakeSocket {
  constructor() {
    this.id = 'sock-self';
    this.handlers = new Map();
    this.emitted = [];
    this.disconnected = false;
    this.responses = {}; // event → ответ в ack
  }

  on(event, callback) {
    this.handlers.set(event, [...(this.handlers.get(event) || []), callback]);
    return this;
  }

  off(event, callback) {
    this.handlers.set(event, (this.handlers.get(event) || []).filter((cb) => cb !== callback));
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  emit(event, ...args) {
    const last = args[args.length - 1];
    const ack = typeof last === 'function' ? last : null;
    const rest = ack ? args.slice(0, -1) : args;
    this.emitted.push({ event, payload: rest.length > 0 ? rest[0] : null });

    if (ack && this.responses[event] !== undefined) ack(this.responses[event]);
    return this;
  }

  disconnect() {
    this.disconnected = true;
    return this;
  }

  // --- helpers для тестов ---
  fire(event, payload) {
    (this.handlers.get(event) || []).forEach((cb) => cb(payload));
  }

  sent(event) {
    return this.emitted.filter((entry) => entry.event === event);
  }
}

const state = vi.hoisted(() => ({ sockets: [] }));

vi.mock('../socket', () => ({
  SOCKET_URL: 'http://localhost:3000',
  SOCKET_DISPLAY_URL: 'http://localhost:3000',
  SOCKET_EVENTS: {
    join: 'room:join',
    leave: 'room:leave',
    message: 'chat:message',
    typing: 'chat:typing',
    privateMessage: 'chat:private',
    react: 'chat:react',
    rooms: 'rooms:list',
    presence: 'presence:list',
    notice: 'system:notice',
    messageUpdate: 'chat:message:update',
  },
  createSocket: () => {
    const socket = new FakeSocket();
    state.sockets.push(socket);
    return socket;
  },
}));

const ROOMS = [
  { id: 'general', title: 'Общий канал', online: 1 },
  { id: 'hr', title: 'Отдел кадров', online: 0 },
];

const MESSAGE = {
  id: 'm1',
  room: 'general',
  authorId: '1',
  authorName: 'ivan@example.com',
  text: 'Сообщение из истории MongoDB',
  kind: 'user',
  reactions: [],
  createdAt: '2026-09-23T10:00:00.000Z',
};

const ONLINE = [
  { socketId: 'sock-self', name: 'me@example.com', room: 'general' },
  { socketId: 'sock-2', name: 'petr@example.com', room: 'general' },
];

// Имитирует успешное подключение и вход в общий канал:
// сервер отвечает ack'ом на room:join и присылает справочники событиями.
async function connectAndJoin(socket, { messages = [MESSAGE] } = {}) {
  socket.responses['room:join'] = { ok: true, room: 'general', messages };
  socket.responses['chat:message'] = { ok: true, message: MESSAGE };
  socket.fire('connect');
  socket.fire('rooms:list', { rooms: ROOMS });
  socket.fire('presence:list', { users: ONLINE });

  await waitFor(() => expect(screen.getByText('Сообщение из истории MongoDB')).toBeInTheDocument());
}

beforeEach(() => {
  state.sockets.length = 0;
  localStorage.clear();
  localStorage.setItem('token', 'jwt-token');
  localStorage.setItem('user', JSON.stringify({ id: 1, email: 'me@example.com', role: 'user' }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ChatRoom: подключение, комнаты и история (Socket.IO)', () => {
  it('подключается, входит в общий канал и показывает историю из MongoDB', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];

    expect(screen.getByText(/Подключение к каналу/)).toBeInTheDocument();

    await connectAndJoin(socket);

    // Список каналов и онлайн-пользователей пришёл с сервера событиями
    expect(screen.getByText('#general — Общий канал')).toBeInTheDocument();
    expect(screen.getByText('#hr — Отдел кадров')).toBeInTheDocument();
    expect(within(screen.getByTestId('presence-list')).getByText('petr@example.com')).toBeInTheDocument();

    // Вход в канал подтверждён ack'ом сервера; в ленте — история канала
    expect(socket.sent('room:join')[0].payload).toBe('general');
    expect(screen.getByRole('heading', { name: /#general/ })).toBeInTheDocument();

    // Доп. эффект: заголовок страницы показывает число пользователей онлайн
    await waitFor(() => expect(document.title).toContain('2 онлайн'));
  });

  it('переключение канала запрашивает историю нового канала (ack)', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    socket.responses['room:join'] = { ok: true, room: 'hr', messages: [] };
    fireEvent.click(screen.getByText('#hr — Отдел кадров'));

    await waitFor(() => expect(screen.getByRole('heading', { name: /#hr/ })).toBeInTheDocument());
    expect(socket.sent('room:join')[1].payload).toBe('hr');
    expect(screen.queryByText('Сообщение из истории MongoDB')).not.toBeInTheDocument();
    expect(screen.getByText(/Сообщений пока нет/)).toBeInTheDocument();
  });

  it('нажатие реакции отправляет chat:react, а результат приходит событием chat:message:update', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    socket.responses['chat:react'] = { ok: true };
    fireEvent.click(within(screen.getByTestId('message-m1')).getByRole('button', { name: '👍 0' }));

    expect(socket.sent('chat:react')[0].payload).toEqual({ messageId: 'm1', emoji: '👍' });

    // Голос учтён: обновление рассылано всем участникам канала
    socket.fire('chat:message:update', {
      room: 'general',
      message: { ...MESSAGE, reactions: [{ emoji: '👍', users: ['me@example.com'] }] },
    });

    const reaction = await within(screen.getByTestId('message-m1')).findByRole('button', { name: '👍 1' });
    expect(reaction).toHaveClass('is-mine'); // мой голос подсвечен
  });
});

describe('ChatRoom: обмен сообщениями и уведомления в реальном времени', () => {
  it('сообщение от другого пользователя появляется в ленте', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    socket.fire('chat:message', {
      room: 'general',
      message: { ...MESSAGE, id: 'm2', authorName: 'petr@example.com', text: 'Привет из второго окна!' },
    });

    expect(await screen.findByText('Привет из второго окна!')).toBeInTheDocument();
  });

  it('сообщение из другого канала не попадает в ленту (изоляция комнат)', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    socket.fire('chat:message', {
      room: 'hr',
      message: { ...MESSAGE, id: 'm3', text: 'Сообщение другого канала' },
    });

    expect(screen.queryByText('Сообщение другого канала')).not.toBeInTheDocument();
  });

  it('уведомления о подключении/отключении попадают в ленту уведомлений', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    socket.fire('system:notice', { text: '🟢 petr@example.com подключился к чату', at: '2026-09-23T10:01:00.000Z' });
    socket.fire('system:notice', { text: '🔴 petr@example.com отключился от чата', at: '2026-09-23T10:02:00.000Z' });

    expect(await screen.findByText(/подключился к чату/)).toBeInTheDocument();
    expect(screen.getByText(/отключился от чата/)).toBeInTheDocument();
  });
});



describe('ChatRoom: отправка сообщений и индикатор «печатает…»', () => {
  it('отправка вызывает chat:message и очищает поле; пустое сообщение не отправляется', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    const input = screen.getByLabelText('Текст сообщения');
    expect(screen.getByRole('button', { name: '➤ Отправить' })).toBeDisabled(); // черновик пуст

    fireEvent.change(input, { target: { value: 'Моё новое сообщение' } });
    fireEvent.click(screen.getByRole('button', { name: '➤ Отправить' }));

    expect(socket.sent('chat:message')).toHaveLength(1);
    expect(socket.sent('chat:message')[0].payload).toEqual({ text: 'Моё новое сообщение' });
    expect(input).toHaveValue(''); // поле очищено после отправки
  });

  it('ошибка сервера при отправке → уведомление, текст остаётся в поле', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);
    socket.responses['chat:message'] = { ok: false, error: 'Сообщение слишком длинное' };

    fireEvent.change(screen.getByLabelText('Текст сообщения'), { target: { value: 'Не отправится' } });
    fireEvent.click(screen.getByRole('button', { name: '➤ Отправить' }));

    expect(await screen.findByText(/Сообщение слишком длинное/)).toBeInTheDocument();
    expect(screen.getByLabelText('Текст сообщения')).toHaveValue('Не отправится');
  });

  it('набор текста отправляет chat:typing true, а через паузу — false (автогашение)', async () => {
    vi.useFakeTimers(); // управляем временем вручную — без реального ожидания
    render(<ChatRoom />);
    const socket = state.sockets[0];

    act(() => {
      socket.responses['room:join'] = { ok: true, room: 'general', messages: [MESSAGE] };
      socket.fire('connect');
      socket.fire('rooms:list', { rooms: ROOMS });
      socket.fire('presence:list', { users: ONLINE });
    });

    fireEvent.change(screen.getByLabelText('Текст сообщения'), { target: { value: 'Привет' } });
    expect(socket.sent('chat:typing')[0].payload).toEqual({ isTyping: true });

    act(() => {
      vi.advanceTimersByTime(1600); // дольше TYPING_STOP_MS (1500 мс)
    });

    expect(socket.sent('chat:typing').at(-1).payload).toEqual({ isTyping: false });
  });

  it('входящее chat:typing показывает «печатает…», а его окончание гасит индикатор', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    socket.fire('chat:typing', { room: 'general', socketId: 'sock-2', name: 'petr@example.com', isTyping: true });
    expect(await screen.findByText('petr@example.com печатает…')).toBeInTheDocument();

    socket.fire('chat:typing', { room: 'general', socketId: 'sock-2', name: 'petr@example.com', isTyping: false });
    await waitFor(() => expect(screen.queryByText(/печатает…/)).not.toBeInTheDocument());
  });
});


describe('ChatRoom: приватные сообщения, ошибки и жизненный цикл', () => {
  it('приватное сообщение уходит выбранному socket.id и входящее отображается', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    fireEvent.change(screen.getByDisplayValue('— кому —'), { target: { value: 'sock-2' } });
    fireEvent.change(screen.getByPlaceholderText('Текст личного сообщения'), {
      target: { value: 'Только для Петра' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Отправить приватно/ }));

    expect(socket.sent('chat:private')[0].payload).toEqual({ toSocketId: 'sock-2', text: 'Только для Петра' });

    socket.fire('chat:private', {
      id: 'dm-1',
      fromSocketId: 'sock-2',
      fromName: 'petr@example.com',
      toSocketId: 'sock-self',
      toName: 'me@example.com',
      text: 'Ответ Петра',
      createdAt: '2026-09-23T10:05:00.000Z',
    });

    expect(await screen.findByText(/Ответ Петра/)).toBeInTheDocument();
  });

  it('ошибка подключения → панель с сообщением и кнопкой «Переподключиться»', async () => {
    render(<ChatRoom />);
    const socket = state.sockets[0];

    socket.fire('connect_error', new Error('Недействительный или просроченный токен'));

    expect(await screen.findByText(/Нет соединения с Socket.IO/)).toBeInTheDocument();
    expect(screen.getByText('Недействительный или просроченный токен')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Переподключиться/ })).toBeInTheDocument();
  });

  it('при размонтировании отписывается и разрывает соединение (отмена при unmount)', async () => {
    const { unmount } = render(<ChatRoom />);
    const socket = state.sockets[0];
    await connectAndJoin(socket);

    unmount();

    expect(socket.disconnected).toBe(true);
    expect(socket.handlers.size).toBe(0); // все обработчики сняты — утечек нет
  });
});
