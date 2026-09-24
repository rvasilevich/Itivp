// Каналы (комнаты Socket.IO) в предметной области «Оценка эффективности сотрудников».
// Общий канал — для объявлений, остальные — по отделам компании (Отдел кадров ведёт
// оценки/аттестации, Отдел разработки — задачи и код-ревью и т.д.).
// Клиент получает этот список событием 'rooms:list' (без дублирования в браузере).
const ROOMS = [
  { id: 'general', title: 'Общий канал', description: 'Объявления и обсуждения для всех' },
  { id: 'hr', title: 'Отдел кадров', description: 'Оценки, аттестации, отзывы сотрудников' },
  { id: 'dev', title: 'Отдел разработки', description: 'Задачи, код-ревью, релизы' },
  { id: 'sales', title: 'Отдел продаж', description: 'Планы и результаты продаж' }
];

// Канал по умолчанию — в него подключается клиент сразу после соединения
const DEFAULT_ROOM = 'general';

// Найти канал по id (или null — защита от произвольных значений от клиента)
const findRoom = (id) => ROOMS.find((room) => room.id === id) || null;

// Список каналов для клиента: онлайн-участников считает PresenceStore
function publicRooms(onlineByRoom = {}) {
  return ROOMS.map((room) => ({
    ...room,
    online: onlineByRoom[room.id] || 0
  }));
}

module.exports = { ROOMS, DEFAULT_ROOM, findRoom, publicRooms };
