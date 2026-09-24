# Приложение оценки эффективности сотрудников

REST API для управления оценкой эффективности сотрудников (Employee Performance Evaluation).

> 📖 **Всем AI-агентам и разработчикам:** все команды запуска хранятся в **`RUNBOOK.md`**.
> Если вы выполняете какую-либо ручную команду (`npm ...`, `npx sequelize-cli ...`,
> `node ...`, `curl ...`), вы **обязаны** дописать её в `RUNBOOK.md` с пояснением.

## Предметная область

Приложение предназначено для оценки эффективности работы сотрудников. Каждый сотрудник имеет:

- **id** — уникальный идентификатор
- **name** — ФИО сотрудника
- **position** — должность
- **department** — отдел
- **rating** — оценка эффективности (число от 1 до 10)
- **reviewDate** — дата проведения оценки (строка в формате YYYY-MM-DD)
- **email** — электронная почта (необязательное поле, добавлено миграцией)

## Технологии

Сервер:

- Node.js
- Express.js (в т.ч. middleware `cors` — CORS для фронтенда)
- Sequelize (ORM) + PostgreSQL
- Mongoose (ODM) + MongoDB — документное хранилище с вложенными структурами
- JSON Web Token (jsonwebtoken)
- bcrypt (хеширование паролей)
- Nodemon (для разработки)

Фронтенд (`my-app/`, лабораторные работы №4–№5):

- React 19 + Vite
- axios (HTTP-клиент, REST API)
- Vitest + Testing Library (тесты с моком API)

## Ветки и лабораторные работы

| Ветка | Лабораторная | Содержимое |
|-------|--------------|------------|
| `lab21` | №1 | Express CRUD API сотрудников (хранение в памяти) |
| `lab22` | №2 | PostgreSQL через Sequelize: модели, миграции, сиды |
| `lab23` | №3 | Аутентификация JWT + RBAC, справочник `GET /api/v1` |
| `lab24` | №4 | React-приложение `my-app`: список на `useState`/`useEffect` + `localStorage` |
| `lab25` | №5 | Интеграция React ↔ REST API (axios): GET с loading/error, оптимистичный CRUD, поиск с debounce |
| `lab26` | №6 | MongoDB + Mongoose: вложенные структуры, CRUD-маршруты, Postman-коллекция |

Каждая лабораторная лежит только в своей ветке: `lab24` — без функционала №5,
`lab25` — без MongoDB, `lab26` — самая полная (фронтенд + реляционное API + документное хранилище).


## Фронтенд (ЛР №4–№5)

Каталог `my-app/` — React-приложение (Vite) для управления списком сотрудников
предметной области «Оценка эффективности сотрудников».

**ЛР №4** — управление локальным списком на `useState`/`useEffect`: добавление /
редактирование / удаление, фильтрация и сортировка, статистика, заголовок
`document.title` с количеством элементов; хранение списка в `localStorage`
(автосохранение с debounce 500 мс, загрузка при монтировании).

**ЛР №5** — интеграция с REST API этого репозитория:

- `src/api.js` — axios-клиент: baseURL из `my-app/.env` (`VITE_API_URL`),
  перехватчик запросов добавляет JWT-токен из `localStorage`
  (`Authorization: Bearer <token>`), нормализация ошибок и функции
  `fetchEmployees / createEmployee / updateEmployee / deleteEmployee`;
- `src/components/EmployeeList.jsx` — GET списка с индикаторами загрузки и
  ошибки + кнопкой «Повторить»; **оптимистичное обновление**: добавление
  (временный id → реальный id из ответа сервера), редактирование (PUT) и
  удаление (DELETE) с откатом состояния при ошибке сервера и toast-уведомлениями;
- **дополнительное улучшение:** серверный поиск (`?search=`) с debounce 500 мс
  и отменой устаревших запросов через `AbortController` (в т.ч. при размонтировании);
- `useEffect [employees.length]` — обновление `document.title`;
- клиентская фильтрация по отделу и сортировка (ЛР №4) сохранены.

**Аутентификация и роли (первая страница — вход/регистрация):**

