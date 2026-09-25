import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  logoutRequested,
  retrySessionValidation,
  unlockWithBiometrics,
  unlockWithPin,
} from '../../store/reducers/auth';
import { UnlockScreen } from './unlock-screen';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
let authState = {
  phase: 'locked',
  isLoading: false,
  error: null as string | null,
  biometricsEnabled: true,
  remainingPinAttempts: 5,
};

async function enterPin(screen: Awaited<ReturnType<typeof render>>, pin: string) {
  for (const digit of pin) {
    await fireEvent.press(screen.getByLabelText('Цифра ' + digit));
  }
}

describe('UnlockScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState = {
      phase: 'locked',
      isLoading: false,
      error: null,
      biometricsEnabled: true,
      remainingPinAttempts: 5,
    };
    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseAppSelector.mockImplementation((selector) =>
      selector({ auth: authState } as never),
    );
  });

  it('requests enabled biometrics automatically only once', async () => {
    const screen = await render(<UnlockScreen />);
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(unlockWithBiometrics()));
    await screen.rerender(<UnlockScreen />);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('offers manual biometric retry while keeping PIN available', async () => {
    const screen = await render(<UnlockScreen />);
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    mockDispatch.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Использовать биометрию' }));
    expect(mockDispatch).toHaveBeenCalledWith(unlockWithBiometrics());
    expect(screen.getByLabelText('Цифра 1')).toBeTruthy();
  });

  it('submits a complete PIN and shows remaining attempts', async () => {
    authState = { ...authState, biometricsEnabled: false, remainingPinAttempts: 3 };
    const screen = await render(<UnlockScreen />);
    expect(screen.getByText('Осталось попыток: 3')).toBeTruthy();
    await enterPin(screen, '1234');
    expect(mockDispatch).toHaveBeenCalledWith(unlockWithPin({ pin: '1234' }));
  });

it('allows switching to full sign-in from the normal lock screen', async () => {
  authState = { ...authState, biometricsEnabled: false };
  const screen = await render(<UnlockScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Войти по email и паролю' }));
  expect(mockDispatch).toHaveBeenCalledWith(
    logoutRequested({ reason: 'switchAccount' }),
  );
});

it('warns before the fifth failed attempt', async () => {
    authState = { ...authState, biometricsEnabled: false, remainingPinAttempts: 1 };
    const screen = await render(<UnlockScreen />);
    expect(screen.getByText('Последняя попытка')).toBeTruthy();
  });

  it('keeps cancellation and biometric errors on the PIN screen', async () => {
    authState = {
      ...authState,
      biometricsEnabled: false,
      error: 'Биометрия сейчас недоступна. Используйте PIN-код',
    };
    const screen = await render(<UnlockScreen />);
    expect(screen.getByText(authState.error!)).toBeTruthy();
    expect(screen.getByLabelText('Цифра 1')).toBeTruthy();
  });

  it('shows a validation spinner without the PIN pad', async () => {
    authState = { ...authState, phase: 'validating', isLoading: true };
    const screen = await render(<UnlockScreen />);
    expect(screen.getByText('Проверяем сессию')).toBeTruthy();
    expect(screen.queryByLabelText('Цифра 1')).toBeNull();
  });

  it('offers retry and full sign-in when validation is unavailable', async () => {
    authState = {
      ...authState,
      phase: 'validationUnavailable',
      isLoading: false,
      error: 'Не удалось проверить сессию. Проверьте интернет и повторите',
    };
    const screen = await render(<UnlockScreen />);

    expect(screen.getByText('Не удалось проверить сессию')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Повторить проверку' }));
    expect(mockDispatch).toHaveBeenCalledWith(retrySessionValidation());

    mockDispatch.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Войти по email и паролю' }));
    expect(mockDispatch).toHaveBeenCalledWith(logoutRequested({ reason: 'switchAccount' }));
  });
});
