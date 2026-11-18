import { fireEvent, render } from '@testing-library/react-native';

import VisitsScreen from '../app/(admin)/visits';
import AbsencesScreen from '../app/(admin)/visits/absences';
import { getAbsenceDay } from '../services/api/absence-day';
import type { AbsenceDay } from '../services/api/absence-day';
import { useAppDispatch, useAppSelector } from '../store';
import { loadPresentStart } from '../store/reducers/visits';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('./ui/refresh-control', () => jest.requireActual('./ui/refresh-control.web'));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../store', () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock('../services/api/absence-day', () => ({
  getAbsenceDay: jest.fn(),
  getNeighboringAbsenceDay: jest.fn(),
}));

const day: AbsenceDay = {
  date: '2026-11-17',
  working: true,
  deadline: '16.11.2026 в 20:00',
  totalChildren: 3,
  absentChildren: 2,
  lateChildren: 1,
  branches: [{
    id: 'branch',
    name: 'Филиал',
    groups: [{
      id: 'group',
      name: 'Ромашка',
      totalChildren: 3,
      absences: [{
        id: 'notice-1',
        childName: 'Примеров Ребёнок',
        from: '2026-11-17',
        to: '2026-11-17',
        reason: 'Болезнь',
        comment: 'Останется дома',
        author: 'Примеров Родитель',
        created: '16.11.2026 в 20:30',
        late: true,
        charged: true,
        remainingDays: 1,
      }, {
        id: 'notice-2',
        childName: 'Примерова Анна',
        from: '2026-11-16',
        to: '2026-11-17',
        reason: 'Отпуск',
        comment: null,
        author: undefined,
        created: null,
        late: false,
        charged: false,
        remainingDays: 1,
      }],
    }],
  }],
};

describe('Список отсутствующих детей', () => {
  const load = jest.mocked(getAbsenceDay);
  beforeEach(() => load.mockReset());

  it('shows the selected day, group and paid-day label, then filters late messages', async () => {
    load.mockResolvedValue(day);
    const screen = await render(<AbsencesScreen />);

    expect(await screen.findByText('Не придут 2 из 3')).toBeTruthy();
    expect(screen.getByText('Ромашка · не будет 2 из 3')).toBeTruthy();
    expect(screen.getByText('17.11.2026 · сообщили после срока · день оплачивается')).toBeTruthy();
    expect(screen.getByText('Примерова Анна')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Только после срока' }));
    expect(screen.queryByText('Примерова Анна')).toBeNull();
    expect(screen.getByText('Примеров Ребёнок')).toBeTruthy();
  });

  it('omits the denominator when the backend cannot count children without a group', async () => {
    load.mockResolvedValue({
      ...day,
      totalChildren: 0,
      absentChildren: 1,
      branches: [{
        ...day.branches[0],
        groups: [{ ...day.branches[0].groups[0], name: 'Без группы', totalChildren: null, absences: day.branches[0].groups[0].absences.slice(0, 1) }],
      }],
    });
    const screen = await render(<AbsencesScreen />);

    expect(await screen.findByText('Не придут 1')).toBeTruthy();
    expect(screen.getByText('Без группы · не будет 1')).toBeTruthy();
    expect(screen.queryByText(/из (0|null)/)).toBeNull();
  });

  it('opens and closes the read-only details using accessible row and close buttons', async () => {
    load.mockResolvedValue(day);
    const screen = await render(<AbsencesScreen />);

    const row = await screen.findByRole('button', { name: 'Подробнее об отсутствии: Примеров Ребёнок' });
    expect(screen.queryByText('«Останется дома»')).toBeNull();
    await fireEvent.press(row);
    expect(screen.getByRole('header', { name: 'Сообщение об отсутствии' })).toBeTruthy();
    expect(screen.getByText('«Останется дома»')).toBeTruthy();
    expect(screen.getByText('Сообщил(а) Примеров Родитель · 16.11.2026 в 20:30')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByText('«Останется дома»')).toBeNull();
  });

  it('keeps Russian date input, rejects an invalid date, and sends ISO dates', async () => {
    load.mockResolvedValueOnce(day).mockResolvedValueOnce({ ...day, date: '2028-02-29', working: false });
    const screen = await render(<AbsencesScreen />);
    const field = await screen.findByLabelText('Дата');

    await fireEvent.changeText(field, '31022028');
    await fireEvent.press(screen.getByRole('button', { name: 'Показать' }));
    expect(screen.getByText('Введите дату в формате ДД.ММ.ГГГГ')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(field, '29022028');
    await fireEvent.press(screen.getByRole('button', { name: 'Показать' }));
    expect(load).toHaveBeenLastCalledWith('2028-02-29', expect.anything());
    expect(await screen.findByText('Сад в этот день не работает')).toBeTruthy();
    expect(screen.getByLabelText('Дата').props.value).toBe('29.02.2028');
  });
});

it('refreshes the absence count with presence even when the entry starts hidden', async () => {
  const load = jest.mocked(getAbsenceDay);
  load.mockReset().mockResolvedValueOnce({ ...day, absentChildren: 0, lateChildren: 0, branches: [] }).mockResolvedValueOnce(day);
  const dispatch = jest.fn();
  jest.mocked(useAppDispatch).mockReturnValue(dispatch);
  jest.mocked(useAppSelector).mockImplementation((selector) => selector({
    auth: { user: { role: 'EMPLOYEE' } },
    visitQueue: { enabled: false, items: [], otherCount: 0 },
    visits: {
      present: { status: 'loaded', refreshing: false, data: { total: 0, branches: [], groups: null, withoutGroup: [] } },
    },
  } as never));
  const screen = await render(<VisitsScreen />);

  expect(load).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /Кого не будет/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Обновить' }));

  expect(dispatch).toHaveBeenCalledWith(loadPresentStart({ refresh: true }));
  expect(load).toHaveBeenCalledTimes(2);
  expect(await screen.findByRole('button', { name: 'Кого не будет 17.11.2026: 2' })).toBeTruthy();
});