- `src/components/AuthPage.jsx` — вход (`POST /auth/login`) и регистрация
  (`POST /auth/register`, затем автоматический вход); JWT и пользователь
  сохраняются в `localStorage` (ключи `token`/`user`, см. `src/session.js`);
- `src/App.jsx` — проверка токена при старте (`GET /profile`, отмена запроса
  через `AbortController`) и разводка **по роли**:
  - **admin** — вкладки «Сотрудники» (полный CRUD — функционал не изменился)
    и «Профиль»;
  - **user** — только своя страница профиля (без доступа к списку сотрудников);
- `src/components/Profile.jsx` — загрузка данных (`GET /profile`, состояния
  «загрузка / ошибка» + «Повторить») и редактирование email/пароля через
  **`PUT /api/v1/profile`** с сохранением в БД; 401 (просрочен токен) →
  автоматический разлогин.

Настройка и запуск (подробности — в `RUNBOOK.md`, раздел «Фронтенд»):

```bash
# создайте my-app/.env (шаблон — my-app/.env.example):
#   VITE_API_URL=http://localhost:3000/api/v1
cd my-app
npm install        # зависимости, в т.ч. axios
npm run dev        # http://localhost:5173 (сервер должен работать на :3000)
npm run test       # Vitest: 27 тестов (API замокан)
```

## MongoDB (Mongoose): документное хранилище

Тот же предметный вид (сотрудники и оценки эффективности) дополнительно хранится
в MongoDB — для демонстрации отличий документной модели от реляционной.

- **подключение:** `mongoose.connect(MONGO_URI)` в `server.js`; строка подключения
  — `MONGO_URI` в `.env` (например, `mongodb://127.0.0.1:27017/employee_eval`
  или Atlas `mongodb+srv://…`);
- **схема/модель:** `mongo/models/employee.js`, коллекция `employees_mongo` —
  поля сотрудника + **вложенные массивы**: `reviews[]` (история оценок, внутри —
  ещё массив целей `goals[]`) и `skills[]` (навык + уровень);
- **маршруты:** `/api/v1/mongo/employees` — CRUD методами Mongoose
  (`find / findById / create / findByIdAndUpdate / findByIdAndDelete`) +
  вложенные операции `$push`, `$`, `$pull`, `$addToSet`, `$inc`; список
  поддерживает `?search=` (`$regex` без учёта регистра по ФИО, должности,
  отделу, email и названию навыка `skills.name`);
- **команды:** `npm run seed:mongo` (демо-документ), `npm run check:mongo`
  (12 проверок), справочник маршрутов — `GET /api/v1`;
- **Postman:** `postman/mongo.postman_collection.json` — отдельная коллекция из
  26 запросов только по MongoDB (подготовка → CRUD → вложенные структуры →
  валидация → «документ vs таблицы» → очистка); запускается кнопкой
  **Run collection**, переменные `mongoId`/`reviewId`/`seedId` подставляются
  автоматически (прогон: 26/26 зелёных, созданный документ удаляется сам).

Пример документа из коллекции `employees_mongo`:

```json
{
  "name": "Иван Иванов",
  "position": "Разработчик",
  "department": "IT",
  "rating": 8.5,
  "skills": [
    { "name": "JavaScript", "level": 9 },
    { "name": "SQL", "level": 7 }
  ],
  "reviews": [
    {
      "date": "2026-09-01",
      "reviewer": "Алексей Сидоров (лид команды)",
      "rating": 9,
      "comment": "Успешно закрыл миграцию сервиса без даунтайма.",
      "goals": ["Снизить время сборки"]
    }
  ]
}
```

**Реляционная модель (PostgreSQL) vs документная (MongoDB):**

| PostgreSQL (Sequelize) | MongoDB (Mongoose) |
|------------------------|--------------------|
| оценки — отдельная таблица + внешний ключ на `Employees` | история оценок **внутри** документа: `reviews[]` |
| навыки — таблица `Skills` (+ связывающая таблица) | `skills[]` — массив вложенных документов |
| чтение истории = `JOIN` / подзапросы | документ читается целиком одним `find()` |
| добавить отзыв = `INSERT` в другую таблицу | `POST .../reviews` → `$push` по массиву |
| изменить уровень навыка = `UPDATE` по id строки | `PATCH .../skills/:name` → `$inc` + позиционный `$` |
| правки структуры = миграции (`sequelize-cli`) | схема гибкая, документ самодокументирован |

