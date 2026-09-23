import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProfile, updateProfile } from '../api';
import { patchStoredUser } from '../session';

// Профиль текущего пользователя (доступен только после аутентификации):
// — GET /profile с состояниями «загрузка / ошибка» и кнопкой «Повторить»;
//   AbortController отменяет запрос при размонтировании;
// — редактирование своих данных (email, новый пароль) через PUT /profile
//   с сохранением в БД; 401 (просроченный токен) → onUnauthorized → разлогин.
export default function Profile({ onProfileUpdate, onUnauthorized }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [form, setForm] = useState({ email: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeTimerRef = useRef(null);

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

  // ---------- GET /profile при монтировании / по кнопке «Повторить» ----------
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      // Состояния загрузки/ошибки обновляем внутри эффекта запроса к API.
      // oxlint-disable-next-line react/set-state-in-effect
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await fetchProfile({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setProfile(data);
        setForm({ email: data.email, password: '' });
      } catch (err) {
        if (err?.isCanceled || controller.signal.aborted) return;
        if (err.status === 401) {
          onUnauthorized?.(); // токен недействителен — разлогин
          return;
        }
        setError(err.message || 'Не удалось загрузить профиль');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [retryToken, onUnauthorized]);

  // ---------- PUT /profile: сохранение своих данных в БД ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim();

    if (!email) {
      showNotice('error', 'Укажите email.');
      return;
    }
    if (form.password && form.password.length < 6) {
      showNotice('error', 'Новый пароль должен содержать не менее 6 символов.');
      return;
    }

    const payload = { email };
    if (form.password) payload.password = form.password;

    setIsSaving(true);
    try {
      const { data } = await updateProfile(payload);
      setProfile(data);
      setForm({ email: data.email, password: '' });
      patchStoredUser(data); // обновляем копию пользователя в localStorage
      onProfileUpdate?.(data);
      showNotice('success', '✅ Данные сохранены в БД.');
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized?.();
        return;
      }
      showNotice('error', `❌ Не удалось сохранить изменения: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---------- Состояния загрузки / ошибки ----------
  if (isLoading) {
    return <p className="empty-state">⏳ Загрузка профиля с сервера…</p>;
  }

  if (error) {
    return (
      <div className="error-panel" role="alert">
        <strong>⚠️ Не удалось загрузить профиль</strong>
        <span>{error}</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setRetryToken((t) => t + 1)}
        >
          ↻ Повторить
        </button>
      </div>
    );
  }

  if (!profile) return null;

  // ---------- Отрисовка профиля и формы ----------
  return (
    <div className="profile-app">
      {notice && (
        <div className={`toast toast-${notice.type}`} role="status">
          {notice.text}
        </div>
      )}

      <section className="profile-card">
        <header className="profile-header">
          <h1>👤 Мой профиль</h1>
          <span className={`badge ${profile.role === 'admin' ? 'badge-ok' : 'badge-wait'}`}>
            {profile.role === 'admin' ? 'админ' : 'пользователь'}
          </span>
        </header>

        <div className="profile-meta">
          <span className="badge">ID: {profile.id}</span>
          <span className="badge">
            Регистрация: {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
          </span>
          <span className="badge">
            Изменено: {new Date(profile.updatedAt).toLocaleString('ru-RU')}
          </span>
        </div>
      </section>

      <form className="employee-form" onSubmit={handleSubmit}>
        <h2>✏️ Изменить данные (сохранение в БД)</h2>
        <div className="form-grid">
          <input
            type="email"
            name="email"
            placeholder="Email *"
            value={form.email}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Новый пароль (необязательно, ≥ 6 символов)"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? '⏳ Сохранение…' : '💾 Сохранить'}
          </button>
          {form.password && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setForm((prev) => ({ ...prev, password: '' }))}
            >
              ✖ Не менять пароль
            </button>
          )}
        </div>
        <p className="profile-hint">
          Пароль остаётся прежним, если поле пустое. Роль отредактировать нельзя
          (назначается администратором, ЛР №3 RBAC).
        </p>
      </form>
    </div>
  );
}