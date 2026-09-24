// Загружаем переменные окружения (.env) до подключения моделей и middleware,
// чтобы JWT_SECRET и DATABASE_URL были доступны на этапе require().
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { config, errorHandler } = require('./core');
const { api } = require('./app');
const mongoEmployeesRouter = require('./mongo/routes/employees');
const { createSocketServer } = require('./socket');

const app = express();

// HTTP-сервер создаём вручную (а не app.listen), чтобы прикрепить к нему
// и Express, и Socket.IO — они работают на одном порту 3000 (ЛР №7).
const server = http.createServer(app);

// CORS — разрешает запросы с клиентского React-приложения (localhost:5173, ЛР №5)
app.use(cors());

// Нормализация URL: Postman/коллекции часто склеивают базовый URL и путь,
// получая двойной слэш — http://localhost:3000//api/v1/auth/register.
// Express такой путь не сопоставляет с маршрутом (404), поэтому сводим
// повторяющиеся слэши к одному до подключения маршрутов.
app.use((req, res, next) => {
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/{2,}/g, '/');
    req.originalUrl = req.url;
  }

  next();
});

// Middleware для парсинга JSON
app.use(express.json());

// Подключение к MongoDB (Mongoose): MONGO_URI из .env, fallback — локальная установка
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employee_eval')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

// Маршруты MongoDB: документные сотрудники с вложенными структурами
// (в реляционной части приложения — Sequelize/PostgreSQL, здесь — Mongoose)
app.use('/api/v1/mongo/employees', mongoEmployeesRouter);

// Подключение маршрутов API v1
app.use('/api/v1', api.v1.router);

// Обработка несуществующих маршрутов — 404
app.use((req, res) => {
  const isApiV1 = req.originalUrl.startsWith('/api/v1');

  const hint = isApiV1
    ? 'Список доступных эндпоинтов: GET /api/v1'
    : `Все эндпоинты приложения доступны только под префиксом /api/v1 — например: ${req.method} /api/v1${req.originalUrl}`;

  res.status(404).json({
    error: `Маршрут ${req.method} ${req.originalUrl} не найден`,
    hint
  });
});

// Глобальный обработчик ошибок (error-handling middleware)
app.use(errorHandler);

// Socket.IO (ЛР №7): реальное время на том же HTTP-сервере и порту, что и REST API.
// Клиент подключается к http://localhost:3000 (СОБЫТИЯ, а не REST-пути /api/v1):
// комнаты-каналы, уведомления о подключении/отключении, история в MongoDB
// (коллекция messages_mongo), индикатор «печатает…», приватные сообщения, реакции.
createSocketServer(server);

server.listen(config.port, () => console.log('Server running...'));
