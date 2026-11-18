import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import PasswordResetScreen from '../../app/password-reset';
import { palettes } from '../../constants/palette';
import { visitControlApi } from '../../services/api/visit-control-api';
import { PasswordResetError } from '../../services/api/password-reset-contract';
import { prefillPasswordResetEmail } from '../../services/auth/password-reset-email';
import { passwordResetSignIn } from '../../store/reducers/auth';

const mockDispatch = jest.fn();
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useRouter: () => ({ canGoBack: () => true, back: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../../store', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => false,
}));
jest.mock('../../services/api/visit-control-api', () => ({
  visitControlApi: {
    requestPasswordReset: jest.fn(),
    verifyPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
  },
}));

const api = jest.mocked(visitControlApi);

describe('PasswordResetScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.requestPasswordReset.mockResolvedValue({ resend_after_sec: 60, code_ttl_sec: 900 });
    api.verifyPasswordReset.mockResolvedValue({ reset_token: 'synthetic-reset', expires_in_sec: 600 });
    api.confirmPasswordReset.mockResolvedValue('synthetic-access');
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['light', 'dark'] as const)('recovers a password in the %s theme', async (scheme) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
    prefillPasswordResetEmail(' Parent@example.org ');
    const screen = await render(<PasswordResetScreen />);
    expect(screen.getByLabelText('Email')).toHaveProp('value', 'Parent@example.org');
    expect(screen.getByText('Получить код')).toHaveStyle({ color: palettes[scheme].onActionPrimary });
    await fireEvent.press(screen.getByRole('button', { name: 'Получить код' }));
    expect(api.requestPasswordReset).toHaveBeenCalledWith('parent@example.org', expect.anything());
    await fireEvent.changeText(screen.getByLabelText('Код из письма'), '012 345');

    expect(api.verifyPasswordReset).toHaveBeenCalledWith('parent@example.org', '012345', expect.anything());
    expect(api.verifyPasswordReset).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(screen.getByLabelText('Новый пароль'), ' new-password ');
    await fireEvent.changeText(screen.getByLabelText('Повторите пароль'), 'different');
    expect(screen.getByRole('button', { name: 'Сохранить и войти' })).toBeDisabled();
    expect(screen.getByText('Пароли должны совпадать')).toBeVisible();
    expect(screen.queryByText('Пароли совпадают')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Повторите пароль'), ' new-password ');
    expect(screen.getByText('✓ Пароли совпадают')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Сохранить и войти' }));
    expect(api.confirmPasswordReset).toHaveBeenCalledWith('synthetic-reset', ' new-password ', expect.anything());
    expect(screen.getByText('Пароль изменён')).toBeVisible();

    await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
    expect(mockDispatch).toHaveBeenCalledWith(passwordResetSignIn({ accessToken: 'synthetic-access' }));
  });

  it('shows attempts left and supports requesting a new code after expiry', async () => {
    api.verifyPasswordReset.mockRejectedValueOnce(new PasswordResetError(400, 'RESET_CODE_INVALID', 2))
      .mockRejectedValueOnce(new PasswordResetError(410));
    const screen = await render(<PasswordResetScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'parent@example.org');
    await fireEvent.press(screen.getByRole('button', { name: 'Получить код' }));
    await fireEvent.changeText(screen.getByLabelText('Код из письма'), '000001');
    expect(screen.getByText('Неверный код. Осталось попыток: 2')).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Код из письма')).toHaveProp('value', ''), { timeout: 2000 });

    await fireEvent.changeText(screen.getByLabelText('Код из письма'), '000002');
    await fireEvent.press(screen.getByRole('button', { name: 'Получить новый код' }));
    expect(api.requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Код из письма')).toHaveProp('value', '');
  });
});
