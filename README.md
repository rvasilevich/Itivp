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
- Sequelize (ORM)
- PostgreSQL
- JSON Web Token (jsonwebtoken)
- bcrypt (хеширование паролей)
- Nodemon (для разработки)

Фронтенд (`my-app/`, лабораторные работы №4–№5):
- React 19 + Vite
- axios (HTTP-клиент, REST API)
- Vitest + Testing Library (тесты с моком API)

## Установка и настройка

### 1. Создание проекта в Supabase (облачная БД)

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект.
2. Запишите URL проекта (Project URL), например `https://<project-ref>.supabase.co`.
3. В разделе **Project Settings → Database → Connection strings** выберите тип подключения:

   - **Session pooler** (рекомендуется для этого приложения — работает по IPv4 с любых сетей):
     ```
     postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
     ```
   - **Direct connection** (только если сеть поддерживает IPv6 или подключён IPv4 add-on):
     ```
     postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
     ```

   > Хост pooler'а (`aws-<index>-<region>.pooler.supabase.com`) нельзя составить вручную — копируйте его из дашборда.

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Замените `<project-ref>`, `<PASSWORD>`, `<index>` и `<region>` на значения из дашборда Supabase.

### 4. Запуск миграций и сидов

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
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
npm test                    # vitest — 12 тестов (мок API)
npm run lint                # oxlint — 0 warnings
npm run build               # production-сборка в my-app/dist
```

Полный список команд — в `RUNBOOK.md`.

## API

Базовый URL: `http://localhost:3000/api/v1`

Ресурс: `/employees`

| Метод  | Эндпоинт                    | Описание                              |
|--------|------------------------------|---------------------------------------|
| GET    | `/api/v1/employees`          | Получить список всех сотрудников      |
| GET    | `/api/v1/employees/:id`      | Получить сотрудника по ID             |
| POST   | `/api/v1/employees`          | Добавить нового сотрудника            |
| PUT    | `/api/v1/employees/:id`      | Полностью обновить данные сотрудника  |
| DELETE | `/api/v1/employees/:id`      | Удалить сотрудника                    |

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

| Метод  | Эндпоинт                        | Доступ            | Описание                                        |
|--------|---------------------------------|-------------------|-------------------------------------------------|
| POST   | `/api/v1/auth/register`         | все               | Регистрация (`email`, `password`) → 201         |
| POST   | `/api/v1/auth/login`            | все               | Вход → `{ token, user }`                        |
| GET    | `/api/v1/profile`               | авторизованные    | Данные текущего пользователя                    |
| DELETE | `/api/v1/profile`               | авторизованные    | Удалить свою учётную запись                     |
| GET    | `/api/v1/admin/users`           | admin             | Список всех пользователей                       |
| GET    | `/api/v1/admin/users/:id`       | admin             | Пользователь по ID                             |
| PATCH  | `/api/v1/admin/users/:id/role`  | admin             | Сменить роль (`user`/`admin`)                  |
| DELETE | `/api/v1/admin/users/:id`       | admin             | Удалить пользователя                            |

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

Фронтенд (лабораторные работы №4–№5) — отдельное Vite + React SPA в `my-app/`:

```
my-app/
├── .env                        # VITE_API_URL (не в git), шаблон — .env.example
├── src/
│   ├── api.js                  # axios-клиент REST API (JWT-перехватчик, CRUD-функции)
│   ├── App.jsx
│   ├── components/
│   │   ├── EmployeeList.jsx    # список: GET/POST/PUT/DELETE, loading/error, поиск
│   │   └── EmployeeList.test.jsx  # vitest-тесты с моком api
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