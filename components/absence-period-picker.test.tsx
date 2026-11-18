import { fireEvent, render } from '@testing-library/react-native';

import AbsencePeriodPicker from './absence-period-picker';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('./ui/icon-symbol', () => ({ IconSymbol: () => null }));

const firstDay = '2026-11-17';

it('selects a range on one calendar within the start and duration limits', async () => {
  const onRangeChange = jest.fn();
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const props = { initialFrom: null, initialTo: null, min: firstDay, maxStart: '2026-11-18', maxLength: 3,
    onRangeChange, onClose, onConfirm };
  const screen = await render(<AbsencePeriodPicker {...props} />);
  const day = (date: string) => screen.getByRole('button', { name: date });
  const confirm = () => screen.getByRole('button', { name: 'Выбрать даты' });

  expect(day('16.11.2026')).toBeDisabled();
  expect(day('19.11.2026')).toBeDisabled();
  await fireEvent.press(day('18.11.2026'));
  expect(day('17.11.2026')).toBeDisabled();
  expect(day('21.11.2026')).toBeDisabled();
  await fireEvent.press(day('20.11.2026'));
  expect(screen.getByRole('button', { name: '19.11.2026', selected: true })).toBeVisible();
  expect(onRangeChange).toHaveBeenCalledWith('2026-11-18', '2026-11-20');
  expect(confirm()).toBeDisabled();
  await screen.rerender(<AbsencePeriodPicker {...props} workingDays={0} />);
  expect(confirm()).toBeDisabled();
  await screen.rerender(<AbsencePeriodPicker {...props} workingDays={2} />);
  expect(screen.getByText('2 дня посещения')).toBeVisible();
  await fireEvent.press(confirm());
  expect(onConfirm).toHaveBeenCalledWith('2026-11-18', '2026-11-20');
  await fireEvent.press(screen.getByRole('button', { name: 'Назад' }));
  expect(onClose).toHaveBeenCalled();
});

it('freezes the existing start and only exempts the original end from a new calculation', async () => {
  const onConfirm = jest.fn();
  const onRetry = jest.fn();
  const props = {
    initialFrom: firstDay, initialTo: '2026-11-21', min: firstDay, maxLength: 3,
    canChangeStart: false, existingTo: '2026-11-21', onClose: jest.fn(), onConfirm, onRetry,
  };
  const screen = await render(<AbsencePeriodPicker {...props} />);
  const confirm = () => screen.getByRole('button', { name: 'Выбрать даты' });

  expect(screen.getByRole('button', { name: 'Первый день, 17.11.2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '20.11.2026' })).toBeDisabled();
  expect(confirm()).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: '19.11.2026' }));

  await screen.rerender(<AbsencePeriodPicker {...props} initialTo="2026-11-19" previewError="Не удалось рассчитать дни" />);
  expect(confirm()).toBeDisabled();
  expect(onConfirm).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
