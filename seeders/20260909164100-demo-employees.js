'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Employees', [
      {
        name: 'Иван Иванов',
        position: 'Разработчик',
        department: 'IT',
        rating: 8.5,
        reviewDate: '2026-09-01',
        email: 'ivan.ivanov@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Мария Петрова',
        position: 'Менеджер',
        department: 'Продажи',
        rating: 7.2,
        reviewDate: '2026-08-15',
        email: 'maria.petrova@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Алексей Сидоров',
        position: 'Аналитик',
        department: 'Аналитика',
        rating: 9.0,
        reviewDate: '2026-09-10',
        email: 'alexey.sidorov@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Employees', null, {});
  }
};