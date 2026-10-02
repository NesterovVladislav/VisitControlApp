import { PeopleCategory, Person } from '@/store/types/people';
import { ageOn } from './input-masks';
import { plural } from './plural';
import { roleLabel } from './profile-format';

type Gender = Person['gender'];

/** «Иванова Мария» */
export function personName(person: Pick<Person, 'surname' | 'firstName'>): string {
  return `${person.surname} ${person.firstName}`.trim();
}

/**
 * Кем человек приходится ребёнку, с учётом его пола: «мама», «папа», «родственница», «знакомый».
 * Если пол неизвестен — нейтрально: «родитель», «родственник», «знакомый».
 */
export function linkLabel(linkRole: string | null, gender: Gender): string {
  const female = gender === 'FEMALE';
  switch (linkRole) {
    case 'PARENT':
      return gender === 'FEMALE' ? 'мама' : gender === 'MALE' ? 'папа' : 'родитель';
    case 'RELATIVE':
      return female ? 'родственница' : 'родственник';
    case 'ACQUAINTANCE':
      return female ? 'знакомая' : 'знакомый';
    default:
      return 'представитель';
  }
}

/**
 * Строка под именем родителя: «мама: Мария, Пётр · родственница: Илья» или «детей не привязано».
 */
export function parentSubtitle(person: Pick<Person, 'children' | 'gender'>): string {
  const children = person.children ?? [];
  if (children.length === 0) {
    return 'детей не привязано';
  }
  const byLabel = new Map<string, string[]>();
  for (const child of children) {
    const label = linkLabel(child.linkRole, person.gender);
    byLabel.set(label, [...(byLabel.get(label) ?? []), child.firstName]);
  }
  return [...byLabel].map(([label, names]) => `${label}: ${names.join(', ')}`).join(' · ');
}

/** «5 лет»; null — дата рождения неизвестна или некорректна. */
export function ageLabel(birthDate: string | null, now: Date = new Date()): string | null {
  const match = birthDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate) : null;
  if (!match) {
    return null;
  }
  const age = ageOn(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))), now);
  return age >= 0 ? `${age} ${plural(age, ['год', 'года', 'лет'])}` : null;
}

/**
 * Строка под именем ребёнка: «Солнышко · Центральный · 5 лет» или «Без группы · 4 года».
 * Филиал — только если филиалов несколько.
 */
export function childSubtitle(person: Pick<Person, 'group' | 'birthDate'>, showBranch: boolean, now?: Date): string {
  const parts: string[] = [];
  if (person.group) {
    parts.push(person.group.name);
    if (showBranch && person.group.branchName) {
      parts.push(person.group.branchName);
    }
  } else {
    parts.push('Без группы');
  }
  const age = ageLabel(person.birthDate, now);
  if (age) {
    parts.push(age);
  }
  return parts.join(' · ');
}

/** Строка под именем сотрудника: «Администратор», «Сотрудник». */
export function staffSubtitle(person: Pick<Person, 'role'>): string {
  return person.role ? roleLabel(person.role) : '';
}

const COUNT_FORMS: Record<PeopleCategory, [string, string, string]> = {
  CHILD: ['ребёнок', 'ребёнка', 'детей'],
  PARENT: ['родитель', 'родителя', 'родителей'],
  STAFF: ['сотрудник', 'сотрудника', 'сотрудников'],
};

/** «124 ребёнка», «187 родителей», «6 сотрудников». */
export function countLabel(category: PeopleCategory, total: number): string {
  return `${total} ${plural(total, COUNT_FORMS[category])}`;
}

/** Что показать, когда в группе никого. */
export function emptyLabel(category: PeopleCategory, q: string): string {
  if (q.trim()) {
    return `Никого не нашли по запросу «${q.trim()}»`;
  }
  switch (category) {
    case 'CHILD':
      return 'Детей пока нет';
    case 'PARENT':
      return 'Родителей пока нет. Обычно они приходят через «Заявки»';
    case 'STAFF':
      return 'Сотрудников пока нет';
  }
}
