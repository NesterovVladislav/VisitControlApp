import { render } from '@testing-library/react-native';

import AdminLayout from '../../app/(admin)/_layout';
import { useAppDispatch, useAppSelector } from '../../store';
import { initialAuthState } from '../../store/reducers/auth';
import { AuthState } from '../../store/types/auth';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/components/haptic-tab', () => ({ HapticTab: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Native.View, { testID: 'admin-tabs' }, children);
  Tabs.Screen = function MockTabsScreen({ name }: { name: string }) {
    return React.createElement(Native.Text, null, name);
  };
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Native.Text, { testID: 'redirect' }, href),
    Tabs,
  };
});

const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const admin = {
  id: 'admin-1',
  email: 'admin@example.test',
  firstName: 'Admin',
  surname: 'Example',
  patronymic: null,
  gender: null,
  role: 'ADMIN',
} as const;

async function renderLayout(auth: AuthState) {
  mockUseAppSelector.mockImplementation((selector) =>
    selector({ auth, requests: { total: 0 } } as never),
  );
  return render(<AdminLayout />);
}

describe('administrator route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(jest.fn());
  });

  it('opens admin tabs only after successful backend validation', async () => {
    const screen = await renderLayout({
      ...initialAuthState,
      phase: 'authenticated',
      user: admin,
      mode: 'admin',
    });
    expect(screen.getByTestId('admin-tabs')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('redirects an authenticated parent away from administrator tabs', async () => {
    const screen = await renderLayout({
      ...initialAuthState,
      phase: 'authenticated',
      user: { ...admin, role: 'PARENT' },
      mode: 'parent',
    });
    expect(screen.getByTestId('redirect').props.children).toBe('/children');
    expect(screen.queryByTestId('admin-tabs')).toBeNull();
  });

  it('keeps an administrator in parent mode out of admin tabs', async () => {
    const screen = await renderLayout({
      ...initialAuthState,
      phase: 'authenticated',
      user: admin,
      mode: 'parent',
    });
    expect(screen.getByTestId('redirect').props.children).toBe('/children');
    expect(screen.queryByTestId('admin-tabs')).toBeNull();
  });

  it('renders no administrator content while the session is locked', async () => {
    const screen = await renderLayout({
      ...initialAuthState,
      phase: 'locked',
      user: null,
    });
    expect(screen.queryByTestId('admin-tabs')).toBeNull();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
