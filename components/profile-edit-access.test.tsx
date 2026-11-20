import { fireEvent, render } from '@testing-library/react-native';

import ParentAccount from './parent-account';
import AboutScreen from '../app/profile/about';
import ProfileDetails from '../app/profile/details';
import ProfileScreen from '../app/profile';
import { useAttendanceToday, useOwnAttendance } from '../hooks/use-own-attendance';
import { useAppDispatch, useAppSelector } from '../store';
import { switchMode } from '../store/reducers/auth';
import { User } from '../store/types/auth';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockHeaderRight: (() => React.ReactNode) | undefined;

jest.mock('../hooks/use-own-attendance', () => ({
  ...jest.requireActual('../hooks/use-own-attendance'),
  useAttendanceToday: jest.fn(),
  useOwnAttendance: jest.fn(),
}));
jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('../utils/app-version', () => ({ getAppVersion: () => ({ version: '1.0.2', build: '3' }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => React.ReactNode } }) => {
      mockHeaderRight = options.headerRight;
      return null;
    },
  },
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

const user: User = {
  id: 'user-1',
  email: 'anna@example.test',
  firstName: 'Анна',
  surname: 'Иванова',
  patronymic: null,
  gender: 'FEMALE',
  organization: null,
  birthDate: '1990-03-14',
  phone: '+79123456789',
  role: 'PARENT',
};

const noRequests = { own: [], ownChildren: null, cancellingIds: [], error: null };

function renderProfile(role: string, state: { children?: object[]; childRequests?: object } = {}) {
  mockHeaderRight = undefined;
  mockUseAppSelector.mockImplementation((selector) =>
    selector({
      auth: { user: { ...user, role } },
      profile: { refreshing: false },
      children: { items: state.children ?? [], listStatus: 'loaded' },
      childRequests: state.childRequests ?? noRequests,
      photos: { own: [], pending: [], busyUserIds: [], cancellingIds: [], decidingIds: [], error: null },
    } as never),
  );
  return render(<ProfileScreen />);
}

describe('application version in the profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it.each(['PARENT', 'EMPLOYEE', 'ADMIN', 'DIRECTOR', 'TECH_ADMIN'])('shows a copyable version for %s', async (role) => {
    const screen = await renderProfile(role);
    expect(screen.queryByText('1.0.2')).toBeNull();
    await fireEvent.press(screen.getByText('О приложении'));
    expect(mockPush).toHaveBeenCalledWith('/profile/about');
    await screen.rerender(<AboutScreen />);
    expect(screen.getByText('1.0.2').props.selectable).toBe(true);
    expect(screen.getByText('3').props.selectable).toBe(true);
  });
});

describe('editing own personal data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it.each(['PARENT', 'EMPLOYEE', 'ADMIN', 'DIRECTOR', 'TECH_ADMIN'])('lets %s open the edit screen', async (role) => {
    const screen = await renderProfile(role);
    expect(mockHeaderRight).toBeDefined();
    expect(screen.queryByText(/Изменить личные данные может только администратор/)).toBeNull();

    const header = await render(<>{mockHeaderRight?.()}</>);
    await fireEvent.press(header.getByText('Изменить'));
    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
  });

});

