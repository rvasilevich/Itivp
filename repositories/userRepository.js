const { User } = require('../models');

// Репозиторий пользователей — работа с данными через Sequelize (PostgreSQL)
class UserRepository {
  // Найти пользователя по email
  async findByEmail(email) {
    return User.findOne({ where: { email } });
  }

  // Найти пользователя по ID
  async findById(id) {
    return User.findByPk(id);
  }

  // Получить всех пользователей (без passwordHash)
  async findAll() {
    return User.findAll({
      attributes: ['id', 'email', 'role', 'createdAt', 'updatedAt']
    });
  }

  // Создать пользователя
  async create(data) {
    return User.create({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role || 'user'
    });
  }

  // Обновить роль пользователя (RBAC)
  async updateRole(id, role) {
    const user = await User.findByPk(id);

    if (!user) {
      return null;
    }

    user.role = role;
    await user.save();
    return user;
  }

  // Обновить данные профиля (email и/или пароль) с сохранением в БД
  async updateProfile(id, data) {
    const user = await User.findByPk(id);

    if (!user) {
      return null;
    }

    if (data.email !== undefined) {
      user.email = data.email;
    }

    if (data.passwordHash !== undefined) {
      user.passwordHash = data.passwordHash;
    }

    await user.save();
    return user;
  }

  // Удалить пользователя
  async delete(id) {
    const user = await User.findByPk(id);

    if (!user) {
      return null;
    }

    await user.destroy();
    return user;
  }
}

module.exports = UserRepository;