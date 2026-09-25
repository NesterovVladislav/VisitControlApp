import { render } from '@testing-library/react-native';

import Index from '../../app/index';
import { useAppSelector } from '../../store';
import { initialAuthState } from '../../store/reducers/auth';
import { AuthState } from '../../store/types/auth';

jest.mock('../../store', () => ({
  useAppSelector: jest.fn(),
}));
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Native.Text, { testID: 'redirect' }, href),
  };
});

const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const admin = {
  id: 'admin-1',
  email: 'admin@example.test',
  firstName: 'Admin',
  surname: 'Example',
  patronymic: null,
  gender: null,
  role: 'ADMIN',
} as const;

function renderIndex(auth: AuthState) {
  mockUseAppSelector.mockImplementation((selector) => selector({ auth } as never));
  return render(<Index />);
}

describe('session landing route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the administrator workspace after a validated admin session', async () => {
    const screen = await renderIndex({
      ...initialAuthState,
      phase: 'authenticated',
      user: admin,
      mode: 'admin',
    });
    expect(screen.getByTestId('redirect').props.children).toBe('/visits');
  });

  it('opens parent children when an administrator selected parent mode', async () => {
    const screen = await renderIndex({
      ...initialAuthState,
      phase: 'authenticated',
      user: admin,
      mode: 'parent',
    });
    expect(screen.getByTestId('redirect').props.children).toBe('/children');
  });

  it('opens public login after the session is cleared', async () => {
    const screen = await renderIndex({ ...initialAuthState, phase: 'unauthenticated' });
    expect(screen.getByTestId('redirect').props.children).toBe('/auth');
  });
});