## Установка и настройка

### 1. Создание проекта в Supabase (облачная БД)

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект.
2. Запишите URL проекта (Project URL), например `https://<project-ref>.supabase.co`.
3. В разделе **Project Settings → Database → Connection strings** выберите тип подключения:

   - **Session pooler** (рекомендуется для этого приложения — работает по IPv4 с любых сетей):
     ```
     postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify
     ```
   - **Direct connection** (только если сеть поддерживает IPv6 или подключён IPv4 add-on):
     ```
     postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
     ```

   > Хост pooler'а (`aws-<index>-<region>.pooler.supabase.com`) нельзя составить вручную — копируйте его из дашборда.

   > ⚠️ **Почему `sslmode=no-verify`, а не `sslmode=require`?** Начиная с `pg@8.16`
   > (через `pg-connection-string@2.9`) режимы `require` / `prefer` трактуются как
   > `verify-full`, и подключение к pooler'у Supabase падает с
   > `self-signed certificate in certificate chain`. Режим `no-verify` включает
   > TLS-шифрование, но не проверяет цепочку сертификатов — это рабочий вариант
   > для Supabase pooler без установки CA-сертификата.

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify
JWT_SECRET=<произвольная_строка>
MONGO_URI=mongodb://127.0.0.1:27017/employee_eval
```

Замените `<project-ref>`, `<PASSWORD>`, `<index>` и `<region>` на значения из дашборда Supabase.
> Файл `.env` в `.gitignore` и не коммитится. Приложение читает его через
> `require('dotenv').config()` в `models/index.js`, а **sequelize-cli — через
> `.sequelizerc`** (CLI сам `.env` не подгружает).

### 4. Запуск миграций и сидов

```bash
npx sequelize-cli db:migrate       # применить миграции (создать таблицу Employees)
npx sequelize-cli db:seed:all      # наполнить базу тестовыми данными (3 сотрудника)
```

Проверить, что всё настроено правильно (подключение, таблица, модель, CRUD,
миграция изменения схемы, сиды) можно одной командой:

```bash
npm run check                      # полная автопроверка лабораторной работы №2
```

### 5. Запуск приложения

```bash
npm run dev          # запуск в режиме разработки (nodemon)
npm start            # обычный запуск
```

Сервер запускается на порту **3000**.

### 6. Запуск фронтенда (лабораторные работы №4–№5)

Фронтенд (React + Vite, папка `my-app`) обращается к REST API сервера:

```bash
cd my-app
npm install                 # установить зависимости (в т.ч. axios)
# создайте my-app/.env (см. .env.example):
#   VITE_API_URL=http://localhost:3000/api/v1
npm run dev                 # Vite dev-сервер на http://localhost:5173
npm run test                # vitest — 27 тестов (мок API)
npm run lint                # oxlint — 0 warnings
npm run build               # production-сборка в my-app/dist
```

Полный список команд — в `RUNBOOK.md`.

## API

**Важно:** все эндпоинты приложения доступны только под префиксом `/api/v1`
(в `server.js` роутер подключён как `app.use('/api/v1', api.v1.router)`).
Без префикса маршрута нет — вернётся 404 с подсказкой.

Базовый URL: `http://localhost:3000/api/v1`

Справочник всех маршрутов (удобно для проверки пути):
`GET http://localhost:3000/api/v1` → JSON со списком `{ method, path, access }`.

Ресурс: `/employees`

| Метод  | Эндпоинт (полный путь)                | Описание                              |
|--------|---------------------------------------|---------------------------------------|
| GET    | `http://localhost:3000/api/v1`        | Справочник эндпоинтов                 |
| GET    | `/api/v1/employees`                   | Получить список всех сотрудников      |
| GET    | `/api/v1/employees/:id`               | Получить сотрудника по ID             |
| POST   | `/api/v1/employees`                   | Добавить нового сотрудника            |
| PUT    | `/api/v1/employees/:id`               | Полностью обновить данные сотрудника  |
| DELETE | `/api/v1/employees/:id`               | Удалить сотрудника                    |

