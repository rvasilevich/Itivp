import axios from 'axios';

// Базовый URL REST API. Значение берётся из my-app/.env (переменная VITE_API_URL).
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
// Публичный адрес API (используется в UI для подписи «Данные загружены с …»)
export const API_URL = baseURL;

// Единый axios-инстанс для всех запросов к серверу
const api = axios.create({
  baseURL,
  timeout: 15000, // 15 секунд на ответ сервера
});

// Перехватчик запросов: автоматически подставляет JWT-токен (ЛР №3) из localStorage.
// Маршруты /employees сейчас публичные, но если на сервере добавить middleware auth,
// токен начнёт передаваться в заголовке Authorization автоматически.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Превращает ошибку axios в Error с понятным сообщением для пользователя.
// Флаг err.isCanceled=true ставится при отмене запроса через AbortController
// (такие ошибки в UI игнорируются — запрос устарел).
function toError(error) {
  const canceled = axios.isCancel(error) || error.code === 'ERR_CANCELED';
  if (canceled) {
    const err = new Error('Запрос отменён');
    err.isCanceled = true;
    return err;
  }

  let message = 'Неизвестная ошибка';
  if (error.response) {
    // Сервер ответил, но с кодом ошибки — используем текст из тела { error }
    const data = error.response.data;
    const details = Array.isArray(data?.details) && data.details.length
      ? ` (${data.details.join('; ')})`
      : '';
    message = `${data?.error || `Ошибка сервера (HTTP ${error.response.status})`}${details}`;
  } else if (error.request) {
    // Запрос отправлен, но ответа нет — сервер недоступен
    message = 'Сервер не отвечает. Проверьте, что сервер запущен.';
  } else if (error.message) {
    message = error.message;
  }

  const normalized = new Error(message);
  normalized.isCanceled = false;
  return normalized;
}

// Обёртка: любые ошибки из axios превращаем в нормализованные Error
async function request(promise) {
  try {
    return await promise;
  } catch (error) {
    throw toError(error);
  }
}

// ---------- API-функции (REST CRUD) ----------

// GET /employees — список сотрудников.
// search: серверный поиск (ILIKE по ФИО/должности/отделу/email);
// signal: AbortSignal для отмены запроса (при размонтировании/смене поиска).
export const fetchEmployees = ({ search = '', signal } = {}) =>
  request(api.get('/employees', { params: { search: search || undefined }, signal }));

// POST /employees — создать сотрудника (сервер вернёт объект с реальным id)
export const createEmployee = (employee) =>
  request(api.post('/employees', employee));

// PUT /employees/:id — полностью обновить сотрудника
export const updateEmployee = (id, employee) =>
  request(api.put(`/employees/${id}`, employee));

// DELETE /employees/:id — удалить сотрудника
export const deleteEmployee = (id) =>
  request(api.delete(`/employees/${id}`));

export default api;