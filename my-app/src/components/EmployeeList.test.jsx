import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeList from './EmployeeList';
import { DEMO_EMPLOYEES } from '../data/demoEmployees';

const STORAGE_KEY = 'employees_rating_list_v1';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Ждём завершение имитации загрузки с сервера (1 сек) и следующий рендер
const finishLoading = () =>
  act(async () => {
    vi.advanceTimersByTime(1000);
  });

// Ждём debounce автосохранения (500 мс)
const waitAutosave = () =>
  act(async () => {
    vi.advanceTimersByTime(500);
  });

describe('EmployeeList: загрузка и localStorage', () => {
  it('показывает индикатор загрузки, затем рендерит демо-данные', async () => {
    render(<EmployeeList />);

    // Идёт имитация загрузки с сервера
    expect(screen.getByText(/Имитация загрузки с сервера/)).toBeInTheDocument();

    await finishLoading();

    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(DEMO_EMPLOYEES.length);
    expect(document.title).toBe(
      `Сотрудники (${DEMO_EMPLOYEES.length}) — оценка эффективности`,
    );
  });

  it('после debounce автосохранения записывает список в localStorage', async () => {
    render(<EmployeeList />);
    await finishLoading();
    await waitAutosave();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).toHaveLength(DEMO_EMPLOYEES.length);
    expect(saved[0].name).toBe('Иван Иванов');
    expect(saved[0].rating).toBe(8.5);
  });

  it('загружает ранее сохранённый список из localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 42, name: 'Зоя Тестова', position: 'QA', department: 'IT', rating: 7.7 },
      ]),
    );

    render(<EmployeeList />);
    await finishLoading();

    const list = screen.getByRole('list');
    expect(within(list).getByText('Зоя Тестова')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });
});
describe('EmployeeList: добавление / редактирование / удаление', () => {
  it('добавляет нового сотрудника и сохраняет его', async () => {
    render(<EmployeeList />);
    await finishLoading();

    fireEvent.change(screen.getByPlaceholderText('ФИО *'), {
      target: { value: 'Пётр Новиков' },
    });
    fireEvent.change(screen.getByPlaceholderText('Должность'), {
      target: { value: 'DevOps' },
    });
    fireEvent.change(screen.getByPlaceholderText('Отдел'), {
      target: { value: 'IT' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Оценка/), {
      target: { value: '9.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));

    expect(screen.getByText('Пётр Новиков')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(DEMO_EMPLOYEES.length + 1);

    await waitAutosave();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved).toHaveLength(DEMO_EMPLOYEES.length + 1);
    expect(saved.at(-1).name).toBe('Пётр Новиков');
    expect(saved.at(-1).rating).toBe(9.1);
  });

  it('редактирует существующего сотрудника', async () => {
    render(<EmployeeList />);
    await finishLoading();

    const item = screen.getByText('Иван Иванов').closest('li');
    fireEvent.click(within(item).getByRole('button', { name: /Изменить/ }));

    const nameInput = screen.getByPlaceholderText('ФИО *');
    expect(nameInput.value).toBe('Иван Иванов'); // форма заполнена данными

    fireEvent.change(nameInput, { target: { value: 'Иван Иванов-мл.' } });
    fireEvent.change(screen.getByPlaceholderText(/Оценка/), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));

    const list = screen.getByRole('list');
    expect(within(list).getByText('Иван Иванов-мл.')).toBeInTheDocument();
    expect(within(list).queryByText('Иван Иванов')).not.toBeInTheDocument();

    await waitAutosave();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const edited = saved.find((e) => e.name === 'Иван Иванов-мл.');
    expect(edited).toBeTruthy();
    expect(edited.rating).toBe(10);
  });

  it('удаляет сотрудника после подтверждения', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<EmployeeList />);
    await finishLoading();

    const item = screen.getByText('Мария Петрова').closest('li');
    fireEvent.click(within(item).getByRole('button', { name: /Удалить/ }));

    expect(screen.queryByText('Мария Петрова')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(DEMO_EMPLOYEES.length - 1);
  });
});

describe('EmployeeList: фильтрация и сортировка', () => {
  it('фильтрует по поиску', async () => {
    render(<EmployeeList />);
    await finishLoading();

    fireEvent.change(screen.getByPlaceholderText(/Поиск/), {
      target: { value: 'разработчик' },
    });

    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.queryByText('Мария Петрова')).not.toBeInTheDocument();
  });

  it('фильтрует по отделу и сортирует по рейтингу по убыванию', async () => {
    render(<EmployeeList />);
    await finishLoading();

    const [deptSelect, sortSelect] = screen.getAllByRole('combobox');

    // Фильтр: только отдел IT (3 демо-сотрудника)
    fireEvent.change(deptSelect, { target: { value: 'IT' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    // Сброс фильтра, сортировка по рейтингу по убыванию
    fireEvent.change(deptSelect, { target: { value: 'all' } });
    fireEvent.change(sortSelect, { target: { value: 'rating' } });
    // Кнопка переключает направление: сейчас "По возрастанию" → клик изменит на "По убыванию"
    fireEvent.click(screen.getByRole('button', { name: /По возрастанию/ }));

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ольга Кузнецова'); // 9.3
    expect(items[1]).toHaveTextContent('Алексей Сидоров'); // 9.0
    expect(items.at(-1)).toHaveTextContent('Дмитрий Смирнов'); // 6.8
  });
});