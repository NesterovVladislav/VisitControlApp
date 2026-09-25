import { fireEvent, render } from '@testing-library/react-native';

import { PinPad } from './pin-pad';

describe('PinPad', () => {
  it('submits exactly four digits and clears the entered value', async () => {
    const onSubmit = jest.fn();
    const screen = await render(<PinPad onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByLabelText('Цифра 1'));
    await fireEvent.press(screen.getByLabelText('Цифра 2'));
    await fireEvent.press(screen.getByLabelText('Цифра 3'));
    expect(screen.queryByText('123')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Цифра 4'));

    expect(onSubmit).toHaveBeenCalledWith('1234');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('pin-indicators')).toBeTruthy();
  });

  it('supports backspace without exposing the PIN text', async () => {
    const onSubmit = jest.fn();
    const screen = await render(<PinPad onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByLabelText('Цифра 1'));
    await fireEvent.press(screen.getByLabelText('Удалить цифру'));
    for (const digit of ['2', '3', '4', '5']) {
      await fireEvent.press(screen.getByLabelText('Цифра ' + digit));
    }

    expect(onSubmit).toHaveBeenCalledWith('2345');
    expect(screen.queryByText('2345')).toBeNull();
  });

  it('ignores input while disabled', async () => {
    const onSubmit = jest.fn();
    const screen = await render(<PinPad onSubmit={onSubmit} disabled />);
    for (const digit of ['1', '2', '3', '4']) {
      await fireEvent.press(screen.getByLabelText('Цифра ' + digit));
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('provides accessible labels for all digits and deletion', async () => {
    const screen = await render(<PinPad onSubmit={jest.fn()} />);
    for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByLabelText('Цифра ' + digit)).toBeTruthy();
    }
    expect(screen.getByLabelText('Удалить цифру')).toBeTruthy();
  });
});
