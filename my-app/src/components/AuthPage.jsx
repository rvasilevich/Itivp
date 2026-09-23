import { useState } from 'react';
import { loginUser, registerUser } from '../api';
import { saveSession } from '../session';

// Первая страница приложения: вход и регистрация (ЛР №6, аутентификация).
// При успехе сохраняем JWT + пользователя в localStorage (см. src/session.js)
// и передаём пользователя наверх — App открывает функционал по роли:
// admin → управление сотрудниками, user → свой профиль.
export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
    setPasswordConfirm('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Пароль должен содержать не менее 6 символов');
        return;
      }
      if (password !== passwordConfirm) {
        setError('Пароли не совпадают');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let session;
      if (mode === 'login') {
        ({ data: session } = await loginUser({ email, password }));
      } else {
        // Регистрация не выдаёт токен — сразу автоматически выполняем вход
        await registerUser({ email, password });
        ({ data: session } = await loginUser({ email, password }));
      }
      saveSession(session);
      onAuth(session.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-card">
      <h1>Оценка эффективности сотрудников</h1>
      <p className="auth-subtitle">Войдите или зарегистрируйтесь, чтобы продолжить</p>

      <div className="auth-tabs">
        <button
          type="button"
          className={`tab${mode === 'login' ? ' is-active' : ''}`}
          aria-pressed={mode === 'login'}
          onClick={() => switchMode('login')}
        >
          Вход
        </button>
        <button
          type="button"
          className={`tab${mode === 'register' ? ' is-active' : ''}`}
          aria-pressed={mode === 'register'}
          onClick={() => switchMode('register')}
        >
          Регистрация
        </button>
      </div>

      {error && (
        <div className="auth-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      <form className="auth-fields" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {mode === 'register' && (
          <input
            type="password"
            placeholder="Повторите пароль"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        )}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting
            ? '⏳ Подождите…'
            : mode === 'login'
              ? '🔓 Войти'
              : '➕ Зарегистрироваться'}
        </button>
      </form>

      <p className="auth-hint">
        Демо-администратор: <code>admin@example.com</code> / <code>Admin123!</code> —
        откроется управление сотрудниками. Обычный пользователь увидит свой профиль.
      </p>
    </section>
  );
}