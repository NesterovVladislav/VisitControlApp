export const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function shiftCalendarMonth(day: string, offset = 0): string {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset, 1);
  return isoDate(date);
}

export function calendarMonth(day: string) {
  const start = new Date(shiftCalendarMonth(day) + 'T00:00:00Z');
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const from = isoDate(start);
  const end = new Date(shiftCalendarMonth(from, 1) + 'T00:00:00Z');
  end.setUTCDate(0);
  const to = isoDate(end);
  const offset = (start.getUTCDay() + 6) % 7;
  const length = end.getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => {
    const dayNumber = index - offset + 1;
    return dayNumber < 1 || dayNumber > length ? null : from.slice(0, 8) + String(dayNumber).padStart(2, '0');
  });
  return { from, to, cells, label: `${months[month]} ${year}` };
}

export function dateInTimeZone(timeZone: string, now = new Date()): string {
  // Java ZoneId возвращает смещения с префиксом UTC, GMT или UT.
  // Поддержка этих строк в Intl зависит от движка.
  const fixed = /^(?:UTC|GMT|UT)?([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeZone);
  if (fixed) {
    const [, sign, hours, minutes, seconds = '0'] = fixed;
    const offset = (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * (sign === '+' ? 1 : -1);
    return isoDate(new Date(now.getTime() + offset * 1000));
  }
  if (['UTC', 'GMT', 'UT', 'Z'].includes(timeZone)) return isoDate(now);

  const parts = new Intl.DateTimeFormat('en', {
    timeZone, calendar: 'iso8601', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
