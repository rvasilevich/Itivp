// Полная самопроверка лабораторной работы №3 (JWT + RBAC)
// Запуск: cd /Users/rodion/my-node-app && npm run check:lab3
// Скрипт сам поднимает сервер, если он ещё не запущен на порту 3000.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { spawn } = require('child_process');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';
const TEST_PREFIX = 'lab3.check';
const TEST_PASSWORD = 'Secret123!';

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

// --- HTTP-помощник -----------------------------------------------------------
async function request(method, url, { body, token } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  return { status: response.status, body: data };
}

// --- Управление сервером -----------------------------------------------------
async function isServerUp() {
  try {
    const response = await fetch(`${API}/employees`);
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
    ['models/user.js', 'модель пользователя (email, passwordHash, role)'],
    ['migrations/20260917165218-create-user.js', 'миграция создания таблицы Users'],
    ['seeders/20260917170000-demo-admin-user.js', 'сид демо-администратора'],
    ['middleware/auth.js', 'middleware проверки JWT'],
    ['middleware/isAdmin.js', 'middleware RBAC (только роль admin)'],
    ['app/api/v1/auth.js', 'маршруты регистрации и входа'],
    ['app/api/v1/profile.js', 'защищённые маршруты текущего пользователя'],
    ['app/api/v1/admin.js', 'защищённые маршруты администратора'],
    ['services/authService.js', 'сервис аутентификации'],
    ['repositories/userRepository.js', 'репозиторий пользователей'],
    ['schemas/authSchema.js', 'валидация данных аутентификации']
  ];

  requiredFiles.forEach(([file, description]) => {
    check(`Файлы. ${file} — ${description}`, fs.existsSync(path.join(process.cwd(), file)));
  });

  const pkg = require(path.join(process.cwd(), 'package.json'));
  const deps = pkg.dependencies || {};
  check('Зависимости. jsonwebtoken установлен', Boolean(deps.jsonwebtoken), deps.jsonwebtoken);
  check('Зависимости. bcrypt установлен', Boolean(deps.bcrypt), deps.bcrypt);
  check('Зависимости. dotenv установлен', Boolean(deps.dotenv), deps.dotenv);
  check('Переменные окружения. JWT_SECRET задан в .env', Boolean(process.env.JWT_SECRET));
}

// --- Задача 1: база данных ---------------------------------------------------
async function checkDatabase() {
  const models = require(path.join(process.cwd(), 'models'));
  const { User, sequelize } = models;

  try {
    await sequelize.authenticate();
    check('БД. Sequelize подключается к PostgreSQL', true, String(process.env.DATABASE_URL).split('@')[1].split('?')[0]);
  } catch (error) {
    check('БД. Sequelize подключается к PostgreSQL', false, error.message);
    return null;
  }

  const [tables] = await sequelize.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1"
  );
  const tableNames = tables.map((row) => row.table_name);
  check('Задача 1. Таблица Users создана миграцией', tableNames.includes('Users'), tableNames.join(', '));

  const [columns] = await sequelize.query(
    "select column_name, is_nullable from information_schema.columns where table_name='Users' order by ordinal_position"
  );
  const columnMap = Object.fromEntries(columns.map((row) => [row.column_name, row.is_nullable]));
  check('Задача 1. Колонки id/email/passwordHash/role присутствуют',
    ['id', 'email', 'passwordHash', 'role'].every((column) => column in columnMap),
    columns.map((row) => row.column_name).join(', '));
  check('Задача 1. email и passwordHash объявлены NOT NULL',
    columnMap.email === 'NO' && columnMap.passwordHash === 'NO');

  const [indexes] = await sequelize.query("select indexdef from pg_indexes where tablename='Users'");
  const uniqueEmailIndex = indexes.find((row) => /unique/i.test(row.indexdef) && /email/i.test(row.indexdef));
  check('Задача 1. Уникальность email обеспечена UNIQUE-индексом в БД', Boolean(uniqueEmailIndex),
    uniqueEmailIndex ? uniqueEmailIndex.indexdef : indexes.map((row) => row.indexdef).join(' | '));

  const [migrations] = await sequelize.query("select name from \"SequelizeMeta\" where name like '%create-user%'");
  check('Задача 1. Миграция create-user отмечена как применённая', migrations.length === 1);

  return models;
}

