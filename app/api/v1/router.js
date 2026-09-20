const express = require('express');
const employeesRouter = require('./employees');

const router = express.Router();

// Подключение маршрутов v1
router.use('/employees', employeesRouter);

module.exports = router;