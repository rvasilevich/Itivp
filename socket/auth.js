const jwt = require('jsonwebtoken');

// Секрет для проверки JWT. Должен совпадать с services/authService.js и middleware/auth.js.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Аутентификация Socket.IO-соединения (ЛР №3 → ЛР №7).
// Токен передаёт клиент при рукопожатии: io(url, { auth: { token } }) —
// он приходит в socket.handshake.auth.token (заголовки в WebSocket недоступны).
//
// Возвращает:
//   { user }  — токен валиден, пользователь авторизован (id/email/role из JWT);
//   { guest } — токена нет: разрешаем гостя (удобно для демонстрации чата);
//   { error } — токен есть, но недействителен/просрочен → соединение отклоняем.
function authenticate(socket) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return { guest: true };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    return {
      user: {
        id: decoded.id === undefined ? null : String(decoded.id),
        email: decoded.email,
        role: decoded.role
      }
    };
  } catch (error) {
    return { error: 'Недействительный или просроченный токен' };
  }
}

module.exports = authenticate;
