import { useCallback, useEffect, useState } from 'react';
import AuthPage from './components/AuthPage';
import EmployeeList from './components/EmployeeList';
import Profile from './components/Profile';
import { fetchProfile } from './api';
import { clearSession, getStoredUser, getToken } from './session';

// Корень приложения: первая страница — вход/регистрация (AuthPage).
// При наличии JWT проверяем токен (GET /profile) и открываем функционал по роли:
// admin — вкладки «Сотрудники» (полный CRUD, функционал не меняется) и «Профиль»;
// user  — только свой профиль с редактированием данных (сохранение в БД).
export default function App() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(() => Boolean(getToken()));
  const [activeTab, setActiveTab] = useState('employees');

  // Проверка токена при монтировании (GET /profile с отменой при размонтировании)
  useEffect(() => {
    if (!getToken()) return undefined;

    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await fetchProfile({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setUser(data);
        setActiveTab(data.role === 'admin' ? 'employees' : 'profile');
      } catch (err) {
        if (err?.isCanceled || controller.signal.aborted) return;
        if (err.status === 401) {
          clearSession(); // просроченный/недействительный токен → экран входа
        } else {
          // Нет связи с сервером — берём сохранённого пользователя (фолбэк)
          const stored = getStoredUser();
          if (stored) {
            setUser(stored);
            setActiveTab(stored.role === 'admin' ? 'employees' : 'profile');
          } else {
            clearSession();
          }
        }
      } finally {
        if (!controller.signal.aborted) setIsChecking(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const handleAuth = useCallback((nextUser) => {
    setUser(nextUser);
    setActiveTab(nextUser.role === 'admin' ? 'employees' : 'profile');
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setUser(null);
    setActiveTab('employees');
  }, []);

  const handleProfileUpdate = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  // ---------- Экраны ----------
  if (isChecking) {
    return (
      <main className="page">
        <p className="empty-state">⏳ Проверка авторизации…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page">
        <AuthPage onAuth={handleAuth} />
      </main>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <main className="page">
      <div className="topbar">
        <span className="topbar-brand">Оценка эффективности сотрудников</span>
        <div className="topbar-user">
          <span className={`badge ${isAdmin ? 'badge-ok' : 'badge-wait'}`}>
            {isAdmin ? 'админ' : 'пользователь'} · {user.email}
          </span>
          <button type="button" className="btn btn-ghost btn-small" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>

      {isAdmin && (
        <nav className="tabs">
          <button
            type="button"
            className={`tab${activeTab === 'employees' ? ' is-active' : ''}`}
            aria-pressed={activeTab === 'employees'}
            onClick={() => setActiveTab('employees')}
          >
            Сотрудники
          </button>
          <button
            type="button"
            className={`tab${activeTab === 'profile' ? ' is-active' : ''}`}
            aria-pressed={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
          >
            Профиль
          </button>
        </nav>
      )}

      {activeTab === 'employees' ? (
        <EmployeeList />
      ) : (
        <Profile onProfileUpdate={handleProfileUpdate} onUnauthorized={handleLogout} />
      )}
    </main>
  );
}