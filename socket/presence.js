// Хранилище подключённых пользователей (presence) — «кто сейчас онлайн».
// В памяти процесса: при отключении сокета запись удаляется, а клиентам
// рассылается обновлённый список (событие 'presence:list').
class PresenceStore {
  constructor() {
    // socketId → { socketId, name, id, role, room, connectedAt }
    this.users = new Map();
  }

  add(socketId, data) {
    this.users.set(socketId, { socketId, ...data });
    return this.users.get(socketId);
  }

  // Убрать сокет из присутствия. Возвращает удалённую запись (или undefined).
  remove(socketId) {
    const user = this.users.get(socketId);
    this.users.delete(socketId);
    return user;
  }

  get(socketId) {
    return this.users.get(socketId);
  }

  // Сменить текущий канал пользователя (при переходе между комнатами)
  setRoom(socketId, room) {
    const user = this.users.get(socketId);

    if (user) {
      user.room = room;
    }

    return user;
  }

  // Список онлайн-пользователей для клиента
  list() {
    return [...this.users.values()];
  }

  // Сколько человек в каждой комнате (для бейджей у каналов)
  onlineByRoom() {
    const counts = {};

    this.users.forEach((user) => {
      if (user.room) {
        counts[user.room] = (counts[user.room] || 0) + 1;
      }
    });

    return counts;
  }

  get size() {
    return this.users.size;
  }
}

module.exports = PresenceStore;
