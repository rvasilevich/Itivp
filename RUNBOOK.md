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
9. [Проверка соединения с БД](#проверка-соединения-с-бд)
10. [Тестирование API (curl)](#тестирование-api-curl)
11. [Известные нюансы](#известные-нюансы)
12. [Сводная таблица команд](#сводная-таблица-команд)

---

## Обзор

- **Стек:** Node.js + Express + Sequelize (ORM) + PostgreSQL (облачная БД **Supabase**).
- **Точка входа:** `server.js` → порт `3000`.
- **Слои:** `app/api/v1` (маршруты) → `services` (бизнес-логика) →
  `repositories` (Sequelize) → `models` (модели), `migrations`/`seeders` (схема и данные).
- **База:** проект Supabase `duiefqyrzmbpqtigfdmr`, хост pooler'а
  `aws-1-eu-west-1.pooler.supabase.com` (регион **eu-west-1**).

---

## Требования

- Node.js ≥ 18 (проверено на Node 24.21.0)
- npm
- Доступ в интернет (БД облачная)

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
```

Этот файл автоматически подгружают и **приложение** (`models/index.js`
вызывает `require('dotenv').config()`), и **sequelize-cli** — второе обеспечивает
файл `.sequelizerc` (`require('dotenv').config()`), который CLI читает до
`config/config.json`. Без `.sequelizerc` CLI падает с
`ERROR: Error parsing url: undefined`, т.к. сам `.env` он не подгружает.

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

## Самопроверка лабораторной работы (selfcheck)

Одна команда проверяет все задачи лаб. работы №2 разом:
подключение БД, таблицу, модель, CRUD, миграцию изменения схемы и сиды.

```bash
npm run check
# или напрямую:
node scripts/selfcheck.js
```

Признак успеха — вывод: `Пройдено проверок: 9/9` и `ВСЕ ЗАДАЧИ ВЫПОЛНЕНЫ ✅`.

> Скрипт создаёт временную тестовую запись и удаляет её после проверки,
> поэтому данные в таблице `Employees` не портятся.

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

## Тестирование API (curl)

Сначала запустить сервер (`npm run dev`), затем:

```bash
# GET — список всех сотрудников
curl http://localhost:3000/api/v1/employees

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
`404` не найден, `500` внутренняя ошибка.

---

## Тестирование API (Postman)

Базовый адрес: `http://localhost:3000/api/v1`

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
| `curl http://localhost:3000/api/v1/employees` | Проверить API (GET список) |
| `npm run check` | Автопроверка задач лаб. работы №2 (selfcheck) |

> **Новые ручные команды дописывать в эту таблицу и в соответствующий раздел!**