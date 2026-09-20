// Схема валидации данных аутентификации и пользователей
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['user', 'admin'];

const authSchema = {
  // Общая проверка, что тело запроса — JSON-объект
  validateBody(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return ['Тело запроса должно быть JSON-объектом'];
    }
    return [];
  },

  // Валидация данных при регистрации
  validateRegister(data) {
    const errors = this.validateBody(data);
    if (errors.length > 0) {
      return errors;
    }

    const email = typeof data.email === 'string' ? data.email.trim() : '';

    if (email === '') {
      errors.push('Поле "email" обязательно и должно быть непустой строкой');
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push('Поле "email" должно быть строкой в формате email');
    }

    if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
      errors.push('Поле "password" обязательно и должно содержать не менее 6 символов');
    }

    return errors;
  },

  // Валидация данных при входе
  validateLogin(data) {
    const errors = this.validateBody(data);
    if (errors.length > 0) {
      return errors;
    }

    const email = typeof data.email === 'string' ? data.email.trim() : '';

    if (email === '') {
      errors.push('Поле "email" обязательно и должно быть непустой строкой');
    }

    if (!data.password || typeof data.password !== 'string' || data.password.length === 0) {
      errors.push('Поле "password" обязательно и должно быть непустой строкой');
    }

    return errors;
  },

  // Валидация роли (RBAC)
  validateRole(role) {
    return typeof role === 'string' && ROLES.includes(role);
  },

  // Валидация ID из параметров маршрута
  validateId(id) {
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0;
  }
};

module.exports = authSchema;