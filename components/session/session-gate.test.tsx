import { render, waitFor } from '@testing-library/react-native';
import { useSessionLifecycle } from '../../hooks/use-session-lifecycle';
import { useAppDispatch, useAppSelector } from '../../store';
import { bootstrapSession } from '../../store/reducers/auth';
import { AuthState } from '../../store/types/auth';
import { SessionGate } from './session-gate';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('../../hooks/use-session-lifecycle', () => ({
  useSessionLifecycle: jest.fn(),
}));
jest.mock('./privacy-shield', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  return {
    PrivacyShield: () => React.createElement(Native.View, { testID: 'privacy-shield' }),
  };
});
jest.mock('./create-pin-screen', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  return {
    CreatePinScreen: () => React.createElement(Native.View, { testID: 'create-pin-screen' }),
  };
});
jest.mock('./biometric-setup-screen', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  return {
    BiometricSetupScreen: () => React.createElement(Native.View, { testID: 'biometric-setup-screen' }),
  };
});
jest.mock('./unlock-screen', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  return {
    UnlockScreen: () => React.createElement(Native.View, { testID: 'unlock-screen' }),
  };
});
jest.mock('./storage-error-screen', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  return {
    StorageErrorScreen: () => React.createElement(Native.View, { testID: 'storage-error-screen' }),
  };
});
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const Native = jest.requireActual('react-native');
  const Stack = ({ children }: { children: React.ReactNode }) => (
    <Native.View>{children}</Native.View>
  );
  Stack.Screen = function MockStackScreen({ name }: { name: string }) {
    return <Native.Text testID={'route-' + name}>{name}</Native.Text>;
  };
  Stack.Protected = function MockStackProtected({
    children,
    guard,
  }: {
    children: React.ReactNode;
    guard: boolean;
  }) {
    return guard ? <>{children}</> : null;
  };
  return { Stack };
});

const mockDispatch = jest.fn();
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const mockUseSessionLifecycle = useSessionLifecycle as jest.MockedFunction<
  typeof useSessionLifecycle
>;

const baseState: AuthState = {
  phase: 'bootstrapping',
  setupStep: null,
  isLoading: true,
  error: null,
  notice: null,
  user: null,
  biometricsAvailable: false,
  biometricsEnabled: false,
  remainingPinAttempts: 5,
  sessionEpoch: 0,
  mode: 'parent',
  selectedModeOwnerId: null,
};
let authState = baseState;

async function renderGate(next: Partial<AuthState>) {
  authState = { ...baseState, ...next };
  return render(<SessionGate />);
}

describe('SessionGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState = baseState;
    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseAppSelector.mockImplementation((selector) =>
      selector({ auth: authState } as never),
    );
    mockUseSessionLifecycle.mockReturnValue({ privacyShieldVisible: false });
  });

  it.each([
    [{ phase: 'bootstrapping' }, 'privacy-shield'],
    [{ phase: 'unauthenticated' }, 'public-navigation'],
    [{ phase: 'pinSetupRequired', setupStep: 'createPin' }, 'create-pin-screen'],
    [{ phase: 'pinSetupRequired', setupStep: 'offerBiometrics' }, 'biometric-setup-screen'],
    [{ phase: 'locked' }, 'unlock-screen'],
    [{ phase: 'validating' }, 'unlock-screen'],
    [{ phase: 'validationUnavailable' }, 'unlock-screen'],
    [{ phase: 'storageUnavailable' }, 'storage-error-screen'],
    [{ phase: 'authenticated' }, 'protected-navigation'],
  ] as const)('renders %j without a protected-content flash', async (state, expected) => {
    const screen = await renderGate(state);
    expect(screen.getByTestId(expected)).toBeTruthy();
    if (state.phase !== 'authenticated') {
      expect(screen.queryByTestId('protected-navigation')).toBeNull();
    }
  });

  it('dispatches bootstrap only once across rerenders', async () => {
    const screen = await renderGate({ phase: 'bootstrapping' });
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(bootstrapSession()));
    await screen.rerender(<SessionGate />);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('does not mount deep-linked protected routes outside authenticated phase', async () => {
    const publicGate = await renderGate({ phase: 'unauthenticated' });
    expect(publicGate.getByTestId('route-register')).toBeTruthy();
    expect(publicGate.queryByTestId('route-children')).toBeNull();
    expect(publicGate.queryByTestId('route-menu')).toBeNull();
    expect(publicGate.queryByTestId('route-(admin)')).toBeNull();

    await publicGate.unmount();
    const lockedGate = await renderGate({ phase: 'locked' });
    expect(lockedGate.queryByTestId('route-register')).toBeNull();
    expect(lockedGate.queryByTestId('route-children')).toBeNull();
    expect(lockedGate.queryByTestId('route-(admin)')).toBeNull();
  });

  it('mounts protected routes only after backend validation succeeds', async () => {
    const screen = await renderGate({ phase: 'authenticated' });
    expect(screen.getByTestId('route-children')).toBeTruthy();
    expect(screen.getByTestId('route-menu')).toBeTruthy();
    expect(screen.getByTestId('route-(admin)')).toBeTruthy();
    expect(screen.queryByTestId('route-register')).toBeNull();
  });

  it('covers authenticated navigation with the privacy shield while backgrounded', async () => {
    mockUseSessionLifecycle.mockReturnValue({ privacyShieldVisible: true });
    const screen = await renderGate({ phase: 'authenticated' });
    expect(screen.getByTestId('protected-navigation')).toBeTruthy();
    expect(screen.getByTestId('privacy-shield')).toBeTruthy();
  });

  it('setup and lock states mount no router, so back gestures cannot bypass them', async () => {
    const setup = await renderGate({ phase: 'pinSetupRequired', setupStep: 'createPin' });
    expect(setup.queryByTestId('route-index')).toBeNull();
    await setup.unmount();

    const locked = await renderGate({ phase: 'locked' });
    expect(locked.queryByTestId('route-index')).toBeNull();
  });
});
