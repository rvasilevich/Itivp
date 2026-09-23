const express = require('express');
const { AppError } = require('../../core');
const Employee = require('../models/employee');

const router = express.Router();

// Mongoose-исключения → AppError (валидные HTTP-статусы вместо 500)
function toAppError(err) {
  if (err.isOperational) return err;
  if (err.name === 'CastError') {
    return new AppError(400, `Некорректный ID: "${err.value}"`);
  }
  if (err.name === 'ValidationError') {
    return new AppError(400, 'Некорректные данные запроса', Object.values(err.errors).map((e) => e.message));
  }
  if (err.code === 11000) {
    return new AppError(409, 'Запись с такими уникальными полями уже существует');
  }
  return err;
}

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(toAppError(err));
  }
};

const notFound = (id) => new AppError(404, `Сотрудник с ID ${id} не найден`);

// ---------- CRUD через методы Mongoose (Часть 5) ----------

// GET /api/v1/mongo/employees — Model.find(); ?search= — $regex без учёта регистра
router.get('/', wrap(async (req, res) => {
  const search = (req.query.search || '').trim();
  const filter = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { position: { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } },
          { 'skills.name': { $regex: search, $options: 'i' } },
        ],
      }
    : {};
  res.json(await Employee.find(filter).sort({ name: 1 }));
}));

// GET /api/v1/mongo/employees/:id — Model.findById(id)
router.get('/:id', wrap(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw notFound(req.params.id);
  res.json(employee);
}));

// POST /api/v1/mongo/employees — Model.create(body); в теле можно сразу
// передать вложенные skills[] и reviews[] — документ сохраняется целиком
router.post('/', wrap(async (req, res) => {
  const employee = await Employee.create(req.body);
  res.status(201).json(employee);
}));

// PUT /api/v1/mongo/employees/:id — Model.findByIdAndUpdate(id, body, { new: true })
router.put('/:id', wrap(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!employee) throw notFound(req.params.id);
  res.json(employee);
}));

// DELETE /api/v1/mongo/employees/:id — Model.findByIdAndDelete(id)
router.delete('/:id', wrap(async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) throw notFound(req.params.id);
  res.json({ message: `Сотрудник с ID ${req.params.id} удалён`, deletedEmployee: employee });
}));

// ---------- Вложенные структуры (Часть 6) ----------

// POST /:id/reviews — добавить вложенный документ отзыва ($push)
router.post('/:id/reviews', wrap(async (req, res) => {
  const { reviewer, rating, comment, goals, date } = req.body;

  if (!reviewer || typeof reviewer !== 'string' || !reviewer.trim()) {
    throw new AppError(400, 'Некорректные данные запроса', ['Поле "reviewer" обязательно']);
  }
  const numericRating = Number(rating);
  if (!(numericRating >= 1 && numericRating <= 10)) {
    throw new AppError(400, 'Некорректные данные запроса', ['Поле "rating" должно быть от 1 до 10']);
  }

  const employee = await Employee.findOneAndUpdate(
    { _id: req.params.id },
    {
      $push: {
        reviews: {
          date: date || new Date(),
          reviewer: reviewer.trim(),
          rating: numericRating,
          comment: typeof comment === 'string' ? comment : '',
          goals: Array.isArray(goals) ? goals.filter((g) => typeof g === 'string') : [],
        },
      },
    },
    { new: true }
  );
  if (!employee) throw notFound(req.params.id);
  res.status(201).json(employee);
}));

// PUT /:id/reviews/:reviewId — изменить элемент внутри массива (позиционный оператор "$")
router.put('/:id/reviews/:reviewId', wrap(async (req, res) => {
  const set = {};
  if (req.body.reviewer !== undefined) set['reviews.$.reviewer'] = String(req.body.reviewer);
  if (req.body.comment !== undefined) set['reviews.$.comment'] = String(req.body.comment);
  if (req.body.goals !== undefined) {
    set['reviews.$.goals'] = Array.isArray(req.body.goals)
      ? req.body.goals.filter((g) => typeof g === 'string')
      : [];
  }
  if (req.body.rating !== undefined) {
    const numericRating = Number(req.body.rating);
    if (!(numericRating >= 1 && numericRating <= 10)) {
      throw new AppError(400, 'Некорректные данные запроса', ['Поле "rating" должно быть от 1 до 10']);
    }
    set['reviews.$.rating'] = numericRating;
  }
  if (Object.keys(set).length === 0) {
    throw new AppError(400, 'Некорректные данные запроса', ['Укажите поля для обновления']);
  }

  const employee = await Employee.findOneAndUpdate(
    { _id: req.params.id, 'reviews._id': req.params.reviewId },
    { $set: set },
    { new: true, runValidators: true }
  );
  if (!employee) {
    const exists = await Employee.findById(req.params.id).lean();
    if (!exists) throw notFound(req.params.id);
    throw new AppError(404, `Отзыв с ID ${req.params.reviewId} не найден`);
  }
  res.json(employee);
}));

// DELETE /:id/reviews/:reviewId — убрать вложенный документ ($pull)
router.delete('/:id/reviews/:reviewId', wrap(async (req, res) => {
  const employee = await Employee.findOneAndUpdate(
    { _id: req.params.id },
    { $pull: { reviews: { _id: req.params.reviewId } } },
    { new: true }
  );
  if (!employee) throw notFound(req.params.id);
  res.json({ message: 'Отзыв удалён', employee });
}));

// POST /:id/skills — добавить навык ($addToSet; повтор → 409)
router.post('/:id/skills', wrap(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    throw new AppError(400, 'Некорректные данные запроса', ['Поле "name" обязательно']);
  }
  const level = req.body.level === undefined ? 1 : Number(req.body.level);
  if (!(Number.isInteger(level) && level >= 1 && level <= 10)) {
    throw new AppError(400, 'Некорректные данные запроса', ['Поле "level" — целое от 1 до 10']);
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) throw notFound(req.params.id);
  if (employee.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new AppError(409, `Навык "${name}" уже добавлен`);
  }

  const updated = await Employee.findOneAndUpdate(
    { _id: req.params.id },
    { $addToSet: { skills: { name, level } } },
    { new: true }
  );
  res.status(201).json(updated);
}));

// PATCH /:id/skills/:name — увеличить уровень навыка: $inc + позиционный "$"
// (аналог «увеличить количество товара в корзине» — обновление элемента массива)
router.patch('/:id/skills/:name', wrap(async (req, res) => {
  const amount = req.body.amount === undefined ? 1 : Number(req.body.amount);
  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(400, 'Некорректные данные запроса', ['Поле "amount" — ненулевое целое число']);
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) throw notFound(req.params.id);
  const skill = employee.skills.find((s) => s.name === req.params.name);
  if (!skill) throw new AppError(404, `Навык "${req.params.name}" не найден`);
  if (skill.level + amount < 1 || skill.level + amount > 10) {
    throw new AppError(400, 'Некорректные данные запроса', ['Уровень навыка должен остаться в диапазоне 1..10']);
  }

  const updated = await Employee.findOneAndUpdate(
    { _id: req.params.id, 'skills.name': req.params.name },
    { $inc: { 'skills.$.level': amount } },
    { new: true }
  );
  res.json(updated);
}));

module.exports = router;