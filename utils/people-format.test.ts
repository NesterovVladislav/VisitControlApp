import { Person } from '@/store/types/people';
import { ageLabel, childSubtitle, countLabel, emptyLabel, linkLabel, parentSubtitle, staffSubtitle } from './people-format';

const child = (firstName: string, linkRole: string | null) => ({ id: firstName, firstName, surname: 'Иванов', linkRole });

describe('people format', () => {
  it('names the link by role and gender', () => {
    expect(linkLabel('PARENT', 'FEMALE')).toBe('мама');
    expect(linkLabel('PARENT', 'MALE')).toBe('папа');
    expect(linkLabel('PARENT', null)).toBe('родитель');
    expect(linkLabel('RELATIVE', 'FEMALE')).toBe('родственница');
    expect(linkLabel('ACQUAINTANCE', 'MALE')).toBe('знакомый');
  });

  it('groups children of a parent by link', () => {
    expect(parentSubtitle({ gender: 'FEMALE', children: [child('Мария', 'PARENT'), child('Пётр', 'PARENT')] }))
      .toBe('мама: Мария, Пётр');
    expect(parentSubtitle({ gender: 'FEMALE', children: [child('Мария', 'PARENT'), child('Илья', 'RELATIVE')] }))
      .toBe('мама: Мария · родственница: Илья');
    expect(parentSubtitle({ gender: 'MALE', children: [] })).toBe('детей не привязано');
  });

  it('describes a child with group, branch and age', () => {
    const now = new Date(Date.UTC(2026, 8, 28));
    const group: Person['group'] = { id: 'g', name: 'Солнышко', branchId: 'b', branchName: 'Центральный' };
    expect(childSubtitle({ group, birthDate: '2021-06-05' }, true, now)).toBe('Солнышко · Центральный · 5 лет');
    expect(childSubtitle({ group, birthDate: '2021-06-05' }, false, now)).toBe('Солнышко · 5 лет');
    expect(childSubtitle({ group: null, birthDate: '2022-10-01' }, true, now)).toBe('Без группы · 3 года');
    expect(ageLabel(null)).toBeNull();
  });

  it('labels staff, counts and empty states', () => {
    expect(staffSubtitle({ role: 'EMPLOYEE' })).toBe('Сотрудник');
    expect(countLabel('CHILD', 124)).toBe('124 ребёнка');
    expect(countLabel('PARENT', 187)).toBe('187 родителей');
    expect(countLabel('STAFF', 1)).toBe('1 сотрудник');
    expect(emptyLabel('CHILD', ' Иваноа ')).toBe('Никого не нашли по запросу «Иваноа»');
  });
});
