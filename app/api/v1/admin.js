const express = require('express');
const { AuthService } = require('../../../services');
const auth = require('../../../middleware/auth');
const isAdmin = require('../../../middleware/isAdmin');

const router = express.Router();
const authService = new AuthService();

// Все административные маршруты требуют аутентификацию и роль admin (RBAC)
router.use(auth, isAdmin);

// GET /api/v1/admin/users — список всех пользователей
router.get('/users', async (req, res) => {
  const users = await authService.getAllUsers();
  res.json(users);
});

// GET /api/v1/admin/users/:id — пользователь по ID
router.get('/users/:id', async (req, res) => {
  const user = await authService.getUserById(req.params.id);
  res.json(user);
});

// PATCH /api/v1/admin/users/:id/role — изменить роль (RBAC: user <-> admin)
router.patch('/users/:id/role', async (req, res) => {
  const user = await authService.changeRole(req.params.id, req.body.role);
  res.json(user);
});

// DELETE /api/v1/admin/users/:id — удалить пользователя
router.delete('/users/:id', async (req, res) => {
  const deleted = await authService.deleteUserById(req.params.id);
  res.json({ message: `Пользователь с ID ${req.params.id} удалён`, user: deleted });
});

module.exports = router;