describe('own children in the profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it.each(['PARENT', 'EMPLOYEE', 'ADMIN', 'DIRECTOR'])('lets %s add a child: staff can be parents too', async (role) => {
    const screen = await renderProfile(role);

    await fireEvent.press(screen.getByText('Добавить ребёнка'));

    expect(mockPush).toHaveBeenCalledWith('/profile/add-child');
  });

  it('has no children section for the technical administrator, who is not in a kindergarten', async () => {
    const screen = await renderProfile('TECH_ADMIN');

    expect(screen.queryByText('МОИ ДЕТИ')).toBeNull();
    expect(screen.queryByText('Добавить ребёнка')).toBeNull();
  });

  it('shows linked children and own requests with their state', async () => {
    const dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
    const request = (id: string, firstName: string, status: string) => ({
      id,
      status,
      surname: 'Иванов',
      firstName,
      patronymic: null,
      birthDate: '2021-03-12',
      gender: 'MALE',
      applicantName: null,
      applicantRole: null,
      matches: [],
    });
    const screen = await renderProfile('PARENT', {
      children: [{ id: 'c1', firstName: 'Мария', surname: 'Иванова', linkRole: 'PARENT' }],
      childRequests: {
        ...noRequests,
        own: [request('r1', 'Петя', 'PENDING'), request('r2', 'Олег', 'REJECTED')],
      },
    });

    expect(screen.getByText('Иванова Мария')).toBeTruthy();
    expect(screen.getByText('Иванов Петя')).toBeTruthy();
    expect(screen.getByText('Ждёт подтверждения сада')).toBeTruthy();
    expect(screen.getByText('Сад не добавил ребёнка')).toBeTruthy();
    // Отозвать можно только заявку, которая ещё ждёт
    expect(screen.getAllByText('Отозвать')).toHaveLength(1);
  });
});

describe('parent account navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it('keeps contact details off the tab and opens them before editing', async () => {
    const screen = await renderProfile('PARENT');
    await screen.rerender(<ParentAccount />);
    expect(screen.queryByText(user.email)).toBeNull();
    await fireEvent.press(screen.getByText('Личные данные'));
    expect(mockPush).toHaveBeenCalledWith('/profile/details');
    await screen.rerender(<ProfileDetails />);
    expect(screen.getByText(user.email)).toBeTruthy();
    expect(screen.getByText('14.03.1990')).toBeTruthy();
    await fireEvent.press(screen.getByText('Редактировать'));
    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
  });

  it('displays the current group and a pending change together for the right child', async () => {
    const today = '2026-11-20';
    const groups = [
      { name: 'Старая группа', branch: null, from: '2026-07-01', to: '2026-11-19' },
      { name: 'Новая группа', branch: 'Филиал', from: today, to: null },
    ];
    jest.mocked(useAttendanceToday).mockReturnValue({ key: today, value: today });
    jest.mocked(useOwnAttendance).mockReturnValue({ key: today, value: [{
      id: 'c1', name: 'Иванова Мария', groups, days: [],
      summary: { full: 0, half: 0, absent: 0, paid: 0, reasons: [] },
    }] });
    const child = { id: 'c1', surname: 'Иванова', firstName: 'Мария', linkRole: 'PARENT' };
    const screen = await renderProfile('PARENT', { children: [child], childRequests: {
      ...noRequests, ownChildren: [{ ...child, change: { status: 'PENDING' } }],
    } });
    await screen.rerender(<ParentAccount />);
    expect(screen.queryByText('Старая группа')).toBeNull();
    expect(screen.getByText('Новая группа · Филиал')).toBeVisible();
    expect(screen.getByText(/изменение|подтверждени/i)).toBeVisible();
    await fireEvent.press(screen.getByText('Иванова Мария'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/profile/child/[id]', params: { id: 'c1' } });
  });

  it('keeps settings and staff mode reachable from the tab', async () => {
    const dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
    const screen = await renderProfile('EMPLOYEE');
    await screen.rerender(<ParentAccount />);
    expect(screen.queryByText('1.0.2')).toBeNull();
    await fireEvent.press(screen.getByText('О приложении'));
    expect(mockPush).toHaveBeenCalledWith('/profile/about');
    await fireEvent.press(screen.getByText('Сменить пароль'));
    expect(mockPush).toHaveBeenCalledWith('/profile/password');
    expect(screen.getByText('Системная')).toBeTruthy();
    await fireEvent.press(screen.getByText('Тема'));
    expect(mockPush).toHaveBeenCalledWith('/profile/theme');
    await fireEvent.press(screen.getByRole('button', { name: 'Добавить ребёнка' }));
    expect(mockPush).toHaveBeenCalledWith('/profile/add-child');
    await fireEvent.press(screen.getByText('Режим сотрудника'));
    expect(dispatch).toHaveBeenCalledWith(switchMode('admin'));
    expect(mockReplace).toHaveBeenCalledWith('/visits');
  });
});