> GET `/api/v1/employees?search=<фрагмент>` — серверный поиск без учёта регистра
> (ILIKE) по ФИО, должности, отделу и email. Используется фронтендом в ЛР №5
> с debounce на ввод.

### Пример тела запроса (POST / PUT)

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

### Коды ответов

| Код | Описание                                    |
|-----|---------------------------------------------|
| 200 | Успешный запрос                            |
| 201 | Сотрудник успешно создан                   |
| 400 | Некорректные данные запроса                |
| 404 | Сотрудник с указанным ID не найден         |
| 500 | Внутренняя ошибка сервера                  |

### Аутентификация: JWT + RBAC

Помимо сотрудников (`Employee`) в приложении есть пользователи (`User`) с
ролью **user** или **admin** (ролевая модель). Регистрация и вход работают на
**JWT** (токен живёт 1 час) и **bcrypt** (хеширование паролей).

| Метод  | Эндпоинт                        | Доступ            | Body (raw → JSON)                        | Описание                                        |
|--------|---------------------------------|-------------------|------------------------------------------|-------------------------------------------------|
| POST   | `/api/v1/auth/register`         | все               | `{"email":"...","password":"..."}`       | Регистрация (`email`, `password`) → 201         |
| POST   | `/api/v1/auth/login`            | все               | `{"email":"...","password":"..."}`       | Вход → `{ token, user }`                        |
| GET    | `/api/v1/profile`               | авторизованные    | —                                        | Данные текущего пользователя                    |
| DELETE | `/api/v1/profile`               | авторизованные    | —                                        | Удалить свою учётную запись                     |
| GET    | `/api/v1/admin/users`           | admin             | —                                        | Список всех пользователей                       |
| GET    | `/api/v1/admin/users/:id`       | admin             | —                                        | Пользователь по ID                             |
| PATCH  | `/api/v1/admin/users/:id/role`  | admin             | `{"role":"user"}` / `{"role":"admin"}`   | Сменить роль (`user`/`admin`)                  |
| DELETE | `/api/v1/admin/users/:id`       | admin             | —                                        | Удалить пользователя                            |

Авторизация: заголовок `Authorization: Bearer <token>`. Маршруты `/admin`
дополнительно проверяют роль через middleware `isAdmin`.

```bash
# Регистрация
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret123"}'

# Вход
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}'
```

Демо-администратор создаётся сидом: `admin@example.com` / `Admin123!`.
Секрет JWT хранится в `.env` (переменная `JWT_SECRET`).

## Архитектура проекта

Проект построен по слоистой архитектуре:

```
my-node-app/
├── app/                        # HTTP-слой (маршруты)
│   ├── api/
│   │   ├── v1/
│   │   │   ├── employees.js    # Маршруты сотрудников
│   │   │   ├── auth.js         # Маршруты аутентификации (register, login)
│   │   │   ├── profile.js      # Защищённые маршруты текущего пользователя
│   │   │   ├── admin.js        # Маршруты администратора (RBAC)
│   │   │   ├── router.js       # Объединение маршрутов v1
│   │   │   └── index.js
│   │   └── index.js
│   └── index.js
├── config/                     # Конфигурация Sequelize
│   └── config.json
├── core/                       # Ядро приложения
│   ├── config.js               # Конфигурация (порт)
│   ├── AppError.js             # Класс ошибок приложения
│   ├── errorHandler.js         # Глобальный обработчик ошибок
│   └── index.js
├── middleware/                 # Middleware безопасности
│   ├── auth.js                 # Проверка JWT (Authorization: Bearer <token>)
│   └── isAdmin.js              # RBAC: доступ только для роли admin
├── mongo/                      # Mongoose (MongoDB): документное хранилище
│   ├── models/employee.js      # Схема: вложенные reviews[] и skills[]
│   └── routes/employees.js     # CRUD + $push / $ / $pull / $addToSet / $inc
├── migrations/                 # Миграции базы данных
├── models/                     # Модели данных (Sequelize)
│   ├── employee.js             # Модель сотрудника
│   ├── user.js                 # Модель пользователя (email, passwordHash, role)
│   └── index.js
├── repositories/               # Слой доступа к данным
│   ├── employeeRepository.js   # Работа с данными сотрудников
│   ├── userRepository.js       # Работа с данными пользователей
│   └── index.js
├── schemas/                    # Схемы валидации
│   ├── employeeSchema.js       # Валидация данных сотрудника
│   ├── authSchema.js           # Валидация аутентификации и ролей
│   └── index.js
├── seeders/                    # Сиды (тестовые данные)
├── services/                   # Бизнес-логика
│   ├── employeeService.js      # Сервис сотрудников
│   ├── authService.js          # Сервис аутентификации (JWT + RBAC)
│   └── index.js
├── server.js                   # Точка входа
├── .env                        # Переменные окружения (не в git)
├── package.json
└── README.md
```

