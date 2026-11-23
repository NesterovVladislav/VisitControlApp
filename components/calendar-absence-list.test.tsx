import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { AbsenceNotice, AbsenceRules } from '../services/api/absence';
import { getChildAbsences } from '../services/api/absence';
import type { AttendanceDay } from '../services/api/own-attendance';
import AbsenceSheet from './absence-sheet';
import { CalendarAbsenceList } from './calendar-absence-list';
import { periodLabel } from './calendar-absence-entry';

jest.mock('./header-brand-title', () => require('react-native').Text);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('../services/api/absence', () => ({ ...jest.requireActual('../services/api/absence'), getChildAbsences: jest.fn() }));
jest.mock('./absence-sheet', () => ({ __esModule: true, default: jest.fn() }));

const child = { id: 'c', firstName: 'Мария', surname: 'Пример', linkRole: 'PARENT' };
const rules = { today_date: '2026-11-20', can_report: false, reasons: [{ code: 'VACATION', name: 'Отпуск' }] } as AbsenceRules;
const entry: AbsenceNotice = { external_key: 'notice', from: '2026-12-07', to: '2026-12-20', reason: 'VACATION', status: 'ACTIVE',
  editable: false, cancellable: false, return_date: null, paid_days: [] };
const day: AttendanceDay = { status: 'NONE', date: '2026-12-09', future: true, working: true, holiday: null,
  reason: entry.reason, paid: false, absencePeriod: { from: entry.from, to: entry.to } };

it('opens the uniquely matched active entry from a calendar day and returns to that day', async () => {
  jest.mocked(getChildAbsences).mockResolvedValue([entry]);
  const onReturnToDay = jest.fn();
  jest.mocked(AbsenceSheet).mockImplementation(({ initialEntry, onClose }) => <Pressable onPress={onClose}><Text>{initialEntry?.external_key}</Text></Pressable>);
  const screen = await render(<CalendarAbsenceList child={child} rules={rules} day={day} onBack={jest.fn()} onRefresh={jest.fn()} onReturnToDay={onReturnToDay} />);
  await fireEvent.press(await screen.findByText('notice'));
  expect(onReturnToDay).toHaveBeenCalledTimes(1);
  expect(getChildAbsences).toHaveBeenCalledWith(child.id, rules.today_date, expect.anything());
  expect(screen.queryByText('Сообщить об отсутствии')).toBeNull();
});

it.each(['ACTIVE', 'CANCELLED'] as const)('refreshes the report and returns to the day after a %s write', async status => {
  jest.mocked(getChildAbsences).mockResolvedValue([entry]);
  const onReturnToDay = jest.fn(), onRefresh = jest.fn();
  jest.mocked(AbsenceSheet).mockImplementation(({ onSaved }) => (
    <Pressable onPress={() => onSaved({ ...entry, status }, 'Готово')}><Text>Записать</Text></Pressable>
  ));
  const screen = await render(<CalendarAbsenceList child={child} rules={rules} day={day} onBack={jest.fn()} onRefresh={onRefresh} onReturnToDay={onReturnToDay} />);
  await fireEvent.press(await screen.findByText('Записать'));
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(onReturnToDay).toHaveBeenCalledTimes(1);
});

it('falls back to the active list when the reported reason and the current period differ', async () => {
  jest.mocked(getChildAbsences).mockResolvedValue([{ ...entry, reason: 'FAMILY' }]);
  const screen = await render(<CalendarAbsenceList child={child} rules={rules} day={day} onBack={jest.fn()} onRefresh={jest.fn()} onReturnToDay={jest.fn()} />);
  expect(await screen.findByText('Запись изменилась. Проверьте список отсутствий.')).toBeVisible();
  expect(screen.queryByText('notice')).toBeNull();
  expect(screen.getByText('7–20 декабря')).toBeVisible();
});

it('labels same-day, same-month and cross-year intervals', () => {
  expect(periodLabel('2026-12-07', '2026-12-07', '2026-11-20')).toBe('7 декабря');
  expect(periodLabel('2026-12-07', '2026-12-20', '2026-11-20')).toBe('7–20 декабря');
  expect(periodLabel('2026-12-30', '2027-01-05', '2026-11-20')).toBe('30 декабря — 5 января 2027');
});
