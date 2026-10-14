import { fireEvent, render } from '@testing-library/react-native';

import VisitsScreen from '../app/(admin)/visits';
import BranchPresenceScreen from '../app/(admin)/visits/branch/[id]';
import { useAppDispatch, useAppSelector } from '../store';
import { Presence } from '../store/types/visits';

const mockPush = jest.fn();
let mockParams: { id: string } = { id: 'b-center' };

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('../components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

const child = (id: string, firstName: string) => ({ id, firstName, surname: 'Иванова' });

const presence: Presence = {
  total: 3,
  branches: [
    { id: 'b-north', name: 'Северный' },
    { id: 'b-center', name: 'Центральный' },
  ],
  groups: [
    { id: 'g-romashka', name: 'Ромашка', branchId: 'b-center', totalChildren: 18, present: [child('c1', 'Мария')] },
    { id: 'g-sun', name: 'Солнышко', branchId: 'b-center', totalChildren: 15, present: [] },
    { id: 'g-new', name: 'Новая', branchId: 'b-center', totalChildren: 0, present: [] },
    { id: 'g-bee', name: 'Пчёлка', branchId: 'b-north', totalChildren: 10, present: [child('c2', 'Анна')] },
  ],
  withoutGroup: [child('c3', 'Ольга')],
};

const noQueue = {
  enabled: false,
  items: [],
  otherCount: 0,
  status: 'idle',
  refreshing: false,
  filter: null,
  filterLoaded: false,
  showAll: false,
  decidingIds: [],
  error: null,
};

function givenPresence(
  data: Presence,
  role = 'ADMIN',
  journalItems: unknown[] = [],
  visitQueue: object = noQueue,
) {
  mockUseAppSelector.mockImplementation((selector) =>
    selector({
      auth: { user: { id: 'me', role } },
      visitQueue,
      visits: {
        present: { data, status: 'loaded', refreshing: false },
        journal: { items: journalItems, status: 'loaded', refreshing: false, page: 0, last: false, loadingMore: false, loadMoreFailed: false },
      },
    } as never),
  );
}

describe('presence by branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it('lists branches with counts and opens the chosen one', async () => {
    givenPresence(presence);
    const screen = await render(<VisitsScreen />);

    expect(screen.getByText('В саду 3 ребёнка')).toBeTruthy();
    expect(screen.getByText('1 из 33')).toBeTruthy();
    expect(screen.getByText('3 группы')).toBeTruthy();
    expect(screen.getByText('Без группы')).toBeTruthy();

    await fireEvent.press(screen.getByText('Центральный'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/visits/branch/[id]', params: { id: 'b-center' } });
  });

  it('shows groups right away when there is only one branch', async () => {
    givenPresence({
      ...presence,
      branches: [presence.branches[1]],
      groups: presence.groups!.filter((group) => group.branchId === 'b-center'),
      withoutGroup: [],
      total: 1,
    });
    const screen = await render(<VisitsScreen />);

    expect(screen.getByText('РОМАШКА · 1 ИЗ 18')).toBeTruthy();
    expect(screen.getByText('Мария Иванова')).toBeTruthy();
    expect(screen.queryByText('Центральный')).toBeNull();
  });

  it('shows the children of the branch by group', async () => {
    givenPresence(presence);
    mockParams = { id: 'b-center' };
    const screen = await render(<BranchPresenceScreen />);

    expect(screen.getByText('В саду 1 из 33')).toBeTruthy();
    expect(screen.getByText('РОМАШКА · 1 ИЗ 18')).toBeTruthy();
    expect(screen.getByText('Мария Иванова')).toBeTruthy();
    expect(screen.getByText('СОЛНЫШКО · 0 ИЗ 15')).toBeTruthy();
    expect(screen.getByText('Сейчас никого нет')).toBeTruthy();
    expect(screen.queryByText('Анна Иванова')).toBeNull();
  });

  it('shows an empty group and lets the admin change its children', async () => {
    givenPresence(presence);
    mockParams = { id: 'b-center' };
    const screen = await render(<BranchPresenceScreen />);

    expect(screen.getByText('НОВАЯ')).toBeTruthy();
    expect(screen.getByText('Детей пока нет')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Изменить состав группы Новая'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/visits/group-members', params: { groupId: 'g-new' } });
  });

  it('does not let an employee change groups', async () => {
    givenPresence(presence, 'EMPLOYEE');
    mockParams = { id: 'b-center' };
    const screen = await render(<BranchPresenceScreen />);

    expect(screen.getByText('НОВАЯ')).toBeTruthy();
    expect(screen.queryByText('Изменить')).toBeNull();
  });

  it('shows the journal by day and group with one row per child', async () => {
    const at = (hours: number, minutes: number) => {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date.toISOString();
    };
    const romashka = { id: 'g-romashka', name: 'Ромашка', branchName: 'Центральный' };
    const visit = (status: 'IN' | 'OUT', datetime: string, representativeName: string) => ({
      key: `c1|${datetime}|${status}`,
      childId: 'c1',
      childName: 'Мария Иванова',
      representativeName,
      status,
      datetime,
      group: romashka,
    });
    givenPresence(presence, 'ADMIN', [visit('OUT', at(17, 30), 'Иванов С.'), visit('IN', at(8, 40), 'Иванова А.')]);
    const screen = await render(<VisitsScreen />);

    await fireEvent.press(screen.getByText('Журнал'));

    expect(screen.getByText('Сегодня')).toBeTruthy();
    expect(screen.getByText('РОМАШКА · ЦЕНТРАЛЬНЫЙ · 1 РЕБЁНОК')).toBeTruthy();
    expect(screen.getByText('08:40 → 17:30')).toBeTruthy();
    expect(screen.getByText('Приход — Иванова А. · Уход — Иванов С.')).toBeTruthy();
  });

  it('opens the queue first while marks are waiting and lets the employee accept a child', async () => {
    const dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
    const mark = {
      id: 'm1',
      status: 'IN',
      childName: 'Мария Иванова',
      representativeId: 'mother',
      representativeName: 'Иванова А.',
      linkRole: 'PARENT',
      datetime: new Date(2026, 9, 12, 8, 40).toISOString(),
      comment: 'Привела бабушка',
      group: { id: 'g-rom', name: 'Ромашка' },
    };
    givenPresence(presence, 'EMPLOYEE', [], { ...noQueue, enabled: true, status: 'loaded', items: [mark], otherCount: 2 });
    const screen = await render(<VisitsScreen />);

    // Число на переключателе — все, кто ждёт, в том числе в других группах
    expect(screen.getByText('Очередь 3')).toBeTruthy();
    expect(screen.getByText('→ Мария Иванова')).toBeTruthy();
    expect(screen.getByText('Привёл(а) — Иванова А. (родитель)')).toBeTruthy();
    expect(screen.getByText('«Привела бабушка»')).toBeTruthy();

    await fireEvent.press(screen.getByText('Принять'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'visitQueue/confirmMarkStart', payload: 'm1' });
  });

  it('does not let an employee confirm their own mark', async () => {
    const mark = {
      id: 'm1',
      status: 'OUT',
      childName: 'Мария Иванова',
      representativeId: 'me',
      representativeName: 'Иванова А.',
      linkRole: 'PARENT',
      datetime: new Date(2026, 9, 12, 17, 30).toISOString(),
      comment: null,
      group: null,
    };
    givenPresence(presence, 'EMPLOYEE', [], { ...noQueue, enabled: true, status: 'loaded', items: [mark] });
    const screen = await render(<VisitsScreen />);

    expect(screen.getByText('Это ваша отметка: её подтвердит другой сотрудник')).toBeTruthy();
    expect(screen.queryByText('Отдать')).toBeNull();
  });

  it('has no queue when confirmation is off in the kindergarten', async () => {
    givenPresence(presence);
    const screen = await render(<VisitsScreen />);

    expect(screen.queryByText(/Очередь/)).toBeNull();
  });
});
