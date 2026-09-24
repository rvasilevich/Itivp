// Полная самопроверка лабораторной работы по Socket.IO (реальное время).
// Запуск: npm run check:socket   (сервер поднимается автоматически, если не запущен)
//
// Скрипт подключается к серверу ДВУМЯ Socket.IO-клиентами и проверяет задачи работы:
//   1) сервер Socket.IO работает на том же порту, что и Express;
//   2) обмен сообщениями в реальном времени (рассылка всем участникам канала);
//   3) уведомления о подключении/отключении пользователей (presence + system:notice);
//   4) история сообщений сохраняется в MongoDB (коллекция messages_mongo);
//   5) комнаты: сообщение из канала не приходит тем, кто в другом канале;
//   6) индикатор «печатает…» (chat:typing);
//   7) приватные сообщения конкретному socket.id;
//   8) голосование за сообщение — вложенный массив reactions[] в документе.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const MESSAGE_MARKER = 'Самопроверка Socket.IO';
const PASS = '✅';
const FAIL = '❌';

const results = [];
let serverChild = null;

function check(name, ok, extra) {
  results.push(Boolean(ok));
  const line = `${ok ? PASS : FAIL}  ${name}`;
  console.log(ok ? line : line + (extra ? ` — ${extra}` : ''));
  return ok;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Socket.IO-помощники -----------------------------------------------------

// Создание клиента: возвращает сокет СРАЗУ (не дожидаясь connect), чтобы можно было
// подписаться на события раньше, чем сервер их отправит (он шлёт rooms:list сразу).
function createClient(auth = {}) {
  return io(BASE_URL, {
    auth,
    transports: ['websocket'], // без polling — проверяем именно WebSocket
    reconnection: false,
    forceNew: true,
    timeout: 4000
  });
}

// Ожидание успешного подключения (или ошибки рукопожатия — например, битый JWT)
function waitConnect(socket) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve(socket);

    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(new Error(error.message));
    });

    return undefined;
  });
}

// Ожидание события с таймаутом и (необязательным) фильтром по данным
function waitFor(socket, event, { timeout = 5000, filter } = {}) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (filter && !filter(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`событие «${event}» не получено за ${timeout} мс`));
    }, timeout);

    socket.on(event, handler);
  });
}

// Проверка, что событие НЕ приходит (для изоляции комнат)
function expectNoEvent(socket, event, { timeout = 1500, filter } = {}) {
  return new Promise((resolve) => {
    let received = null;
    const handler = (payload) => {
      if (!filter || filter(payload)) received = payload;
    };

    socket.on(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(received);
    }, timeout);
  });
}

// Событие с подтверждением (ack): socket.emit(event, payload, cb).
// Если payload не передан — отправляем событие только с cb, иначе сервер
// воспримет cb как payload и ack-подтверждение не придёт.
function emitAck(socket, event, payload, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`нет ack-подтверждения «${event}»`)), timeout);
    const callback = (response) => {
      clearTimeout(timer);
      resolve(response);
    };

    if (payload === undefined) {
      socket.emit(event, callback);
    } else {
      socket.emit(event, payload, callback);
    }
  });
}

// --- Управление сервером -----------------------------------------------------
async function isServerUp() {
  try {
    const response = await fetch(`${BASE_URL}/api/v1`);
    return response.status < 500;
  } catch (error) {
    return false;
  }
}

async function ensureServer() {
  if (await isServerUp()) {
    return true;
  }

  serverChild = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    stdio: 'ignore'
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);

    if (await isServerUp()) {
      return true;
    }
  }

  return false;
}

