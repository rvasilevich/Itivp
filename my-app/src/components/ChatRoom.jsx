import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSocket, SOCKET_EVENTS, SOCKET_DISPLAY_URL } from '../socket';
import { getStoredUser } from '../session';

const TYPING_STOP_MS = 1500;  // через сколько после ввода гасим «печатает…»
const NOTICE_LIMIT = 30;      // сколько системных уведомлений держим в ленте
const REACTION_EMOJIS = ['👍', '⚠️']; // голосование за сообщение (реакции)

// Чат в реальном времени (ЛР №7, Socket.IO):
//  • комнаты-каналы (общий + по отделам) — вход через ack + история из MongoDB;
//  • обмен сообщениями (chat:message) в реальном времени;
//  • уведомления о подключении/отключении (presence:list + system:notice);
//  • индикатор «печатает…» (chat:typing с debounce);
//  • приватные сообщения конкретному пользователю по socket.id;
//  • голосование за сообщение (вложенный массив reactions[] в документе MongoDB).
// Доп. эффект: заголовок страницы показывает количество пользователей онлайн.
export default function ChatRoom() {
  const [status, setStatus] = useState('connecting'); // connecting | connected | error
  const [error, setError] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selfId, setSelfId] = useState(null);
  const [dmTarget, setDmTarget] = useState('');
  const [dmText, setDmText] = useState('');
  const [privateMessages, setPrivateMessages] = useState([]);

  const socketRef = useRef(null);
  const typingStopRef = useRef(null);
  const activeRoomRef = useRef(null);
  const feedRef = useRef(null);
  const me = useMemo(() => getStoredUser(), []);

  const addNotice = useCallback((text) => {
    setNotices((prev) => [...prev.slice(-(NOTICE_LIMIT - 1)), { text, at: new Date().toISOString() }]);
  }, []);

  // ---------- Вход в канал (комната + история сообщений из MongoDB) ----------
  const joinRoom = useCallback((roomId) => {
    const socket = socketRef.current;

    if (!socket) return;

    socket.emit(SOCKET_EVENTS.join, roomId, (response) => {
      if (!response?.ok) {
        addNotice(`⚠️ ${response?.error || 'Не удалось войти в канал'}`);
        return;
      }

      activeRoomRef.current = response.room;
      setActiveRoom(response.room);
      setMessages(response.messages || []); // история канала из MongoDB
      setTypingUsers([]);
    });
  }, [addNotice]);


  // ---------- Подключение к серверу (один раз при монтировании) ----------
  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setStatus('connected');
      setError(null);
      setSelfId(socket.id);
      joinRoom('general'); // при подключении входим в общий канал
    };

    const handleConnectError = (err) => {
      setStatus('error');
      setError(err?.message || 'Не удалось подключиться к серверу Socket.IO');
    };

    const handleDisconnect = () => {
      setStatus('connecting');
      setTypingUsers([]);
    };

    const handleRooms = (payload) => setRooms(payload?.rooms || []);
    const handlePresence = (payload) => setOnlineUsers(payload?.users || []);
    const handleNotice = (payload) => addNotice(payload?.text || '');

    // Новое сообщение канала (источник истины — рассылка сервера, без оптимистики)
    const handleMessage = (payload) => {
      if (payload?.room !== activeRoomRef.current) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
    };

    // Синхронизация состояния: реакции/голоса обновлены у всех участников канала
    const handleMessageUpdate = (payload) => {
      if (payload?.room !== activeRoomRef.current) return;
      setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? payload.message : m)));
    };

    const handleTyping = (payload) => {
      if (!payload || payload.socketId === socket.id) return;
      setTypingUsers((prev) => {
        const without = prev.filter((u) => u.socketId !== payload.socketId);
        return payload.isTyping ? [...without, { socketId: payload.socketId, name: payload.name }] : without;
      });
    };

    const handlePrivate = (payload) => setPrivateMessages((prev) => [...prev.slice(-49), payload]);

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on(SOCKET_EVENTS.rooms, handleRooms);
    socket.on(SOCKET_EVENTS.presence, handlePresence);
    socket.on(SOCKET_EVENTS.notice, handleNotice);
    socket.on(SOCKET_EVENTS.message, handleMessage);
    socket.on(SOCKET_EVENTS.messageUpdate, handleMessageUpdate);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:private', handlePrivate);

    // Отключаемся при размонтировании (закрытие вкладки/переключение страницы)
    return () => {
      clearTimeout(typingStopRef.current);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addNotice, joinRoom]);



  // ---------- Доп. эффект: заголовок страницы = количество онлайн ----------
  useEffect(() => {
    document.title = activeRoom
      ? `💬 Чат · ${onlineUsers.length} онлайн · Оценка эффективности`
      : 'Оценка эффективности сотрудников';

    return () => {
      document.title = 'Оценка эффективности сотрудников';
    };
  }, [activeRoom, onlineUsers.length]);

  // ---------- Автопрокрутка ленты к последнему сообщению ----------
  useEffect(() => {
    const feed = feedRef.current;

    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages, privateMessages]);

  // ---------- Отправка сообщения в активный канал ----------
  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();
    const socket = socketRef.current;

    if (!text || !socket) return;

    setIsSending(true);
    socket.emit(SOCKET_EVENTS.message, { text }, (response) => {
      setIsSending(false);

      if (!response?.ok) {
        addNotice(`❌ ${response?.error || 'Не удалось отправить сообщение'}`);
        return;
      }

      setDraft('');
      socket.emit(SOCKET_EVENTS.typing, { isTyping: false });
      clearTimeout(typingStopRef.current);
    });
  };

  // ---------- Ввод: «печатает…» с автоматическим выключением ----------
  const handleDraftChange = (event) => {
    setDraft(event.target.value);
    const socket = socketRef.current;

    if (!socket) return;

    socket.emit(SOCKET_EVENTS.typing, { isTyping: true });
    clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.typing, { isTyping: false });
    }, TYPING_STOP_MS);
  };

  // ---------- Голосование за сообщение (вложенный массив reactions[]) ----------
  const handleReact = (messageId, emoji) => {
    socketRef.current?.emit(SOCKET_EVENTS.react, { messageId, emoji }, (response) => {
      if (!response?.ok) addNotice(`⚠️ ${response?.error || 'Голос не учтён'}`);
    });
  };

  // ---------- Приватное сообщение конкретному пользователю (по socket.id) ----------
  const handlePrivateSend = (event) => {
    event.preventDefault();
    const text = dmText.trim();

    if (!text || !dmTarget) return;

    socketRef.current?.emit(SOCKET_EVENTS.privateMessage, { toSocketId: dmTarget, text }, (response) => {
      if (!response?.ok) {
        addNotice(`⚠️ ${response?.error || 'Приватное сообщение не доставлено'}`);
        return;
      }

      setDmText('');
    });
  };

  // ---------- Выход из канала ----------
  const handleLeave = () => {
    socketRef.current?.emit(SOCKET_EVENTS.leave, (response) => {
      activeRoomRef.current = response?.room || null;
      setActiveRoom(response?.room || null);
      setMessages([]);
    });
  };

  // ---------- Состояние соединения ----------
  if (status === 'error') {
    return (
      <div className="error-panel" role="alert">
        <strong>⚠️ Нет соединения с Socket.IO</strong>
        <span>{error}</span>
        <span className="chat-hint">
          Проверьте, что сервер запущен (<code>npm run dev</code> в корне проекта) — он обслуживает
          и REST API, и Socket.IO. Адрес: <code>{SOCKET_DISPLAY_URL}</code>
        </span>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          ↻ Переподключиться
        </button>
      </div>
    );
  }

  const typingLabel = typingUsers.length === 0
    ? null
    : typingUsers.length === 1
      ? `${typingUsers[0].name} печатает…`
      : `${typingUsers.map((u) => u.name).join(', ')} печатают…`;

  const others = onlineUsers.filter((u) => u.socketId !== selfId);

  // ---------- Разметка чата ----------
  return (
    <div className="chat-app">
      <section className="chat-sidebar">
        <h2>📡 Каналы (комнаты)</h2>
        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                className={`room-item${activeRoom === room.id ? ' is-active' : ''}`}
                onClick={() => joinRoom(room.id)}
              >
                <span className="room-title">
                  #{room.id} — {room.title}
                </span>
                <span className="room-online">{room.online} онлайн</span>
              </button>
            </li>
          ))}
        </ul>

        {activeRoom && (
          <button type="button" className="btn btn-ghost btn-small" onClick={handleLeave}>
            🚪 Выйти из канала
          </button>
        )}

        <h2>👥 Онлайн ({onlineUsers.length})</h2>
        <ul className="presence-list" data-testid="presence-list">
          {onlineUsers.map((user) => (
            <li key={user.socketId}>
              <span>
                {user.name}
                {user.socketId === selfId ? ' (вы)' : ''}
              </span>
              <span className="badge">{user.room ? `#${user.room}` : 'вне каналов'}</span>
            </li>
          ))}
        </ul>

        <form className="dm-form" onSubmit={handlePrivateSend}>
          <h2>✉️ Личное сообщение</h2>
          <select value={dmTarget} onChange={(e) => setDmTarget(e.target.value)}>
            <option value="">— кому —</option>
            {others.map((user) => (
              <option key={user.socketId} value={user.socketId}>
                {user.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Текст личного сообщения"
            value={dmText}
            onChange={(e) => setDmText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-small" disabled={!dmTarget || !dmText.trim()}>
            Отправить приватно
          </button>
          <p className="chat-hint">Доставка по socket.id напрямую, минуя комнаты (в БД не сохраняется).</p>
        </form>
      </section>

      <section className="chat-main">
        <header className="chat-header">
          <h2>
            {activeRoom ? `#${activeRoom}` : 'Подключение к каналу…'}
            {status === 'connected' ? ' 🟢' : ' 🟡'}
          </h2>
          <span className="badge">{me?.email || 'гость'}</span>
        </header>

        <div className="chat-feed" ref={feedRef} data-testid="chat-feed">
          {messages.length === 0 && <p className="empty-state">Сообщений пока нет — напишите первым.</p>}
          {messages.map((message) => (
            <article key={message.id} className="chat-message" data-testid={`message-${message.id}`}>
              <header>
                <strong>{message.authorName}</strong>
                <time>{new Date(message.createdAt).toLocaleTimeString('ru-RU')}</time>
              </header>
              <p>{message.text}</p>
              <div className="chat-reactions">
                {REACTION_EMOJIS.map((emoji) => {
                  const reaction = message.reactions?.find((r) => r.emoji === emoji);
                  const count = reaction?.users?.length || 0;
                  const mine = Boolean(me?.email && reaction?.users?.includes(me.email));

                  return (
                    <button
                      key={emoji}
                      type="button"
                      className={`reaction${mine ? ' is-mine' : ''}`}
                      onClick={() => handleReact(message.id, emoji)}
                      title={reaction?.users?.join(', ') || 'Голосов нет'}
                    >
                      {emoji} {count}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <p className="chat-typing" role="status">
          {typingLabel || '\u00A0'}
        </p>

        <form className="chat-form" onSubmit={handleSend}>
          <input
            type="text"
            placeholder={activeRoom ? `Сообщение в #${activeRoom}…` : 'Войдите в канал'}
            value={draft}
            onChange={handleDraftChange}
            disabled={!activeRoom}
            aria-label="Текст сообщения"
          />
          <button type="submit" className="btn btn-primary" disabled={!draft.trim() || isSending || !activeRoom}>
            {isSending ? '⏳' : '➤ Отправить'}
          </button>
        </form>

        <footer className="app-footer">
          Socket.IO: <code>{SOCKET_DISPLAY_URL}</code> (тот же сервер, что и REST API{' '}
          <code>{activeRoom ? `#${activeRoom}` : '—'}</code>). История канала хранится в MongoDB
          (<code>messages_mongo</code>), голоса — во вложенном массиве <code>reactions[]</code>.
        </footer>
      </section>

      <aside className="chat-notices">
        <h2>🔔 Уведомления в реальном времени</h2>
        <ul data-testid="notice-list">
          {notices.map((notice, index) => (
            <li key={`${notice.at}-${index}`}>
              <time>{new Date(notice.at).toLocaleTimeString('ru-RU')}</time> {notice.text}
            </li>
          ))}
        </ul>

        <h2>✉️ Личные сообщения</h2>
        <ul data-testid="dm-list">
          {privateMessages.length === 0 && <li className="chat-hint">Пока пусто.</li>}
          {privateMessages.map((dm) => (
            <li key={dm.id}>
              <strong>{dm.fromName}</strong> → {dm.toName}: {dm.text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}


