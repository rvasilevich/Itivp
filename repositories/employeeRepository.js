const { Op } = require('sequelize');
const { Employee } = require('../models');

// Репозиторий сотрудников — работа с данными через Sequelize (PostgreSQL)
class EmployeeRepository {
  // Получить всех сотрудников (с необязательным серверным поиском ?search=)
  async findAll({ search } = {}) {
    const where = {};

    // Серверный поиск: нечувствительное к регистру частичное совпадение
    // по ФИО, должности, отделу и email (ILIKE '%<search>%').
    if (search && search.trim() !== '') {
      const pattern = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: pattern } },
        { position: { [Op.iLike]: pattern } },
        { department: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } }
      ];
    }

    return Employee.findAll({ where });
  }

  // Получить сотрудника по ID
  async findById(id) {
    return Employee.findByPk(id);
  }

  // Создать нового сотрудника
  async create(data) {
    return Employee.create({
      name: data.name.trim(),
      position: data.position.trim(),
      department: data.department.trim(),
      rating: data.rating,
      reviewDate: data.reviewDate,
      email: data.email ? data.email.trim() : null
    });
  }

  // Полностью обновить сотрудника
  async update(id, data) {
    const employee = await Employee.findByPk(id);

    if (!employee) {
      return null;
    }

    employee.name = data.name.trim();
    employee.position = data.position.trim();
    employee.department = data.department.trim();
    employee.rating = data.rating;
    employee.reviewDate = data.reviewDate;
    employee.email = data.email ? data.email.trim() : null;

    await employee.save();
    return employee;
  }

  // Удалить сотрудника
  async delete(id) {
    const employee = await Employee.findByPk(id);

    if (!employee) {
      return null;
    }

    await employee.destroy();
    return employee;
  }
}

module.exports = EmployeeRepository;