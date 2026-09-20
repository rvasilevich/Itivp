// Хранение данных в памяти сервера (лабораторная работа №1)
// Данные сбрасываются при перезапуске сервера.
const employees = [
  { id: 1, name: 'Иван Иванов', position: 'Разработчик', department: 'IT', rating: 8.5, reviewDate: '2026-09-01' },
  { id: 2, name: 'Мария Петрова', position: 'Аналитик', department: 'Аналитика', rating: 9, reviewDate: '2026-08-15' }
];

let nextId = 3;

// Репозиторий сотрудников — работа с данными в массиве в памяти
class EmployeeRepository {
  // Получить всех сотрудников
  async findAll() {
    return employees;
  }

  // Получить сотрудника по ID
  async findById(id) {
    return employees.find(e => e.id === Number(id)) || null;
  }

  // Создать нового сотрудника
  async create(data) {
    const employee = {
      id: nextId++,
      name: data.name.trim(),
      position: data.position.trim(),
      department: data.department.trim(),
      rating: data.rating,
      reviewDate: data.reviewDate
    };

    employees.push(employee);
    return employee;
  }

  // Полностью обновить сотрудника
  async update(id, data) {
    const index = employees.findIndex(e => e.id === Number(id));

    if (index === -1) {
      return null;
    }

    employees[index] = {
      id: Number(id),
      name: data.name.trim(),
      position: data.position.trim(),
      department: data.department.trim(),
      rating: data.rating,
      reviewDate: data.reviewDate
    };

    return employees[index];
  }

  // Удалить сотрудника
  async delete(id) {
    const index = employees.findIndex(e => e.id === Number(id));

    if (index === -1) {
      return null;
    }

    const [removed] = employees.splice(index, 1);
    return removed;
  }
}

module.exports = EmployeeRepository;