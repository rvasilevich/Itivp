// Моковые данные, повторяющие структуру REST API (модель Employee):
// id, name, position, department, rating (1..10), reviewDate (YYYY-MM-DD), email.
// В ЛР №5 используются как эталонная структура объекта Employee в тестах
// (мок ответа сервера в EmployeeList.test.jsx).
export const DEMO_EMPLOYEES = [
  {
    id: 1,
    name: 'Иван Иванов',
    position: 'Разработчик',
    department: 'IT',
    rating: 8.5,
    reviewDate: '2026-09-01',
    email: 'ivan.ivanov@example.com',
  },
  {
    id: 2,
    name: 'Мария Петрова',
    position: 'Менеджер',
    department: 'Продажи',
    rating: 7.2,
    reviewDate: '2026-08-15',
    email: 'maria.petrova@example.com',
  },
  {
    id: 3,
    name: 'Алексей Сидоров',
    position: 'Аналитик',
    department: 'Аналитика',
    rating: 9.0,
    reviewDate: '2026-09-10',
    email: 'alexey.sidorov@example.com',
  },
  {
    id: 4,
    name: 'Ольга Кузнецова',
    position: 'Дизайнер',
    department: 'IT',
    rating: 9.3,
    reviewDate: '2026-07-30',
    email: 'olga.kuznetsova@example.com',
  },
  {
    id: 5,
    name: 'Дмитрий Смирнов',
    position: 'Тестировщик',
    department: 'IT',
    rating: 6.8,
    reviewDate: '2026-09-20',
    email: 'dmitry.smirnov@example.com',
  },
];
