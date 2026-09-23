import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_EMPLOYEES } from '../data/demoEmployees';

// Ключ, по которому список хранится в localStorage
const STORAGE_KEY = 'employees_rating_list_v1';

const EMPTY_FORM = {
  name: '',
  position: '',
  department: '',
  rating: '',
  reviewDate: '',
  email: '',
};

export default function EmployeeList() {
  // ---------- useState: данные списка, форма, фильтр/сортировка ----------
  const [employees, setEmployees] = useState([]);      // массив сотрудников
  const [form, setForm] = useState(EMPTY_FORM);        // значения полей ввода
  const [editingId, setEditingId] = useState(null);    // id редактируемого сотрудника
  const [query, setQuery] = useState('');              // строка поиска
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');        // name | rating | department | reviewDate
  const [sortDir, setSortDir] = useState('asc');       // asc | desc
  const [isLoading, setIsLoading] = useState(true);    // имитация загрузки с сервера
  const [saveStatus, setSaveStatus] = useState('');    // статус автосохранения

  // ---------- useEffect (пустой массив): загрузка из localStorage при монтировании ----------
  // Имитация загрузки с сервера: задержка 1 секунда, затем читаем localStorage.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setEmployees(Array.isArray(parsed) ? parsed : DEMO_EMPLOYEES);
        } else {
          // Нет сохранённых данных — инициализируем моковыми.
          setEmployees(DEMO_EMPLOYEES);
        }
      } catch {
        setEmployees(DEMO_EMPLOYEES);
      } finally {
        setIsLoading(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // ---------- useEffect [employees]: автосохранение в localStorage (debounce 500 мс) ----------
  const debounceRef = useRef(null);
  const markDirty = () => setSaveStatus('⏳ Ожидание сохранения…');
  useEffect(() => {
    if (isLoading) return; // не сохраняем, пока идёт первичная загрузка

    debounceRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
      const time = new Date().toLocaleTimeString('ru-RU');
      setSaveStatus(`✅ Сохранено в localStorage в ${time}`);
    }, 500);

    return () => clearTimeout(debounceRef.current); // сброс таймера при новом изменении
  }, [employees, isLoading]);

  // ---------- useEffect [employees.length]: заголовок страницы ----------
  useEffect(() => {
    document.title = employees.length
      ? `Сотрудники (${employees.length}) — оценка эффективности`
      : 'Сотрудники — оценка эффективности';
  }, [employees.length]);
  // ---------- Служебные функции ----------
  const nextId = () =>
    employees.reduce((max, e) => (e.id > max ? e.id : max), 0) + 1;

  const isValidForm = () =>
    form.name.trim() !== '' &&
    form.rating !== '' &&
    Number(form.rating) >= 1 &&
    Number(form.rating) <= 10;

  // ---------- Обработчики формы (добавление / редактирование) ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidForm()) {
      alert('Укажите ФИО и оценку эффективности от 1 до 10.');
      return;
    }
    markDirty();
    const employee = {
      id: editingId ?? nextId(),
      name: form.name.trim(),
      position: form.position.trim(),
      department: form.department.trim(),
      rating: Number(form.rating),
      reviewDate: form.reviewDate,
      email: form.email.trim(),
    };

    if (editingId) {
      // Редактирование: заменяем элемент с тем же id.
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? employee : e)));
      setEditingId(null);
    } else {
      // Добавление нового сотрудника.
      setEmployees((prev) => [...prev, employee]);
    }
    setForm(EMPTY_FORM);
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

  const handleDelete = (id) => {
    if (window.confirm('Удалить сотрудника?')) {
      markDirty();
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) cancelEdit();
    }
  };

  const handleReset = () => {
    if (window.confirm('Сбросить список к демо-данным? Текущие изменения будут потеряны.')) {
      markDirty();
      setEmployees(DEMO_EMPLOYEES);
    }
  };

  const handleClearStorage = () => {
    if (window.confirm('Очистить localStorage и показать демо-данные?')) {
      markDirty();
      localStorage.removeItem(STORAGE_KEY);
      setEmployees(DEMO_EMPLOYEES);
      setSaveStatus('🧹 localStorage очищен. Данные восстановлены из демо.');
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
      <header className="app-header">
        <h1>Оценка эффективности сотрудников</h1>
        <div className="header-meta">
          {isLoading ? (
            <span className="badge badge-loading">⏳ Загрузка данных с сервера…</span>
          ) : (
            <span className={`badge ${saveStatus.includes('✅') ? 'badge-ok' : 'badge-wait'}`}>
              {saveStatus}
            </span>
          )}
          {!isLoading && (
            <button className="btn btn-ghost btn-small" onClick={handleClearStorage}>
              🧹 Очистить localStorage
            </button>
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
          <input type="date" name="reviewDate" value={form.reviewDate} onChange={handleChange} />
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
          <button type="button" className="btn btn-danger" onClick={handleReset}>
            ↺ Сбросить к демо
          </button>
        </div>
      </form>

      {/* ---------- Фильтры и сортировка ---------- */}
      <section className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="🔍 Поиск по ФИО, должности или отделу…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
      {/* ---------- Список сотрудников ---------- */}
      {isLoading ? (
        <p className="empty-state">⏳ Имитация загрузки с сервера… (1 секунда)</p>
      ) : filteredAndSorted.length === 0 ? (
        <p className="empty-state">
          {employees.length === 0
            ? 'Список пуст. Добавьте первого сотрудника.'
            : 'По заданным фильтрам ничего не найдено.'}
        </p>
      ) : (
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
      )}

      <footer className="app-footer">
        Данные хранятся в <code>localStorage</code> под ключом{' '}
        <code>employees_rating_list_v1</code>. Показано {filteredAndSorted.length} из {employees.length}.
      </footer>
    </div>
  );
}