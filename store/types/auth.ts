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
}
