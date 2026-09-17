const jwt = require('jsonwebtoken');
const { AppError } = require('../core');

// Секрет для проверки JWT. Должен совпадать с тем, что в services/authService.js
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Middleware аутентификации:
// 1) извлекает токен из заголовка Authorization: Bearer <token>
// 2) верифицирует токен
// 3) прикрепляет req.user = { id, email, role } и вызывает next()
function auth(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    throw new AppError(401, 'Токен не предоставлен. Используйте заголовок Authorization: Bearer <token>');
  }

  const token = header.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    throw new AppError(401, 'Недействительный или просроченный токен');
  }
}

module.exports = auth;