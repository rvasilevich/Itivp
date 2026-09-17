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
- Nodemon (для разработки)

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

## Архитектура проекта

Проект построен по слоистой архитектуре:

```
my-node-app/
├── app/                        # HTTP-слой (маршруты)
│   ├── api/
│   │   ├── v1/
│   │   │   ├── employees.js    # Маршруты сотрудников
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
├── migrations/                 # Миграции базы данных
├── models/                     # Модели данных (Sequelize)
│   ├── employee.js              # Модель сотрудника
│   └── index.js
├── repositories/               # Слой доступа к данным
│   ├── employeeRepository.js    # Работа с данными (Sequelize/PostgreSQL)
│   └── index.js
├── schemas/                    # Схемы валидации
│   ├── employeeSchema.js        # Валидация данных сотрудника
│   └── index.js
├── seeders/                    # Сиды (тестовые данные)
├── services/                   # Бизнес-логика
│   ├── employeeService.js       # Сервис сотрудников
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