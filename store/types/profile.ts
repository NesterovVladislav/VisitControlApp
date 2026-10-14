export type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

export type PasswordFieldErrors = Partial<Record<PasswordField, string>>;

/**
 * Форма смены пароля. Живёт только в useState экрана, в store не попадает.
 */
export interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Статусы запросов профиля. Сами данные пользователя — в state.auth.user.
 */
export interface ProfileState {
  /** Идёт обновление, запущенное жестом pull-to-refresh. */
  refreshing: boolean;
  /** Непосредственное изменение своих данных. */
  saveStatus: 'idle' | 'saving' | 'saved';
  saveFieldErrors: ProfileEditErrors;
  saveError: string | null;
  passwordStatus: 'idle' | 'submitting' | 'changed';
  passwordFieldErrors: PasswordFieldErrors;
  passwordError: string | null;
}
import type { ProfileEditErrors } from '../../utils/profile-edit';
