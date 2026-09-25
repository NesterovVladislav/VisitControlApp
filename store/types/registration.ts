/**
 * Пол в терминах бэкенда.
 */
export type Gender = 'FEMALE' | 'MALE';

/**
 * Значения формы регистрации в том виде, в каком их вводит пользователь (с масками).
 */
export interface RegistrationForm {
  surname: string;
  firstName: string;
  patronymic: string;
  noPatronymic: boolean;
  birthDate: string; // ДД.ММ.ГГГГ
  gender: Gender | null;
  email: string;
  phone: string; // +7 (XXX) XXX-XX-XX
  consent: boolean;
}

/**
 * Поля формы, под которыми может показываться ошибка.
 */
export type RegistrationField =
  | 'surname'
  | 'firstName'
  | 'patronymic'
  | 'birthDate'
  | 'gender'
  | 'email'
  | 'phone'
  | 'consent';

export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>;

/**
 * Тело запроса POST /registration (snake_case, как в API).
 */
export interface RegistrationRequest {
  surname: string;
  first_name: string;
  patronymic?: string;
  birth_date: string; // YYYY-MM-DD
  gender: Gender;
  email: string;
  phone: string; // +7XXXXXXXXXX
  personal_data_consent: {
    accepted: true;
    policy_version: string;
  };
}

/**
 * Текущая политика обработки ПДн (GET /registration/policy).
 */
export interface PrivacyPolicy {
  version: string;
  url: string;
}

/**
 * Состояние регистрации в Redux. Значения полей хранятся в экране, здесь — только результат запросов.
 */
export interface RegistrationState {
  policy: PrivacyPolicy | null;
  policyStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  status: 'idle' | 'submitting' | 'sent';
  /** Ошибки полей, пришедшие с сервера (400/409). */
  fieldErrors: RegistrationFieldErrors;
  /** Ошибка без привязки к полю: сеть, 429, 5xx. */
  formError: string | null;
  /** Увеличивается, когда нужно снять галочку согласия (политика обновилась). */
  consentResetCount: number;
  /** Email, на который придёт пароль, — для экрана «Заявка отправлена». */
  sentToEmail: string | null;
}
