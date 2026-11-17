import { ADMIN_ROLE, DIRECTOR_ROLE, EMPLOYEE_ROLE, User, isAdminRole, outranks } from '@/store/types/auth';
import { PasswordReset, Person, StaffRole } from '@/store/types/people';

/** Роль ребёнка в бэкенде. */
export const CHILD_ROLE = 'VISITOR';

type Viewer = Pick<User, 'id' | 'role'> | null | undefined;

export function isChild(person: Pick<Person, 'role'>): boolean {
  return person.role === CHILD_ROLE;
}

/**
 * Управляет ли администратор этим человеком: свой сад, роль строго ниже своей, не он сам.
 * Так же проверяет бэкенд (UserAccessServiceImpl.lockManagedUser).
 */
export function canManagePerson(viewer: Viewer, person: Pick<Person, 'id' | 'role'>): boolean {
  return !!viewer && isAdminRole(viewer.role) && person.id !== viewer.id && outranks(viewer.role, person.role);
}

/** Сброс пароля: взрослому с email — новый пароль уходит письмом. */
export function canResetPassword(viewer: Viewer, person: Pick<Person, 'id' | 'role' | 'email'>): boolean {
  return canManagePerson(viewer, person) && !isChild(person) && !!person.email;
}

export function canDeactivate(viewer: Viewer, person: Pick<Person, 'id' | 'role'>): boolean {
  return canManagePerson(viewer, person);
}

/**
 * Какую роль директор может дать человеку: сотрудника — сделать администратором, администратора — сотрудником.
 * Администраторов назначает только директор (на бэкенде — роль строго ниже своей). У родителей кнопки нет.
 */
export function staffRoleChange(viewer: Viewer, person: Pick<Person, 'id' | 'role'>): StaffRole | null {
  if (!viewer || viewer.role !== DIRECTOR_ROLE || person.id === viewer.id) {
    return null;
  }
  if (person.role === EMPLOYEE_ROLE) return ADMIN_ROLE;
  if (person.role === ADMIN_ROLE) return EMPLOYEE_ROLE;
  return null;
}

/** Привязать ребёнка можно к любому взрослому сада, в том числе к себе. */
export function canLinkChild(viewer: Viewer, person: Pick<Person, 'role'>): boolean {
  return !!viewer && isAdminRole(viewer.role) && !isChild(person);
}

/** Текст диалога с результатом сброса пароля; null — показывать нечего. */
export function passwordResetMessage(reset: PasswordReset): { title: string; text?: string } | null {
  switch (reset.status) {
    case 'sent':
      return { title: 'Пароль сброшен', text: 'Новый пароль отправлен на email пользователя.' };
    case 'notSent':
      return {
        title: 'Пароль сброшен, но письмо не отправлено',
        text: 'Старый пароль уже не работает. Сбросьте пароль ещё раз, чтобы отправить письмо повторно.',
      };
    case 'failed':
      return reset.message ? { title: 'Пароль не сброшен', text: reset.message } : null;
    default:
      return null;
  }
}
