// Mongoose-схема и модель «Сотрудник» (MongoDB, лаб. № по документным БД).
// Файл лежит в mongo/models/, а НЕ в models/ — папка models/ занята Sequelize:
// models/index.js подгружает оттуда все .js как фабрики реляционных моделей.
//
// Отличие от реляционной модели (PostgreSQL "Employees" + "Reviews"):
// история оценок и навыки хранятся ВНУТРИ документа сотрудника (reviews[],
// skills[]) — без отдельных таблиц, внешних ключей и JOIN-ов.
const mongoose = require('mongoose');

// Вложенный документ: один результат оценки эффективности
const reviewSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  reviewer: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 10 },
  comment: { type: String, trim: true, default: '' },
  goals: [{ type: String, trim: true }], // массив строк: цели на период
});

// Вложенный документ: навык и его уровень (1..10)
const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  level: { type: Number, required: true, min: 1, max: 10, default: 1 },
});

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    rating: { type: Number, min: 1, max: 10 },
    skills: [skillSchema],   // массив вложенных документов
    reviews: [reviewSchema], // вложенные документы: история оценок
  },
  { timestamps: true } // createdAt / updatedAt
);

// Третий аргумент — имя коллекции (не	confликтует с таблицей "Employees" в PostgreSQL)
module.exports = mongoose.model('Employee', employeeSchema, 'employees_mongo');