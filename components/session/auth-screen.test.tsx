import { render } from '@testing-library/react-native';

import { useAppDispatch, useAppSelector } from '../../store';
import AuthScreen from '../../app/auth';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

describe('AuthScreen session notice', () => {
  it('shows why a protected session returned to full sign-in', async () => {
    mockUseAppDispatch.mockReturnValue(jest.fn());
    mockUseAppSelector.mockImplementation((selector) => selector({
      auth: {
        isLoading: false,
        error: null,
        notice: 'Сессия истекла. Войдите снова',
      },
    } as never));

    const screen = await render(<AuthScreen />);
    expect(screen.getByText('Сессия истекла. Войдите снова')).toBeTruthy();
  });
});
