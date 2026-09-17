// Схема валидации данных сотрудника
const employeeSchema = {
  // Валидация данных при создании/обновлении сотрудника
  validate(data) {
    const errors = [];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return ['Тело запроса должно быть JSON-объектом'];
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Поле "name" обязательно и должно быть непустой строкой');
    }

    if (!data.position || typeof data.position !== 'string' || data.position.trim() === '') {
      errors.push('Поле "position" обязательно и должно быть непустой строкой');
    }

    if (!data.department || typeof data.department !== 'string' || data.department.trim() === '') {
      errors.push('Поле "department" обязательно и должно быть непустой строкой');
    }

    if (data.rating === undefined || typeof data.rating !== 'number' || isNaN(data.rating) || data.rating < 1 || data.rating > 10) {
      errors.push('Поле "rating" обязательно и должно быть числом от 1 до 10');
    }

    if (!data.reviewDate || typeof data.reviewDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.reviewDate)) {
      errors.push('Поле "reviewDate" обязательно и должно быть строкой в формате YYYY-MM-DD');
    }

    if (data.email !== undefined && (typeof data.email !== 'string' || data.email.trim() === '' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) {
      errors.push('Поле "email" должно быть строкой в формате email');
    }

    return errors;
  },

  // Валидация ID из параметров маршрута
  validateId(id) {
    const parsed = Number(id);
    return Number.isInteger(parsed) && parsed > 0;
  }
};

module.exports = employeeSchema;