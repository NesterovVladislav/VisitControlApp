import { act, fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';

import PeopleScreen from '../app/(admin)/people';
import { useAppDispatch, useAppSelector } from '../store';
import { loadPeople } from '../store/reducers/people';
import { PeopleState, Person } from '../store/types/people';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('../components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const dispatch = jest.fn();

const base: Omit<Person, 'id' | 'firstName'> = {
  surname: 'Иванова',
  patronymic: null,
  role: 'PARENT',
  gender: 'FEMALE',
  birthDate: null,
  phone: null,
  email: null,
  group: null,
  present: null,
  children: null,
};

function givenPeople(people: Partial<PeopleState>, viewerRole = 'ADMIN') {
  const state: PeopleState = {
    query: { category: 'CHILD', q: '', groupFilter: { kind: 'all' } },
    items: [],
    total: 0,
    status: 'loaded',
    refreshing: false,
    page: 0,
    last: true,
    loadingMore: false,
    loadMoreFailed: false,
    requestId: 1,
    passwordReset: null,
    deactivation: null,
    roleChange: null,
    filterOptions: { status: 'loaded', groups: [], branches: [{ id: 'b1', name: 'Центральный' }] },
    ...people,
  };
  const auth = { user: { id: 'me', role: viewerRole } };
  const childLink = { adult: null, q: '', candidates: [], status: 'idle', requestId: 0, link: null };
  mockUseAppSelector.mockImplementation((selector) => selector({ people: state, auth, childLink } as never));
  return state;
}

describe('PeopleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(dispatch);
  });

  it('shows children with group, age and presence', async () => {
    givenPeople({
      total: 1,
      items: [{
        ...base,
        id: 'c1',
        firstName: 'Мария',
        role: 'VISITOR',
        present: true,
        group: { id: 'g1', name: 'Солнышко', branchId: 'b1', branchName: 'Центральный' },
      }],
    });
    const screen = await render(<PeopleScreen />);

    expect(screen.getByText('1 ребёнок')).toBeTruthy();
    expect(screen.getByText('Иванова Мария')).toBeTruthy();
    expect(screen.getByText(/^Солнышко/)).toBeTruthy();
    expect(screen.getByLabelText('В саду')).toBeTruthy();
    expect(screen.getByText('Все группы')).toBeTruthy();
  });

  it('shows who a parent is to the children and calls them', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    givenPeople({
      query: { category: 'PARENT', q: '', groupFilter: { kind: 'all' } },
      total: 1,
      items: [{
        ...base,
        id: 'p1',
        firstName: 'Анна',
        phone: '+79123456789',
        children: [{ id: 'c1', firstName: 'Мария', surname: 'Иванова', linkRole: 'PARENT' }],
      }],
    });
    const screen = await render(<PeopleScreen />);

    expect(screen.getByText('мама: Мария')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Позвонить: Иванова Анна'));
    expect(openURL).toHaveBeenCalledWith('tel:+79123456789');
    expect(screen.queryByText('Все группы')).toBeNull();
  });

  it('switches the group keeping the search text', async () => {
    const state = givenPeople({ query: { category: 'CHILD', q: 'иван', groupFilter: { kind: 'all' } } });
    const screen = await render(<PeopleScreen />);

    await fireEvent.press(screen.getByText('Сотрудники'));

    expect(dispatch).toHaveBeenCalledWith(loadPeople({ query: { ...state.query, category: 'STAFF' } }));
  });

  it('searches after the user stops typing', async () => {
    jest.useFakeTimers();
    try {
      const state = givenPeople({});
      const screen = await render(<PeopleScreen />);
      dispatch.mockClear();

      await fireEvent.changeText(screen.getByLabelText('Поиск'), 'Ива');
      await fireEvent.changeText(screen.getByLabelText('Поиск'), 'Иванова');
      expect(dispatch).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(loadPeople({ query: { ...state.query, q: 'Иванова' } }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('explains an empty search result', async () => {
    givenPeople({ query: { category: 'PARENT', q: 'Иваноа', groupFilter: { kind: 'all' } } });
    const screen = await render(<PeopleScreen />);
    expect(screen.getByText('Никого не нашли по запросу «Иваноа»')).toBeTruthy();
  });

  it('opens the person card from a row', async () => {
    givenPeople({
      query: { category: 'PARENT', q: '', groupFilter: { kind: 'all' } },
      total: 1,
      items: [{ ...base, id: 'p1', firstName: 'Анна' }],
    });
    const screen = await render(<PeopleScreen />);

    await fireEvent.press(screen.getByLabelText('Открыть карточку: Иванова Анна'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/people/[id]', params: { id: 'p1' } });
  });
});
