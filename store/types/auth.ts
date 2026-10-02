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
/** Сотрудник сада: видит весь сад, но не создаёт людей и не разбирает заявки. */
export const EMPLOYEE_ROLE = 'EMPLOYEE';

/**
 * Персонал сада — у него есть рабочий режим. Сотрудник и администратор могут быть ещё и родителями.
 */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE || role === EMPLOYEE_ROLE;
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
