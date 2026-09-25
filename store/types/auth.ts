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
 * Режим работы. Для администратора, который ещё и родитель, — что сейчас на экране.
 * На права не влияет: токен и роль те же.
 */
export type AppMode = 'admin' | 'parent';

export const ADMIN_ROLE = 'ADMIN';

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
}
