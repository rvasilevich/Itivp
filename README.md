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
     postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify
     ```
   - **Direct connection** (только если сеть поддерживает IPv6 или подключён IPv4 add-on):
     ```
     postgresql://postgres:<PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
     ```

   > ⚠️ **Почему `sslmode=no-verify`, а не `sslmode=require`?** Начиная с `pg@8.16`
   > (через `pg-connection-string@2.9`) режимы `require` / `prefer` трактуются как
   > `verify-full`, и подключение к pooler'у Supabase падает с
   > `self-signed certificate in certificate chain`. Режим `no-verify` включает
   > TLS-шифрование, но не проверяет цепочку сертификатов — это рабочий вариант
   > для Supabase pooler без установки CA-сертификата.

### 2. Установка зависимостей

```bash
npm install
npm install --save-dev sequelize-cli
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-<index>-<region>.pooler.supabase.com:5432/postgres?sslmode=no-verify
JWT_SECRET=<произвольная_строка>
```

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

- Конфигурация подключения: `config/config.json` (указывает на `DATABASE_URL` из `.env`)
  и `.sequelizerc` (загружает `.env` для sequelize-cli и задаёт пути к config/models/migrations/seeders).
- Модель: `models/employee.js` → таблица `Employees`.
- Миграции:
  - `create-employee` — создание таблицы `Employees`;
  - `add-email-to-employees` — добавление колонки `email` (изменение схемы).
- Сиды: `seeders/demo-employees` — стартовые данные (3 сотрудника).
- Репозиторий (CRUD через Sequelize): `repositories/employeeRepository.js`
  (`Employee.findAll` / `findByPk` / `create` / `save` / `destroy`).
- Автопроверка всех задач лабораторной работы: `scripts/selfcheck.js` (`npm run check`).

## Тестирование через Postman

Postman → **New Request**, метод и адрес — из таблицы выше. Для `POST` и `PUT`:

- вкладка **Body** → **raw** → тип **JSON** (не Text!);
- в поле ввода — JSON из примера выше;
- заголовок `Content-Type: application/json` Postman ставит сам при выборе JSON.

Postman обращается только к HTTP API приложения (`http://localhost:3000`),
поэтому о подключении к облачной БД (`sslmode=no-verify`) думать не нужно.