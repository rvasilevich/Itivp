// Хранение сессии (JWT + данные пользователя) в localStorage.
// Ключ 'token' читает интерсептор axios в src/api.js.
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Сохранить сессию после входа / успешной регистрации ({ token, user })
export const saveSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Обновить сохранённого пользователя (после PUT /profile)
export const patchStoredUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Выйти: удалить токен и данные пользователя
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};