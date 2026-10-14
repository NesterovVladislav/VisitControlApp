import { fireEvent, render } from '@testing-library/react-native';

import ProfileScreen from '../app/profile';
import { useAppDispatch, useAppSelector } from '../store';
import { User } from '../store/types/auth';

const mockPush = jest.fn();
let mockHeaderRight: (() => React.ReactNode) | undefined;

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('../utils/app-version', () => ({ getAppVersionLabel: () => 'Версия 1.0.2 · сборка 3' }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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
    expect(screen.getByText('Версия 1.0.2 · сборка 3').props.selectable).toBe(true);
  });
});

describe('who can change personal data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it.each(['ADMIN', 'DIRECTOR'])('lets %s open the edit screen', async (role) => {
    const screen = await renderProfile(role);
    expect(mockHeaderRight).toBeDefined();
    expect(screen.queryByText(/Изменить личные данные может только администратор/)).toBeNull();

    const header = await render(<>{mockHeaderRight?.()}</>);
    await fireEvent.press(header.getByText('Изменить'));
    expect(mockPush).toHaveBeenCalledWith('/profile/edit');
  });

  it.each(['PARENT', 'EMPLOYEE'])('sends %s to the administrator instead', async (role) => {
    const screen = await renderProfile(role);
    expect(mockHeaderRight).toBeUndefined();
    expect(screen.getByText(/Изменить личные данные может только администратор/)).toBeTruthy();
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