// --- Демо-администратор для проверки RBAC ------------------------------------
async function ensureAdminToken(db) {
  const attempt = await request('POST', `${API}/auth/login`, {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  if (attempt.status === 200) {
    return attempt.body.token;
  }

  if (!db) {
    return null;
  }

  // Администратора нет (или пароль другой) — создаём/обновляем его напрямую в БД
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await db.User.findOne({ where: { email: ADMIN_EMAIL } });

  if (admin) {
    admin.passwordHash = passwordHash;
    admin.role = 'admin';
    await admin.save();
  } else {
    await db.User.create({ email: ADMIN_EMAIL, passwordHash, role: 'admin' });
  }

  const retry = await request('POST', `${API}/auth/login`, {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  return retry.status === 200 ? retry.body.token : null;
}

// --- Очистка тестовых данных -------------------------------------------------
async function cleanup(db) {
  if (db) {
    const { Op } = db.Sequelize;
    const removed = await db.User.destroy({
      where: { email: { [Op.like]: `${TEST_PREFIX}.%@example.com` } }
    });
    await db.sequelize.close();
    console.log(`\nОчистка: удалено тестовых пользователей — ${removed}`);
  }

  if (serverChild) {
    serverChild.kill();
    console.log('Тестовый сервер остановлен.');
  }
}

// --- Основной сценарий -------------------------------------------------------
(async () => {
  console.log('=== САМОПРОВЕРКА ЛАБОРАТОРНОЙ РАБОТЫ №3 (JWT + RBAC) ===\n');
  console.log('--- 1. Структура проекта, зависимости, база данных ---');
  checkFiles();
  const db = await checkDatabase();

  console.log(`\n--- 2. HTTP API (${BASE_URL}) ---`);
  const serverReady = await ensureServer();
  check(`Сервер отвечает на ${BASE_URL}${serverChild ? ' (запущен автоматически)' : ' (уже был запущен)'}`, serverReady);

  if (!serverReady) {
    console.log('\nСервер не поднялся — проверьте `npm start` и DATABASE_URL в .env.');
    process.exitCode = 1;
    if (serverChild) serverChild.kill();
    return;
  }

  const stamp = Date.now();
  const testEmail = `${TEST_PREFIX}.${stamp}@example.com`;
  const deleteEmail = `${TEST_PREFIX}.${stamp}.delete@example.com`;

  try {
    // Задача 2. Регистрация
    const registration = await request('POST', `${API}/auth/register`, {
      body: { email: testEmail, password: TEST_PASSWORD }
    });
    check('Задача 2. POST /auth/register → 201 Created', registration.status === 201, `статус ${registration.status}`);

    check('Задача 2. Ответ регистрации не содержит passwordHash',
      Boolean(registration.body) && !('passwordHash' in registration.body) && registration.body.email === testEmail);

    const duplicate = await request('POST', `${API}/auth/register`, {
      body: { email: testEmail, password: TEST_PASSWORD }
    });
    check('Задача 2. Уникальность email: повторная регистрация → 409', duplicate.status === 409, `статус ${duplicate.status}`);

    const weakPassword = await request('POST', `${API}/auth/register`, {
      body: { email: `${TEST_PREFIX}.${stamp}.weak@example.com`, password: '123' }
    });
    check('Задача 2. Валидация: короткий пароль → 400', weakPassword.status === 400, `статус ${weakPassword.status}`);

    if (db) {
      const stored = await db.User.findOne({ where: { email: testEmail } });
      const isHashed = Boolean(stored) && stored.passwordHash.startsWith('$2') &&
        stored.passwordHash !== TEST_PASSWORD && (await bcrypt.compare(TEST_PASSWORD, stored.passwordHash));
      check('Задача 2. В БД лежит bcrypt-хеш пароля (не открытый пароль)', isHashed,
        stored ? `passwordHash: ${stored.passwordHash.slice(0, 7)}...` : 'пользователь не найден');
      check('Задача 2. Новому пользователю назначена роль user', Boolean(stored) && stored.role === 'user');
    }

    // Задача 3. Вход
    const login = await request('POST', `${API}/auth/login`, {
      body: { email: testEmail, password: TEST_PASSWORD }
    });
    const token = login.body && login.body.token;
    check('Задача 3. POST /auth/login → 200 и JWT формата header.payload.signature',
      login.status === 200 && typeof token === 'string' && token.split('.').length === 3, `статус ${login.status}`);

    const wrongPassword = await request('POST', `${API}/auth/login`, {
      body: { email: testEmail, password: 'WrongPassword!' }
    });
    check('Задача 3. Неверный пароль → 401', wrongPassword.status === 401, `статус ${wrongPassword.status}`);

    const unknownUser = await request('POST', `${API}/auth/login`, {
      body: { email: `${TEST_PREFIX}.${stamp}.nobody@example.com`, password: TEST_PASSWORD }
    });
    check('Задача 3. Несуществующий email → 401 (существование не раскрывается)',
      unknownUser.status === 401, `статус ${unknownUser.status}`);

    // Задачи 4-6. Middleware аутентификации и защищённые маршруты
    const withoutToken = await request('GET', `${API}/profile`);
    check('Задача 5. GET /profile без токена → 401 Unauthorized', withoutToken.status === 401, `статус ${withoutToken.status}`);

    const headerWithoutBearer = await request('GET', `${API}/profile`, { token: '' });
    check('Задача 4. GET /profile без заголовка Authorization → 401', headerWithoutBearer.status === 401, `статус ${headerWithoutBearer.status}`);

    const invalidToken = await request('GET', `${API}/profile`, { token: 'not.a.valid.jwt' });
    check('Задача 4. GET /profile с недействительным токеном → 401', invalidToken.status === 401, `статус ${invalidToken.status}`);

    const profile = await request('GET', `${API}/profile`, { token });
    check('Задача 4/6. GET /profile с валидным токеном → 200 и данные текущего пользователя',
      profile.status === 200 && Boolean(profile.body) && profile.body.email === testEmail, `статус ${profile.status}`);

    // Задача 6. Второй защищённый маршрут: удаление собственной учётной записи
    await request('POST', `${API}/auth/register`, { body: { email: deleteEmail, password: TEST_PASSWORD } });
    const deleteLogin = await request('POST', `${API}/auth/login`, {
      body: { email: deleteEmail, password: TEST_PASSWORD }
    });
    const deleteProfile = await request('DELETE', `${API}/profile`, { token: deleteLogin.body && deleteLogin.body.token });
    check('Задача 6. DELETE /profile (только авторизованный) → 200, запись удалена',
      deleteProfile.status === 200, `статус ${deleteProfile.status}`);

    const afterDelete = await request('GET', `${API}/profile`, { token: deleteLogin.body && deleteLogin.body.token });
    check('Задача 6. Токен удалённого пользователя больше не даёт данных → 404',
      afterDelete.status === 404, `статус ${afterDelete.status}`);

    // Задача 7. Дополнительный механизм безопасности — ролевая модель (RBAC)
    const adminToken = await ensureAdminToken(db);
    check('Задача 7. Демо-администратор admin@example.com может войти', Boolean(adminToken));

    const adminList = await request('GET', `${API}/admin/users`, { token: adminToken });
    check('Задача 7. GET /admin/users с токеном admin → 200 и список пользователей',
      adminList.status === 200 && Array.isArray(adminList.body), `статус ${adminList.status}`);

    const forbidden = await request('GET', `${API}/admin/users`, { token });
    check('Задача 7. GET /admin/users с токеном обычного user → 403 (middleware isAdmin)',
      forbidden.status === 403, `статус ${forbidden.status}`);

    const adminListWithoutToken = await request('GET', `${API}/admin/users`);
    check('Задача 7. GET /admin/users без токена → 401', adminListWithoutToken.status === 401, `статус ${adminListWithoutToken.status}`);

    const roleChange = await request('PATCH', `${API}/admin/users/${registration.body.id}/role`, {
      token: adminToken,
      body: { role: 'admin' }
    });
    check('Задача 7. PATCH /admin/users/:id/role — admin назначает роль admin',
      roleChange.status === 200 && Boolean(roleChange.body) && roleChange.body.role === 'admin', `статус ${roleChange.status}`);

    const promotedLogin = await request('POST', `${API}/auth/login`, {
      body: { email: testEmail, password: TEST_PASSWORD }
    });
    const promotedAccess = await request('GET', `${API}/admin/users`, {
      token: promotedLogin.body && promotedLogin.body.token
    });
    check('Задача 7. Пользователь с ролью admin получает доступ к /admin/users → 200',
      promotedAccess.status === 200, `статус ${promotedAccess.status}`);

    const badRole = await request('PATCH', `${API}/admin/users/${registration.body.id}/role`, {
      token: adminToken,
      body: { role: 'superuser' }
    });
    check('Задача 7. Некорректная роль → 400 (валидация RBAC)', badRole.status === 400, `статус ${badRole.status}`);

  } catch (error) {
    check('HTTP-проверки выполнены без исключений', false, error.message);
  }

  console.log('\n=== ИТОГ ЛАБОРАТОРНОЙ РАБОТЫ №3 ===');
  [
    '1. Модель User (email, passwordHash, role) + миграция таблицы Users',
    '2. POST /api/v1/auth/register — bcrypt-хеш, проверка уникальности email, 201',
    '3. POST /api/v1/auth/login — проверка пароля, выдача JWT (1 час)',
    '4. middleware/auth.js — проверка заголовка Authorization: Bearer <token>',
    '5. Защищённые маршруты /api/v1/profile (без токена — 401)',
    '6. GET /api/v1/profile — данные текущего пользователя',
    '7. Дополнительный механизм: RBAC (role, middleware isAdmin, /api/v1/admin/*)'
  ].forEach((item) => console.log(`  ${PASS} ${item}`));

  console.log('\n=== ШПАРГАЛКА: ЭНДПОИНТЫ ===');
  [
    'POST   /api/v1/auth/register              Body(raw JSON): {"email":"...","password":"..."}',
    'POST   /api/v1/auth/login                 Body(raw JSON): {"email":"...","password":"..."} → {token, user}',
    'GET    /api/v1/profile                    Header: Authorization: Bearer <token>',
    'DELETE /api/v1/profile                    Header: Authorization: Bearer <token>',
    'GET    /api/v1/admin/users                Header: Authorization: Bearer <admin-token>',
    'GET    /api/v1/admin/users/:id            Header: Authorization: Bearer <admin-token>',
    'PATCH  /api/v1/admin/users/:id/role       Body(raw JSON): {"role":"user|admin"}',
    'DELETE /api/v1/admin/users/:id            Header: Authorization: Bearer <admin-token>'
  ].forEach((item) => console.log(`  ${item}`));

  const passed = results.filter(Boolean).length;
  console.log(`\nПройдено проверок: ${passed}/${results.length}`);

  const allPassed = results.every(Boolean);
  console.log(allPassed ? 'ВСЕ ЗАДАЧИ ЛАБОРАТОРНОЙ РАБОТЫ №3 ВЫПОЛНЕНЫ ✅' : 'ЕСТЬ ПРОБЛЕМЫ ❌');

  await cleanup(db);

  if (!allPassed) {
    process.exitCode = 1;
  }
})();

