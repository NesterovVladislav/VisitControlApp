import { ChildForm, RegistrationForm } from '../store/types/registration';
import { MESSAGES, toRegistrationRequest, validateChildren } from './registration-validation';

const NOW = new Date(Date.UTC(2026, 9, 10));

const masha: ChildForm = {
  key: 'child-1',
  surname: 'Иванова',
  firstName: 'Маша',
  patronymic: '',
  birthDate: '01.05.2022',
  gender: 'FEMALE',
};

const form: RegistrationForm = {
  role: 'PARENT',
  surname: 'Иванова',
  firstName: 'Ольга',
  patronymic: '',
  noPatronymic: true,
  birthDate: '12.03.1990',
  gender: 'FEMALE',
  email: ' Olga@Mail.RU ',
  phone: '+7 (912) 345-67-89',
  consent: true,
  children: [masha],
};

describe('children in the registration form', () => {
  it('accepts a child without patronymic', () => {
    expect(validateChildren(form, NOW)).toEqual({});
  });

  it('requires name, birth date and gender of a child', () => {
    const empty = { ...masha, surname: ' ', firstName: '', birthDate: '', gender: null };

    expect(validateChildren({ ...form, children: [empty] }, NOW)).toEqual({
      'child-1': {
        surname: MESSAGES.required,
        firstName: MESSAGES.required,
        birthDate: MESSAGES.required,
        gender: MESSAGES.gender,
      },
    });
  });

  it('does not accept an adult or a future birth date', () => {
    const adult = { ...masha, birthDate: '10.10.2008' };
    const unborn = { ...masha, key: 'child-2', firstName: 'Петя', birthDate: '01.01.2027' };

    expect(validateChildren({ ...form, children: [adult, unborn] }, NOW)).toEqual({
      'child-1': { birthDate: MESSAGES.childAge },
      'child-2': { birthDate: MESSAGES.childFuture },
    });
  });

  it('marks the same child listed twice', () => {
    const twice = { ...masha, key: 'child-2', firstName: ' маша ' };

    expect(validateChildren({ ...form, children: [masha, twice] }, NOW)).toEqual({
      'child-2': { firstName: MESSAGES.childTwice },
    });
  });

  it('does not check children of an employee: they are not sent', () => {
    const empty = { ...masha, firstName: '' };

    expect(validateChildren({ ...form, role: 'EMPLOYEE', children: [empty] }, NOW)).toEqual({});
  });
});

describe('registration request', () => {
  it('sends the role and children of a parent', () => {
    const request = toRegistrationRequest(
      { ...form, children: [masha, { ...masha, key: 'child-2', firstName: 'Петя', patronymic: ' Ивановна ' }] },
      'org-1',
      'v1'
    );

    expect(request.role).toBe('PARENT');
    expect(request.email).toBe('olga@mail.ru');
    expect(request.children).toEqual([
      { surname: 'Иванова', first_name: 'Маша', birth_date: '2022-05-01', gender: 'FEMALE' },
      { surname: 'Иванова', first_name: 'Петя', patronymic: 'Ивановна', birth_date: '2022-05-01', gender: 'FEMALE' },
    ]);
  });

  it('does not send children of an employee or an empty list', () => {
    expect(toRegistrationRequest({ ...form, role: 'EMPLOYEE' }, 'org-1', 'v1')).not.toHaveProperty('children');
    expect(toRegistrationRequest({ ...form, children: [] }, 'org-1', 'v1')).not.toHaveProperty('children');
    expect(toRegistrationRequest({ ...form, role: 'EMPLOYEE' }, 'org-1', 'v1').role).toBe('EMPLOYEE');
  });
});
