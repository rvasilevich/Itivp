const { AppError } = require('../core');

// Middleware ролевой модели (RBAC): допускает только пользователей с ролью admin.
// Использовать ПОСЛЕ middleware auth, чтобы req.user уже был прикреплён.
function isAdmin(req, res, next) {
  if (!req.user) {
    throw new AppError(401, 'Требуется аутентификация');
  }

  if (req.user.role !== 'admin') {
    throw new AppError(403, 'Доступ запрещён. Требуется роль администратора');
  }

  next();
}

module.exports = isAdmin;