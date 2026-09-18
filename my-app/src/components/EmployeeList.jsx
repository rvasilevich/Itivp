import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, createEmployee, deleteEmployee, fetchEmployees, updateEmployee } from '../api';

const EMPTY_FORM = {
  name: '',
  position: '',
  department: '',
  rating: '',
  reviewDate: '',
  email: '',
};

// Пауза (мс) перед отправкой поискового запроса на сервер (debounce)
const SEARCH_DEBOUNCE_MS = 500;

export default function EmployeeList() {
  // ---------- useState: данные с сервера, форма, фильтр/сортировка ----------
  const [employees, setEmployees] = useState([]);      // массив сотрудников (с сервера)
  const [form, setForm] = useState(EMPTY_FORM);        // значения полей ввода
  const [editingId, setEditingId] = useState(null);    // id редактируемого сотрудника
  const [query, setQuery] = useState('');              // строка поиска (ввод)
  const [debouncedQuery, setDebouncedQuery] = useState(''); // поиск, отправляемый на сервер
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');        // name | rating | department | reviewDate
  const [sortDir, setSortDir] = useState('asc');       // asc | desc
  const [isLoading, setIsLoading] = useState(true);    // первичная загрузка с сервера
  const [isSearching, setIsSearching] = useState(false); // идёт серверный поиск
  const [error, setError] = useState(null);            // ошибка загрузки с сервера
  const [notice, setNotice] = useState(null);          // уведомление об операции CRUD
  const [retryToken, setRetryToken] = useState(0);     // счётчик нажатий «Повторить»

  const hasDataRef = useRef(false);    // были ли уже успешно получены данные с сервера
  const noticeTimerRef = useRef(null); // таймер автоскрытия уведомления

  // ---------- Уведомления (toast) ----------
  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

  // ---------- Загрузка данных с сервера (GET /employees) ----------
  // Используется для первичной загрузки и для серверного поиска.
  // signal — AbortSignal, позволяющий отменить устаревший запрос.
  const loadEmployees = useCallback(async (search, signal) => {
    const isInitial = !hasDataRef.current;
    if (isInitial) setIsLoading(true);      // полный индикатор при первой загрузке
    else if (search) setIsSearching(true);  // лёгкий индикатор при серверном поиске
    setError(null);

    try {
      const { data } = await fetchEmployees({ search, signal });
      if (signal?.aborted) return;          // запрос отменён — результаты устарели
      setEmployees(data);
      hasDataRef.current = true;
    } catch (err) {
      if (err?.isCanceled || signal?.aborted) return; // отмена запроса — не ошибка
      setError(err.message || 'Не удалось загрузить данные с сервера');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsSearching(false);
      }
    }
  }, []);

  // Запрос при монтировании, при изменении поиска и по кнопке «Повторить».
  // AbortController отменяет предыдущий запрос (смена строки поиска)
  // и запрос при размонтировании компонента.
  useEffect(() => {
    const controller = new AbortController();
    // Обновление состояний загрузки/ошибки внутри эффекта запроса данных —
    // стандартный паттерн работы с внешней системой (REST API).
    // oxlint-disable-next-line react/set-state-in-effect
    loadEmployees(debouncedQuery, controller.signal);
    return () => controller.abort();
  }, [debouncedQuery, retryToken, loadEmployees]);

  // Debounce поиска: запрос на сервер отправляется только после паузы в наборе текста
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // ---------- useEffect [employees.length]: заголовок страницы ----------
  useEffect(() => {
    document.title = employees.length
      ? `Сотрудники (${employees.length}) — оценка эффективности`
      : 'Сотрудники — оценка эффективности';
  }, [employees.length]);
  // ---------- Служебные функции ----------
  const isValidForm = () =>
    form.name.trim() !== '' &&
    form.rating !== '' &&
    Number(form.rating) >= 1 &&
    Number(form.rating) <= 10;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---------- Добавление (POST) и редактирование (PUT): оптимистичное обновление ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidForm()) {
      showNotice('error', 'Укажите ФИО и оценку эффективности от 1 до 10.');
      return;
    }

    const employee = {
      name: form.name.trim(),
      position: form.position.trim(),
      department: form.department.trim(),
      rating: Number(form.rating),
      reviewDate: form.reviewDate,
      email: form.email.trim(),
    };

    if (editingId != null) {
      // ---- РЕДАКТИРОВАНИЕ: сразу обновляем элемент в списке, при ошибке откатываем ----
      const previous = employees.find((e) => e.id === editingId);
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...employee } : e)));
      setEditingId(null);
      setForm(EMPTY_FORM);

      try {
        const { data } = await updateEmployee(editingId, employee);
        // заменяем оптимистичную версию на ответ сервера (актуальные createdAt/updatedAt и т.п.)
        setEmployees((prev) => prev.map((e) => (e.id === editingId ? data : e)));
        showNotice('success', '✅ Изменения сохранены на сервере.');
      } catch (err) {
        // откат к прежним данным
        if (previous) setEmployees((prev) => prev.map((e) => (e.id === editingId ? previous : e)));
        showNotice('error', `❌ Не удалось сохранить изменения: ${err.message}`);
      }
    } else {
      // ---- ДОБАВЛЕНИЕ: временный ID, после ответа сервера заменяется реальным ----
      const tempId = `temp-${Date.now()}`; // уникальный временный ID
      setEmployees((prev) => [...prev, { id: tempId, ...employee }]);
      setForm(EMPTY_FORM);

      try {
        const { data } = await createEmployee(employee);
        // заменяем временный ID на реальный из ответа сервера
        setEmployees((prev) => prev.map((e) => (e.id === tempId ? data : e)));
        showNotice('success', '✅ Сотрудник добавлен на сервер.');
      } catch (err) {
        setEmployees((prev) => prev.filter((e) => e.id !== tempId)); // откат
        showNotice('error', `❌ Не удалось добавить сотрудника: ${err.message}`);
      }
    }
  };

  const startEdit = (employee) => {
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      position: employee.position,
      department: employee.department,
      rating: String(employee.rating),
      reviewDate: employee.reviewDate,
      email: employee.email ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // ---------- Удаление (DELETE): оптимистичное удаление с откатом при ошибке ----------
  const handleDelete = async (id) => {
    if (!window.confirm('Удалить сотрудника?')) return;

    const index = employees.findIndex((e) => e.id === id);
    const removed = employees[index];
    if (editingId === id) cancelEdit();
    setEmployees((prev) => prev.filter((e) => e.id !== id)); // сразу убираем из списка

    try {
      await deleteEmployee(id);
      showNotice('success', '✅ Сотрудник удалён на сервере.');
    } catch (err) {
      // при ошибке возвращаем сотрудника на прежнее место в списке
      setEmployees((prev) => {
        if (index === -1) return prev;
        const next = [...prev];
        next.splice(index, 0, removed);
        return next;
      });
      showNotice('error', `❌ Не удалось удалить сотрудника: ${err.message}`);
    }
  };

  // ---------- Фильтрация и сортировка (useMemo) ----------
  const filteredAndSorted = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    const filtered = employees.filter((e) => {
      const matchesQuery =
        !lowerQuery ||
        e.name.toLowerCase().includes(lowerQuery) ||
        e.position.toLowerCase().includes(lowerQuery) ||
        e.department.toLowerCase().includes(lowerQuery);
      const matchesDepartment =
        departmentFilter === 'all' || e.department === departmentFilter;
      return matchesQuery && matchesDepartment;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let res;
      if (sortBy === 'rating' || sortBy === 'reviewDate') {
        res = a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : 0;
      } else {
        res = a[sortBy].localeCompare(b[sortBy], 'ru');
      }
      return res * dir;
    });
  }, [employees, query, departmentFilter, sortBy, sortDir]);

  // ---------- Статистика (useMemo) ----------
  const stats = useMemo(() => {
    const total = employees.length;
    const rated = employees.filter((e) => e.rating);
    const avgRating = rated.length
      ? (rated.reduce((sum, e) => sum + e.rating, 0) / rated.length).toFixed(1)
      : '—';
    const best = rated.length
      ? rated.reduce((max, e) => (e.rating > max.rating ? e : max), rated[0])
      : null;
    const highPerformers = rated.filter((e) => e.rating >= 8).length;
    const departments = [...new Set(employees.map((e) => e.department))].length;
    return { total, avgRating, best, highPerformers, departments };
  }, [employees]);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))],
    [employees],
  );

  // ---------- Отрисовка интерфейса ----------
  return (
    <div className="employee-app">
      {notice && (
        <div className={`toast toast-${notice.type}`} role="status">
          {notice.text}
        </div>
      )}

      <header className="app-header">
        <h1>Оценка эффективности сотрудников</h1>
        <div className="header-meta">
          {isLoading ? (
            <span className="badge badge-loading">⏳ Загрузка данных с сервера…</span>
          ) : (
            <span className={`badge ${error ? 'badge-error' : 'badge-ok'}`}>
              {error ? '⚠️ Сервер недоступен' : '✅ Данные загружены с сервера'}
            </span>
          )}
        </div>
      </header>

      {/* ---------- Статистика ---------- */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Всего сотрудников</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.avgRating}</span>
          <span className="stat-label">Средний рейтинг</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.highPerformers}</span>
          <span className="stat-label">Рейтинг ≥ 8</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.departments}</span>
          <span className="stat-label">Отделов</span>
        </div>
        <div className="stat-card stat-card-wide">
          {stats.best ? (
            <>
              <span className="stat-value stat-value-small">{stats.best.name}</span>
              <span className="stat-label">Лучший сотрудник — {stats.best.rating}</span>
            </>
          ) : (
            <>
              <span className="stat-value">—</span>
              <span className="stat-label">Лучший сотрудник</span>
            </>
          )}
        </div>
      </section>

      {/* ---------- Форма добавления / редактирования ---------- */}
      <form className="employee-form" onSubmit={handleSubmit}>
        <h2>{editingId ? `✏️ Редактирование: ${form.name || '…'}` : '➕ Добавить сотрудника'}</h2>
        <div className="form-grid">
          <input type="text" name="name" placeholder="ФИО *" value={form.name} onChange={handleChange} required />
          <input type="text" name="position" placeholder="Должность" value={form.position} onChange={handleChange} />
          <input type="text" name="department" placeholder="Отдел" value={form.department} onChange={handleChange} />
          <input type="number" name="rating" placeholder="Оценка (1–10) *" min="1" max="10" step="0.1" value={form.rating} onChange={handleChange} required />
          <input type="date" name="reviewDate" aria-label="Дата оценки" value={form.reviewDate} onChange={handleChange} />
          <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {editingId ? '💾 Сохранить изменения' : '➕ Добавить'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
              ✖ Отмена
            </button>
          )}
        </div>
      </form>

      {/* ---------- Фильтры и сортировка ---------- */}
      <section className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="🔍 Поиск по ФИО, должности или отделу… (на сервере)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isSearching && <span className="badge badge-loading">🔍 Поиск на сервере…</span>}
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
          <option value="all">Все отделы</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Сортировка: по ФИО</option>
          <option value="rating">Сортировка: по рейтингу</option>
          <option value="department">Сортировка: по отделу</option>
          <option value="reviewDate">Сортировка: по дате оценки</option>
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        >
          {sortDir === 'asc' ? '🔼 По возрастанию' : '🔽 По убыванию'}
        </button>
      </section>
      {/* ---------- Список сотрудников: загрузка / ошибка / пусто / данные ---------- */}
      {isLoading ? (
        <p className="empty-state">⏳ Получение данных с сервера…</p>
      ) : filteredAndSorted.length === 0 ? (
        error ? (
          <div className="error-panel" role="alert">
            <strong>⚠️ Не удалось загрузить данные</strong>
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setRetryToken((t) => t + 1)}
            >
              ↻ Повторить
            </button>
          </div>
        ) : (
          <p className="empty-state">
            {employees.length === 0
              ? 'Список пуст. Добавьте первого сотрудника.'
              : 'По заданным фильтрам ничего не найдено.'}
          </p>
        )
      ) : (
        <>
          {error && (
            <div className="error-panel error-panel--inline" role="alert">
              <span>⚠️ {error}</span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setRetryToken((t) => t + 1)}
              >
                ↻ Повторить
              </button>
            </div>
          )}
          <ul className="employee-list">
            {filteredAndSorted.map((e) => (
              <li
                key={e.id}
                className={`employee-item${editingId === e.id ? ' is-editing' : ''}`}
              >
                <div className="employee-info">
                  <strong>{e.name}</strong>
                  <span>{e.position}</span>
                  <span className="department-tag">{e.department}</span>
                  {e.email && <span className="email">{e.email}</span>}
                </div>
                <div className="employee-meta">
                  <span className="rating" title="Оценка эффективности">
                    ⭐ {e.rating}
                  </span>
                  <span className="review-date">
                    📅 {e.reviewDate ? new Date(e.reviewDate).toLocaleDateString('ru-RU') : '—'}
                  </span>
                </div>
                <div className="employee-actions">
                  <button type="button" className="btn btn-small btn-edit" onClick={() => startEdit(e)}>
                    ✏️ Изменить
                  </button>
                  <button type="button" className="btn btn-small btn-delete" onClick={() => handleDelete(e.id)}>
                    🗑 Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <footer className="app-footer">
        Данные загружаются с REST API <code>{API_URL}</code>. Показано {filteredAndSorted.length} из{' '}
        {employees.length}. Поиск выполняется на сервере (debounce {SEARCH_DEBOUNCE_MS} мс,
        устаревшие запросы отменяются).
      </footer>
    </div>
  );
}