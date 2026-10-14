import { ADMIN_ROLE, DIRECTOR_ROLE, User } from '@/store/types/auth';
import { formatPhone } from './input-masks';

const ROLE_LABELS: Record<string, string> = {
  [DIRECTOR_ROLE]: 'Директор',
  [ADMIN_ROLE]: 'Администратор',
  PARENT: 'Родитель',
  EMPLOYEE: 'Сотрудник',
};

/** «Иванова Мария Петровна» */
export function fullName(user: Pick<User, 'surname' | 'firstName' | 'patronymic'>): string {
  return [user.surname, user.firstName, user.patronymic].filter(Boolean).join(' ');
}

/** «МИ»: имя и фамилия, как принято в аватарах. */
export function initials(user: Pick<User, 'surname' | 'firstName'>): string {
  return `${user.firstName.charAt(0)}${user.surname.charAt(0)}`.toUpperCase();
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function genderLabel(gender: User['gender']): string | null {
  if (gender === 'FEMALE') return 'Женский';
  if (gender === 'MALE') return 'Мужской';
  return null;
}

/** `1990-03-14` → `14.03.1990` */
export function formatBirthDate(iso: string | null): string | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

/** `+79123456789` → `+7 (912) 345-67-89`; номер в другом формате показываем как есть. */
export function formatPhoneForDisplay(phone: string | null): string | null {
  if (!phone) return null;
  const formatted = formatPhone(phone);
  return formatted.length === '+7 (XXX) XXX-XX-XX'.length ? formatted : phone;
}
