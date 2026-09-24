// Socket.IO-сервер приложения «Оценка эффективности сотрудников» (ЛР №7).
//
// Монтируется в server.js на ТОТ ЖЕ HTTP-сервер, что и Express (порт 3000),
// поэтому клиент подключается к http://localhost:3000 — без префикса /api/v1
// (Socket.IO работает по своим путям /socket.io/*).
//
// Что реализовано (задачи работы):
//  1) обмен сообщениями в реальном времени (события chat:message / chat:message:update);
//  2) уведомления о подключении/отключении пользователей (presence:list, system:notice);
//  3) дополнительные функции по предметной области:
//     • комнаты — общий канал + канал на каждый отдел (socket.io rooms);
//     • история сообщений в MongoDB (Mongoose, коллекция messages_mongo);
//     • индикатор «печатает…» (chat:typing);
//     • приватные сообщения по socket.id;
//     • голосование за сообщение «👍 полезно / ⚠️ требует внимания» — обновление
//       ВЛОЖЕННОГО массива reactions[] прямо в документе сообщения.
const { Server } = require('socket.io');
const Message = require('../mongo/models/message');
const authenticate = require('./auth');
const PresenceStore = require('./presence');
const { findRoom, publicRooms } = require('./rooms');

const HISTORY_LIMIT = 50; // сколько последних сообщений канала отдаём при входе
const MAX_TEXT_LENGTH = 1000;
const MAX_NAME_LENGTH = 60;
const REACTION_EMOJIS = ['👍', '⚠️'];

