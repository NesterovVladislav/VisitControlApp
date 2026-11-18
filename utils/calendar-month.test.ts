import { calendarMonth, dateInTimeZone } from './calendar-month';

it.each(['Asia/Novosibirsk', 'UTC+07:00', 'GMT+07:00', 'UT+07:00', '+07:00'])(
  'starts December in the garden before UTC midnight for %s',
  (timeZone) => {
    const today = dateInTimeZone(timeZone, new Date('2026-11-30T17:00:00Z'));
    expect(today).toBe('2026-12-01');
    expect(calendarMonth(today)).toMatchObject({ from: '2026-12-01', to: '2026-12-31' });
  },
);

it('keeps the previous day for a negative offset with minutes', () => {
  expect(dateInTimeZone('-03:30', new Date('2026-12-01T03:29:00Z'))).toBe('2026-11-30');
});
