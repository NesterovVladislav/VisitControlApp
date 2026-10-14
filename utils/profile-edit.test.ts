import { User } from '@/store/types/auth';
import {
  formFromUser,
  isProfileChanged,
  serverFieldToProfileField,
  toProfileUpdate,
  validateProfileForm,
} from './profile-edit';

const admin: User = {
  id: 'admin-1',
  email: 'admin@example.test',
  firstName: 'Анна',
  surname: 'Иванова',
  patronymic: 'Петровна',
  gender: 'FEMALE',
  organization: null,
  birthDate: '1990-03-14',
  phone: '+79123456789',
  role: 'ADMIN',
};

const now = new Date(Date.UTC(2026, 8, 28));

describe('profile edit form', () => {
  it('starts from the profile with masks applied', () => {
    expect(formFromUser(admin)).toEqual({
      surname: 'Иванова',
      firstName: 'Анна',
      patronymic: 'Петровна',
      noPatronymic: false,
      birthDate: '14.03.1990',
      phone: '+7 (912) 345-67-89',
    });
    expect(formFromUser({ ...admin, patronymic: null, phone: null, birthDate: null })).toMatchObject({
      noPatronymic: true,
      birthDate: '',
      phone: '',
    });
  });

  it('notices only real changes', () => {
    const initial = formFromUser(admin);
    expect(isProfileChanged({ ...initial, surname: ' Иванова ' }, initial)).toBe(false);
    expect(isProfileChanged({ ...initial, surname: 'Смирнова' }, initial)).toBe(true);
    expect(isProfileChanged({ ...initial, noPatronymic: true }, initial)).toBe(true);
  });

  it('validates like registration, but phone is optional', () => {
    const form = formFromUser(admin);
    expect(validateProfileForm({ ...form, phone: '' }, now)).toEqual({});
    expect(validateProfileForm({ ...form, surname: '123', phone: '+7 (912)', birthDate: '01.01.2020' }, now))
      .toEqual({
        surname: 'Только буквы, пробел, дефис и апостроф',
        phone: 'Введите номер полностью: +7 и 10 цифр',
        birthDate: 'Возраст должен быть от 16 до 100 лет',
      });
  });

  it('builds the request body', () => {
    const form = { ...formFromUser(admin), surname: ' Смирнова ', noPatronymic: true };
    expect(toProfileUpdate(form)).toEqual({
      surname: 'Смирнова',
      first_name: 'Анна',
      patronymic: null,
      birth_date: '1990-03-14',
      phone: '+79123456789',
    });
    expect(toProfileUpdate({ ...form, phone: '' }).phone).toBeNull();
  });

  it('maps server fields to form fields', () => {
    expect(serverFieldToProfileField('first_name')).toBe('firstName');
    expect(serverFieldToProfileField('email')).toBeNull();
  });
});
