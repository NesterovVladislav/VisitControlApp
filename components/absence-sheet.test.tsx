import { fireEvent, render } from '@testing-library/react-native';

import {
  type AbsenceNotice, type AbsenceRules, cancelAbsence, createAbsence, getAbsenceRules, getChildAbsences, updateAbsence,
} from '../services/api/absence';
import { ApiError } from '../services/errors/api-error';
import AbsenceSheet from './absence-sheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../services/api/absence', () => ({
  ...jest.requireActual<typeof import('../services/api/absence')>('../services/api/absence'),
  createAbsence: jest.fn(),
  cancelAbsence: jest.fn(),
  getAbsenceRules: jest.fn(),
  getChildAbsences: jest.fn(),
  updateAbsence: jest.fn(),
}));

const day = '2026-11-17';
const option = { from: day, to: day, working_days: 1, paid_days: [day] };
const rules: AbsenceRules = {
  today_date: day, earliest_from: day, max_days: 31, can_report: true,
  deadline_enabled: true, deadline: '20:00', time_zone: 'Asia/Novosibirsk',
  today: option, tomorrow: null, period: option, current: null,
  reasons: [{ code: 'OTHER', name: 'Другое', comment_required: true }],
};
const freeRules = { ...rules, today: { ...option, paid_days: [] } };
const paidAction = 'Сообщить · 17.11 оплачивается';
const notice: AbsenceNotice = {
  external_key: 'fixture', from: day, to: day, status: 'ACTIVE', reason: 'OTHER',
  editable: true, cancellable: false, return_date: null, paid_days: [{ date: day, waived: false }],
};

