import { formatBirthDate, formatPhoneForDisplay, fullName, genderLabel, initials, roleLabel } from './profile-format';

describe('profile format', () => {
  const user = { surname: 'Иванова', firstName: 'Мария', patronymic: null };

  it('builds the full name without an empty patronymic', () => {
    expect(fullName(user)).toBe('Иванова Мария');
    expect(fullName({ ...user, patronymic: 'Петровна' })).toBe('Иванова Мария Петровна');
  });

  it('builds initials from the first name and surname', () => {
    expect(initials(user)).toBe('МИ');
  });

  it('names roles and genders in Russian', () => {
    expect(roleLabel('DIRECTOR')).toBe('Директор');
    expect(roleLabel('ADMIN')).toBe('Администратор');
    expect(roleLabel('PARENT')).toBe('Родитель');
    expect(roleLabel('EMPLOYEE')).toBe('Сотрудник');
    expect(roleLabel('VISITOR')).toBe('VISITOR');
    expect(genderLabel('FEMALE')).toBe('Женский');
    expect(genderLabel(null)).toBeNull();
  });

  it('formats the birth date and phone for display', () => {
    expect(formatBirthDate('1990-03-14')).toBe('14.03.1990');
    expect(formatBirthDate(null)).toBeNull();
    expect(formatPhoneForDisplay('+79123456789')).toBe('+7 (912) 345-67-89');
    expect(formatPhoneForDisplay('+441234')).toBe('+441234');
    expect(formatPhoneForDisplay(null)).toBeNull();
  });
});
