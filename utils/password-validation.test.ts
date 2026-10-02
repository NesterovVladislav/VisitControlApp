import { PASSWORD_MESSAGES, utf8Length, validatePasswordField, validatePasswordForm } from './password-validation';

const form = (currentPassword: string, newPassword: string, confirmPassword = newPassword) => ({
  currentPassword,
  newPassword,
  confirmPassword,
});

describe('password validation', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8Length('password')).toBe(8);
    expect(utf8Length('пароль')).toBe(12);
    expect(utf8Length('🙂')).toBe(4);
  });

  it('accepts a valid change', () => {
    expect(validatePasswordForm(form('old-password', 'new-password'))).toEqual({});
  });

  it('requires every field', () => {
    expect(validatePasswordForm(form('', '', ''))).toEqual({
      currentPassword: PASSWORD_MESSAGES.required,
      newPassword: PASSWORD_MESSAGES.required,
      confirmPassword: PASSWORD_MESSAGES.required,
    });
  });

  it('checks the length of the new password in bytes', () => {
    expect(validatePasswordField('newPassword', form('old', 'short'))).toBe(PASSWORD_MESSAGES.length);
    // 4 кириллические буквы — 8 байт, bcrypt примет
    expect(validatePasswordField('newPassword', form('old', 'абвг'))).toBeUndefined();
    expect(validatePasswordField('newPassword', form('old', 'a'.repeat(72)))).toBeUndefined();
    expect(validatePasswordField('newPassword', form('old', 'a'.repeat(73)))).toBe(PASSWORD_MESSAGES.length);
    // 40 кириллических букв — 80 байт: хвост bcrypt бы отбросил
    expect(validatePasswordField('newPassword', form('old', 'я'.repeat(40)))).toBe(PASSWORD_MESSAGES.tooLong);
  });

  it('rejects a new password equal to the current one', () => {
    expect(validatePasswordField('newPassword', form('same-password', 'same-password'))).toBe(
      PASSWORD_MESSAGES.sameAsCurrent,
    );
  });

  it('requires the confirmation to match', () => {
    expect(validatePasswordField('confirmPassword', form('old', 'new-password', 'new-passwort'))).toBe(
      PASSWORD_MESSAGES.mismatch,
    );
  });
});