describe('absence consent', () => {
  it('requires a comment, shows the server dates, and never consents automatically', async () => {
    jest.mocked(getAbsenceRules).mockResolvedValue(freeRules);
    jest.mocked(createAbsence).mockRejectedValueOnce(new ApiError('Needs consent', 409, '', {
      code: 'ABSENCE_PAID_DAYS_NOT_ACCEPTED', paid_days: [[2026, 11, 17]],
    })).mockResolvedValueOnce(notice);
    const onSaved = jest.fn();
    const screen = await render(
      <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
        initialRules={freeRules} initialMode="create" onClose={jest.fn()} onSaved={onSaved} />,
    );

    expect(screen.queryByLabelText('Комментарий (необязательно)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Причина: Выбрать' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Другое' }));
    expect(screen.getByRole('button', { name: 'Сообщить саду' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Комментарий (обязательно)'), 'Семейная поездка');
    await fireEvent.press(screen.getByRole('button', { name: 'Сообщить саду' }));

    expect(createAbsence).toHaveBeenCalledWith({
      child_external_key: 'child', from: day, to: day, reason: 'OTHER',
      comment: 'Семейная поездка', accept_paid_days: false,
    });
    expect(screen.getByText('День 17.11 будет оплачен.')).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: paidAction }));
    expect(createAbsence).toHaveBeenLastCalledWith(expect.objectContaining({ accept_paid_days: true }));
    expect(onSaved).toHaveBeenCalledWith(notice, 'Сад уведомлён');
  });
});

describe('absence write safety', () => {
  const tomorrow = '2026-11-18';
  const multi = { ...rules, today: { ...option, to: tomorrow, working_days: 2 },
    period: { ...option, to: tomorrow, working_days: 2 } };

  async function fillForm(initialRules: AbsenceRules) {
    jest.mocked(createAbsence).mockReset();
    jest.mocked(getAbsenceRules).mockResolvedValue(initialRules);
    const screen = await render(
      <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
        initialRules={initialRules} initialMode="create" onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Комментарий (необязательно)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Причина: Выбрать' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Другое' }));
    await fireEvent.changeText(screen.getByLabelText('Комментарий (обязательно)'), 'Семейная поездка');
    return screen;
  }

  it('saves the entire period on the first tap and names only the paid date', async () => {
    const screen = await fillForm(multi);
    jest.mocked(createAbsence).mockResolvedValueOnce({ ...notice, to: tomorrow });
    expect(createAbsence).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: paidAction }));
    expect(createAbsence).toHaveBeenCalledTimes(1);
    expect(createAbsence).toHaveBeenCalledWith(expect.objectContaining({
      from: day, to: tomorrow, accept_paid_days: true,
    }));
  });

  it('discards the old payment confirmation when the preset rolls over', async () => {
    const screen = await fillForm(rules);
    jest.mocked(getAbsenceRules).mockResolvedValue({
      ...rules, earliest_from: tomorrow, today_date: tomorrow,
      today: { ...option, from: tomorrow, to: tomorrow, paid_days: [tomorrow] },
      period: { ...option, working_days: 0, paid_days: [] },
    });
    await fireEvent.press(screen.getByRole('button', { name: paidAction }));
    expect(createAbsence).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: paidAction })).toBeNull();
    expect(screen.getByRole('button', { name: 'Сообщить · 18.11 оплачивается' })).toBeVisible();
  });

  it('asks for new confirmation if the paid dates changed before submitting', async () => {
    const screen = await fillForm(multi);
    jest.mocked(getAbsenceRules).mockResolvedValue({ ...multi, period: { ...multi.period, paid_days: [day, tomorrow] } });
    await fireEvent.press(screen.getByRole('button', { name: paidAction }));
    expect(screen.getByText('Дни 17.11, 18.11 будут оплачены.')).toBeVisible();
    expect(createAbsence).not.toHaveBeenCalled();
  });

  it('passes only confirmed dates when exact atomic consent is advertised', async () => {
    const screen = await fillForm({ ...multi, supports_exact_paid_days: true });
    jest.mocked(createAbsence).mockResolvedValueOnce(notice);
    await fireEvent.press(screen.getByRole('button', { name: paidAction }));
    expect(createAbsence).toHaveBeenLastCalledWith(expect.objectContaining({
      accept_paid_days: false, accepted_paid_days: [day],
    }));
  });

  it('extends an absence after confirming only the newly paid date', async () => {
    const end = '2026-11-19';
    const original = { ...notice, comment: 'Поездка' };
    jest.mocked(getChildAbsences).mockResolvedValue([original]);
    jest.mocked(getAbsenceRules).mockResolvedValue({
      ...rules, period: { ...option, to: end, working_days: 3, paid_days: [day, tomorrow] },
    });
    jest.mocked(updateAbsence).mockResolvedValueOnce({ ...original, to: end });
    const screen = await render(
      <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
        initialRules={rules} initialMode="list" onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: '17.11.2026 · Другое' }));
    expect(screen.queryByRole('button', { name: 'Изменить даты' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Даты: 17.11.2026' }));
    await fireEvent.press(screen.getByRole('button', { name: '19.11.2026' }));
    await screen.findByText('3 дня посещения');
    await fireEvent.press(screen.getByRole('button', { name: 'Выбрать даты' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Сохранить · 18.11 оплачивается' }));
    expect(updateAbsence).toHaveBeenCalledTimes(1);
    expect(updateAbsence).toHaveBeenCalledWith(original.external_key, { to: end, accept_paid_days: true });
  });

  it('moves to tomorrow after arrival and keeps the reason and comment', async () => {
    const tomorrowOption = { ...option, from: tomorrow, to: tomorrow, paid_days: [] };
    const screen = await fillForm({ ...freeRules, tomorrow: tomorrowOption });
    await fireEvent.press(screen.getByRole('radio', { name: 'Сегодня' }));
    jest.mocked(createAbsence).mockRejectedValueOnce(new ApiError('Arrived', 409, '', { code: 'ABSENCE_CHILD_ARRIVED' }));
    jest.mocked(getAbsenceRules).mockResolvedValue({ ...rules, today: null, tomorrow: tomorrowOption });
    await fireEvent.press(screen.getByRole('button', { name: 'Сообщить саду' }));
    expect(screen.queryByRole('radio', { name: 'Сегодня' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Завтра' })).toBeChecked();
    expect(screen.getByLabelText('Комментарий (обязательно)')).toHaveProp('value', 'Семейная поездка');
  });

  it('preserves the changed comment after reconciling an uncertain edit', async () => {
    const original = { ...notice, comment: 'До изменения' };
    jest.mocked(getChildAbsences).mockResolvedValue([original]);
    jest.mocked(updateAbsence).mockReset().mockRejectedValueOnce(new ApiError('Network', null, ''));
    jest.mocked(getAbsenceRules).mockResolvedValue(rules);
    const screen = await render(
      <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
        initialRules={rules} initialMode="list" initialEntry={original} onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Комментарий (обязательно)'), 'Сохраняемый черновик');
    await fireEvent.press(screen.getByRole('button', { name: 'Сохранить' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Проверить список отсутствий' }));
    expect(screen.getByLabelText('Комментарий (обязательно)')).toHaveProp('value', 'Сохраняемый черновик');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('keeps the selected end when a same-day custom period conflicts with arrival', async () => {
    const end = '2026-11-19';
    const range = { ...option, to: end, paid_days: [], working_days: 3 };
    const screen = await fillForm({ ...freeRules, period: range });
    await fireEvent.press(screen.getByRole('radio', { name: 'Другие даты' }));
    await fireEvent.press(screen.getByRole('button', { name: '17.11.2026' }));
    await fireEvent.press(screen.getByRole('button', { name: '19.11.2026' }));
    await screen.findByText('3 дня посещения');
    await fireEvent.press(screen.getByRole('button', { name: 'Выбрать даты' }));
    jest.mocked(createAbsence).mockRejectedValueOnce(new ApiError('Arrived', 409, '', { code: 'ABSENCE_CHILD_ARRIVED' }));
    jest.mocked(getAbsenceRules).mockRejectedValueOnce(new ApiError('Network', null, ''));
    await fireEvent.press(screen.getByRole('button', { name: 'Сообщить саду' }));
    expect(screen.getByText('17.11.2026 — 19.11.2026')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Сообщить саду' })).toBeDisabled();
    expect(screen.getByLabelText('Комментарий (обязательно)')).toHaveProp('value', 'Семейная поездка');
    await fireEvent.press(screen.getByRole('radio', { name: 'Другие даты' }));
    expect(screen.getByRole('button', { name: '17.11.2026' })).toBeDisabled();
  });

  it('opens the record directly and cancels it only after confirmation', async () => {
    const original: AbsenceNotice = { ...notice, cancellable: true, cancel_effect: { kind: 'CANCEL', return_date: day } };
    const cancelled: AbsenceNotice = { ...original, status: 'CANCELLED' };
    const onSaved = jest.fn();
    jest.mocked(getChildAbsences).mockResolvedValue([original]);
    jest.mocked(getAbsenceRules).mockResolvedValue(rules);
    jest.mocked(cancelAbsence).mockResolvedValue(cancelled);
    const screen = await render(
      <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
        initialRules={rules} initialMode="list" initialEntry={original} onClose={jest.fn()} onSaved={onSaved} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Отменить отсутствие' }));
    expect(screen.getByText('Примерова Анна сможет прийти 17.11.2026.')).toBeVisible();
    expect(cancelAbsence).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Отменить отсутствие' }));
    expect(cancelAbsence).toHaveBeenCalledWith(original.external_key);
    expect(onSaved).toHaveBeenCalledWith(cancelled, 'Предупреждение отменено');
  });

  it('closes after saving a new period reached through an unchanged record', async () => {
    const original = { ...notice, comment: 'Прежний период' };
    const newRules = { ...freeRules, today: { ...option, from: tomorrow, to: tomorrow, paid_days: [] } };
    const saved = { ...notice, from: tomorrow, to: tomorrow };
    const onSaved = jest.fn();
    jest.mocked(getChildAbsences).mockResolvedValue([original]);
    jest.mocked(getAbsenceRules).mockResolvedValue(newRules);
    jest.mocked(createAbsence).mockReset().mockResolvedValue(saved);
    const screen = await render(
      <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
        initialRules={newRules} initialMode="list" initialEntry={original} onClose={jest.fn()} onSaved={onSaved} />,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Все периоды' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Сообщить о другом периоде' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Причина: Выбрать' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Другое' }));
    await fireEvent.changeText(screen.getByLabelText('Комментарий (обязательно)'), 'Новый период');
    await fireEvent.press(screen.getByRole('button', { name: 'Сообщить саду' }));
    expect(onSaved).toHaveBeenCalledWith(saved, 'Сад уведомлён');
  });

  it('requires reading history after a write with unknown outcome', async () => {
    const screen = await fillForm(freeRules);
    jest.mocked(createAbsence).mockRejectedValueOnce(new ApiError('Network', null, ''));
    await fireEvent.press(screen.getByRole('button', { name: 'Сообщить саду' }));
    expect(screen.queryByRole('button', { name: 'Сообщить саду' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Проверить список отсутствий' })).toBeVisible();
  });
});

it('preserves the optional comment across disclosure and dismissal confirmation', async () => {
  const onClose = jest.fn();
  const screen = await render(
    <AbsenceSheet child={{ id: 'child', firstName: 'Анна', surname: 'Примерова', linkRole: 'PARENT' }}
      initialRules={freeRules} initialMode="create" onClose={onClose} onSaved={jest.fn()} />
  );
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  await press('Комментарий');
  await fireEvent.changeText(screen.getByLabelText('Комментарий (необязательно)'), 'Уезжаем за город');
  await press('Комментарий');
  expect(screen.queryByLabelText('Комментарий (необязательно)')).toBeNull();
  await press('Закрыть');
  expect(onClose).not.toHaveBeenCalled();
  await press('Продолжить редактирование');
  await press('Комментарий');
  expect(screen.getByLabelText('Комментарий (необязательно)')).toHaveProp('value', 'Уезжаем за город');
  await press('Закрыть');
  await press('Выйти без сохранения');
  expect(onClose).toHaveBeenCalledTimes(1);
});
