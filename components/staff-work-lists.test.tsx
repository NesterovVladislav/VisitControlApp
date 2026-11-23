import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import JournalScreen from '../app/(admin)/journal';
import VisitsScreen from '../app/(admin)/visits';
import { useAppDispatch, useAppSelector } from '../store';
import { loadJournalMore } from '../store/reducers/visits';
import type { VisitEntry, VisitsState } from '../store/types/visits';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), Redirect: () => null }));
jest.mock('../store', () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));
const mockPush = jest.fn();

const first = { id: 'west', name: 'Ромашка', branchName: 'Западный' };
const second = { id: 'east', name: 'Ромашка', branchName: 'Восточный' };
const groups = [first, second].map((group, i) => ({
  id: group.id, name: group.name, branchId: group.id, totalChildren: 3,
  present: [{ id: String(i), firstName: i ? 'Ева' : 'Иван', surname: i ? 'Белова' : 'Волков' }],
}));
const mark = (group: typeof first, id: string, childName: string): VisitEntry => ({
  key: id, childId: id, childName, status: 'IN', representativeName: 'Орлова Анна',
  datetime: '2026-11-23T08:12:00', group, comment: 'Уйдём раньше',
});

const fresh = (): VisitsState => ({
  present: { data: { total: 2, groups, branches: [first, second].map(g => ({ id: g.id, name: g.branchName })),
    withoutGroup: [{ id: 'u', firstName: 'Имя', surname: 'Без группы' }] }, status: 'loaded', refreshing: false },
  journal: { revision: 0, items: [], status: 'loaded', page: 0, last: false, loadingMore: false, refreshing: false, loadMoreFailed: false },
});
let visits: VisitsState;
const dispatch = jest.fn();
const originalOS = Platform.OS;

beforeEach(() => {
  visits = fresh();
  Platform.OS = 'android';
  jest.clearAllMocks();
  jest.mocked(useAppDispatch).mockReturnValue(dispatch);
  jest.mocked(useAppSelector).mockImplementation(select => select({
    auth: { user: { role: 'EMPLOYEE' } }, visits, visitQueue: { enabled: false, items: [], otherCount: 0 },
  } as never));
});
afterEach(() => { Platform.OS = originalOS; });

test('staff sees accessible branches, scopes presence and carries the same group into absences', async () => {
  const screen = await render(<VisitsScreen />);
  expect(screen.queryByText('Без группы Имя')).toBeNull();
  expect(screen.getByText('Волков Иван')).toBeTruthy();
  expect(screen.getByText('Белова Ева')).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Журнал' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать группу: Все группы' }));
  // Восточный precedes Западный, and the two identically named options select distinct IDs.
  await fireEvent.press(screen.getAllByRole('button', { name: 'Ромашка' })[0]);
  expect(screen.queryByText('Волков Иван')).toBeNull();
  expect(screen.getByText('Белова Ева')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /Кого не будет/ }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/visits/absences', params: { groupId: 'east', groupName: 'Ромашка' } });
});

test('a selected journal group searches beyond pages with no matches, including after its first visible child', async () => {
  const one = mark(first, 'a', 'Волков Иван');
  const two = mark(second, 'b', 'Белова Ева');
  visits.journal.items = [one];
  const screen = await render(<JournalScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Выбрать группу: Все группы' }));
  await fireEvent.press(screen.getAllByRole('button', { name: 'Ромашка' })[0]);
  expect(dispatch).toHaveBeenCalledWith(loadJournalMore());
  expect(screen.queryByText('В этой группе пока нет отметок')).toBeNull();
  visits = { ...visits, journal: { ...visits.journal, items: [one, two], page: 1 } };
  await screen.rerender(<JournalScreen />);
  expect(screen.getByText('Белова Ева')).toBeTruthy();
  expect(screen.getByText('«Уйдём раньше»')).toBeTruthy();
  expect(screen.queryByText('Волков Иван')).toBeNull();
  dispatch.mockClear();
  await fireEvent.press(screen.getByRole('button', { name: 'Показать ещё' }));
  expect(dispatch).toHaveBeenCalledWith(loadJournalMore());
  dispatch.mockClear();
  visits = { ...visits, journal: { ...visits.journal, items: [...visits.journal.items, mark(first, 'c', 'Орлов Лев')], page: 2 } };
  await screen.rerender(<JournalScreen />);
  expect(dispatch).toHaveBeenCalledWith(loadJournalMore());
  dispatch.mockClear();
  visits = { ...visits, journal: { ...visits.journal, items: [...visits.journal.items, mark(second, 'd', 'Громова Мия')], page: 3, last: true } };
  await screen.rerender(<JournalScreen />);
  expect(screen.getByText('Громова Мия')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull();
  expect(dispatch).not.toHaveBeenCalled();
});
