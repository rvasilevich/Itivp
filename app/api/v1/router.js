const express = require('express');
const employeesRouter = require('./employees');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const adminRouter = require('./admin');

const router = express.Router();

// Подключение маршрутов v1
router.use('/employees', employeesRouter);
router.use('/auth', authRouter);
router.use('/profile', profileRouter);
router.use('/admin', adminRouter);

module.exports = router;