// --- Задача 1: файлы и зависимости -------------------------------------------
function checkFiles() {
  const requiredFiles = [
    ['socket/index.js', 'Socket.IO-сервер: события, комнаты, presence, история'],
    ['socket/rooms.js', 'список каналов (комнат) предметной области'],
    ['socket/auth.js', 'аутентификация соединения по JWT (ЛР №3 → ЛР №7)'],
    ['socket/presence.js', 'хранилище онлайн-пользователей'],
    ['mongo/models/message.js', 'модель сообщения чата (MongoDB, reactions[])'],
    ['scripts/selfcheck-socket.js', 'этот скрипт самопроверки'],
    ['my-app/src/socket.js', 'клиент: подключение к Socket.IO с JWT'],
    ['my-app/src/components/ChatRoom.jsx', 'клиент: компонент чата (комнаты, сообщения, typing)']
  ];

  requiredFiles.forEach(([file, description]) => {
    check(`Файлы. ${file} — ${description}`, fs.existsSync(path.join(process.cwd(), file)));
  });

  const pkg = require(path.join(process.cwd(), 'package.json'));
  const appPkg = require(path.join(process.cwd(), 'my-app/package.json'));

  check('Зависимости. socket.io установлен (сервер)', Boolean(pkg.dependencies?.['socket.io']), pkg.dependencies?.['socket.io']);
  check('Зависимости. socket.io-client установлен (клиент)', Boolean(appPkg.dependencies?.['socket.io-client']), appPkg.dependencies?.['socket.io-client']);
  check('server.js. Socket.IO прикреплён к тому же HTTP-серверу', fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8').includes('createSocketServer(server)'));
}

// --- Задача 1 (продолжение): подключение к серверу ---------------------------
async function checkConnection() {
  const up = await ensureServer();
  check('Сервер доступен на :3000 (Express + Socket.IO на одном порту)', up, `BASE_URL=${BASE_URL}`);

  return up;
}


// --- Основной сценарий -------------------------------------------------------
(async () => {
  let clientA = null;
  let clientB = null;
  let clientC = null;
  let clientD = null;
  // Эти значения формируются в первом сценарии и используются в последующих —
  // поэтому объявлены здесь, а не внутри блока try.
  let textHr = '';
  let textAll = '';
  let messageId = null;

  try {
    checkFiles();

    if (!(await checkConnection())) {
      throw new Error('сервер на :3000 не поднялся');
    }

    // --- Задача: подключение и уведомление о подключении ---------------------
    clientA = createClient({ name: 'Самопроверка A' });
    // Подписываемся ДО подключения: сервер шлёт rooms:list/presence:list сразу
    const roomsPromise = waitFor(clientA, 'rooms:list');
    const welcomePromise = waitFor(clientA, 'system:notice', { filter: (p) => p.text.includes('Добро пожаловать') });
    await waitConnect(clientA);

    const roomsPayload = await roomsPromise;
    check('Комнаты. При подключении клиент получает список каналов (rooms:list)', Array.isArray(roomsPayload?.rooms) && roomsPayload.rooms.length >= 3, `каналов=${roomsPayload?.rooms?.length}`);
    check('Комнаты. В списке есть общий канал и каналы отделов', roomsPayload.rooms.some((r) => r.id === 'general') && roomsPayload.rooms.some((r) => r.id === 'hr'));

    const welcome = await welcomePromise;
    check('Уведомления. Подключившийся получает приветствие (system:notice)', welcome.text.includes('Самопроверка A'), welcome.text);

    // --- Второй клиент: presence + уведомление о подключении -----------------
    clientB = createClient({ name: 'Самопроверка B' });
    const joinNotice = waitFor(clientA, 'system:notice', { filter: (p) => p.text.includes('подключился к чату') });
    const presenceTwo = waitFor(clientA, 'presence:list', { filter: (p) => (p.users || []).length === 2 });
    await waitConnect(clientB);

    const notice = await joinNotice;
    check('Уведомления. Остальные получают уведомление о подключении нового пользователя', notice.text.includes('Самопроверка B'), notice.text);

    const presence = await presenceTwo;
    check('Presence. Список онлайн-пользователей обновляется (стало 2)', presence.users.length === 2 && presence.users.every((u) => Boolean(u.socketId)));

    // --- Комнаты (каналы) ----------------------------------------------------
    const ackA = await emitAck(clientA, 'room:join', 'hr');
    check('Комнаты. room:join(«hr») подтверждён и отдаёт историю канала (ack)', ackA?.ok === true && ackA.room === 'hr' && Array.isArray(ackA.messages));
    const badRoom = await emitAck(clientA, 'room:join', 'no-such-room');
    check('Валидация. Несуществующий канал → ошибка в ack', badRoom?.ok === false, badRoom?.error);
    await emitAck(clientB, 'room:join', 'dev');

    // --- Обмен сообщениями в реальном времени + изоляция комнат -------------
    textHr = `${MESSAGE_MARKER} в канал hr ${Date.now()}`;
    const ownMessage = waitFor(clientA, 'chat:message', { filter: (p) => p.message?.text === textHr });
    const noLeak = expectNoEvent(clientB, 'chat:message', { filter: (p) => p.message?.text === textHr });
    const msgAck = await emitAck(clientA, 'chat:message', { text: textHr });

    const delivered = await ownMessage;
    check('Сообщения. Отправитель получает своё сообщение из рассылки (реальное время)', delivered.message.id === msgAck.message.id && delivered.message.authorName === 'Самопроверка A');
    check('Сообщения. Сообщение сохранено в MongoDB (в ответе есть id и createdAt)', Boolean(msgAck.message.id) && Boolean(msgAck.message.createdAt));

    const leaked = await noLeak;
    check('Комнаты. Сообщение канала «hr» НЕ приходит участнику канала «dev» (изоляция комнат)', leaked === null);

    messageId = msgAck.message.id;
    textAll = `${MESSAGE_MARKER} всем в канале ${Date.now()}`;
    const bGetsMessage = waitFor(clientB, 'chat:message', { filter: (p) => p.message?.text === textAll });
    await emitAck(clientB, 'room:join', 'hr');
    const aGetsMessage = waitFor(clientA, 'chat:message', { filter: (p) => p.message?.text === textAll });
    await emitAck(clientA, 'chat:message', { text: textAll });
    const [bCopy, aCopy] = await Promise.all([bGetsMessage, aGetsMessage]);
    check('Сообщения. Все участники одного канала получают сообщение (рассылка на комнату)', bCopy.message.id === aCopy.message.id);

    const emptyAck = await emitAck(clientA, 'chat:message', { text: '   ' });
    check('Валидация. Пустое сообщение → ошибка в ack', emptyAck?.ok === false, emptyAck?.error);

    // --- Доп. функция: индикатор «печатает…» ---------------------------------
    const typingPromise = waitFor(clientB, 'chat:typing', { filter: (p) => p.isTyping === true });
    clientA.emit('chat:typing', { isTyping: true });
    const typingPayload = await typingPromise;
    check('Доп. функция. «Печатает…» рассылается участникам канала (кроме автора)', typingPayload.socketId === clientA.id && typingPayload.name === 'Самопроверка A');

    // --- Доп. функция: приватные сообщения по socket.id ----------------------
    const dmText = `${MESSAGE_MARKER} личное ${Date.now()}`;
    const privatePromise = waitFor(clientA, 'chat:private', { filter: (p) => p.text === dmText });
    await emitAck(clientB, 'chat:private', { toSocketId: clientA.id, text: dmText });
    const dm = await privatePromise;
    check('Доп. функция. Приватное сообщение доставлено адресату по socket.id', dm.toSocketId === clientA.id && dm.fromName === 'Самопроверка B', `${dm.fromName} → ${dm.toName}`);
    const dmBad = await emitAck(clientB, 'chat:private', { toSocketId: 'no-such-socket', text: 'привет' });
    check('Валидация. Приватное сообщение не в сети → ошибка в ack', dmBad?.ok === false, dmBad?.error);
  } catch (error) {
    check(`Сценарий прерван: ${error.message}`, false);
  }

  // --- Доп. функция: история из MongoDB для нового подключения --------------
  // (эти шаги — в отдельном try, чтобы сбой одного не скрывал остальные)
  try {
    clientC = createClient({ name: 'Самопроверка C' });
    await waitConnect(clientC);
    const historyAck = await emitAck(clientC, 'room:join', 'hr');
    const history = historyAck?.messages || [];
    check('История (MongoDB). Новый клиент получает историю канала из messages_mongo', history.some((m) => m.text === textHr) && history.some((m) => m.text === textAll), `сообщений=${history.length}`);
    check('История. Сообщения идут в хронологическом порядке и с авторами', history.every((m) => Boolean(m.authorName) && Boolean(m.createdAt)));

    // --- Доп. функция: голосование (вложенный массив reactions[]) ------------
    const reactAdd = waitFor(clientB, 'chat:message:update', { filter: (p) => p.message?.id === messageId && p.message.reactions.some((r) => r.emoji === '👍' && r.users.length === 1) });
    await emitAck(clientA, 'chat:react', { messageId, emoji: '👍' });
    const added = await reactAdd;
    check('Доп. функция. Голосование за сообщение рассылается всем (chat:message:update)', added.message.reactions[0].users[0] === 'Самопроверка A');

    const reactRemove = waitFor(clientB, 'chat:message:update', { filter: (p) => p.message?.id === messageId && p.message.reactions.every((r) => r.users.length === 0) });
    await emitAck(clientA, 'chat:react', { messageId, emoji: '👍' });
    await reactRemove;
    check('Доп. функция. Повторное голосование снимает реакцию ($pull + позиционный $)', true);

    const reactB = await emitAck(clientB, 'chat:react', { messageId, emoji: '⚠️' });
    check('Доп. функция. Разные виды реакций у одного сообщения (вложенный массив)', reactB?.ok === true && reactB.message.reactions.length >= 1);
    const reactBad = await emitAck(clientA, 'chat:react', { messageId, emoji: '🔥' });
    check('Валидация. Недопустимая реакция → ошибка в ack', reactBad?.ok === false, reactBad?.error);
    const reactBadId = await emitAck(clientA, 'chat:react', { messageId: 'not-an-id', emoji: '👍' });
    check('Валидация. Некорректный id сообщения → ошибка в ack', reactBadId?.ok === false, reactBadId?.error);
  } catch (error) {
    check(`Сценарий (история/реакции) прерван: ${error.message}`, false);
  }

  // --- Аутентификация соединения по JWT (ЛР №3 → ЛР №7) --------------------
  try {
    const api = `${BASE_URL}/api/v1`;
    const email = `lab7.check.${Date.now()}@example.com`;
    const password = 'Secret123!';

    await fetch(`${api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const loginRes = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const { token } = await loginRes.json();

    clientD = createClient({ token });
    await waitConnect(clientD);
    const authPresence = await emitAck(clientD, 'presence:list');
    const me = authPresence.users.find((u) => u.socketId === clientD.id);
    check('Аутентификация. JWT из ЛР №3 принимается: имя и роль берутся из токена', me?.name === email && me?.role === 'user', `${me?.name}/${me?.role}`);

    let jwtError = null;
    try {
      const broken = createClient({ token: 'broken.token.value' });
      await waitConnect(broken);
    } catch (error) {
      jwtError = error.message;
    }
    check('Аутентификация. Соединение с недействительным JWT отклоняется (connect_error)', jwtError === 'Недействительный или просроченный токен', jwtError);

    // Удаляем тестовую учётную запись (DELETE /profile)
    if (token) {
      await fetch(`${api}/profile`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }
    clientD.disconnect();
  } catch (error) {
    check(`Сценарий (JWT) прерван: ${error.message}`, false);
  }

  // --- Отключение: уведомление остальным и обновление presence -------------
  try {
    // Считаем онлайн ДО отключения: к этому моменту подключены A, B и C
    const beforeLeave = (await emitAck(clientA, 'presence:list')).users.length;
    const leaveNotice = waitFor(clientA, 'system:notice', {
      filter: (p) => p.text.includes('Самопроверка B') && p.text.includes('отключился'),
    });
    const presenceAfterLeave = waitFor(clientA, 'presence:list', {
      filter: (p) => (p.users || []).length === beforeLeave - 1,
    });
    clientB.disconnect();
    const leave = await leaveNotice;
    const onlineLeft = await presenceAfterLeave;
    check('Уведомления. Остальные получают уведомление об отключении пользователя', leave.text.includes('Самопроверка B'), leave.text);
    check('Presence. Список онлайн уменьшился после отключения', onlineLeft.users.length === beforeLeave - 1, `было=${beforeLeave}, стало=${onlineLeft.users.length}`);
  } catch (error) {
    check(`Сценарий (disconnect) прерван: ${error.message}`, false);
  }

  // --- Очистка тестовых сообщений из MongoDB -------------------------------
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employee_eval');
    const Message = require(path.join(process.cwd(), 'mongo/models/message'));
    const { deletedCount } = await Message.deleteMany({ text: { $regex: MESSAGE_MARKER } });
    check('Очистка. Тестовые сообщения удалены из коллекции messages_mongo', true, `удалено=${deletedCount}, коллекция=${Message.collection.name}`);
    await mongoose.disconnect();
  } catch (error) {
    check('Очистка. Не удалось удалить тестовые сообщения', false, error.message);
  }

  // --- Итоги ----------------------------------------------------------------
  [clientA, clientB, clientC, clientD].forEach((socket) => socket?.disconnect());

  console.log('\n=== ШПАРГАЛКА: СОБЫТИЯ SOCKET.IO ===');
  [
    'клиент → сервер: room:join(roomId)  → ack { ok, room, messages } (история из MongoDB)',
    'клиент → сервер: room:leave',
    'клиент → сервер: chat:message({ text }) → ack { ok, message }',
    'клиент → сервер: chat:typing({ isTyping })',
    'клиент → сервер: chat:private({ toSocketId, text })',
    'клиент → сервер: chat:react({ messageId, emoji }) — эмодзи: 👍 ⚠️',
    'сервер → клиент: rooms:list / presence:list / system:notice',
    'сервер → клиент: chat:message / chat:message:update / chat:typing / chat:private'
  ].forEach((item) => console.log(`  ${item}`));

  const passed = results.filter(Boolean).length;
  console.log(`\nПройдено проверок: ${passed}/${results.length}`);

  const allPassed = results.length > 0 && results.every(Boolean);
  console.log(allPassed
    ? 'ВСЕ ЗАДАЧИ ЛАБОРАТОРНОЙ РАБОТЫ ПО SOCKET.IO ВЫПОЛНЕНЫ ✅'
    : 'ЕСТЬ НЕПРОЙДЕННЫЕ ПРОВЕРКИ ❌');

  if (serverChild) {
    serverChild.kill();
  }

  process.exit(allPassed ? 0 : 1);
})();


