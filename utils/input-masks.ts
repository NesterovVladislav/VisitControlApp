/**
 * Маски ввода для формы регистрации. Чистые функции без зависимостей от React Native.
 */

const PHONE_DIGITS = 10;
const DATE_DIGITS = 8;

/**
 * Цифры национального номера (без кода страны), не больше 10.
 * Первая 7 или 8 считается кодом страны: так работают и вставка «89123456789»,
 * и повторное форматирование уже отформатированного «+7 (912) …».
 */
function nationalPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, PHONE_DIGITS);
}

/**
 * Форматирует ввод телефона по маске `+7 (XXX) XXX-XX-XX` по мере набора.
 * Разделители добавляются только перед следующей цифрой, поэтому удаление символов работает естественно.
 */
export function formatPhone(input: string): string {
  const digits = nationalPhoneDigits(input);
  if (!digits) {
    return '';
  }
  const area = digits.slice(0, 3);
  const first = digits.slice(3, 6);
  const second = digits.slice(6, 8);
  const third = digits.slice(8, 10);

  let result = `+7 (${area}`;
  if (first) result += `) ${first}`;
  if (second) result += `-${second}`;
  if (third) result += `-${third}`;
  return result;
}

/**
 * Телефон в формате бэкенда `+7XXXXXXXXXX` или null, если номер неполный.
 */
export function phoneToE164(formatted: string): string | null {
  const digits = nationalPhoneDigits(formatted);
  return digits.length === PHONE_DIGITS ? `+7${digits}` : null;
}

/**
 * Форматирует ввод даты по маске `ДД.ММ.ГГГГ` по мере набора.
 */
export function formatDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, DATE_DIGITS);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  let result = day;
  if (month) result += `.${month}`;
  if (year) result += `.${year}`;
  return result;
}

/**
 * Разбирает дату `ДД.ММ.ГГГГ`. Возвращает null для неполной или несуществующей даты (например, 31.02.1990).
 */
export function parseDate(masked: string): { iso: string; date: Date } | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(masked);
  if (!match) {
    return null;
  }
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { iso: `${yyyy}-${mm}-${dd}`, date };
}

/**
 * Полных лет на дату `now` (по UTC-компонентам обеих дат).
 */
export function ageOn(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}
