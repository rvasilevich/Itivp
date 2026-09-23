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

- Node.js
- Express.js
- Sequelize (ORM)
- PostgreSQL
- JSON Web Token (jsonwebtoken)
- bcrypt (хеширование паролей)
- Nodemon (для разработки)
- React + Vite (фронтенд `my-app/`, ЛР №4)
- localStorage (клиентское хранение списка сотрудников)

## Фронтенд (ЛР №4)

Каталог `my-app/` — React-приложение (Vite) для управления списком сотрудников
предметной области «Оценка эффективности сотрудников».

Компонент `my-app/src/components/EmployeeList.jsx`:

- `useState` — массив сотрудников, значения полей формы, состояние фильтра/сортировки;
- `useEffect []` — загрузка списка из `localStorage` при монтировании (с имитацией
  загрузки с сервера, задержка 1 с), инициализация демо-данными, если сохранений нет;
- `useEffect [employees]` — автосохранение в `localStorage` (`JSON.stringify`)
  с debounce 500 мс после последнего изменения;
- `useEffect [employees.length]` — обновление `document.title` (кол-во элементов);
- добавление / редактирование / удаление сотрудников;
- фильтрация (поиск по ФИО/должности/отделу, выбор отдела) и сортировка
  (ФИО, рейтинг, отдел, дата оценки; по возрастанию/убыванию);
- статистика: всего, средний рейтинг, рейтинг ≥ 8, лучший сотрудник.

Запуск (подробности — в `RUNBOOK.md`, раздел «Фронтенд»):

```bash
cd my-app
npm install
npm run dev    # http://localhost:5173
npm run test   # Vitest: 8 юнит-тестов компонента
```

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
