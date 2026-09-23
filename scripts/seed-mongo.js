// Демо-наполнение MongoDB: документ сотрудника со ВЛОЖЕННЫМИ структурами
// (reviews[] — история оценок, skills[] — навыки с уровнями).
// Запуск: npm run seed:mongo  (сервер запущен не обязателен)
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../mongo/models/employee');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employee_eval';

const DEMO = {
  name: 'Иван Иванов',
  position: 'Разработчик',
  department: 'IT',
  email: 'ivan.mongo@example.com',
  rating: 8.5,
  skills: [
    { name: 'JavaScript', level: 9 },
    { name: 'SQL', level: 7 },
    { name: 'Docker', level: 6 },
  ],
  reviews: [
    {
      date: new Date('2026-06-15'),
      reviewer: 'Мария Петрова (менеджер)',
      rating: 8,
      comment: 'Стабильная работа, хорошо документирует код.',
      goals: ['Внедрить CI', 'Менторить джуниора'],
    },
    {
      date: new Date('2026-09-01'),
      reviewer: 'Алексей Сидоров (лид команды)',
      rating: 9,
      comment: 'Успешно закрыл миграцию сервиса без даунтайма.',
      goals: ['Снизить время сборки'],
    },
  ],
};

(async () => {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected:', MONGO_URI.replace(/\/\/.*@/, '//***@'));

  // upsert: повторный запуск не создаёт дубликат
  await Employee.findOneAndUpdate(
    { email: DEMO.email },
    { $setOnInsert: DEMO },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const total = await Employee.countDocuments();
  const demo = await Employee.findOne({ email: DEMO.email }).lean();
  console.log(`Seed OK: документов в коллекции ${total}`);
  console.log('Вложенный документ (для MongoDB Compass):');
  console.log(JSON.stringify(demo, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});