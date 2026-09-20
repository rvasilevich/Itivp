# Приложение оценки эффективности сотрудников — лабораторная работа №2

REST API для управления оценкой эффективности сотрудников (Employee Performance Evaluation).

> 📖 **Всем AI-агентам и разработчикам:** все команды запуска хранятся в **`RUNBOOK.md`**.
> Если вы выполняете какую-либо ручную команду (`npm ...`, `npx sequelize-cli ...`,
> `node ...`, `curl ...`), вы **обязаны** дописать её в `RUNBOOK.md` с пояснением.

## Цель работы

Освоение подключения реляционной базы данных PostgreSQL к Node.js-приложению,
использование ORM Sequelize для создания моделей и выполнения CRUD-операций,
изучение миграций и связей между таблицами.

## Предметная область

Приложение предназначено для оценки эффективности работы сотрудников. Каждый сотрудник имеет:

- **id** — уникальный идентификатор
- **name** — ФИО сотрудника
- **position** — должность
- **department** — отдел
- **rating** — оценка эффективности (число от 1 до 10)
- **reviewDate** — дата проведения оценки (строка в формате YYYY-MM-DD)
- **email** — электронная почта (необязательное поле, добавлено миграцией)

Данные хранятся в базе данных **PostgreSQL** (облачная БД Supabase). Вместо массива
в памяти (лабораторная работа №1) используется ORM **Sequelize**.

## Технологии

- Node.js
- Express.js
- Sequelize (ORM)
- PostgreSQL (Supabase)
- Nodemon (для разработки)

## Установка и настройка

### 1. Создание проекта в Supabase (облачная БД)

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект.
2. Запишите URL проекта (Project URL), например `https://<project-ref>.supabase.co`.
3. В разделе **Project Settings → Database → Connection strings** выберите тип подключения:

   - **Session pooler** (рекомендуется — работает по IPv4 с любых сетей):
     ```
     postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
     ```
   - **Direct connection** (только если сеть поддерживает IPv6 или подключён IPv4 add-on):
     ```
     postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
     ```

### 2. Установка зависимостей

```bash
npm install
npm install --save-dev sequelize-cli
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

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

## База данных (Sequelize)

- Конфигурация подключения: `config/config.json` (указывает на `DATABASE_URL` из `.env`).
- Модель: `models/employee.js` → таблица `Employees`.
- Миграции:
  - `create-employee` — создание таблицы `Employees`;
  - `add-email-to-employees` — добавление колонки `email` (изменение схемы).
- Сиды: `seeders/demo-employees` — стартовые данные (3 сотрудника).