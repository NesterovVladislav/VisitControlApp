import { ChildChange, ChildData, ChildRequest } from '@/store/types/child-requests';
import { formatBirthDate, roleLabel } from './profile-format';

/** Роли, которым доступно «Добавить ребёнка»: все, кто состоит в саду и может быть родителем. */
const ROLES_WITH_CHILDREN = ['PARENT', 'EMPLOYEE', 'ADMIN', 'DIRECTOR'];

export function canAddChild(role: string | null | undefined): boolean {
  return ROLES_WITH_CHILDREN.includes(role ?? '');
}

/** «Иванов Петя Сергеевич» */
export function childRequestName(request: Pick<ChildRequest, 'surname' | 'firstName' | 'patronymic'>): string {
  return [request.surname, request.firstName, request.patronymic].filter(Boolean).join(' ');
}

/** «Ждёт подтверждения сада» / «Сад не добавил ребёнка» */
export function ownRequestStatusLabel(request: Pick<ChildRequest, 'status'>): string {
  return request.status === 'REJECTED' ? 'Сад не добавил ребёнка' : 'Ждёт подтверждения сада';
}

/** «Иванова А. · Родитель» — кто просит добавить ребёнка */
export function applicantLabel(request: Pick<ChildRequest, 'applicantName' | 'applicantRole'>): string {
  return [request.applicantName, request.applicantRole ? roleLabel(request.applicantRole) : null]
    .filter(Boolean)
    .join(' · ');
}

/** «Иванов Петя · 12.03.2021» */
export function childRequestSummary(
  request: Pick<ChildRequest, 'surname' | 'firstName' | 'patronymic' | 'birthDate'>
): string {
  return [childRequestName(request), formatBirthDate(request.birthDate)].filter(Boolean).join(' · ');
}

/** Подпись варианта «привязать ребёнка сада»: «Это он: Иванов Петя, 12.03.2021» */
export function matchOptionLabel(match: ChildRequest['matches'][number]): string {
  return `Уже в саду: ${[childRequestName(match), formatBirthDate(match.birthDate)].filter(Boolean).join(', ')}`;
}

const CHANGE_FIELDS: { key: keyof ChildData; label: string }[] = [
  { key: 'surname', label: 'Фамилия' },
  { key: 'firstName', label: 'Имя' },
  { key: 'patronymic', label: 'Отчество' },
  { key: 'birthDate', label: 'Дата рождения' },
];

function shown(key: keyof ChildData, value: string | null): string {
  if (!value) {
    return '—';
  }
  return key === 'birthDate' ? formatBirthDate(value) ?? value : value;
}

/** «Фамилия: Иванов → Петров» — только то, что меняется. */
export function changeDiff(change: Pick<ChildChange, 'previous' | 'next'>): string[] {
  return CHANGE_FIELDS.filter(({ key }) => (change.previous[key] ?? '') !== (change.next[key] ?? '')).map(
    ({ key, label }) => `${label}: ${shown(key, change.previous[key])} → ${shown(key, change.next[key])}`
  );
}

/** «Изменение ждёт подтверждения сада» / «Сад отклонил изменение: причина» — под именем ребёнка в профиле. */
export function ownChangeLabel(change: Pick<ChildChange, 'status' | 'reason'>): string | null {
  if (change.status === 'PENDING') {
    return 'Изменение ждёт подтверждения сада';
  }
  if (change.status === 'REJECTED') {
    return change.reason ? `Сад отклонил изменение: ${change.reason}` : 'Сад отклонил изменение';
  }
  return null;
}
