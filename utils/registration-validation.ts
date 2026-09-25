import {
  RegistrationField,
  RegistrationFieldErrors,
  RegistrationForm,
  RegistrationRequest,
} from '@/store/types/registration';
import { ageOn, parseDate, phoneToE164 } from './input-masks';

export const MIN_AGE = 16;
export const MAX_AGE = 100;
const MAX_NAME_LENGTH = 255;

// Латиница и кириллица (включая расширенную: Ә, Ө, Ү, Ґ и т.п.), пробел, дефис, апостроф; начинается с буквы.
const LETTER = "A-Za-z\\u00C0-\\u024F\\u0400-\\u04FF";
const NAME_REGEX = new RegExp(`^[${LETTER}][${LETTER}' \\-]*$`);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGES = {
  required: 'Заполните поле',
  name: 'Только буквы, пробел, дефис и апостроф',
  nameTooLong: `Не больше ${MAX_NAME_LENGTH} символов`,
  date: 'Введите дату в формате ДД.ММ.ГГГГ',
  dateInvalid: 'Такой даты нет',
  age: `Возраст должен быть от ${MIN_AGE} до ${MAX_AGE} лет`,
  gender: 'Выберите пол',
  email: 'Введите корректный email',
  phone: 'Введите номер полностью: +7 и 10 цифр',
  consent: 'Без согласия заявку отправить нельзя',
} as const;

/**
 * Порядок полей на экране: к первому ошибочному прокручивается форма.
 */
export const FIELD_ORDER: RegistrationField[] = [
  'surname',
  'firstName',
  'patronymic',
  'birthDate',
  'gender',
  'email',
  'phone',
  'consent',
];

function validateName(value: string, required: boolean): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? MESSAGES.required : undefined;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return MESSAGES.nameTooLong;
  }
  return NAME_REGEX.test(trimmed) ? undefined : MESSAGES.name;
}

/**
 * Проверяет одно поле. Возвращает текст ошибки или undefined.
 */
export function validateField(
  field: RegistrationField,
  form: RegistrationForm,
  now: Date = new Date()
): string | undefined {
  switch (field) {
    case 'surname':
      return validateName(form.surname, true);
    case 'firstName':
      return validateName(form.firstName, true);
    case 'patronymic':
      return form.noPatronymic ? undefined : validateName(form.patronymic, true);
    case 'birthDate': {
      if (!form.birthDate) return MESSAGES.required;
      if (form.birthDate.length < 10) return MESSAGES.date;
      const parsed = parseDate(form.birthDate);
      if (!parsed) return MESSAGES.dateInvalid;
      const age = ageOn(parsed.date, now);
      return age < MIN_AGE || age > MAX_AGE ? MESSAGES.age : undefined;
    }
    case 'gender':
      return form.gender ? undefined : MESSAGES.gender;
    case 'email': {
      const email = form.email.trim();
      if (!email) return MESSAGES.required;
      return EMAIL_REGEX.test(email) ? undefined : MESSAGES.email;
    }
    case 'phone':
      if (!form.phone) return MESSAGES.required;
      return phoneToE164(form.phone) ? undefined : MESSAGES.phone;
    case 'consent':
      return form.consent ? undefined : MESSAGES.consent;
  }
}

/**
 * Проверяет всю форму.
 */
export function validateForm(form: RegistrationForm, now: Date = new Date()): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  for (const field of FIELD_ORDER) {
    const error = validateField(field, form, now);
    if (error) {
      errors[field] = error;
    }
  }
  return errors;
}

/**
 * Собирает тело запроса из проверенной формы.
 */
export function toRegistrationRequest(form: RegistrationForm, policyVersion: string): RegistrationRequest {
  const birthDate = parseDate(form.birthDate);
  const phone = phoneToE164(form.phone);
  if (!birthDate || !phone || !form.gender) {
    throw new Error('Form must be validated before building a request');
  }
  const patronymic = form.noPatronymic ? '' : form.patronymic.trim();
  return {
    surname: form.surname.trim(),
    first_name: form.firstName.trim(),
    ...(patronymic ? { patronymic } : {}),
    birth_date: birthDate.iso,
    gender: form.gender,
    email: form.email.trim().toLowerCase(),
    phone,
    personal_data_consent: { accepted: true, policy_version: policyVersion },
  };
}

/**
 * Ключ поля из ответа сервера (`first_name`, `personal_data_consent.accepted`) → поле формы.
 */
export function serverFieldToFormField(serverField: string): RegistrationField | null {
  const root = serverField.split('.')[0];
  const map: Record<string, RegistrationField> = {
    surname: 'surname',
    first_name: 'firstName',
    patronymic: 'patronymic',
    birth_date: 'birthDate',
    gender: 'gender',
    email: 'email',
    phone: 'phone',
    personal_data_consent: 'consent',
  };
  return map[root] ?? null;
}
