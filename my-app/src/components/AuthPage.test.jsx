import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthPage from './AuthPage';

// API мокаем целиком: реальных HTTP-запросов в тестах нет
const mocks = vi.hoisted(() => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
}));

vi.mock('../api', () => mocks);

const ADMIN_USER = { id: 1, email: 'admin@example.com', role: 'admin' };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthPage: вход и регистрация', () => {
  it('успешный вход сохраняет сессию (token + user) и вызывает onAuth', async () => {
    mocks.loginUser.mockResolvedValue({ data: { token: 'jwt-token', user: ADMIN_USER } });
    const onAuth = vi.fn();
    render(<AuthPage onAuth={onAuth} />);

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'Admin123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Войти/ }));

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith(ADMIN_USER));
    expect(mocks.loginUser).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'Admin123!',
    });
    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(ADMIN_USER);
  });

  it('показывает ошибку сервера при неверном пароле', async () => {
    mocks.loginUser.mockRejectedValue(new Error('Неверный email или пароль'));
    const onAuth = vi.fn();
    render(<AuthPage onAuth={onAuth} />);

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Войти/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль');
    expect(onAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('регистрация: несовпадающие пароли отсекаются на клиенте', async () => {
    render(<AuthPage onAuth={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Регистрация' }));

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'secret12' },
    });
    fireEvent.change(screen.getByPlaceholderText('Повторите пароль'), {
      target: { value: 'secret99' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Пароли не совпадают');
    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it('регистрация: register + автоматический вход → onAuth с пользователем', async () => {
    mocks.registerUser.mockResolvedValue({
      data: { id: 7, email: 'new@example.com', role: 'user' },
    });
    mocks.loginUser.mockResolvedValue({
      data: { token: 'new-token', user: { id: 7, email: 'new@example.com', role: 'user' } },
    });
    const onAuth = vi.fn();
    render(<AuthPage onAuth={onAuth} />);

    fireEvent.click(screen.getByRole('button', { name: 'Регистрация' }));
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), {
      target: { value: 'secret12' },
    });
    fireEvent.change(screen.getByPlaceholderText('Повторите пароль'), {
      target: { value: 'secret12' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Зарегистрироваться/ }));

    await waitFor(() =>
      expect(onAuth).toHaveBeenCalledWith({ id: 7, email: 'new@example.com', role: 'user' }),
    );
    expect(mocks.registerUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret12',
    });
    expect(mocks.loginUser).toHaveBeenCalledTimes(1); // автовход после регистрации
    expect(localStorage.getItem('token')).toBe('new-token');
  });
});