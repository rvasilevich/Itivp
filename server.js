// Загружаем переменные окружения (.env) до подключения моделей и middleware,
// чтобы JWT_SECRET и DATABASE_URL были доступны на этапе require().
require('dotenv').config();

const express = require('express');
const { config, errorHandler } = require('./core');
const { api } = require('./app');

const app = express();

// Middleware для парсинга JSON
app.use(express.json());

// Подключение маршрутов API v1
app.use('/api/v1', api.v1.router);

// Обработка несуществующих маршрутов — 404
app.use((req, res) => {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

// Глобальный обработчик ошибок (error-handling middleware)
app.use(errorHandler);

app.listen(config.port, () => console.log('Server running...'));