Фронтенд (лабораторные работы №4–№5) — отдельное Vite + React SPA в `my-app/`:

```
my-app/
├── .env                        # VITE_API_URL (не в git), шаблон — .env.example
├── src/
│   ├── api.js                  # axios-клиент (JWT-перехватчик, CRUD + auth/profile)
│   ├── session.js              # сессия в localStorage (token, user)
│   ├── App.jsx                 # вход → проверка токена → вкладки по роли
│   ├── App.test.jsx            # тесты ролей (admin/user, logout, 401)
│   ├── components/
│   │   ├── AuthPage.jsx        # вход / регистрация (первая страница)
│   │   ├── AuthPage.test.jsx
│   │   ├── EmployeeList.jsx    # список: GET/POST/PUT/DELETE, loading/error, поиск
│   │   ├── EmployeeList.test.jsx
│   │   ├── Profile.jsx         # профиль: GET/PUT /profile (сохранение в БД)
│   │   └── Profile.test.jsx
│   └── data/demoEmployees.js   # эталонная структура объекта Employee
└── vite.config.js
```

### Слои и их ответственность

| Слой | Ответственность |
|------|-----------------|
| `app/api/v1` | HTTP-маршруты, обработка запросов/ответов |
| `services` | Бизнес-логика, валидация, вызовы репозитория |
| `repositories` | Доступ к данным (Sequelize/PostgreSQL) |
| `models` | Описание структуры данных (Sequelize) |
| `migrations` | Управление схемой базы данных |
| `seeders` | Наполнение базы тестовыми данными |
| `schemas` | Валидация входных данных |
| `core` | Конфигурация, ошибки, обработчики |

## База данных (Sequelize)

- Конфигурация подключения: `config/config.json` (указывает на `DATABASE_URL` из `.env`)
  и `.sequelizerc` (загружает `.env` для sequelize-cli и задаёт пути к config/models/migrations/seeders).
- Модель сотрудника: `models/employee.js` → таблица `Employees`.
- Модель пользователя: `models/user.js` → таблица `Users`
  (`email` unique + NOT NULL, `passwordHash` NOT NULL, `role` по умолчанию `user`).
- Миграции:
  - `create-employee` — создание таблицы `Employees`;
  - `add-email-to-employees` — добавление колонки `email` (изменение схемы);
  - `create-user` — создание таблицы `Users` (лабораторная работа №3).
- Сиды:
  - `seeders/demo-employees` — стартовые данные (3 сотрудника);
  - `seeders/demo-admin-user` — демо-администратор `admin@example.com` / `Admin123!`.
- Репозиторий (CRUD через Sequelize): `repositories/employeeRepository.js`
  (`Employee.findAll` / `findByPk` / `create` / `save` / `destroy`).
- Автопроверка задач лабораторной работы №2: `scripts/selfcheck.js` (`npm run check`).
- Автопроверка задач лабораторной работы №3: `scripts/selfcheck-lab3.js` (`npm run check:lab3`).

