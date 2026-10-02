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
  // Как в expo-router: вкладка с href: null в панели не показывается
  Tabs.Screen = function MockTabsScreen({ name, options }: { name: string; options?: { href?: null } }) {
    return options?.href === null ? null : React.createElement(Native.Text, null, name);
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
  birthDate: null,
  phone: null,
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

  it('shows the administrator every tab and loads registration requests', async () => {
    const dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
    const screen = await renderLayout({ ...initialAuthState, phase: 'authenticated', user: admin, mode: 'admin' });

    for (const tab of ['visits', 'requests', 'garden', 'people/index', 'more/index']) {
      expect(screen.getByText(tab)).toBeTruthy();
    }
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'requests/loadRequestsStart' }));
  });

  it('gives an employee only visits and more, without registration requests', async () => {
    const dispatch = jest.fn();
    mockUseAppDispatch.mockReturnValue(dispatch);
    const screen = await renderLayout({
      ...initialAuthState,
      phase: 'authenticated',
      user: { ...admin, role: 'EMPLOYEE' },
      mode: 'admin',
    });

    expect(screen.getByText('visits')).toBeTruthy();
    expect(screen.getByText('more/index')).toBeTruthy();
    expect(screen.queryByText('requests')).toBeNull();
    expect(screen.queryByText('garden')).toBeNull();
    expect(screen.queryByText('people/index')).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
