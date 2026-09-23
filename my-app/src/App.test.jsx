import { fireEvent, render, screen } from '@testing-library/react';
import { within } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

// Мокаем весь API-слой (App, AuthPage, Profile и EmployeeList берут функции из src/api.js)
const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  fetchEmployees: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  updateProfile: vi.fn(),
  API_URL: 'http://localhost:3000/api/v1',
}));

vi.mock('./api', () => mocks);

const ADMIN = {
  id: 1,
  email: 'admin@example.com',
  role: 'admin',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const USER = {
  id: 2,
  email: 'user@example.com',
  role: 'user',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
};

const EMPLOYEES = [
  {
    id: 1,
    name: 'Иван Иванов',
    position: 'Разработчик',
    department: 'IT',
    rating: 8.5,
    reviewDate: '2026-09-01',
    email: 'ivan@example.com',
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.fetchEmployees.mockResolvedValue({ data: EMPLOYEES });
  mocks.createEmployee.mockResolvedValue({ data: { id: 99 } });
  mocks.updateEmployee.mockResolvedValue({ data: { id: 1 } });
  mocks.deleteEmployee.mockResolvedValue({ data: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App: аутентификация и роли', () => {
  it('без токена показывает страницу входа и не ходит в /profile', async () => {
    render(<App />);

    expect(
      await screen.findByText('Войдите или зарегистрируйтесь, чтобы продолжить'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вход' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Регистрация' })).toBeInTheDocument();
    expect(mocks.fetchProfile).not.toHaveBeenCalled();
  });

  it('токен админа → вкладки «Сотрудники»/«Профиль» и список сотрудников', async () => {
    localStorage.setItem('token', 'admin-token');
    mocks.fetchProfile.mockResolvedValue({ data: ADMIN });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Сотрудники' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeInTheDocument();
    // Имя есть и в списке, и в карточке «Лучший сотрудник» — ищем внутри списка
    const list = await screen.findByRole('list');
    expect(await within(list).findByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText(/админ · admin@example.com/)).toBeInTheDocument();
    expect(mocks.fetchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('токен обычного пользователя → только профиль, список сотрудников не запрашивается', async () => {
    localStorage.setItem('token', 'user-token');
    mocks.fetchProfile.mockResolvedValue({ data: USER });
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Мой профиль/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email *')).toHaveValue('user@example.com');
    expect(screen.queryByRole('button', { name: 'Сотрудники' })).not.toBeInTheDocument();
    expect(mocks.fetchEmployees).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBe('user-token'); // не разлогинились
  });

  it('кнопка «Выйти» очищает сессию и возвращает на страницу входа', async () => {
    localStorage.setItem('token', 'admin-token');
    mocks.fetchProfile.mockResolvedValue({ data: ADMIN });
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Выйти' }));

    expect(
      await screen.findByText('Войдите или зарегистрируйтесь, чтобы продолжить'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('просроченный токен (401 от /profile) → очистка сессии и экран входа', async () => {
    localStorage.setItem('token', 'expired-token');
    const err = new Error('Недействительный или просроченный токен');
    err.status = 401;
    mocks.fetchProfile.mockRejectedValue(err);
    render(<App />);

    expect(
      await screen.findByText('Войдите или зарегистрируйтесь, чтобы продолжить'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(mocks.fetchEmployees).not.toHaveBeenCalled();
  });
});