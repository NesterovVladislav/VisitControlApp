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

/**
 * Результат входа: токен из POST /token и профиль из GET /user
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
