const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isValid(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/** Ключ дня в местном времени, для группировки журнала */
export function localDayKey(iso: string): string {
  const date = new Date(iso);
  if (!isValid(date)) {
    return 'unknown';
  }
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** «Сегодня», «Вчера, 24 сентября», «24 сентября», «24 сентября 2025» */
export function dayTitle(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (!isValid(date)) {
    return 'Дата неизвестна';
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  if (days === 0) {
    return 'Сегодня';
  }
  if (days === 1) {
    return `Вчера, ${dayMonth}`;
  }
  return date.getFullYear() === now.getFullYear() ? dayMonth : `${dayMonth} ${date.getFullYear()}`;
}

/** «08:40» в местном времени */
export function timeOfDay(iso: string): string {
  const date = new Date(iso);
  if (!isValid(date)) {
    return '—';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
