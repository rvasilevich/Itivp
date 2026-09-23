const express = require('express');
const { AuthService } = require('../../../services');
const auth = require('../../../middleware/auth');

const router = express.Router();
const authService = new AuthService();

// Все маршруты /profile защищены аутентификацией (Bearer <token>)
router.use(auth);

// GET /api/v1/profile — данные текущего пользователя
router.get('/', async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  res.json(profile);
});

// PUT /api/v1/profile — обновление своих данных (email и/или пароль) с сохранением в БД
router.put('/', async (req, res) => {
  const profile = await authService.updateProfile(req.user.id, req.body);
  res.json(profile);
});

// DELETE /api/v1/profile — удаление собственной учётной записи
router.delete('/', async (req, res) => {
  const deleted = await authService.deleteUser(req.user.id);
  res.json({ message: 'Ваша учётная запись удалена', user: deleted });
});

module.exports = router;