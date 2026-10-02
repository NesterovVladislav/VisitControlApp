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
  /** Изменение своих данных (только администратор) */
  saveStatus: 'idle' | 'saving' | 'saved';
  saveFieldErrors: Partial<Record<'surname' | 'firstName' | 'patronymic' | 'birthDate' | 'phone', string>>;
  saveError: string | null;
  passwordStatus: 'idle' | 'submitting' | 'changed';
  passwordFieldErrors: PasswordFieldErrors;
  passwordError: string | null;
}
