import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeList from './EmployeeList';
import { DEMO_EMPLOYEES } from '../data/demoEmployees';

// Полностью мокаем API-слой: реальных HTTP-запросов в тестах не выполняется.
// Моки объявляем через vi.hoisted, чтобы ссылаться на них и в vi.mock, и в тестах.
const mocks = vi.hoisted(() => ({
  fetchEmployees: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  API_URL: 'http://localhost:3000/api/v1',
}));

vi.mock('../api', () => mocks);

// Данные, которые «возвращает сервер»: копия демо-данных
const SERVER_EMPLOYEES = DEMO_EMPLOYEES.map((e) => ({ ...e }));

beforeEach(() => {
  vi.clearAllMocks();
  // Успешные ответы по умолчанию (отдельные тесты переопределяют под себя)
  mocks.fetchEmployees.mockResolvedValue({ data: SERVER_EMPLOYEES });
  mocks.createEmployee.mockResolvedValue({ data: { id: 99 } });
  mocks.updateEmployee.mockResolvedValue({ data: { id: 1 } });
  mocks.deleteEmployee.mockResolvedValue({ data: { message: 'deleted' } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Заполняет форму данными нового сотрудника
function fillNewEmployee(name = 'Пётр Новиков') {
  fireEvent.change(screen.getByPlaceholderText('ФИО *'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('Должность'), { target: { value: 'DevOps' } });
  fireEvent.change(screen.getByPlaceholderText('Отдел'), { target: { value: 'IT' } });
  fireEvent.change(screen.getByPlaceholderText(/Оценка/), { target: { value: '9.1' } });
  fireEvent.change(screen.getByLabelText('Дата оценки'), { target: { value: '2026-09-15' } });
}

describe('EmployeeList: загрузка данных с сервера (GET)', () => {
  it('показывает индикатор загрузки, затем рендерит список с сервера', async () => {
    render(<EmployeeList />);

    // Состояние загрузки
    expect(screen.getByText(/Загрузка данных с сервера/)).toBeInTheDocument();
    expect(screen.getByText(/Получение данных с сервера/)).toBeInTheDocument();

    // Первичный запрос уходит без строки поиска
    expect(mocks.fetchEmployees).toHaveBeenCalledWith(expect.objectContaining({ search: '' }));

    // После ответа сервера список отрисован
    expect(await screen.findByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(SERVER_EMPLOYEES.length);
    expect(screen.getByText(/Данные загружены с сервера/)).toBeInTheDocument();
    expect(document.title).toBe(`Сотрудники (${SERVER_EMPLOYEES.length}) — оценка эффективности`);
  });

  it('при ошибке GET показывает сообщение и кнопку «Повторить», после повтора загружает данные', async () => {
    mocks.fetchEmployees.mockRejectedValueOnce(new Error('Сервер не отвечает'));
    render(<EmployeeList />);

    // Состояние ошибки
    const retryBtn = await screen.findByRole('button', { name: /Повторить/ });
    expect(screen.getByText(/Сервер не отвечает/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

    // Повтор запроса — теперь успех
    fireEvent.click(retryBtn);
    expect(await screen.findByText('Иван Иванов')).toBeInTheDocument();
    expect(mocks.fetchEmployees).toHaveBeenCalledTimes(2);
  });

  it('передаёт в запрос AbortSignal и отменяет его при размонтировании', async () => {
    const { unmount } = render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    const lastCall = mocks.fetchEmployees.mock.calls.at(-1)[0];
    expect(lastCall.signal).toBeTruthy();

    const onAbort = vi.fn();
    lastCall.signal.addEventListener('abort', onAbort);

    unmount();

    expect(onAbort).toHaveBeenCalled();
  });
describe('EmployeeList: CRUD с оптимистичным обновлением', () => {
  it('добавляет сотрудника: сразу в списке, затем временный ID заменяется реальным (POST)', async () => {
    const created = {
      id: 42,
      name: 'Пётр Новиков',
      position: 'DevOps',
      department: 'IT',
      rating: 9.1,
      reviewDate: '2026-09-15',
      email: 'petr@example.com',
    };
    mocks.createEmployee.mockResolvedValue({ data: created });
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    fillNewEmployee();
    fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));

    // Оптимистичное добавление: элемент уже виден без ожидания ответа
    expect(screen.getByText('Пётр Новиков')).toBeInTheDocument();

    // На сервер отправляется объект без id (id присваивает сервер)
    expect(mocks.createEmployee.mock.calls.at(-1)[0]).toEqual(
      expect.objectContaining({ name: 'Пётр Новиков', rating: 9.1 }),
    );

    // После ответа сервера элемент не задвоился
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(SERVER_EMPLOYEES.length + 1);
    });
    expect(screen.getByText('Пётр Новиков')).toBeInTheDocument();
  });

  it('откатывает добавление при ошибке POST', async () => {
    mocks.createEmployee.mockRejectedValueOnce(new Error('Некорректные данные запроса'));
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    fillNewEmployee();
    fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));

    // Оптимистично элемент появился…
    expect(screen.getByText('Пётр Новиков')).toBeInTheDocument();

    // …но после ошибки сервера откатывается, показывается уведомление
    await waitFor(() => expect(screen.queryByText('Пётр Новиков')).not.toBeInTheDocument());
    expect(screen.getByText(/Не удалось добавить сотрудника/)).toBeInTheDocument();
  });

  it('редактирует сотрудника оптимистично и вызывает PUT', async () => {
    mocks.updateEmployee.mockResolvedValue({
      data: {
        id: 1,
        name: 'Иван Иванов-мл.',
        position: 'Разработчик',
        department: 'IT',
        rating: 10,
        reviewDate: '2026-09-01',
        email: 'ivan.ivanov@example.com',
      },
    });
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    const item = screen.getByText('Иван Иванов').closest('li');
    fireEvent.click(within(item).getByRole('button', { name: /Изменить/ }));

    const nameInput = screen.getByPlaceholderText('ФИО *');
    expect(nameInput.value).toBe('Иван Иванов'); // форма заполнена данными

    fireEvent.change(nameInput, { target: { value: 'Иван Иванов-мл.' } });
    fireEvent.change(screen.getByPlaceholderText(/Оценка/), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));

    // Оптимистичное обновление в списке
    const list = screen.getByRole('list');
    expect(within(list).getByText('Иван Иванов-мл.')).toBeInTheDocument();
    expect(mocks.updateEmployee).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'Иван Иванов-мл.', rating: 10 }),
    );

    // После ответа сервера данные обновлены и не задвоены
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(SERVER_EMPLOYEES.length);
    });
  });

  it('откатывает редактирование при ошибке PUT', async () => {
    mocks.updateEmployee.mockRejectedValueOnce(new Error('Ошибка сервера'));
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    const item = screen.getByText('Иван Иванов').closest('li');
    fireEvent.click(within(item).getByRole('button', { name: /Изменить/ }));
    fireEvent.change(screen.getByPlaceholderText('ФИО *'), { target: { value: 'Иван Иванов-мл.' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));

    // Оптимистично имя изменилось…
    expect(screen.getByText('Иван Иванов-мл.')).toBeInTheDocument();

    // …после ошибки PUT откатилось к прежнему
    await waitFor(() => expect(screen.getByText('Иван Иванов')).toBeInTheDocument());
    expect(screen.queryByText('Иван Иванов-мл.')).not.toBeInTheDocument();
    expect(screen.getByText(/Не удалось сохранить изменения/)).toBeInTheDocument();
  });
});
describe('EmployeeList: CRUD с оптимистичным обновлением (delete)', () => {
  it('удаляет сотрудника оптимистично и вызывает DELETE', async () => {
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    const item = screen.getByText('Иван Иванов').closest('li');
    fireEvent.click(within(item).getByRole('button', { name: /Удалить/ }));

    // Оптимистичное удаление из списка
    expect(screen.queryByText('Иван Иванов')).not.toBeInTheDocument();
    expect(mocks.deleteEmployee).toHaveBeenCalledWith(1);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(SERVER_EMPLOYEES.length - 1);
    });
  });

  it('возвращает сотрудника в список при ошибке DELETE', async () => {
    mocks.deleteEmployee.mockRejectedValueOnce(new Error('Сервер не ответил'));
    render(<EmployeeList />);
    await screen.findByText('Мария Петрова');

    const item = screen.getByText('Мария Петрова').closest('li');
    fireEvent.click(within(item).getByRole('button', { name: /Удалить/ }));

    // Сначала элемент исчез оптимистично…
    expect(screen.queryByText('Мария Петрова')).not.toBeInTheDocument();

    // …после ошибки DELETE вернулся на место
    await waitFor(() => expect(screen.getByText('Мария Петрова')).toBeInTheDocument());
    expect(screen.getAllByRole('listitem')).toHaveLength(SERVER_EMPLOYEES.length);
    expect(screen.getByText(/Не удалось удалить сотрудника/)).toBeInTheDocument();
  });
});

