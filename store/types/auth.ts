/**
 * Данные пользователя
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Данные для входа
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Ответ от API при успешной авторизации
 */
export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Состояние авторизации в Redux store
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  token: string | null;
}
