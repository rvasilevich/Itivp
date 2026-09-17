const { AppError } = require('../core');
const { employeeSchema } = require('../schemas');
const { EmployeeRepository } = require('../repositories');

// Сервис сотрудников — бизнес-логика приложения
class EmployeeService {
  constructor() {
    this.repository = new EmployeeRepository();
  }

  // Получить всех сотрудников
  async getAllEmployees() {
    return this.repository.findAll();
  }

  // Получить сотрудника по ID
  async getEmployeeById(id) {
    if (!employeeSchema.validateId(id)) {
      throw new AppError(400, 'Некорректный ID. ID должен быть положительным целым числом');
    }

    const employee = await this.repository.findById(id);

    if (!employee) {
      throw new AppError(404, `Сотрудник с ID ${id} не найден`);
    }

    return employee;
  }

  // Создать нового сотрудника
  async createEmployee(data) {
    const errors = employeeSchema.validate(data);

    if (errors.length > 0) {
      throw new AppError(400, 'Некорректные данные запроса', errors);
    }

    return this.repository.create(data);
  }

  // Полностью обновить сотрудника
  async updateEmployee(id, data) {
    if (!employeeSchema.validateId(id)) {
      throw new AppError(400, 'Некорректный ID. ID должен быть положительным целым числом');
    }

    const errors = employeeSchema.validate(data);

    if (errors.length > 0) {
      throw new AppError(400, 'Некорректные данные запроса', errors);
    }

    const updated = await this.repository.update(id, data);

    if (!updated) {
      throw new AppError(404, `Сотрудник с ID ${id} не найден`);
    }

    return updated;
  }

  // Удалить сотрудника
  async deleteEmployee(id) {
    if (!employeeSchema.validateId(id)) {
      throw new AppError(400, 'Некорректный ID. ID должен быть положительным целым числом');
    }

    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new AppError(404, `Сотрудник с ID ${id} не найден`);
    }

    return deleted;
  }
}

module.exports = EmployeeService;