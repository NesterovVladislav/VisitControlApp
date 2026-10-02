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
  birthDate: '1990-03-14',
  phone: '+79123456789',
  role: 'PARENT',
};

function renderProfile(role: string) {
  mockHeaderRight = undefined;
  mockUseAppSelector.mockImplementation((selector) =>
    selector({ auth: { user: { ...user, role } }, profile: { refreshing: false } } as never),
  );
  return render(<ProfileScreen />);
}

describe('who can change personal data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it('lets an administrator open the edit screen', async () => {
    const screen = await renderProfile('ADMIN');
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
