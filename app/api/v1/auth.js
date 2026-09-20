const express = require('express');
const { AuthService } = require('../../../services');

const router = express.Router();
const authService = new AuthService();

// POST /api/v1/auth/register — регистрация нового пользователя (201)
router.post('/register', async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json(user);
});

// POST /api/v1/auth/login — вход, проверка пароля, выдача JWT
router.post('/login', async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

module.exports = router;