describe('EmployeeList: серверный поиск с debounce', () => {
  it('отправляет запрос на сервер только после паузы 500 мс', async () => {
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');
    expect(mocks.fetchEmployees).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText(/Поиск/), {
      target: { value: 'Разработчик' },
    });

    // Debounce: сразу после ввода новый запрос на сервер НЕ отправляется
    expect(mocks.fetchEmployees).toHaveBeenCalledTimes(1);

    // Через 500 мс паузы уходит запрос с параметром search
    await waitFor(() => expect(mocks.fetchEmployees).toHaveBeenCalledTimes(2));
    expect(mocks.fetchEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Разработчик' }),
    );
  });

  it('фильтрует список по результатам, полученным с сервера', async () => {
    const onlyDev = SERVER_EMPLOYEES.filter((e) => e.position.toLowerCase().includes('разработ'));
    mocks.fetchEmployees.mockResolvedValue({ data: onlyDev });
    render(<EmployeeList />);

    // Ждём, пока придут данные с сервера, и только затем берём список
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(onlyDev.length));
    const list = screen.getByRole('list');
    expect(within(list).getByText('Иван Иванов')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Поиск/), {
      target: { value: 'Разработчик' },
    });

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(onlyDev.length);
    });
    expect(within(list).getByText('Иван Иванов')).toBeInTheDocument();
    expect(within(list).queryByText('Мария Петрова')).not.toBeInTheDocument();
  });
});

describe('EmployeeList: фильтрация и сортировка на клиенте', () => {
  it('фильтрует по отделу и сортирует по рейтингу по убыванию', async () => {
    render(<EmployeeList />);
    await screen.findByText('Иван Иванов');

    const [deptSelect, sortSelect] = screen.getAllByRole('combobox');

    // Фильтр: только отдел IT (3 демо-сотрудника)
    fireEvent.change(deptSelect, { target: { value: 'IT' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    // Сброс фильтра, сортировка по рейтингу по убыванию
    fireEvent.change(deptSelect, { target: { value: 'all' } });
    fireEvent.change(sortSelect, { target: { value: 'rating' } });
    fireEvent.click(screen.getByRole('button', { name: /По возрастанию/ }));

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Ольга Кузнецова'); // 9.3
    expect(items[1]).toHaveTextContent('Алексей Сидоров'); // 9.0
    expect(items.at(-1)).toHaveTextContent('Дмитрий Смирнов'); // 6.8
  });
});
});