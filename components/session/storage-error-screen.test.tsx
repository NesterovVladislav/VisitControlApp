import { fireEvent, render } from '@testing-library/react-native';

import { useAppDispatch } from '../../store';
import { retryProtectedStorage } from '../../store/reducers/auth';
import { StorageErrorScreen } from './storage-error-screen';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;

describe('StorageErrorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(mockDispatch);
  });

  it('offers only protected-storage retry and no navigation bypass', async () => {
    const screen = await render(<StorageErrorScreen />);
    expect(screen.getByText('Защищённое хранилище недоступно')).toBeTruthy();
    expect(screen.queryByText(/войти по email/i)).toBeNull();
    expect(screen.queryByText(/продолжить/i)).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
    expect(mockDispatch).toHaveBeenCalledWith(retryProtectedStorage());
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