## Тестирование через Postman

Готовая коллекция со всеми запросами лабораторной №3 (JWT + RBAC) лежит в
`postman/lab3-auth.postman_collection.json` — токены подставляются автоматически.
Полный набор по всем эндпоинтам — `postman/full-api.postman_collection.json`
(34 запроса: auth, employees, profile, admin, MongoDB).
Только MongoDB (лабораторная по документным БД) —
`postman/mongo.postman_collection.json`: 26 запросов, порядок «подготовка → CRUD →
вложенные структуры → валидация → документ vs таблицы → очистка», кнопка
**Run collection** заполняет `mongoId`/`reviewId`/`seedId` и удаляет тестовый
документ в конце (прогон 26/26 зелёных).

Как пользоваться:

1. Postman → **Import** → выбрать `postman/lab3-auth.postman_collection.json`.
2. Проверить переменную коллекции `baseUrl` (= `http://localhost:3000`) —
   вкладка **Variables** у коллекции; при необходимости поменять на свой порт.
   `baseUrl` содержит **только хост**: префикс `/api/v1` уже прописан в путях
   запросов (например `{{baseUrl}}/api/v1/employees`), иначе получится
   `/api/v1/api/v1/...` и 404.
3. Запустить сервер (`npm start`) и выполнять запросы **по порядку**:
   0.1 (справочник эндпоинтов) → 1.1 (регистрация) → 1.2/1.3 (вход:
   пользователь/админ) → 2.x (защищённые) → 3.x (только для роли admin).
4. Токены из ответов сохраняются скриптами в переменные коллекции
   (`token`, `adminToken`), поэтому защищённые запросы сразу работают:
   достаточно выбрать тип авторизации **Bearer Token** → `{{token}}` (или
   `{{adminToken}}` для админских).
5. Результаты проверок видны на вкладке **Test Results** каждого запроса.

Запросы коллекции и ожидаемые статусы:

| № | Запрос | Доступ | Ожидаемо |
|---|--------|--------|----------|
| 1.1 | `POST /api/v1/auth/register` | все | **201** |
| 1.2 | `POST /api/v1/auth/login` (обычный пользователь) | все | **200** + token |
| 1.3 | `POST /api/v1/auth/login` (admin@example.com) | все | **200** + adminToken |
| 1.4 | `POST /api/v1/auth/login` (неверный пароль) | все | **401** |
| 2.1 | `GET /api/v1/profile` с токеном | авторизованные | **200** |
| 2.2 | `GET /api/v1/profile` без токена | — | **401** |
| 2.3 | `GET /api/v1/profile` с битым токеном | — | **401** |
| 2.4 | `DELETE /api/v1/profile` | авторизованные | **200** (удаляет свою учётку) |
| 3.1 | `GET /api/v1/admin/users` с токеном admin | admin | **200** |
| 3.2 | `GET /api/v1/admin/users` с токеном user | user | **403** |
| 3.3 | `GET /api/v1/admin/users` без токена | — | **401** |
| 3.4 | `GET /api/v1/admin/users/:id` | admin | **200** |
| 3.5 | `PATCH /api/v1/admin/users/:id/role` `{"role":"admin"}` | admin | **200** |
| 3.6 | `PATCH /api/v1/admin/users/:id/role` `{"role":"superuser"}` | admin | **400** |
| 3.7 | `DELETE /api/v1/admin/users/:id` | admin | **200** |

Обычные ручные запросы в Postman: метод и адрес — из таблицы выше. Для `POST`,
`PATCH`, `PUT`:

- вкладка **Body** → **raw** → тип **JSON** (не Text!);
- в поле ввода — JSON из примера;
- заголовок `Content-Type: application/json` Postman ставит сам при выборе JSON;
- для защищённых маршрутов — вкладка **Auth** → **Bearer Token** → `{{token}}`
  (Postman сам добавит заголовок `Authorization: Bearer <token>`).

Postman обращается только к HTTP API приложения (`http://localhost:3000`),
поэтому о подключении к облачной БД (`sslmode=no-verify`) думать не нужно.
