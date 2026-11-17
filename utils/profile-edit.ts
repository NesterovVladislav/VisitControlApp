import { User } from '@/store/types/auth';
import { formatDate, formatPhone, parseDate, phoneToE164 } from './input-masks';
import { validateField } from './registration-validation';

export type ProfileEditField = 'surname' | 'firstName' | 'patronymic' | 'birthDate' | 'gender' | 'phone';
export type ProfileEditErrors = Partial<Record<ProfileEditField, string>>;

/**
 * Форма изменения своих данных. Значения — как на экране: дата `ДД.ММ.ГГГГ`, телефон с маской.
 */
export interface ProfileEditForm {
  surname: string;
  firstName: string;
  patronymic: string;
  noPatronymic: boolean;
  birthDate: string;
  gender: User['gender'];
  phone: string;
}

/** Тело PUT /user/me. */
export interface ProfileUpdate {
  surname: string;
  first_name: string;
  patronymic: string | null;
  birth_date: string;
  gender: NonNullable<User['gender']>;
  phone: string | null;
}

export const PROFILE_EDIT_FIELDS: ProfileEditField[] = ['surname', 'firstName', 'patronymic', 'birthDate', 'gender', 'phone'];

/** Начальные значения формы из профиля. */
export function formFromUser(user: User): ProfileEditForm {
  const [year, month, day] = (user.birthDate ?? '').split('-');
  return {
    surname: user.surname,
    firstName: user.firstName,
    patronymic: user.patronymic ?? '',
    noPatronymic: !user.patronymic,
    birthDate: user.birthDate ? formatDate(`${day}${month}${year}`) : '',
    gender: user.gender,
    phone: user.phone ? formatPhone(user.phone) : '',
  };
}

/**
 * Проверка поля — теми же правилами, что при регистрации. Телефон необязателен.
 */
export function validateProfileField(field: ProfileEditField, form: ProfileEditForm, now = new Date()): string | undefined {
  if (field === 'phone' && !form.phone) {
    return undefined;
  }
  return validateField(field, { ...form, email: '', consent: false, role: 'PARENT', children: [] }, now);
}

export function validateProfileForm(form: ProfileEditForm, now = new Date()): ProfileEditErrors {
  const errors: ProfileEditErrors = {};
  for (const field of PROFILE_EDIT_FIELDS) {
    const error = validateProfileField(field, form, now);
    if (error) {
      errors[field] = error;
    }
  }
  return errors;
}

/** Изменено ли что-нибудь по сравнению с исходными данными. */
export function isProfileChanged(form: ProfileEditForm, initial: ProfileEditForm): boolean {
  const patronymic = (value: ProfileEditForm) => (value.noPatronymic ? '' : value.patronymic.trim());
  return (
    form.surname.trim() !== initial.surname.trim() ||
    form.firstName.trim() !== initial.firstName.trim() ||
    patronymic(form) !== patronymic(initial) ||
    form.birthDate !== initial.birthDate ||
    form.gender !== initial.gender ||
    (phoneToE164(form.phone) ?? form.phone) !== (phoneToE164(initial.phone) ?? initial.phone)
  );
}

/** Тело запроса из проверенной формы. */
export function toProfileUpdate(form: ProfileEditForm): ProfileUpdate {
  const birthDate = parseDate(form.birthDate);
  if (!birthDate || !form.gender) {
    throw new Error('Form must be validated before building a request');
  }
  const patronymic = form.noPatronymic ? '' : form.patronymic.trim();
  return {
    surname: form.surname.trim(),
    first_name: form.firstName.trim(),
    patronymic: patronymic || null,
    birth_date: birthDate.iso,
    gender: form.gender,
    phone: form.phone ? phoneToE164(form.phone) : null,
  };
}

/** Ключ поля из ответа сервера → поле формы. */
export function serverFieldToProfileField(serverField: string): ProfileEditField | null {
  const map: Record<string, ProfileEditField> = {
    surname: 'surname',
    first_name: 'firstName',
    patronymic: 'patronymic',
    birth_date: 'birthDate',
    gender: 'gender',
    phone: 'phone',
  };
  return map[serverField] ?? null;
}
