const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { AppError } = require('../core');
const { authSchema } = require('../schemas');
const { UserRepository } = require('../repositories');

// Секрет для подписи JWT. В проде обязательно задавать через переменную окружения!
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PASSWORD_SALT_ROUNDS = 10;

// Сервис аутентификации — регистрация, вход, управление пользователями (RBAC)
class AuthService {
  constructor() {
    this.repository = new UserRepository();
  }

  // Регистрация нового пользователя (роль всегда 'user')
  async register(data) {
    const errors = authSchema.validateRegister(data);

    if (errors.length > 0) {
      throw new AppError(400, 'Некорректные данные запроса', errors);
    }

    const email = data.email.trim().toLowerCase();
    const existing = await this.repository.findByEmail(email);

    if (existing) {
      throw new AppError(409, 'Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(data.password, PASSWORD_SALT_ROUNDS);

    const user = await this.repository.create({
      email,
      passwordHash,
      role: 'user'
    });

    return this.toSafeUser(user);
  }

  // Вход в систему — проверка пароля и выдача JWT (срок жизни 1 час)
  async login(data) {
    const errors = authSchema.validateLogin(data);

    if (errors.length > 0) {
      throw new AppError(400, 'Некорректные данные запроса', errors);
    }

    const email = data.email.trim().toLowerCase();
    const user = await this.repository.findByEmail(email);

    // Не раскрываем, существует ли пользователь, — одинаковый ответ для обоих случаев
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      throw new AppError(401, 'Неверный email или пароль');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return { token, user: this.toSafeUser(user) };
  }

  // Данные текущего пользователя
  async getProfile(userId) {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new AppError(404, 'Пользователь не найден');
    }

    return this.toSafeUser(user);
  }

  // Удалить собственную учётную запись
  async deleteUser(userId) {
    const deleted = await this.repository.delete(userId);

    if (!deleted) {
      throw new AppError(404, 'Пользователь не найден');
    }

    return this.toSafeUser(deleted);
  }

  // --- Административные операции (доступны только роли admin) ---

  // Список всех пользователей
  async getAllUsers() {
    const users = await this.repository.findAll();
    return users.map((user) => this.toSafeUser(user));
  }

  // Пользователь по ID
  async getUserById(id) {
    if (!authSchema.validateId(id)) {
      throw new AppError(400, 'Некорректный ID. ID должен быть положительным целым числом');
    }

    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError(404, `Пользователь с ID ${id} не найден`);
    }

    return this.toSafeUser(user);
  }

  // Изменить роль пользователя (RBAC: user <-> admin)
  async changeRole(id, role) {
    if (!authSchema.validateId(id)) {
      throw new AppError(400, 'Некорректный ID. ID должен быть положительным целым числом');
    }

    if (!authSchema.validateRole(role)) {
      throw new AppError(400, 'Некорректная роль. Роль должна быть "user" или "admin"');
    }

    const user = await this.repository.updateRole(id, role);

    if (!user) {
      throw new AppError(404, `Пользователь с ID ${id} не найден`);
    }

    return this.toSafeUser(user);
  }

  // Удалить пользователя по ID (админ)
  async deleteUserById(id) {
    if (!authSchema.validateId(id)) {
      throw new AppError(400, 'Некорректный ID. ID должен быть положительным целым числом');
    }

    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new AppError(404, `Пользователь с ID ${id} не найден`);
    }

    return this.toSafeUser(deleted);
  }

  // Убрать из ответа чувствительные поля (passwordHash)
  toSafeUser(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

module.exports = AuthService;