const express = require('express');
const employeesRouter = require('./employees');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const adminRouter = require('./admin');

const router = express.Router();

// Справочник API: ВСЕ эндпоинты приложения живут под префиксом /api/v1
// (см. server.js: app.use('/api/v1', api.v1.router)).
// GET /api/v1 — возвращает этот список, чтобы легко проверить актуальные пути.
const API_INDEX = [
  { method: 'GET', path: '/api/v1', access: 'все', description: 'Справочник эндпоинтов' },
  { method: 'GET', path: '/api/v1/employees', access: 'все', description: 'Список всех сотрудников (поддерживает ?search=)' },
  { method: 'GET', path: '/api/v1/employees/:id', access: 'все', description: 'Сотрудник по ID' },
  { method: 'POST', path: '/api/v1/employees', access: 'все', description: 'Создать сотрудника' },
  { method: 'PUT', path: '/api/v1/employees/:id', access: 'все', description: 'Обновить сотрудника' },
  { method: 'DELETE', path: '/api/v1/employees/:id', access: 'все', description: 'Удалить сотрудника' },
  { method: 'POST', path: '/api/v1/auth/register', access: 'все', description: 'Регистрация (email, password) → 201' },
  { method: 'POST', path: '/api/v1/auth/login', access: 'все', description: 'Вход → { token, user }' },
  { method: 'GET', path: '/api/v1/profile', access: 'авторизованные', description: 'Данные текущего пользователя' },
  { method: 'DELETE', path: '/api/v1/profile', access: 'авторизованные', description: 'Удалить свою учётную запись' },
  { method: 'GET', path: '/api/v1/admin/users', access: 'admin', description: 'Список всех пользователей (RBAC)' },
  { method: 'GET', path: '/api/v1/admin/users/:id', access: 'admin', description: 'Пользователь по ID (RBAC)' },
  { method: 'PATCH', path: '/api/v1/admin/users/:id/role', access: 'admin', description: 'Сменить роль user/admin (RBAC)' },
  { method: 'DELETE', path: '/api/v1/admin/users/:id', access: 'admin', description: 'Удалить пользователя (RBAC)' }
];

router.get('/', (req, res) => {
  res.json({
    baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
    endpoints: API_INDEX
  });
});

// Подключение маршрутов v1
router.use('/employees', employeesRouter);
router.use('/auth', authRouter);
router.use('/profile', profileRouter);
router.use('/admin', adminRouter);

module.exports = router;