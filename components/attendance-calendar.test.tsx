import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palettes } from '../constants/palette';
import type { AttendanceDay } from '../services/api/own-attendance';
import { calendarMonth } from '../utils/calendar-month';
import { AttendanceCalendar } from './attendance-calendar';
import { AttendanceOverview } from './attendance-overview';

const days: AttendanceDay[] = [
  { date: '2026-11-15', working: false, future: false, holiday: null, status: 'NONE', reason: null, paid: false },
  { date: '2026-11-16', working: true, future: false, holiday: null, status: 'NONE', reason: null, paid: false },
  { date: '2026-11-17', working: true, future: false, holiday: null, status: 'SECOND_HALF', reason: null, paid: false },
  { date: '2026-11-18', working: true, future: false, holiday: null, status: 'NONE', reason: 'FAMILY', paid: true },
  { date: '2026-11-19', working: true, future: true, holiday: null, status: 'NONE', reason: 'FAMILY', paid: false },
];

afterEach(() => jest.restoreAllMocks());

it.each(['light', 'dark'] as const)('renders accessible attendance marks and a single ruble sign in %s mode', async (scheme) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
  const view = await render(
    <>
      <AttendanceCalendar month={calendarMonth('2026-11-18')} days={days} today="2026-11-18" />
      <AttendanceOverview summary={{ full: 0, half: 1, absent: 3, paid: 1,
        reasons: [{ reason: 'FAMILY', count: 1 }, { reason: 'ILLNESS', count: 2 }] }} />
    </>,
  );

  expect(view.getByRole('button', { name: '15.11.2026 · Нерабочий день' })).toBeVisible();
  expect(view.getByText('15').parent).toHaveStyle({ backgroundColor: palettes[scheme].fill });
  expect(view.getByText('×')).toBeVisible();
  expect(view.getByRole('button', { name: '16.11.2026 · Нет отметки' })).toBeVisible();
  expect(view.getByText('16').parent).toHaveStyle({ backgroundColor: palettes[scheme].card });
  expect(view.getByRole('button', { name: '17.11.2026 · Вторая половина дня' })).toBeVisible();
  expect(view.getByText('17').parent).toHaveStyle({ backgroundColor: palettes[scheme].successSoft });
  expect(view.getByRole('button', { name: '18.11.2026 · Сегодня · Пропуск · Семейные обстоятельства · Оплачиваемый пропуск' }))
    .toBeVisible();
  expect(view.getByText('18').parent)
    .toHaveStyle({ backgroundColor: palettes[scheme].dangerSoft, borderColor: palettes[scheme].actionPrimary });
  expect(view.getByRole('button', { name: '19.11.2026 · Запланированный пропуск · Семейные обстоятельства' })).toBeVisible();
  expect(view.getByText('19').parent)
    .toHaveStyle({ borderStyle: 'dashed', backgroundColor: palettes[scheme].primarySoft });
  expect(view.getAllByText(/₽/)).toHaveLength(1);
  expect(view.getByText('Семейные обстоятельства · 1')).toBeVisible();
  expect(view.getByText('Болезнь · 2')).toBeVisible();
  expect(view.getByText('Оплачиваемые пропуски: 1')).toBeVisible();
});

it('opens a named date button and shows the attendance record for that day', async () => {
  const records = days.map((day) => ({
    ...day,
    holiday: day.date === '2026-11-15' ? 'Праздник сада' : null,
    absencePeriod: day.reason ? { from: '2026-11-18', to: '2026-11-20' } : undefined,
  }));
  const view = await render(
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}>
      <AttendanceCalendar month={calendarMonth('2026-11-18')} days={records} today="2026-11-18" />
    </SafeAreaProvider>,
  );

  await fireEvent.press(view.getByRole('button', { name: /^18\.11\.2026.*Оплачиваемый пропуск$/ }));
  expect(view.getByRole('header', { name: '18.11.2026' })).toBeVisible();
  expect(view.getByText('Пропуск · Семейные обстоятельства')).toBeVisible();
  expect(view.getByText('18.11.2026 — 20.11.2026')).toBeVisible();
  expect(view.getByText('Оплачиваемый пропуск')).toBeVisible();
  expect(view.getAllByText(/₽/)).toHaveLength(1);
  await fireEvent.press(view.getByRole('button', { name: 'Закрыть' }));

  await fireEvent.press(view.getByRole('button', { name: /^19\.11\.2026/ }));
  expect(view.getByText('Запланированный пропуск · Семейные обстоятельства')).toBeVisible();
  expect(view.queryByText('Оплачиваемый пропуск')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Закрыть' }));

  await fireEvent.press(view.getByRole('button', { name: /^15\.11\.2026/ }));
  expect(view.getByText('Праздник сада')).toBeVisible();
});
