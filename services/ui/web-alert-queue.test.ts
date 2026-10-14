import {
  currentWebAlert,
  dismissWebAlert,
  orderWebAlertButtons,
  pressWebAlertButton,
  resetWebAlertsForTests,
  showWebAlert,
  subscribeWebAlerts,
} from './web-alert-queue';

describe('web alert queue', () => {
  beforeEach(() => resetWebAlertsForTests());

  it('shows a single OK button when none are given, like the system alert', () => {
    showWebAlert('Ошибка', 'Пожалуйста, введите email');

    expect(currentWebAlert()).toMatchObject({
      title: 'Ошибка',
      message: 'Пожалуйста, введите email',
      buttons: [{ text: 'OK' }],
    });
  });

  it('shows alerts one at a time in call order', () => {
    showWebAlert('Первый');
    showWebAlert('Второй');

    const first = currentWebAlert()!;
    expect(first.title).toBe('Первый');
    pressWebAlertButton(first.id, first.buttons[0]);
    expect(currentWebAlert()?.title).toBe('Второй');
  });

  it('closes the dialog before running the pressed button action', () => {
    const seen: (string | null)[] = [];
    showWebAlert('Удалить?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => seen.push(currentWebAlert()?.title ?? null) },
    ]);

    const request = currentWebAlert()!;
    pressWebAlertButton(request.id, request.buttons[1]);

    expect(seen).toEqual([null]);
  });

  it('runs a button action only once on a double tap', () => {
    const onPress = jest.fn();
    showWebAlert('Выйти?', undefined, [{ text: 'Выйти', onPress }]);
    const request = currentWebAlert()!;

    pressWebAlertButton(request.id, request.buttons[0]);
    pressWebAlertButton(request.id, request.buttons[0]);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores a tap outside unless the alert is cancelable', () => {
    const onDismiss = jest.fn();
    showWebAlert('Важно');
    dismissWebAlert(currentWebAlert()!.id);
    expect(currentWebAlert()?.title).toBe('Важно');

    resetWebAlertsForTests();
    showWebAlert('Можно закрыть', undefined, undefined, { cancelable: true, onDismiss });
    dismissWebAlert(currentWebAlert()!.id);
    expect(currentWebAlert()).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers about changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeWebAlerts(listener);

    showWebAlert('Раз');
    unsubscribe();
    showWebAlert('Два');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('puts cancel on the left in a row and at the bottom in a column, as iOS does', () => {
    const cancel = { text: 'Отмена', style: 'cancel' as const };
    const remove = { text: 'Удалить', style: 'destructive' as const };
    const edit = { text: 'Изменить' };
    const copy = { text: 'Копировать' };

    expect(orderWebAlertButtons([remove, cancel])).toEqual([cancel, remove]);
    expect(orderWebAlertButtons([cancel, edit, copy])).toEqual([edit, copy, cancel]);
  });
});
