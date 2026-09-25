import { fireEvent, render } from '@testing-library/react-native';

import { useAppDispatch, useAppSelector } from '../../store';
import { completePinSetup } from '../../store/reducers/auth';
import { CreatePinScreen } from './create-pin-screen';

jest.mock('../../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

async function enterPin(screen: Awaited<ReturnType<typeof render>>, pin: string) {
  for (const digit of pin) {
    await fireEvent.press(screen.getByLabelText('Цифра ' + digit));
  }
}

describe('CreatePinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseAppSelector.mockImplementation((selector) =>
      selector({ auth: { isLoading: false } } as never),
    );
  });

  it('requires first entry and confirmation before dispatching', async () => {
    const screen = await render(<CreatePinScreen />);
    expect(screen.getByText('Создайте PIN-код')).toBeTruthy();

    await enterPin(screen, '1234');
    expect(screen.getByText('Повторите PIN-код')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();

    await enterPin(screen, '1234');
    expect(mockDispatch).toHaveBeenCalledWith(completePinSetup({ pin: '1234' }));
  });

  it('resets both entries after a mismatch', async () => {
    const screen = await render(<CreatePinScreen />);
    await enterPin(screen, '1234');
    await enterPin(screen, '1111');

    expect(screen.getByText('PIN-коды не совпали. Попробуйте ещё раз')).toBeTruthy();
    expect(screen.getByText('Создайте PIN-код')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('has no setup bypass control', async () => {
    const screen = await render(<CreatePinScreen />);
    expect(screen.queryByText(/пропустить/i)).toBeNull();
    expect(screen.queryByText(/назад/i)).toBeNull();
  });
});
