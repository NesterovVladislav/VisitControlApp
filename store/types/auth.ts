/**
 * Текущий пользователь из GET /user
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  surname: string;
  patronymic: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  /** ISO `YYYY-MM-DD` */
  birthDate: string | null;
  /** Телефон в формате бэкенда `+7XXXXXXXXXX` */
  phone: string | null;
  role: string;
  /** Сад пользователя. Нет только у технического администратора. */
  organization: UserOrganization | null;
  /** Путь к фотографии относительно API; нет фотографии — null */
  photoUrl?: string | null;
}

export interface UserOrganization {
  id: string;
  name: string;
}

/**
 * Данные для входа
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

export type AuthPhase =
  | 'bootstrapping'
  | 'unauthenticated'
  | 'pinSetupRequired'
  | 'locked'
  | 'validating'
  | 'authenticated'
  | 'validationUnavailable'
  | 'storageUnavailable';

export type SetupStep = 'createPin' | 'offerBiometrics' | null;
export type LogoutReason = 'user' | 'switchAccount' | 'expired';

/**
 * Режим работы. Для сотрудника или администратора, который ещё и родитель, — что сейчас на экране:
 * 'admin' — рабочий режим (вкладки сада), 'parent' — «Мои дети». На права не влияет: токен и роль те же.
 */
export type AppMode = 'admin' | 'parent';

export const ADMIN_ROLE = 'ADMIN';
/** Директор сада: всё, что может администратор, плюс назначение администраторов. */
export const DIRECTOR_ROLE = 'DIRECTOR';
/** Сотрудник сада: видит весь сад, но не создаёт людей и не разбирает заявки. */
export const EMPLOYEE_ROLE = 'EMPLOYEE';

/**
 * Персонал сада — у него есть рабочий режим. Сотрудник и администратор могут быть ещё и родителями.
 */
export function isStaffRole(role: string | null | undefined): boolean {
  return isAdminRole(role) || role === EMPLOYEE_ROLE;
}

/**
 * Администратор сада или директор: создаёт людей, разбирает заявки, ведёт сад.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE || role === DIRECTOR_ROLE;
}

/**
 * Состояние авторизации в Redux store
 */
export interface AuthState {
  phase: AuthPhase;
  setupStep: SetupStep;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  user: User | null;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  remainingPinAttempts: number;
  sessionEpoch: number;
  mode: AppMode;
  selectedModeOwnerId: string | null;
}
