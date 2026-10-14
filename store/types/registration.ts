/**
 * Пол в терминах бэкенда.
 */
export type Gender = 'FEMALE' | 'MALE';

/**
 * Кем регистрируется пользователь. Администратор сада при подтверждении может выбрать другую роль.
 */
export type RegistrationRole = 'PARENT' | 'EMPLOYEE';

/**
 * Ребёнок в форме родителя, как его вводит пользователь (дата с маской).
 */
export interface ChildForm {
  /** Ключ строки на экране, на сервер не уходит */
  key: string;
  surname: string;
  firstName: string;
  /** Необязательно: пусто — без отчества */
  patronymic: string;
  birthDate: string; // ДД.ММ.ГГГГ
  gender: Gender | null;
}

export type ChildField = 'surname' | 'firstName' | 'patronymic' | 'birthDate' | 'gender';

export type ChildErrors = Partial<Record<ChildField, string>>;

/**
 * Значения формы регистрации в том виде, в каком их вводит пользователь (с масками).
 */
export interface RegistrationForm {
  role: RegistrationRole;
  surname: string;
  firstName: string;
  patronymic: string;
  noPatronymic: boolean;
  birthDate: string; // ДД.ММ.ГГГГ
  gender: Gender | null;
  email: string;
  phone: string; // +7 (XXX) XXX-XX-XX
  consent: boolean;
  /** Дети родителя; у сотрудника не отправляются */
  children: ChildForm[];
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
  organization_external_key: string;
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
  role: RegistrationRole;
  /** Только у родителя */
  children?: RegistrationChildRequest[];
}

export interface RegistrationChildRequest {
  surname: string;
  first_name: string;
  patronymic?: string;
  birth_date: string; // YYYY-MM-DD
  gender: Gender;
}

/**
 * Текущая политика обработки ПДн (GET /registration/policy).
 */
export interface PrivacyPolicy {
  version: string;
  url: string;
}

/**
 * Сад в списке на экране регистрации (GET /organization/public/list).
 */
export interface PublicOrganization {
  id: string;
  name: string;
  address: string | null;
  /** Полный адрес картинки или null, если логотипа нет. */
  logoUrl: string | null;
  /** false — у сада нет политики ПДн, подать заявку в него нельзя. */
  registrationAvailable: boolean;
}

/**
 * Состояние регистрации в Redux. Значения полей хранятся в экране, здесь — только результат запросов.
 */
export interface RegistrationState {
  organizations: PublicOrganization[];
  organizationsStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  /** Сад, в который подаётся заявка. Политика ПДн у каждого сада своя. */
  organization: PublicOrganization | null;
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
