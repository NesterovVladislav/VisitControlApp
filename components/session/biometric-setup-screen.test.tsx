import { fireEvent, render } from '@testing-library/react-native';

import { useAppDispatch, useAppSelector } from '../../store';
import { submitBiometricPreference } from '../../store/reducers/auth';
import { BiometricSetupScreen } from './biometric-setup-screen';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
let authState = {
  biometricsAvailable: true,
  isLoading: false,
};

describe('BiometricSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState = { biometricsAvailable: true, isLoading: false };
    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseAppSelector.mockImplementation((selector) =>
      selector({ auth: authState } as never),
    );
  });

  it('allows enabling or skipping available biometrics', async () => {
    const screen = await render(<BiometricSetupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Включить биометрию' }));
    expect(mockDispatch).toHaveBeenCalledWith(submitBiometricPreference({ enabled: true }));

    mockDispatch.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Не сейчас' }));
    expect(mockDispatch).toHaveBeenCalledWith(submitBiometricPreference({ enabled: false }));
  });

  it('hides the biometric offer when capability is unavailable', async () => {
    authState = { biometricsAvailable: false, isLoading: false };
    const screen = await render(<BiometricSetupScreen />);

    expect(screen.queryByText('Включить биометрию')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
    expect(mockDispatch).toHaveBeenCalledWith(submitBiometricPreference({ enabled: false }));
  });
});
