const express = require('express');
const { EmployeeService } = require('../../../services');

const router = express.Router();
const employeeService = new EmployeeService();

// GET /api/v1/employees — получение списка всех сотрудников
router.get('/', async (req, res) => {
  const employees = await employeeService.getAllEmployees();
  res.json(employees);
});

// GET /api/v1/employees/:id — получение сотрудника по ID
router.get('/:id', async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.params.id);
  res.json(employee);
});

// POST /api/v1/employees — добавление нового сотрудника
router.post('/', async (req, res) => {
  const newEmployee = await employeeService.createEmployee(req.body);
  res.status(201).json(newEmployee);
});

// PUT /api/v1/employees/:id — полное обновление сотрудника
router.put('/:id', async (req, res) => {
  const updatedEmployee = await employeeService.updateEmployee(req.params.id, req.body);
  res.json(updatedEmployee);
});

// DELETE /api/v1/employees/:id — удаление сотрудника
router.delete('/:id', async (req, res) => {
  const deletedEmployee = await employeeService.deleteEmployee(req.params.id);
  res.json({ message: `Сотрудник с ID ${req.params.id} удалён`, deletedEmployee });
});

module.exports = router;