// Ответ на событие с подтверждением (ack): клиент вызывает socket.emit(ev, data, cb).
function reply(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

// Документ MongoDB → «плоский» объект для клиента
function toClientMessage(doc) {
  return {
    id: String(doc._id),
    room: doc.room,
    authorId: doc.authorId,
    authorName: doc.authorName,
    text: doc.text,
    kind: doc.kind,
    reactions: (doc.reactions || []).map((reaction) => ({
      emoji: reaction.emoji,
      users: reaction.users || []
    })),
    createdAt: doc.createdAt
  };
}

// Голосование за сообщение («переключатель» реакции одного пользователя).
// Демонстрирует три способа обновления ВЛОЖЕННОГО массива:
// позиционный оператор «$» с $pull и $addToSet, а для новой реакции — $push.
async function toggleReaction(messageId, emoji, userName) {
  // 1) Пользователь уже голосовал за этот эмодзи → снимаем голос
  let doc = await Message.findOneAndUpdate(
    { _id: messageId, reactions: { $elemMatch: { emoji, users: userName } } },
    { $pull: { 'reactions.$.users': userName } },
    { new: true }
  );

  if (doc) {
    return doc;
  }

  // 2) Группа реакций с таким эмодзи уже есть → добавляем голос (без дублей)
  doc = await Message.findOneAndUpdate(
    { _id: messageId, 'reactions.emoji': emoji },
    { $addToSet: { 'reactions.$.users': userName } },
    { new: true }
  );

  if (doc) {
    return doc;
  }

  // 3) Реакции с таким эмодзи ещё нет → создаём её во вложенном массиве
  return Message.findByIdAndUpdate(
    messageId,
    { $push: { reactions: { emoji, users: [userName] } } },
    { new: true }
  );
}

// Создаёт Socket.IO-сервер поверх общего HTTP-сервера и возвращает его
function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    // Клиент Vite живёт на другом origin (:5173) — как и у REST API, CORS открыт
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  const presence = new PresenceStore();

  // ---------- Аутентификация на рукопожатии (JWT из ЛР №3) ----------
  // Заголовки в WebSocket недоступны, поэтому токен приходит в auth:
  //   io(SOCKET_URL, { auth: { token, name } })
  io.use((socket, next) => {
    const result = authenticate(socket);

    if (result.error) {
      // Клиент получит ошибку в обработчике 'connect_error'
      return next(new Error(result.error));
    }

    const guestName = String(socket.handshake.auth?.name || '')
      .trim()
      .slice(0, MAX_NAME_LENGTH);

    socket.data.user = result.user || null;
    // Имя для чата: email авторизованного пользователя, присланное имя или «Гость-XXXX»
    socket.data.name = result.user?.email || guestName || `Гость-${socket.id.slice(0, 4)}`;

    next();
  });

  // ---------- Вспомогательные рассылки ----------
  const roomsPayload = () => ({ rooms: publicRooms(presence.onlineByRoom()) });
  const presencePayload = () => ({ users: presence.list() });
  const broadcastRooms = () => io.emit('rooms:list', roomsPayload());
  const broadcastPresence = () => io.emit('presence:list', presencePayload());
  const systemNotice = (text, room = null) => {
    const payload = { text, at: new Date().toISOString() };

    if (room) {
      io.to(room).emit('system:notice', payload);
    } else {
      io.emit('system:notice', payload);
    }
  };


  io.on('connection', (socket) => {
    const { user, name } = socket.data;

    presence.add(socket.id, {
      name,
      id: user?.id ?? null,
      role: user?.role ?? 'guest',
      room: null,
      connectedAt: new Date().toISOString()
    });

    console.log(`Socket connected: ${socket.id} (${name})`);

    // Новому клиенту — каналы, список онлайн и приветствие;
    // остальным — уведомление о подключении и обновлённый список онлайн
    socket.emit('rooms:list', roomsPayload());
    socket.emit('presence:list', presencePayload());
    socket.emit('system:notice', {
      text: `👋 Добро пожаловать, ${name}! Выберите канал и напишите сообщение.`,
      at: new Date().toISOString()
    });
    socket.broadcast.emit('system:notice', {
      text: `🟢 ${name} подключился к чату`,
      at: new Date().toISOString()
    });
    broadcastPresence();
    broadcastRooms();

    // ---------- Справочники по запросу клиента ----------
    socket.on('rooms:list', (ack) => reply(ack, { ok: true, ...roomsPayload() }));
    socket.on('presence:list', (ack) => reply(ack, { ok: true, ...presencePayload() }));

    // ---------- Вход в канал (комнату) + история из MongoDB ----------
    socket.on('room:join', async (roomId, ack) => {
      const room = findRoom(roomId);

      if (!room) {
        return reply(ack, { ok: false, error: `Канал «${roomId}» не найден` });
      }

      const previous = socket.data.room;

      if (previous && previous !== room.id) {
        socket.leave(previous);
        // Раньше «печатал…» в старом канале — гасим индикатор
        socket.to(previous).emit('chat:typing', {
          room: previous,
          socketId: socket.id,
          name,
          isTyping: false
        });
      }

      socket.join(room.id);
      socket.data.room = room.id;
      presence.setRoom(socket.id, room.id);

      // История канала: последние HISTORY_LIMIT сообщений (в хронологическом порядке)
      let messages = [];

      try {
        const docs = await Message.find({ room: room.id }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);
        messages = docs.reverse().map(toClientMessage);
      } catch (error) {
        // MongoDB недоступна — чат продолжает работать «в прямом эфире», но без истории
        socket.emit('system:notice', {
          text: `⚠️ История сообщений недоступна: ${error.message}`,
          at: new Date().toISOString()
        });
      }

      io.to(room.id).emit('system:notice', {
        text: `📢 ${name} присоединился к каналу «${room.title}»`,
        at: new Date().toISOString()
      });
      broadcastRooms();
      broadcastPresence();

      return reply(ack, { ok: true, room: room.id, messages });
    });

    // ---------- Выход из канала ----------
    socket.on('room:leave', (ack) => {
      const roomId = socket.data.room;

      if (roomId) {
        socket.leave(roomId);
        socket.data.room = null;
        presence.setRoom(socket.id, null);
        broadcastRooms();
        broadcastPresence();
      }

      return reply(ack, { ok: true, room: null });
    });


    // ---------- Новое сообщение в канале (сохранение в MongoDB + рассылка) ----------
    socket.on('chat:message', async (payload, ack) => {
      const body = typeof payload?.text === 'string' ? payload.text.trim() : '';
      const roomId = socket.data.room;

      if (!body) {
        return reply(ack, { ok: false, error: 'Сообщение не может быть пустым' });
      }

      if (!roomId) {
        return reply(ack, { ok: false, error: 'Сначала выберите канал' });
      }

      if (body.length > MAX_TEXT_LENGTH) {
        return reply(ack, {
          ok: false,
          error: `Сообщение слишком длинное: максимум ${MAX_TEXT_LENGTH} символов`
        });
      }

      try {
        const doc = await Message.create({
          room: roomId,
          authorId: user?.id ?? null,
          authorName: name,
          text: body,
          kind: 'user'
        });

        const message = toClientMessage(doc);

        // Всем участникам канала (включая отправителя — у него сообщение появится
        // из рассылки, а не «оптимистично» на клиенте, поэтому дублей нет)
        io.to(roomId).emit('chat:message', { room: roomId, message });

        return reply(ack, { ok: true, message });
      } catch (error) {
        return reply(ack, { ok: false, error: `Не удалось сохранить сообщение: ${error.message}` });
      }
    });

    // ---------- Индикатор «печатает…» (рассылается всем, кроме автора) ----------
    socket.on('chat:typing', (payload) => {
      const roomId = socket.data.room;

      if (!roomId) {
        return;
      }

      socket.to(roomId).emit('chat:typing', {
        room: roomId,
        socketId: socket.id,
        name,
        isTyping: Boolean(payload?.isTyping)
      });
    });

    // ---------- Приватное сообщение конкретному пользователю (по socket.id) ----------
    socket.on('chat:private', (payload, ack) => {
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      const target = io.sockets.sockets.get(payload?.toSocketId);

      if (!text) {
        return reply(ack, { ok: false, error: 'Сообщение не может быть пустым' });
      }

      if (!target) {
        return reply(ack, { ok: false, error: 'Пользователь не в сети' });
      }

      const to = presence.get(target.id);
      const message = {
        id: `dm-${Date.now()}-${socket.id.slice(0, 4)}`,
        fromSocketId: socket.id,
        fromName: name,
        toSocketId: target.id,
        toName: to?.name || 'пользователь',
        text,
        createdAt: new Date().toISOString()
      };

      // Доставляем адресату и возвращаем эхо отправителю (личные сообщения
      // в MongoDB не сохраняются — только доставка в реальном времени)
      target.emit('chat:private', message);
      socket.emit('chat:private', message);

      return reply(ack, { ok: true, message });
    });

    // ---------- Голосование за сообщение (вложенный массив reactions[]) ----------
    socket.on('chat:react', async (payload, ack) => {
      const { messageId, emoji } = payload || {};

      if (!REACTION_EMOJIS.includes(emoji)) {
        return reply(ack, { ok: false, error: `Допустимые реакции: ${REACTION_EMOJIS.join(' ')}` });
      }

      try {
        const doc = await toggleReaction(messageId, emoji, name);

        if (!doc) {
          return reply(ack, { ok: false, error: 'Сообщение не найдено' });
        }

        const message = toClientMessage(doc);

        // Синхронизация состояния у всех участников канала
        io.to(doc.room).emit('chat:message:update', { room: doc.room, message });

        return reply(ack, { ok: true, message });
      } catch (error) {
        return reply(ack, { ok: false, error: error.message });
      }
    });

    // ---------- Отключение: обновляем присутствие и уведомляем остальных ----------
    socket.on('disconnect', (reason) => {
      const left = presence.remove(socket.id);

      console.log(`Socket disconnected: ${socket.id} (${left?.name || 'unknown'}, ${reason})`);

      if (!left) {
        return;
      }

      if (socket.data.room) {
        socket.to(socket.data.room).emit('chat:typing', {
          room: socket.data.room,
          socketId: socket.id,
          name: left.name,
          isTyping: false
        });
      }

      systemNotice(`🔴 ${left.name} отключился от чата`);
      broadcastPresence();
      broadcastRooms();
    });
  });

  return io;
}

module.exports = { createSocketServer, REACTION_EMOJIS, HISTORY_LIMIT };

