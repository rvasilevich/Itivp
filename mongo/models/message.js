// Mongoose-схема и модель «Сообщение чата» (Socket.IO, ЛР № по реальному времени).
// Файл лежит в mongo/models/, а НЕ в models/ — папка models/ занята Sequelize
// (models/index.js подгружает оттуда все .js как фабрики реляционных моделей).
//
// Коллекция messages_mongo хранит историю сообщений чата: у каждого сообщения
// есть канал (room), автор и ВЛОЖЕННЫЙ массив реакций (reactions[]) — «голосование»
// в реальном времени, где голоса лежат прямо в документе сообщения
// (в реляционной модели это была бы таблица MessageReactions + JOIN).
const mongoose = require('mongoose');

// Вложенный документ: реакция одного вида (эмодзи) и список проголосовавших
const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, trim: true },
    users: [{ type: String, trim: true }] // имена (email) проголосовавших
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, trim: true, index: true }, // канал (комната Socket.IO)
    authorId: { type: String, default: null }, // id пользователя (null — гость)
    authorName: { type: String, required: true, trim: true }, // имя для отображения (email или «Гость-…»)
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    // kind — тип записи ('user' | 'system'); поле названо kind, а не type,
    // чтобы не путать с ключом SchemaType в Mongoose.
    kind: { type: String, enum: ['user', 'system'], default: 'user' },
    reactions: [reactionSchema] // вложенный массив: реакции на сообщение
  },
  { timestamps: true } // createdAt / updatedAt
);

// Третий аргумент — имя коллекции (не конфликтует с таблицами PostgreSQL)
module.exports = mongoose.model('Message', messageSchema, 'messages_mongo');
