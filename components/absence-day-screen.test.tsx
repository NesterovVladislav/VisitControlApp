import { fireEvent, render } from '@testing-library/react-native';

import { Platform } from 'react-native';
import VisitsScreen from '../app/(admin)/visits';
import AbsencesScreen from '../app/(admin)/visits/absences';
import { getAbsenceDay, getNeighboringAbsenceDay } from '../services/api/absence-day';
import type { AbsenceDay } from '../services/api/absence-day';
import { useAppDispatch, useAppSelector } from '../store';
import { ApiError } from '../services/errors/api-error';
import { AbsenceDayEntry } from './absence-day-entry';
import { absenceEntrySummary } from '../utils/absence-day-labels';
import { loadPresentStart } from '../store/reducers/visits';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('./ui/refresh-control', () => jest.requireActual('./ui/refresh-control.web'));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
const mockParams: Record<string, string> = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => mockParams }));
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
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'android'); load.mockReset(); Object.keys(mockParams).forEach(key => delete mockParams[key]); });

  it('shows the selected day, group and paid-day label, then filters late messages', async () => {
    load.mockResolvedValue(day);
    const screen = await render(<AbsencesScreen />);

    expect(await screen.findByText('Не придут 2 ребёнка')).toBeTruthy();
    expect(screen.getByText('Ромашка')).toBeTruthy();
    expect(screen.getByText('2 из 3')).toBeTruthy();
    expect(screen.getByText('Сообщили позже')).toBeTruthy();
    expect(screen.getByText('Примерова Анна')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Фильтр по времени сообщения' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Сообщили позже' }));
    expect(screen.getByText('Сообщили позже · 1 из 2')).toBeTruthy();
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

    expect(await screen.findByText('Не придёт 1 ребёнок')).toBeTruthy();
    expect(screen.getByText('Без группы')).toBeTruthy();
    expect(screen.queryByText(/из (0|null)/)).toBeNull();
  });

  it('opens and closes the read-only details using accessible row and close buttons', async () => {
    load.mockResolvedValue(day);
    const screen = await render(<AbsencesScreen />);

    const row = await screen.findByRole('button', { name: 'Подробнее об отсутствии: Примеров Ребёнок' });
    expect(screen.queryByText('«Останется дома»')).toBeNull();
    await fireEvent.press(row);
    expect(screen.getByRole('header', { name: 'Отсутствие' })).toBeTruthy();
    expect(screen.getByText('«Останется дома»')).toBeTruthy();
    expect(screen.getByText('Примеров Родитель')).toBeTruthy();
    expect(screen.getByText('16.11.2026 в 20:30')).toBeTruthy();
    expect(screen.getByText('16.11.2026 в 20:00')).toBeTruthy();
    expect(screen.getByText('Начислена')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByText('«Останется дома»')).toBeNull();
  });

  it('keeps Russian date input, rejects an invalid date, and sends ISO dates', async () => {
    load.mockResolvedValueOnce(day).mockResolvedValueOnce({ ...day, date: '2028-02-29', working: false });
    const screen = await render(<AbsencesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Выбрать дату\./ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ввести дату' }));
    const field = screen.getByLabelText('Дата');

    await fireEvent.changeText(field, '31022028');
    await fireEvent.press(screen.getByRole('button', { name: 'Показать' }));
    expect(screen.getByText('Введите дату в формате ДД.ММ.ГГГГ')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(field, '29022028');
    await fireEvent.press(screen.getByRole('button', { name: 'Показать' }));
    expect(load).toHaveBeenLastCalledWith('2028-02-29', expect.anything());
    expect(await screen.findByText('Сад в этот день не работает')).toBeTruthy();
    expect(screen.getByRole('button', { name: /29 февраля/ })).toBeTruthy();
  });
  it('stays in the inherited group across dates, including a day without the group in the report', async () => {
    Object.assign(mockParams, { groupId: 'group', groupName: 'Ромашка', date: day.date });
    const other = { ...day.branches[0].groups[0], id: 'another', name: 'Солнышко', absences: [{
      ...day.branches[0].groups[0].absences[0], id: 'other-child', childName: 'Из другой группы',
    }] };
    load.mockResolvedValue({ ...day, branches: [{ ...day.branches[0], groups: [other, ...day.branches[0].groups] }] });
    jest.mocked(getNeighboringAbsenceDay).mockResolvedValue({ ...day, date: '2026-11-18', branches: [{ ...day.branches[0], groups: [other] }] });
    const screen = await render(<AbsencesScreen />);
    expect(await screen.findByRole('button', { name: 'Группы. Ромашка' })).toBeTruthy();
    expect(load).toHaveBeenCalledWith(day.date, expect.anything());
    expect(screen.queryByText('Из другой группы')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Следующий рабочий день' }));
    expect(await screen.findByText('На эту дату нет данных по выбранной группе')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Группы. Ромашка' })).toBeTruthy();
    expect(screen.queryByText('Из другой группы')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Группы. Ромашка' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Солнышко' }));
    expect(await screen.findByText('Из другой группы')).toBeTruthy();
  });

  it('drops sensitive report rows on denial and can retry the same requested day', async () => {
    load.mockResolvedValueOnce(day).mockRejectedValueOnce(new ApiError('forbidden', 403)).mockResolvedValueOnce(day);
    const screen = await render(<AbsencesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Выбрать дату\./ }));
    await fireEvent.press(screen.getByRole('button', { name: '19.11.2026' }));
    expect(await screen.findByText('У вас нет доступа к списку отсутствующих')).toBeTruthy();
    expect(screen.queryByText('Примерова Анна')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Примерова Анна')).toBeTruthy();
    expect(load).toHaveBeenLastCalledWith('2026-11-19', expect.anything());
  });

});

it('refreshes the absence count with presence when zero notifications were returned', async () => {
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
  expect(await screen.findByRole('button', { name: /Кого не будет.*сообщений нет/ })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Обновить' }));

  expect(dispatch).toHaveBeenCalledWith(loadPresentStart({ refresh: true }));
  expect(load).toHaveBeenCalledTimes(2);
  expect(await screen.findByRole('button', { name: /Кого не будет.*не придут 2 ребёнка/ })).toBeTruthy();
});

it('opens even without a report and forwards only the chosen group and displayed date', async () => {
  const screen = await render(<AbsenceDayEntry day={null} groupId="group" groupName="Ромашка" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Кого не будет. Открыть список' }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/visits/absences', params: { groupId: 'group', groupName: 'Ромашка' } });
  await screen.rerender(<AbsenceDayEntry day={{ ...day, absentChildren: 15 }} groupId="group" />);
  await fireEvent.press(screen.getByRole('button', { name: /не придут 2 ребёнка/ }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/visits/absences', params: { date: day.date, groupId: 'group', groupName: 'Ромашка' } });
});

it('uses tomorrow only for the next calendar date, including the year boundary', () => {
  const now = new Date(2026, 11, 31, 23, 50);
  expect(absenceEntrySummary('2027-01-01', 0, now)).toBe('На завтра сообщений нет');
  expect(absenceEntrySummary('2027-01-01', 1, now)).toBe('Завтра не придёт 1 ребёнок');
  expect(absenceEntrySummary('2027-01-04', 11, now)).toContain('4 января 2027 не придут 11 детей');
});
