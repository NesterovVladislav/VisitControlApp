import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import MoreScreen from '../../app/(admin)/more';
import { useAppDispatch, useAppSelector } from '../../store';
import { logoutRequested } from '../../store/reducers/auth';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const dispatch = jest.fn();

describe('administrator account menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(dispatch);
    mockUseAppSelector.mockImplementation((selector) =>
      selector({ children: { items: [] } } as never),
    );
  });

  it('uses protected-session cleanup when the administrator confirms logout', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      const screen = await render(<MoreScreen />);
      fireEvent.press(screen.getByText('Выйти'));

      const buttons = alert.mock.calls[0][2];
      const confirm = buttons?.find((button) => button.text === 'Выйти');
      confirm?.onPress?.();

      expect(dispatch).toHaveBeenCalledWith(logoutRequested({ reason: 'user' }));
    } finally {
      alert.mockRestore();
    }
  });
});
