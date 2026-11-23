import { plural } from './plural';

export function absentChildrenLabel(count: number) {
  const noun = plural(count, ['ребёнок', 'ребёнка', 'детей']);
  return `${noun === 'ребёнок' ? 'не придёт' : 'не придут'} ${count} ${noun}`;
}

export function absenceDateLabel(iso: string, weekday = false, now = new Date()) {
  const date = new Date(iso + 'T12:00:00Z');
  const label = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
    ...(date.getUTCFullYear() !== now.getFullYear() && { year: 'numeric' }),
    ...(weekday && { weekday: 'short' }),
  }).format(date).replace(/\s*г\.$/, '');
  return label.charAt(0).toLocaleUpperCase('ru-RU') + label.slice(1);
}

export function absenceEntrySummary(iso: string, count: number, now = new Date()) {
  // Сравниваем календарные даты, как их видит воспитатель, включая переход месяца и года.
  const tomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1)).toISOString().slice(0, 10);
  const when = iso === tomorrow ? 'Завтра' : absenceDateLabel(iso, false, now);
  return count ? `${when} ${absentChildrenLabel(count)}` : iso === tomorrow ? 'На завтра сообщений нет' : `На ${when} сообщений нет`;
}
