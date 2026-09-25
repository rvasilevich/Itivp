# RUNBOOK — как запускать проект и базу данных

Файл-«шпаргалка» для людей и AI-агентов. Здесь собраны все команды, которые
нужно запускать вручную, чтобы проект работал.

> ## ⚠️ ОБЯЗАТЕЛЬНОЕ ПРАВИЛО ДЛЯ ВСЕХ AI-АГЕНТОВ
>
> Если вы (агент / ассистент) предлагаете или выполняете **любую ручную команду**
> (`npm ...`, `npx sequelize-cli ...`, `node ...`, `curl ...` и т.п.), вы **обязаны**
> дописать её в этот файл — в раздел «[Сводная таблица команд](#сводная-таблица-команд)»
> или в соответствующий тематический раздел — с кратким пояснением, что она делает.
> Так пользователь и другие агенты всегда смогут повторить любой шаг вручную.

---

## Содержание

1. [Обзор](#обзор)
2. [Требования](#требования)
3. [Первый запуск (быстрый старт)](#первый-запуск-быстрый-старт)
4. [Переменные окружения (.env)](#переменные-окружения-env)
5. [Сервер](#сервер)
6. [База данных: миграции](#база-данных-миграции)
7. [База данных: сиды (тестовые данные)](#база-данных-сиды-тестовые-данные)
8. [Создание новой модели / миграции / сида](#создание-новой-модели--миграции--сида)
9. [Самопроверка лабораторных работ (selfcheck)](#самопроверка-лабораторных-работ-selfcheck)
10. [Проверка соединения с БД](#проверка-соединения-с-бд)
11. [Тестирование API (curl)](#тестирование-api-curl)
12. [Аутентификация: JWT + RBAC](#аутентификация-jwt--rbac)
13. [Фронтенд (my-app, Vite + React)](#фронтенд-my-app-vite--react)
14. [MongoDB (Mongoose)](#mongodb-mongoose)
15. [Чат в реальном времени (Socket.IO)](#чат-в-реальном-времени-socketio)
16. [Docker и Docker Compose (ЛР №8)](#docker-и-docker-compose-лр-8)
17. [Известные нюансы](#известные-нюансы)
18. [Сводная таблица команд](#сводная-таблица-команд)

---

## Обзор

- **Стек:** Node.js + Express + Sequelize (ORM) + PostgreSQL (облачная БД **Supabase**).
- **Фронтенд:** `my-app/` — Vite + React (ЛР №4–№5: локальный список → интеграция с REST API через axios), см. раздел [Фронтенд (my-app, Vite + React)](#фронтенд-my-app-vite--react).
- **MongoDB (Mongoose):** документное хранилище с вложенными структурами (маршруты `/api/v1/mongo/employees`), см. раздел [MongoDB (Mongoose)](#mongodb-mongoose).
- **Точка входа:** `server.js` → порт `3000`.
- **Слои:** `app/api/v1` (маршруты) → `services` (бизнес-логика) →
  `repositories` (Sequelize) → `models` (модели), `migrations`/`seeders` (схема и данные).
- **База:** проект Supabase `duiefqyrzmbpqtigfdmr`, хост pooler'а
  `aws-1-eu-west-1.pooler.supabase.com` (регион **eu-west-1**).

### Ветки ↔ лабораторные работы

| Ветка | ЛР | Что внутри | Вершина ветки |
|-------|----|------------|---------------|
| `lab21` | №1 | Express CRUD API сотрудников (хранение в памяти) | `3f93c8f` |
| `lab22` | №2 | PostgreSQL через Sequelize: модели, миграции, сиды | `2a716ac` |
| `lab23` | №3 | Аутентификация JWT + RBAC, справочник `GET /api/v1` | `570b033` |
| `lab24` | №4 | React `my-app`: список сотрудников на `useState`/`useEffect` + `localStorage` | `d933e78` |
| `lab25` | №5 | React ↔ свой REST API (axios): GET с loading/error и «Повторить», оптимистичные POST/DELETE/PUT, поиск с debounce, `AbortController`; экраны входа/профиля | `69f7ffb` |
| `lab26` | №6 | MongoDB + Mongoose: вложенные `skills[]`/`reviews[]`, CRUD-маршруты, Postman-коллекция | `2e5a233` |
| `lab27` | №7 | Чат в реальном времени (Socket.IO): комнаты-каналы, история в MongoDB, «печатает…», приватные сообщения, реакции; самопроверка `check:socket` | см. `lab27` |
| `lab28` | №8 | Docker/Docker Compose: образы backend (Node 22 Alpine) и frontend (multi-stage → nginx), сервисы `postgres` + `mongo`, reverse-proxy, healthcheck, mongo-express | см. `lab28` |

Ветки строго последовательны, и каждая лабораторная лежит только в своей ветке:
`lab24` — ЛР №4 и **ничего** из ЛР №5; `lab25` — ЛР №4+№5 и **ничего** из MongoDB (ЛР №6);
`lab26` — без Socket.IO (ЛР №7); `lab27` — самая полная ветка
(фронтенд + реляционное API + документное хранилище + реальное время);
`lab28` — та же функциональность, но весь стек запускается в Docker (ЛР №8).
Проверить текущие вершины: `git for-each-ref --format='%(refname:short) %(objectname:short)' refs/heads/lab2*`

**Итоговая ветка — `release`.** В неё merge-коммитом влит результат ЛР №1–№8
из `lab28` (`git merge --allow-unrelated-histories -X theirs lab28`: истории
`release` и линеек `lab2x` не связаны, поэтому нужен явный флаг «разрешить
несвязанные истории»). Сами lab-ветки не удаляются и не переписываются —
каждая лабораторная по-прежнему лежит только в своей ветке. Исходное
состояние `release` (до вливания) дополнительно помечено тегом
`archive/original-c2df370`.


---

## Требования

- Node.js ≥ 20.19 (проект проверен на Node 24.21.0; `mongoose@9` требует ≥ 20.19)
- npm
- Docker + Docker Compose — только для ЛР №8 (в остальных лабораторных не нужен)
- Доступ в интернет (БД облачная) — **не нужен** при запуске через Docker: БД поднимаются локально контейнерами

---

## Первый запуск (быстрый старт)

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env (см. раздел про переменные окружения), затем:

# 3. Применить миграции (создать таблицы)
npx sequelize-cli db:migrate

# 4. Наполнить базу тестовыми данными
npx sequelize-cli db:seed:all

# 5. Запустить сервер
npm run dev        # режим разработки (nodemon, авто-перезапуск)
# или
npm start          # обычный запуск
```

Сервер запускается на **http://localhost:3000**.
Базовый URL API: `http://localhost:3000/api/v1`

---

## Переменные окружения (.env)

Файл `.env` лежит в корне проекта (в `.gitignore`, не коммитится).
Пример актуальной строки подключения (pooler session mode):

```
DATABASE_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify
JWT_SECRET=<случайная строка, например результат `openssl rand -hex 32`>
```

Этот файл автоматически подгружают и **приложение** (`models/index.js`
вызывает `require('dotenv').config()`), и **sequelize-cli** — второе обеспечивает
файл `.sequelizerc` (`require('dotenv').config()`), который CLI читает до
`config/config.json`. Без `.sequelizerc` CLI падает с
`ERROR: Error parsing url: undefined`, т.к. сам `.env` он не подгружает.

Для JWT-аутентификации в `.env` также должен быть секрет:

```
JWT_SECRET=<случайная строка, например результат `openssl rand -hex 32`>
```

> Если `JWT_SECRET` не задан, в коде используется dev-значение
> (`dev-secret-change-me`) — только для разработки, в проде задавать обязательно!

> Для БД Supabase хост pooler'а нужно брать из дашборда:
> **Project Settings → Database → Connection strings → Session pooler**.
> `sslmode=no-verify` обязателен: TLS включён, но цепочка сертификатов не
> проверяется. С `sslmode=require` (pg ≥ 8.16 трактует его как `verify-full`)
> подключение падает с `self-signed certificate in certificate chain`.

---

## Сервер

```bash
npm start          # обычный запуск: node server.js
npm run dev        # разработка: nodemon server.js (перезапуск при изменениях)
```

Остановить сервер в фоне (если запущен через `&`):

```bash
pkill -f 'node server.js'
```

---

## База данных: миграции

Все команды Sequelize CLI выполняются из корня проекта. `.env` подгружает
`.sequelizerc` (см. раздел «Переменные окружения»), поэтому `DATABASE_URL`
доступен и для CLI, и для приложения.

```bash
# Применить все неприменённые миграции (создать/изменить таблицы)
npx sequelize-cli db:migrate

# Показать статус миграций (up/down)
npx sequelize-cli db:migrate:status

# Откатить последнюю миграцию
npx sequelize-cli db:migrate:undo

# Откатить все миграции (база останется без таблиц проекта)
npx sequelize-cli db:migrate:undo:all
```

После `undo:all` полный цикл пересоздания схемы:

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

---

## База данных: сиды (тестовые данные)

```bash
# Заполнить базу тестовыми данными (все сиды)
npx sequelize-cli db:seed:all

# Откатить последний сид
npx sequelize-cli db:seed:undo

# Откатить все сиды
npx sequelize-cli db:seed:undo:all
```

Очистить таблицу перед повторным сидированием (чтобы не было дублей; id снова с 1):

```bash
node -e "require('dotenv').config();const{Sequelize}=require('sequelize');const s=new Sequelize(process.env.DATABASE_URL,{dialect:'postgres',logging:false});s.query('TRUNCATE \"Employees\" RESTART IDENTITY CASCADE').then(()=>{console.log('Employees очищена');return s.close()})"
```

> ⚠️ **Сиды в sequelize-cli не отслеживаются** (`seederStorage` по умолчанию —
> `none`, служебная таблица `SequelizeData` не создаётся). Поэтому `db:seed:all`
> при каждом запуске вставляет данные заново — легко получить дубликаты.
> Перед повторным сидированием очистите таблицу (команда выше) или запускайте
> сиды один раз после `db:migrate`.

---

## Создание новой модели / миграции / сида

```bash
# Модель + миграция одной командой (генерирует файлы в models/ и migrations/)
npx sequelize-cli model:generate --name Item --attributes name:string,description:string

# Только миграция (например, добавить поле в таблицу)
npx sequelize-cli migration:generate --name add-price-to-items

# Только сид
npx sequelize-cli seed:generate --name demo-items
```

> После генерации миграции обязательно применить:
> `npx sequelize-cli db:migrate`

Пример миграции «добавить поле» (руками):

```js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Items', 'price', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Items', 'price');
  }
};
```
---

## Самопроверка лабораторных работ (selfcheck)

**Лабораторная работа №2** — одна команда проверяет все задачи разом:
подключение БД, таблицу, модель, CRUD, миграцию изменения схемы и сиды.

```bash
npm run check
# или напрямую:
node scripts/selfcheck.js
```

Признак успеха — вывод: `Пройдено проверок: 9/9` и `ВСЕ ЗАДАЧИ ВЫПОЛНЕНЫ ✅`.

> Скрипт создаёт временную тестовую запись и удаляет её после проверки,
> поэтому данные в таблице `Employees` не портятся.

**Лабораторная работа №3** — проверяет модель `User`, миграцию таблицы `Users`,
регистрацию (bcrypt), вход (JWT), middleware `auth`, защищённые маршруты
`/profile` (401 без токена) и RBAC (`/admin/*`, 403 для роли `user`).

```bash
npm run check:lab3
# или напрямую:
node scripts/selfcheck-lab3.js
```

Скрипт сам поднимает сервер на :3000, если он не запущен, и останавливает его
после проверки. Тестовые пользователи (`lab3.check.*@example.com`) удаляются
автоматически. Признак успеха — `Пройдено проверок: 44/44` и
`ВСЕ ЗАДАЧИ ЛАБОРАТОРНОЙ РАБОТЫ №3 ВЫПОЛНЕНЫ ✅`.

**Лабораторная работа №7 (Socket.IO)** — проверяет файлы и зависимости чата,
обмен сообщениями в реальном времени, комнаты-каналы (включая изоляцию),
историю из MongoDB, уведомления о подключении/отключении, «печатает…»,
приватные сообщения, голосование за сообщение (вложенные `reactions[]`),
аутентификацию соединения по JWT и валидацию входных данных.

```bash
npm run check:socket
# или напрямую:
node scripts/selfcheck-socket.js
```

Скрипт подключается к запущенному серверу двумя Socket.IO-клиентами (а если
сервера нет — поднимает свой и останавливает после проверки), в конце удаляет
тестовые сообщения из `messages_mongo` и тестового пользователя. Признак успеха —
`Пройдено проверок: 39/39` и `ВСЕ ЗАДАЧИ ЛАБОРАТОРНОЙ РАБОТЫ ПО SOCKET.IO ВЫПОЛНЕНЫ ✅`.
В конце печается шпаргалка всех событий протокола.

---

---

## Проверка соединения с БД

```bash
# Быстрая проверка: подключается ли приложение к PostgreSQL
npm start    # в логе должно появиться "Server running..." без ошибок подключения
```

Или однострочник без запуска сервера (создать временный файл /tmp/dbcheck.js):

```js
require('dotenv').config();
const { Sequelize } = require('sequelize');
(async () => {
  const s = new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres' });
  try {
    await s.authenticate();
    console.log('DB CONNECTION OK');
  } catch (e) {
    console.error('FAIL: ' + e.message);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
})();
```

Запуск: `cd /Users/rodion/my-node-app && node /tmp/dbcheck.js`

---

## Подключение к БД из DBeaver (просмотр структуры/данных)

Параметры подключения (New Database Connection → PostgreSQL → Main):

| Поле | Значение |
|------|----------|
| Connect by | `Host` |
| Host | `aws-1-eu-west-1.pooler.supabase.com` |
| Port | `5432` |
| Database | `postgres` |
| Authentication | `Username/password` |
| Username | `postgres.duiefqyrzmbpqtigfdmr` |
| Password | из `.env` (часть строки `DATABASE_URL` между `postgres.<ref>:` и `@`) |

Нюансы:

1. **Username обязательно с project-ref** (`postgres.duiefqyrzmbpqtigfdmr`). Если
   указать просто `postgres`, pooler отвечает
   `FATAL: (ENOIDENTIFIER) no tenant identifier provided (external_id or sni_hostname required)` —
   по логину pooler понимает, в какой проект направлять соединение.
   Проверено: `postgres` не пускает и без SSL, и с SSL; `postgres.<ref>` пускает в обоих случаях.
2. **SSL**: в DBeaver (JDBC) `sslmode=no-verify` не поддерживается — это расширение
   node-postgres. В окне подключения: кнопка «SSH, SSL, …» → **Use SSL**, либо на
   вкладке **Driver properties** добавить `sslmode=require` (в JDBC `require` =
   «шифровать, сертификат не проверять»; сертификат pooler'а выпущен внутренним CA
   `Supabase Intermediate 2021 CA`, поэтому `verify-ca`/`verify-full` не подойдут).
3. Что смотреть для отчёта: `Schemas → public → Tables` (`Employees`, `SequelizeMeta`),
   **Columns** таблицы `Employees` (последняя колонка `email` — её добавила миграция),
   **Constraints** (`Employees_pkey`), **Data** (3 строки из сида), и
   ПКМ по таблице → **Generate SQL → DDL** (итоговый `CREATE TABLE`).
4. Альтернатива без установки клиента — Supabase Dashboard → **Table Editor**.

---

## Тестирование API (curl)

Сначала запустить сервер (`npm run dev`), затем:

```bash
# GET — список всех сотрудников
curl http://localhost:3000/api/v1/employees

# GET — серверный поиск (регистронезависимый, по ФИО/должности/отделу/email)
curl --get http://localhost:3000/api/v1/employees --data-urlencode 'search=разработ'

# GET — сотрудник по ID
curl http://localhost:3000/api/v1/employees/1

# POST — создать сотрудника (201)
curl -X POST http://localhost:3000/api/v1/employees \
  -H 'Content-Type: application/json' \
  -d '{"name":"Иван Иванов","position":"Разработчик","department":"IT","rating":8.5,"reviewDate":"2026-09-01","email":"ivan@example.com"}'

# PUT — полностью обновить сотрудника
curl -X PUT http://localhost:3000/api/v1/employees/1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Иван Иванов","position":"Сеньор-разработчик","department":"IT","rating":9.0,"reviewDate":"2026-09-01","email":"ivan@example.com"}'

# DELETE — удалить сотрудника
curl -X DELETE http://localhost:3000/api/v1/employees/1
```

Ожидаемые коды ответов: `200` ок, `201` создан, `400` невалидные данные,
`401` нет/недействительный токен, `403` нет прав (RBAC), `404` не найден,
`409` email уже занят, `500` внутренняя ошибка.

---

## Аутентификация: JWT + RBAC

Лабораторная работа №3 — регистрация и вход по **JWT**, ролевая модель
(поле `role`: `user` / `admin`, middleware `isAdmin`).

### Зависимости

```bash
npm install jsonwebtoken bcrypt
```

### Модель, миграция и демо-администратор

```bash
# Сгенерировать модель + миграцию (затем добавить ограничения в models/user.js и миграции)
npx sequelize-cli model:generate --name User --attributes email:string,passwordHash:string,role:string

# .env подгружает .sequelizerc — DATABASE_URL виден и для sequelize-cli

npx sequelize-cli db:migrate     # создаёт таблицу Users
npx sequelize-cli db:seed:all    # создаёт admin@example.com / Admin123!
```

Таблица `Users`: `id`, `email` (unique, NOT NULL), `passwordHash` (NOT NULL),
`role` (по умолчанию `user`, значения `user`/`admin`).

### Эндпоинты

Все пути — под префиксом `/api/v1` (полный адрес: `http://localhost:3000/api/v1/...`).
Справочник всех маршрутов: `GET /api/v1`.

| Метод  | Эндпоинт                        | Доступ            | Body (raw → JSON)                          | Описание                                        |
|--------|---------------------------------|-------------------|--------------------------------------------|-------------------------------------------------|
| POST   | `/api/v1/auth/register`         | все               | `{"email":"...","password":"..."}`         | регистрация `email` + `password` → 201          |
| POST   | `/api/v1/auth/login`            | все               | `{"email":"...","password":"..."}`         | вход → `{ token, user }`, JWT живёт 1 час       |
| GET    | `/api/v1/profile`               | авторизованные    | —                                          | данные текущего пользователя                    |
| PUT    | `/api/v1/profile`               | авторизованные    | `{"email":"..."}` и/или `{"password":"..."}` | обновить свои данные **с сохранением в БД**     |
| DELETE | `/api/v1/profile`               | авторизованные    | —                                          | удалить свою учётную запись                     |
| GET    | `/api/v1/admin/users`           | admin             | —                                          | список всех пользователей                       |
| GET    | `/api/v1/admin/users/:id`       | admin             | —                                          | пользователь по ID                             |
| PATCH  | `/api/v1/admin/users/:id/role`  | admin             | `{"role":"user"}` или `{"role":"admin"}`   | сменить роль (`user`/`admin`)                  |
| DELETE | `/api/v1/admin/users/:id`       | admin             | —                                          | удалить пользователя                            |

Для запросов с body в Postman: **Body → raw → JSON** (тип `JSON`, не `Text`);
заголовок `Content-Type: application/json` Postman подставляет сам.
Для защищённых маршрутов — вкладка **Headers**: `Authorization: Bearer <token>`
(токен из ответа `POST /auth/login`).

### Проверка (curl)

```bash
# Регистрация
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret123"}'

# Вход (из ответа запомнить поле "token")
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}'

# Профиль текущего пользователя
curl http://localhost:3000/api/v1/profile \
  -H 'Authorization: Bearer <TOKEN>'

# Обновить свои данные (email и/или пароль) — сохраняется в БД
curl -X PUT http://localhost:3000/api/v1/profile \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"new.email@example.com","password":"newsecret12"}'

# Админ-список пользователей
curl http://localhost:3000/api/v1/admin/users \
  -H 'Authorization: Bearer <ADMIN_TOKEN>'

# Сменить роль пользователя (RBAC)
curl -X PATCH http://localhost:3000/api/v1/admin/users/2/role \
  -H 'Authorization: Bearer <ADMIN_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"admin"}'
```

### Готовая Postman-коллекция

Все 15 запросов лабораторной (регистрация, вход, защищённые, RBAC, негативные
кейсы 401/403/400) лежат в `postman/lab3-auth.postman_collection.json`.

```bash
# импорт: Postman → Import → File → postman/lab3-auth.postman_collection.json
```

Что внутри:

- переменные коллекции: `baseUrl` (= `http://localhost:3000` — только хост,
  без `/api/v1`; префикс уже прописан в путях запросов), `token`,
  `adminToken`, `userId`, `email`;
- запрос 0.1 (`GET /api/v1`) возвращает справочник всех маршрутов приложения
  с полными путями вида `/api/v1/...`;
- скрипты `Tests` автоматически сохраняют токены после входа, поэтому
  защищённые запросы работают сразу (Auth → Bearer Token → `{{token}}`);
- запрос 1.1 создаёт пользователя с уникальным email
  (`tester+{{$timestamp}}@example.com`), поэтому его можно запускать повторно;
- запросы 2.4 и 3.7 удаляют данные — выполнять осознанно;
- порядок запуска: 0.1 → 1.1 → 1.2 → 1.3 → 2.x → 3.x.

> Все эндпоинты приложения доступны только под префиксом `/api/v1`
> (`http://localhost:3000/api/v1/...`). Обращение без префикса (например
> `http://localhost:3000/auth/login`) вернёт 404 с подсказкой правильного пути.

### Нюансы

- В JWT лежит `{ id, email, role }` — смена роли действует **после повторного входа**.
- Через регистрацию создаётся только роль `user`; админа назначает другой админ.
- Секрет подписи — `JWT_SECRET` в `.env`; без него используется dev-значение.

---

## Тестирование API (Postman)

Базовый адрес: `http://localhost:3000/api/v1`

**Полная коллекция «все эндпоинты сразу»:**
`postman/full-api.postman_collection.json` — 34 запроса с **полными путями**
(`http://localhost:3000/api/v1/...`), raw-телами и ожидаемыми статусами.
Импорт: Postman → Import → File → `postman/full-api.postman_collection.json`.
Порядок важен: сначала 1.1–1.4 (регистрация/вход сохраняют переменные
`token` и `adminToken`), запросы 2.x/3.x/4.x/5.x выполняются с подстановкой
`{{token}}`, `{{adminToken}}`, `{{employeeId}}`, `{{mongoId}}` и т.д.
Для раздела 5 (MongoDB) должен быть запущен mongod (раздел «MongoDB (Mongoose)»).
Коллекция самоочищается: тестовые пользователи, сотрудники и mongo-документ
удаляются в конце потока.

**Только MongoDB:** `postman/mongo.postman_collection.json` — 26 запросов лишь по
`/api/v1/mongo/employees`, 6 папок: подготовка (получить ID), CRUD, вложенные
структуры (`$push`/позиционный `$`/`$addToSet`/`$inc`/`$pull`), валидация,
«документ vs таблицы», очистка. **Collection Runner → 26/26 проходят**:
переменные `mongoId`/`reviewId`/`seedId` заполняются тест-скриптами, созданный
документ удаляется в 5.1, демо-документ не трогается. Перед прогоном: запущен
`mongod` и (для запроса 4.1) выполнен `npm run seed:mongo`.

⚠️ `{{mongoId}}`, `{{employeeId}}`, `{{reviewId}}` — это **переменные Postman**, а не
«подставь сюда значение». Пока запрос, который их заполняет, не выполнен, переменная
пустая (URL вида `.../mongo/employees/{{mongoId}}` → 404/список), а запись литерала
`{{1}}` в URL даёт `400 Некорректный ID: "{{1}}"`. Поэтому либо запускайте коллекцию
целиком через **Collection Runner (Run collection)** — переменные подставятся сами
(проверено: 34/34 запроса проходят), либо для одиночного запуска впишите значение
вручную: коллекция → Variables → `mongoId` (ObjectId из ответа `5.1`),
`employeeId` (из ответа `2.1`), `reviewId` (из ответа `5.6`).

| Метод | URL | Тело (Body → raw → JSON) | Ожидаемый ответ |
|-------|-----|--------------------------|-----------------|
| GET | `http://localhost:3000/api/v1/employees` | — | 200, массив сотрудников |
| GET | `http://localhost:3000/api/v1/employees/1` | — | 200, объект сотрудника |
| POST | `http://localhost:3000/api/v1/employees` | см. ниже | 201, созданный сотрудник |
| PUT | `http://localhost:3000/api/v1/employees/1` | см. ниже | 200, обновлённый сотрудник |
| DELETE | `http://localhost:3000/api/v1/employees/1` | — | 200, `{message, deletedEmployee}` |

Тело запроса (POST / PUT), тип **raw → JSON**:

```json
{
  "name": "Иван Иванов",
  "position": "Разработчик",
  "department": "IT",
  "rating": 8.5,
  "reviewDate": "2026-09-01",
  "email": "ivan.ivanov@example.com"
}
```

Все поля обязательны кроме `email`; `rating` — число 1..10,
`reviewDate` — строка `YYYY-MM-DD`. Ошибки: `400` (валидация), `404` (нет ID),
`500` (ошибка сервера).

---

## Фронтенд (my-app, Vite + React)

ЛР №4–№5 — React-клиент `my-app/` (компонент `src/components/EmployeeList.jsx`:
оценка эффективности сотрудников — добавление, редактирование, удаление,
фильтрация по отделу, сортировка, статистика).

Начиная с ЛР №5 фронтенд **полностью взаимодействует с REST API** сервера
(список больше не хранится в `localStorage` — там остаётся только JWT-токен):

- `src/api.js` — axios-клиент: baseURL из `my-app/.env` (`VITE_API_URL`),
  перехватчик подставляет JWT-токен (`Authorization: Bearer …`), нормализация
  ошибок, CRUD-функции (`fetchEmployees/createEmployee/updateEmployee/deleteEmployee`);
- GET `/employees` — загрузка списка с индикаторами «загрузка / ошибка» и
  кнопкой «Повторить»;
- POST / PUT / DELETE `/employees/:id` — CRUD с **оптимистичным обновлением**
  UI (временный id → реальный) и откатом при ошибке сервера (toast-уведомления);
- **доп. улучшение ЛР №5:** серверный поиск (`?search=`) с debounce 500 мс и
  отменой устаревших запросов через `AbortController` (при размонтировании тоже);
- `useEffect [employees.length]` — обновление `document.title`.

**Аутентификация и роли (экран входа первым):**

- `src/components/AuthPage.jsx` — первая страница: вход и регистрация
  (`POST /auth/register`, `POST /auth/login`); токен и пользователь
  сохраняются в `localStorage` (`src/session.js`, ключи `token`/`user`);
- `src/App.jsx` — при наличии токена проверяет его (`GET /profile`, отмена
  через `AbortController`) и открывает функционал **по роли**:
  - **admin** — вкладки «Сотрудники» (полный CRUD, функционал не изменился)
    и «Профиль»;
  - **user** — только страница профиля со своими данными;
- `src/components/Profile.jsx` — `GET /profile` (загрузка/ошибка/«Повторить»)
  и форма редактирования email/пароля через **`PUT /profile`** с сохранением
  в БД; ошибка 401 (просрочен токен) → автоматический разлогин.

### Настройка и запуск

Сначала поднимите сервер (раздел «Сервер»), затем — клиент.
Все команды выполняются **внутри каталога `my-app`**:

```bash
cd my-app

# 1. Установить зависимости клиента (React, Vite, axios, Vitest)
npm install

# 2. Переменная окружения: создать my-app/.env (шаблон — my-app/.env.example)
#    VITE_API_URL=http://localhost:3000/api/v1

# 3. Запуск dev-сервера Vite на :5173 (http://localhost:5173)
npm run dev

# 4. Юнит-тесты (Vitest + Testing Library, 27 проверок, API замокан)
npm run test

# 5. Production-сборка в my-app/dist/ (каталог в .gitignore, не коммитится)
npm run build

# 6. Линтер (oxlint)
npm run lint
```

Проверка после изменений: `npm run test` → `Tests 27 passed (27)`,
затем `npm run dev` и открыть <http://localhost:5173> (сервер на :3000 должен
работать — данные приходят с REST API, CORS включён в `server.js`).

---

## MongoDB (Mongoose)

Лаб. работа по документным БД: Mongoose подключён к существующему Express-приложению
(`server.js` → `mongoose.connect(MONGO_URI)`), маршруты — `/api/v1/mongo/employees`.

**Подключение.** Строка подключения — `MONGO_URI` в `.env`:

```
MONGO_URI=mongodb://127.0.0.1:27017/employee_eval   # локальная установка
# или Atlas (бесплатный M0): mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/employee_eval
```

Альтернативы: кластер **MongoDB Atlas** (в Atlas → Network Access добавить свой IP,
в Database Access — пользователя БД) или **локальный mongod**:

```bash
# локальный запуск (пример; бинарник — с fastdl.mongodb.org или brew)
mongod --dbpath ~/mongodb-data --port 27017 --bind_ip 127.0.0.1 \
  --fork --logpath /tmp/mongod.log
```

**Структура кода:**

- `mongo/models/employee.js` — схема и модель `Employee` (коллекция `employees_mongo`):
  поля сотрудника + **вложенные документы** `reviews[]` (история оценок: date,
  reviewer, rating, comment и массив целей `goals[]`) и `skills[]` (навык + уровень);
- `mongo/routes/employees.js` — CRUD методами Mongoose + вложенные операции:
  `$push` (новый отзыв), позиционный оператор `$` (правка конкретного
  отзыва/навыка внутри массива), `$pull` (удаление отзыва), `$addToSet`
  (добавить навык), `$inc` (увеличить уровень навыка — аналог «корзины»).

| Маршрут | Что делает |
|---------|-----------|
| `GET /api/v1/mongo/employees` | список (`find`), `?search=` — `$regex` без учёта регистра по ФИО, должности, отделу, email и `skills.name` |
| `GET /api/v1/mongo/employees/:id` | сотрудник (`findById`) |
| `POST /api/v1/mongo/employees` | создать документ, в т.ч. со `skills[]`/`reviews[]` (`create`) |
| `PUT /api/v1/mongo/employees/:id` | обновить документ (`findByIdAndUpdate`) |
| `DELETE /api/v1/mongo/employees/:id` | удалить документ (`findByIdAndDelete`) |
| `POST .../:id/reviews` | добавить вложенный отзыв (`$push`) |
| `PUT .../:id/reviews/:reviewId` | изменить элемент массива (позиционный `$`) |
| `DELETE .../:id/reviews/:reviewId` | удалить отзыв (`$pull`) |
| `POST .../:id/skills` | добавить навык (`$addToSet`), дубль → 409 |
| `PATCH .../:id/skills/:name` | увеличить уровень навыка (`$inc` + `$`) |

**Команды:**

```bash
npm install mongoose      # ODM-зависимость
npm run seed:mongo        # демо-документ со вложенными структурами (для Compass)
npm run check:mongo       # 12 проверок: CRUD + вложенные операции (сервер запущен)
npm run dev               # сервер: в логе должно быть «MongoDB connected»
```

Посмотреть вложенную структуру: MongoDB Compass → база `employee_eval` →
коллекция `employees_mongo` (или JSON-вывод `npm run seed:mongo` / `npm run check:mongo`).

### Нюансы MongoDB

1. Mongoose-файлы лежат в `mongo/`, а **не** в `models/` — `models/` занят
   Sequelize (`models/index.js` подгружает оттуда все `.js` как фабрики моделей).
2. Если mongod не запущен — `npm run dev` поднимется (PostgreSQL-API работает),
   а `/api/v1/mongo/*` вернёт 500/таймаут: сначала запустить mongod,
   затем перезапустить сервер.
3. Ошибки Mongoose (`CastError` → 400, `ValidationError` → 400, дубль `11000` → 409)
   маппятся в `AppError` хелпером `toAppError` в `mongo/routes/employees.js`.
4. Коллекция названа `employees_mongo`, чтобы не путать с таблицей
   `"Employees"` PostgreSQL.

---

## Чат в реальном времени (Socket.IO)

Лаб. работа №7: тот же `server.js` обслуживает **Express и Socket.IO на одном
порту 3000** — `const server = http.createServer(app)` вместо `app.listen(...)`,
затем `createSocketServer(server)` (см. `socket/index.js`). Клиент подключается
к `http://localhost:3000` **без** `/api/v1`: у Socket.IO свои пути `/socket.io/*`.

**Задачи работы → как реализовано:**

| Задача | Реализация |
|--------|-----------|
| Сервер Node.js + Express + Socket.IO | `socket/index.js`: `new Server(httpServer, { cors })`, обработчики событий |
| Клиент (React) подключается к серверу | `my-app/src/socket.js` (`createSocket()`), вкладка «Чат» в `App.jsx` |
| Отправка/получение сообщений в реальном времени | `chat:message` → `io.to(room).emit(...)`; ack-подтверждение отправителю |
| Уведомления о подключении/отключении | `system:notice` (🟢/🔴) + `presence:list` (список онлайн) |
| **Доп. функции (по выбору):** | |
| Комнаты для разных чатов | `socket/rooms.js` — общий канал + каналы отделов; вход через `room:join`, изоляция сообщений |
| История в MongoDB | `mongo/models/message.js`, коллекция `messages_mongo`; последних 50 сообщений канала при входе |
| Приватные сообщения | `chat:private` — доставка конкретному `socket.id` (в БД не сохраняются) |
| «Печатает…» | `chat:typing` с автогашением через 1500 мс на клиенте |
| Голосование/реакции | `chat:react` → вложенный массив `reactions[]` документа сообщения: `$push`, позиционный `$` + `$addToSet`/`$pull` |
| Аутентификация (бонус) | `socket/auth.js`: JWT из ЛР №3 в `handshake.auth.token`, битый токен → `connect_error` |

**Структура кода:**

- `socket/index.js` — `createSocketServer(httpServer)`: middleware аутентификации,
  рассылки (`rooms:list`, `presence:list`, `system:notice`), обработчики
  `room:join` / `room:leave` / `chat:message` / `chat:typing` / `chat:private` /
  `chat:react` / `disconnect`;
- `socket/rooms.js` — справочник каналов предметной области («Общий»,
  «Отдел кадров», «Отдел разработки», «Отдел продаж») + защита от произвольных
  id от клиента (`findRoom` → ошибка в ack для неизвестного канала);
- `socket/presence.js` — `PresenceStore` (Map): кто онлайн, в каком канале,
  счётчик онлайн по комнатам для бейджей;
- `socket/auth.js` — верификация токена; гость (без токена) тоже может участвовать;
- `mongo/models/message.js` — модель сообщения (канал, автор, текст,
  **вложенные** `reactions[]: [{ emoji, users[] }]`, `timestamps`);
- `my-app/src/socket.js` — клиент: `io(SOCKET_URL, { auth: { token, name } })`,
  карта событий `SOCKET_EVENTS`;
- `my-app/src/components/ChatRoom.jsx` — UI чата (каналы, лента, онлайн,
  приватные сообщения, реакции, уведомления), `document.title` с числом онлайн,
  отключение сокета при размонтировании.

**Запуск и проверка:**

```bash
npm run dev            # сервер (Express + Socket.IO на :3000)
cd my-app && npm run dev   # клиент на :5173 → вкладка «Чат»
npm run check:socket   # автопроверка (39 проверок)
```

Для демонстрации откройте **два окна браузера** (или два разных браузера) —
сообщения, уведомления о подключении/отключении и «печатает…» видны в реальном
времени; история канала переживает перезагрузку (MongoDB).

**Нюансы:**

- Заголовки HTTP недоступны в WebSocket → JWT передаётся в `handshake.auth`;
- сообщение приходит всем участникам канала **серверной рассылкой** (не
  оптимистично на клиенте) — дублей нет, но при недоступности MongoDB ack
  вернёт ошибку «Не удалось сохранить сообщение»;
- реакция — «переключатель»: повторный клик снимает голос (`$pull`),
  новая группа реакций создаётся через `$push`;
- приватные сообщения и presence живут только в памяти процесса (история
  сохраняется только для каналов).

## Docker и Docker Compose (ЛР №8)

Лаб. работа №8: весь стек (backend + frontend + PostgreSQL + MongoDB)
поднимается контейнерами одной командой — локально установленные Node.js и БД
не нужны, версии не конфликтуют.

### Запуск

```bash
docker compose up --build        # или: docker-compose up --build
docker compose ps                # статус сервисов (и healthcheck)
docker compose logs -f backend   # логи backend: миграции, сиды, сервер
docker compose restart backend   # перезапуск (сиды повторно не применятся)
docker compose down              # остановить контейнеры
docker compose down -v           # + удалить тома (данные БД будут потеряны)
```

После старта (`docker compose ps` — все сервисы `running`/`healthy`):

| Что | Адрес |
|-----|-------|
| Frontend (React через nginx) | http://localhost |
| Backend (healthcheck) | http://localhost:5001/health |
| REST API (через nginx-прокси) | http://localhost/api/v1 |
| Socket.IO (через nginx-прокси) | http://localhost/socket.io/?EIO=4&transport=polling |
| MongoDB UI (mongo-express) | http://localhost:8081 |
| Логин в приложении | `admin@example.com` / `Admin123!` (создаётся сидом) |

### Файлы

| Файл | Назначение |
|------|-----------|
| `Dockerfile` | backend: `node:22-alpine`, `npm ci`, `EXPOSE 5000`, `HEALTHCHECK GET /health`, точка входа `docker/entrypoint.sh` |
| `docker/entrypoint.sh` | `sequelize-cli db:migrate` → сиды (только если таблица `Users` пуста) → `node server.js` |
| `my-app/Dockerfile` | frontend: **multi-stage** — `npm ci && vite build` → `nginx:alpine` со статикой (итоговый образ ~94 МБ) |
| `my-app/nginx.conf` | раздача SPA (`try_files` → `index.html`) + reverse-proxy `/api/` и `/socket.io/` → `backend:5000` (заголовки `Upgrade` для WebSocket) |
| `docker-compose.yml` | сервисы `postgres`, `mongo`, `backend`, `frontend`, `mongo-express`; сети `backend_net`/`frontend_net`; тома |
| `.dockerignore`, `my-app/.dockerignore` | не копировать в образы `node_modules`, `.env`, `dist` |

### Переменные, порты, сети

- Compose автоматически читает `.env` корня проекта и подставляет
  `${JWT_SECRET}`, `${BACKEND_PORT}`, `${FRONTEND_PORT}`, `${MONGO_EXPRESS_PORT}`
  и `DOCKER_DATABASE_URL`. Без `.env` работают значения по умолчанию.
- Внутри контейнера backend слушает `5000` (`PORT=5000`), наружу по умолчанию
  проброшен `5001`: на macOS хост-порт **5000 занят AirPlay Receiver**
  (Control Center). Чтобы получить ровно `http://localhost:5000` — задайте
  `BACKEND_PORT=5000` в `.env` и отключите AirPlay Receiver
  (Системные настройки → Основные → AirDrop и Handoff).
- Чтобы backend работал с **облачным Supabase** вместо контейнерного PostgreSQL:
  добавьте в `.env` `DOCKER_DATABASE_URL=<строка подключения Supabase>`.
- Базы (`postgres`, `mongo`) **не публикуются на хост** — доступны только
  внутри сети `backend_net`. Наружу открыты `80` (frontend), `5001` (backend),
  `8081` (mongo-express).

### Проверка (curl / контейнеры)

```bash
curl http://localhost:5001/health
curl http://localhost/api/v1
curl http://localhost/api/v1/employees
curl -X POST http://localhost/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
curl 'http://localhost/socket.io/?EIO=4&transport=polling'

# Данные внутри контейнеров
docker compose exec -T postgres psql -U postgres -d employee_eval -c 'SELECT COUNT(*) FROM "Employees"'
docker exec employee-eval-mongo mongosh --quiet employee_eval --eval 'db.getCollectionNames()'
```

### Нюансы

- **`node:18-alpine` из шаблона задания не подходит**: `mongoose@9` требует
  Node ≥ 20.19 (`engines`) — образ собран на `node:22-alpine`.
- **Сиды идемпотентны на уровне entrypoint**: `bulkInsert` не идемпотентен, а
  `Users.email` — `UNIQUE`, поэтому сиды выполняются только при пустой `Users`.
  При повторном запуске в логах: «Пользователи уже есть (Users=1) — сиды пропускаем».
- **Frontend собирается с относительными адресами** (`VITE_API_URL=/api/v1`,
  `VITE_SOCKET_URL=same-origin`) — передаются build-аргументами из compose;
  поэтому CORS для контейнерного фронтенда не нужен.
- `mongo-express` в образе по умолчанию имеет `ME_CONFIG_BASICAUTH=true` —
  в compose он выключен (`ME_CONFIG_BASICAUTH: "false"`), иначе UI отдаёт 401.
- Первая сборка скачивает образы `node:22-alpine`, `nginx:alpine`, `mongo:7`,
  `postgres:16-alpine`, `mongo-express` — нужен интернет (единоразово).

## Известные нюансы

1. **Прямой хост `db.<ref>.supabase.co` недоступен с IPv4** — проект сидит за
   Cloudflare, порт 5432 таймаутит без IPv4 add-on. Поэтому используем **pooler**:
   `aws-1-eu-west-1.pooler.supabase.com:5432` с пользователем
   `postgres.duiefqyrzmbpqtigfdmr` (session mode).
2. **`sslmode=no-verify`** в `DATABASE_URL` — не менять на `sslmode=require`:
   pg ≥ 8.16 трактует `require` как `verify-full` и подключение к pooler'у
   падает с `self-signed certificate in certificate chain`.
3. **sequelize-cli 6.x сам `.env` НЕ читает**: конфигурация с
   `"use_env_variable": "DATABASE_URL"` работает только благодаря `.sequelizerc`
   (там вызывается `require('dotenv').config()`). Не удалять этот файл.
4. **Sequelize сам разбирает `DATABASE_URL`** и перекрывает `ssl` из
   `config/config.json` (`Object.assign(dialectOptions, parse(url))`), поэтому
   SSL-режим задаётся именно в строке подключения.
5. Пароль в `.env` — файл в `.gitignore`, не коммитить.
6. `pg`/`pg-hstore` — зависимости драйвера PostgreSQL для Sequelize.
7. **Сиды не отслеживаются** (`seederStorage: none` по умолчанию) — повторный
   `db:seed:all` добавит ещё 3 сотрудника. Перед повторным сидированием
   очищайте таблицу `TRUNCATE` (команда в разделе «База данных: сиды»).
8. **`my-app/.env`: `VITE_API_URL` должен указывать на `/api/v1`**
   (`http://localhost:3000/api/v1`), а не на `/api` из примеров generic-шаблонов —
   все маршруты сервера живут под префиксом `/api/v1` (см. раздел «Сервер»).
   Без `.env` клиент откатится на дефолт `http://localhost:3000/api/v1` из `src/api.js`.
9. **После изменения `package-lock.json` в `my-app` Vite перестартует
   препреобмен зависимостей** (лог `Re-optimizing dependencies because lockfile
   has changed`) — это нормально, подождите vài секунд.

---

## Сводная таблица команд

| Команда | Что делает |
|---------|------------|
| `npm install` | Устанавливает зависимости проекта |
| `npm start` | Запуск сервера (node server.js) на :3000 |
| `npm run dev` | Запуск сервера в режиме разработки (nodemon) |
| `npx sequelize-cli db:migrate` | Применить все миграции |
| `npx sequelize-cli db:migrate:status` | Статус миграций (up/down) |
| `npx sequelize-cli db:migrate:undo` | Откатить последнюю миграцию |
| `npx sequelize-cli db:migrate:undo:all` | Откатить все миграции |
| `npx sequelize-cli db:seed:all` | Применить все сиды (тестовые данные) |
| `node -e "...TRUNCATE \"Employees\" RESTART IDENTITY CASCADE..."` | Очистить таблицу сотрудников перед повторным сидом |
| `npx sequelize-cli db:seed:undo` | Откатить последний сид |
| `npx sequelize-cli db:seed:undo:all` | Откатить все сиды |
| `npx sequelize-cli model:generate --name X --attributes ...` | Создать модель + миграцию |
| `npx sequelize-cli migration:generate --name xxx` | Создать пустую миграцию |
| `npx sequelize-cli seed:generate --name xxx` | Создать пустой сид |
| `pkill -f 'node server.js'` | Остановить фоновый сервер |
| `npm install jsonwebtoken bcrypt` | Установить зависимости JWT и bcrypt |
| `npm run check:lab3` | Автопроверка всех задач лабораторной работы №3 (44 проверки) |
| `postman/lab3-auth.postman_collection.json` | Импортировать в Postman — 15 готовых запросов (JWT + RBAC) |
| `postman/full-api.postman_collection.json` | Импортировать в Postman — все 34 эндпоинта (auth, employees, profile, admin, MongoDB) с полными путями |
| `postman/mongo.postman_collection.json` | Импортировать в Postman — 26 запросов только по MongoDB (CRUD, вложенные массивы, валидация), Run collection → 26/26 |
| `npx sequelize-cli model:generate --name User --attributes ...` | Создать модель User + миграцию |
| `curl http://localhost:3000/api/v1/auth/register` | Проверить регистрацию (см. раздел «Аутентификация») |
| `curl http://localhost:3000/api/v1/employees` | Проверить API (GET список) |
| `npm run check` | Автопроверка задач лаб. работы №2 (selfcheck) |
| `cd my-app && npm install` | Установить зависимости фронтенда (React/Vite/Vitest) |
| `cd my-app && npm run dev` | Запуск Vite dev-сервера клиента на :5173 |
| `cd my-app && npm run test` | Юнит-тесты фронтенда (Vitest, 43 шт., мок API и Socket.IO) |
| `cd my-app && npm run build` | Production-сборка клиента в `my-app/dist/` |
| `cd my-app && npm run lint` | Линтер фронтенда (oxlint) |
| `npm install cors` | Добавить CORS middleware (нужен Client → API, ЛР №5) |
| `cd my-app && npm install axios` | Установить axios — HTTP-клиент фронтенда (ЛР №5) |
| `curl --get http://localhost:3000/api/v1/employees --data-urlencode 'search=...'` | Проверить серверный поиск `?search=` (ЛР №5) |
| `curl -X PUT http://localhost:3000/api/v1/profile -H 'Authorization: Bearer <TOKEN>' -d '{"email":"..."}'` | Обновить свои данные в БД (PUT /profile) |
| `npm install mongoose` | Установить ODM Mongoose (MongoDB, документные БД) |
| `npm run seed:mongo` | Демо-документ в MongoDB со вложенными структурами |
| `npm run check:mongo` | Самопроверка MongoDB-лабораторной (12 проверок) |
| `npm install socket.io` | Socket.IO — реальное время поверх HTTP-сервера (ЛР №7) |
| `cd my-app && npm install socket.io-client` | Клиентская библиотека Socket.IO (ЛР №7) |
| `npm run check:socket` | Самопроверка чата в реальном времени (39 проверок) |
| `curl 'http://localhost:3000/socket.io/?EIO=4&transport=polling'` | Проверить, что Socket.IO отвечает на :3000 |
| `mongod --dbpath ~/mongodb-data --port 27017 --bind_ip 127.0.0.1 --fork --logpath /tmp/mongod.log` | Запустить локальный MongoDB |
| `curl http://localhost:3000/api/v1/mongo/employees` | Список документов MongoDB |
| `curl -X POST http://localhost:3000/api/v1/mongo/employees/:id/reviews -H 'Content-Type: application/json' -d '{"reviewer":"...","rating":9}'` | Добавить вложенный отзыв ($push) |
| `curl -X PATCH http://localhost:3000/api/v1/mongo/employees/:id/skills/SQL -H 'Content-Type: application/json' -d '{"amount":1}'` | Увеличить уровень навыка ($inc + $) |
| `git for-each-ref --format='%(refname:short) %(objectname:short)' refs/heads/lab2*` | Показать, что лежит в каждой lab-ветке (соответствие лабораторным) |
| `git branch -f lab24 d933e78` | Переставить локальную ветку на нужный коммит (без переключения HEAD) |
| `git push --force-with-lease origin lab24:lab24 lab25:lab25` | Force-push переставленных веток (проверяет, что на сервере нет чужих коммитов) |
| `git worktree add --detach /tmp/lab24chk d933e78` | Открыть состояние ветки в отдельной папке, не трогая рабочее дерево |
| `git worktree remove --force /tmp/lab24chk` | Удалить временный worktree после проверки |
| `cd my-app && npx vitest run --reporter=default` | Прогнать тесты фронтенда вручную (в vitest 5 отчёта `basic` уже нет) |
| `docker compose up --build` | Собрать образы и поднять весь стек (ЛР №8): postgres, mongo, backend, frontend, mongo-express |
| `docker compose ps` | Статус контейнеров и healthcheck |
| `docker compose logs -f backend` | Логи backend-а (миграции, сиды, старт сервера) |
| `docker compose restart backend` | Перезапустить backend (сиды повторно не применятся) |
| `docker compose down` / `down -v` | Остановить стек / + удалить тома с данными БД |
| `docker compose config` | Проверить итоговую конфигурацию compose (подстановка переменных) |
| `docker compose exec -T postgres psql -U postgres -d employee_eval -c '...'` | SQL-запрос к PostgreSQL внутри контейнера (без публикации порта на хост) |
| `docker exec employee-eval-mongo mongosh --quiet employee_eval --eval '...'` | Запрос к MongoDB внутри контейнера |
| `curl http://localhost:5001/health` | Healthcheck backend-а (в контейнере `PORT=5000`, наружу `5001`) |
| `curl http://localhost/api/v1/employees` | REST API через nginx-прокси frontend-контейнера |
| `docker run -d --name lab27-mongo -p 27017:27017 mongo:7` | Поднять MongoDB в Docker для локальной разработки/самопроверок (ЛР №7) |
| `git push -u origin lab28` | Отправить ветку ЛР №8 на GitHub (создаёт `origin/lab28`, запоминает upstream) |
| `git merge --allow-unrelated-histories -X theirs lab28` | Влить итоговый результат (`lab28`) в `release`: истории этих веток не связаны, в конфликтах принимается версия `lab28` |
| `git rm index.js && git commit --amend --no-edit` | Убрать из merge-коммита legacy-заглушку `index.js` (точка входа проекта — `server.js`) |
| `git push origin develop release` | Отправить на GitHub обновлённые ветки `develop` и `release` |

> **Новые ручные команды дописывать в эту таблицу и в соответствующий раздел!**