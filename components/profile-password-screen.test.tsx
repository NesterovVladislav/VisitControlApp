import { fireEvent, render } from '@testing-library/react-native';

import ChangePasswordScreen from '../app/profile/password';
import { useAppDispatch, useAppSelector } from '../store';
import { changePasswordStart } from '../store/reducers/profile';
import { PASSWORD_MESSAGES } from '../utils/password-validation';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const dispatch = jest.fn();

function renderScreen(profile: Record<string, unknown> = {}) {
  mockUseAppSelector.mockImplementation((selector) =>
    selector({
      profile: {
        refreshing: false,
        passwordStatus: 'idle',
        passwordFieldErrors: {},
        passwordError: null,
        ...profile,
      },
    } as never),
  );
  return render(<ChangePasswordScreen />);
}

async function fill(screen: Awaited<ReturnType<typeof renderScreen>>, current: string, next: string, confirm: string) {
  await fireEvent.changeText(screen.getByLabelText('Текущий пароль'), current);
  await fireEvent.changeText(screen.getByLabelText('Новый пароль'), next);
  await fireEvent.changeText(screen.getByLabelText('Повторите новый пароль'), confirm);
}

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(dispatch);
  });

  it('sends the current and the new password', async () => {
    const screen = await renderScreen();
    await fill(screen, 'old-password', 'new-password', 'new-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Сменить пароль' }));

    expect(dispatch).toHaveBeenCalledWith(
      changePasswordStart({ currentPassword: 'old-password', newPassword: 'new-password' }),
    );
  });

  it('does not send a form with mismatched passwords', async () => {
    const screen = await renderScreen();
    await fill(screen, 'old-password', 'new-password', 'new-passwort');
    await fireEvent.press(screen.getByRole('button', { name: 'Сменить пароль' }));

    expect(screen.getByText(PASSWORD_MESSAGES.mismatch)).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: changePasswordStart.type }));
  });

  it('shows the server error under the current password', async () => {
    const screen = await renderScreen({ passwordFieldErrors: { currentPassword: 'Неверный текущий пароль' } });
    expect(screen.getByText('Неверный текущий пароль')).toBeTruthy();
  });

  it('hides passwords until the eye is pressed', async () => {
    const screen = await renderScreen();
    expect(screen.getByLabelText('Текущий пароль').props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getAllByLabelText('Показать пароль')[0]);

    expect(screen.getByLabelText('Текущий пароль').props.secureTextEntry).toBe(false);
  });
});
