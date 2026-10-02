import { PasswordField, PasswordFieldErrors, PasswordForm } from '@/store/types/profile';

export const MIN_PASSWORD_BYTES = 8;
/** bcrypt учитывает только первые 72 байта пароля. */
export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_MESSAGES = {
  required: 'Заполните поле',
  length: `Пароль должен быть от ${MIN_PASSWORD_BYTES} до ${MAX_PASSWORD_BYTES} символов`,
  // Кириллица занимает 2 байта, поэтому 72 байта — это 36 русских букв
  tooLong: 'Пароль слишком длинный: сократите его. Русские буквы считаются за два символа',
  sameAsCurrent: 'Новый пароль совпадает с текущим',
  mismatch: 'Пароли не совпадают',
} as const;

export const PASSWORD_FIELD_ORDER: PasswordField[] = ['currentPassword', 'newPassword', 'confirmPassword'];

/**
 * Длина строки в байтах UTF-8.
 */
export function utf8Length(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Проверяет одно поле формы смены пароля. Пробелы не обрезаются: они часть пароля.
 */
export function validatePasswordField(field: PasswordField, form: PasswordForm): string | undefined {
  switch (field) {
    case 'currentPassword':
      return form.currentPassword ? undefined : PASSWORD_MESSAGES.required;
    case 'newPassword': {
      if (!form.newPassword) return PASSWORD_MESSAGES.required;
      const bytes = utf8Length(form.newPassword);
      if (bytes < MIN_PASSWORD_BYTES) return PASSWORD_MESSAGES.length;
      if (bytes > MAX_PASSWORD_BYTES) {
        return form.newPassword.length <= MAX_PASSWORD_BYTES ? PASSWORD_MESSAGES.tooLong : PASSWORD_MESSAGES.length;
      }
      return form.newPassword === form.currentPassword ? PASSWORD_MESSAGES.sameAsCurrent : undefined;
    }
    case 'confirmPassword':
      if (!form.confirmPassword) return PASSWORD_MESSAGES.required;
      return form.confirmPassword === form.newPassword ? undefined : PASSWORD_MESSAGES.mismatch;
  }
}

/**
 * Проверяет всю форму.
 */
export function validatePasswordForm(form: PasswordForm): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};
  for (const field of PASSWORD_FIELD_ORDER) {
    const error = validatePasswordField(field, form);
    if (error) {
      errors[field] = error;
    }
  }
  return errors;
}
