import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Profile from './Profile';

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../api', () => mocks);

const USER = {
  id: 3,
  email: 'user@example.com',
  role: 'user',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.fetchProfile.mockResolvedValue({ data: USER });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Profile: загрузка профиля (GET /profile)', () => {
  it('показывает индикатор загрузки, затем данные пользователя', async () => {
    render(<Profile />);

    expect(screen.getByText(/Загрузка профиля/)).toBeInTheDocument();
    expect(mocks.fetchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.anything() }),
    );

    expect(await screen.findByRole('heading', { name: /Мой профиль/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email *')).toHaveValue('user@example.com');
    expect(screen.getByText('пользователь')).toBeInTheDocument(); // бейдж роли
  });

  it('при ошибке показывает панель с кнопкой «Повторить», после повтора загружает', async () => {
    mocks.fetchProfile.mockRejectedValueOnce(new Error('Сервер не отвечает'));
    render(<Profile />);

    const retryBtn = await screen.findByRole('button', { name: /Повторить/ });
    expect(screen.getByText('Сервер не отвечает')).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(await screen.findByRole('heading', { name: /Мой профиль/ })).toBeInTheDocument();
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(2);
  });

  it('при ошибке 401 вызывает onUnauthorized (разлогин)', async () => {
    const err = new Error('Недействительный или просроченный токен');
    err.status = 401;
    mocks.fetchProfile.mockRejectedValue(err);
    const onUnauthorized = vi.fn();
    render(<Profile onUnauthorized={onUnauthorized} />);

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: /Мой профиль/ })).not.toBeInTheDocument();
  });
});

describe('Profile: редактирование своих данных (PUT /profile)', () => {
  it('сохраняет email: updateProfile → успех, localStorage и UI обновлены', async () => {
    mocks.updateProfile.mockResolvedValue({
      data: { ...USER, email: 'updated@example.com', updatedAt: '2026-09-23T12:00:00.000Z' },
    });
    const onProfileUpdate = vi.fn();
    render(<Profile onProfileUpdate={onProfileUpdate} />);
    await screen.findByRole('heading', { name: /Мой профиль/ });

    fireEvent.change(screen.getByPlaceholderText('Email *'), {
      target: { value: 'updated@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({ email: 'updated@example.com' }),
    );
    expect(await screen.findByText(/Данные сохранены в БД/)).toBeInTheDocument();
    expect(onProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'updated@example.com' }),
    );
    expect(JSON.parse(localStorage.getItem('user')).email).toBe('updated@example.com');
    expect(screen.getByPlaceholderText('Email *')).toHaveValue('updated@example.com');
  });

  it('пароль короче 6 символов — валидация на клиенте, запрос не уходит', async () => {
    render(<Profile />);
    await screen.findByRole('heading', { name: /Мой профиль/ });

    fireEvent.change(screen.getByPlaceholderText(/Новый пароль/), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByText(/не менее 6 символов/)).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('ошибка сервера при сохранении — уведомление без изменения состояния', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('Пользователь с таким email уже зарегистрирован'));
    render(<Profile />);
    await screen.findByRole('heading', { name: /Мой профиль/ });

    fireEvent.change(screen.getByPlaceholderText('Email *'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

    expect(await screen.findByText(/email уже зарегистрирован/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email *')).toHaveValue('admin@example.com');
  });
});