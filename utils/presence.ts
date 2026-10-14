import { PersonGroup } from '@/store/types/people';
import { Presence, PresenceGroup, PresentChild } from '@/store/types/visits';

/** Псевдофилиал для детей в саду, которые не состоят ни в одной группе. */
export const WITHOUT_GROUP_ID = 'without-group';
/** Псевдофилиал для групп, чей филиал не пришёл в /branch/list (например, закрыт). */
export const OTHER_GROUPS_ID = 'other-groups';

export interface BranchSummary {
  id: string;
  name: string;
  /** Сколько детей из групп филиала сейчас в саду */
  present: number;
  /** Сколько всего детей в группах филиала; null — для детей без группы, у них «всего» нет */
  total: number | null;
  groupCount: number;
}

export interface PresentSection {
  key: string;
  title: string;
  /** Группа секции; null — дети без группы или общий список */
  group: { id: string; name: string } | null;
  /** Текст под заголовком, когда строк нет: «Детей пока нет» или «Сейчас никого нет» */
  emptyText: string | null;
  data: PresentChild[];
}

/**
 * Группы филиала по названию; для OTHER_GROUPS_ID — группы без известного филиала.
 */
export function groupsOf(presence: Presence, branchId: string): PresenceGroup[] {
  const groups = presence.groups ?? [];
  if (branchId === OTHER_GROUPS_ID) {
    const known = new Set(presence.branches.map((branch) => branch.id));
    return groups.filter((group) => !group.branchId || !known.has(group.branchId));
  }
  return groups.filter((group) => group.branchId === branchId);
}

function summary(id: string, name: string, groups: PresenceGroup[]): BranchSummary {
  return {
    id,
    name,
    present: groups.reduce((sum, group) => sum + group.present.length, 0),
    total: groups.reduce((sum, group) => sum + group.totalChildren, 0),
    groupCount: groups.length,
  };
}

/**
 * Строки экрана выбора филиала: филиалы по названию, затем группы без известного филиала и дети без группы.
 */
export function branchSummaries(presence: Presence): BranchSummary[] {
  const result = presence.branches.map((branch) => summary(branch.id, branch.name, groupsOf(presence, branch.id)));
  const other = groupsOf(presence, OTHER_GROUPS_ID);
  if (other.length > 0) {
    result.push(summary(OTHER_GROUPS_ID, 'Другие группы', other));
  }
  if (presence.withoutGroup.length > 0) {
    result.push({
      id: WITHOUT_GROUP_ID,
      name: 'Без группы',
      present: presence.withoutGroup.length,
      total: null,
      groupCount: 0,
    });
  }
  return result;
}

/**
 * Название строки по id: филиал, «Другие группы» или «Без группы». null — такого филиала больше нет.
 */
export function branchName(presence: Presence, branchId: string): string | null {
  return branchSummaries(presence).find((item) => item.id === branchId)?.name ?? null;
}

/**
 * Секции экрана филиала: все группы по названию (порядок задаёт сервер), в том числе пустые —
 * чтобы администратор видел новую группу и мог добавить в неё детей. Для «Без группы» — один список без заголовка.
 */
/** « · ждут приёма: 2 · ждут выдачи: 1» — отметки, которые сад ещё не подтвердил. */
export function pendingSuffix(group: Pick<PresenceGroup, 'pendingIn' | 'pendingOut'>): string {
  const parts: string[] = [];
  if (group.pendingIn) {
    parts.push(`ждут приёма: ${group.pendingIn}`);
  }
  if (group.pendingOut) {
    parts.push(`ждут выдачи: ${group.pendingOut}`);
  }
  return parts.map((part) => ` · ${part}`).join('');
}

export function branchSections(presence: Presence, branchId: string): PresentSection[] {
  if (branchId === WITHOUT_GROUP_ID) {
    return presence.withoutGroup.length > 0
      ? [{ key: WITHOUT_GROUP_ID, title: '', group: null, emptyText: null, data: presence.withoutGroup }]
      : [];
  }
  return groupsOf(presence, branchId).map((group) => {
    const noChildren = group.totalChildren === 0 && group.present.length === 0;
    return {
      key: group.id,
      title: noChildren
        ? group.name
        : `${group.name} · ${group.present.length} из ${group.totalChildren}${pendingSuffix(group)}`,
      group: { id: group.id, name: group.name },
      emptyText: noChildren ? 'Детей пока нет' : group.present.length === 0 ? 'Сейчас никого нет' : null,
      data: group.present,
    };
  });
}

/**
 * Группа для экрана «Добавить в группу»: название и филиал. null — группы больше нет.
 */
export function findGroup(presence: Presence, groupId: string): PersonGroup | null {
  const group = presence.groups?.find((item) => item.id === groupId);
  if (!group) {
    return null;
  }
  const branch = presence.branches.find((item) => item.id === group.branchId);
  return { id: group.id, name: group.name, branchId: group.branchId, branchName: branch?.name ?? null };
}

/**
 * Показывать ли сразу группы без выбора филиала: филиал один, и нет ни «Без группы», ни «Других групп».
 * Возвращает id этого филиала или null.
 */
export function singleBranchId(presence: Presence): string | null {
  const items = branchSummaries(presence);
  return items.length === 1 && items[0].id !== WITHOUT_GROUP_ID ? items[0].id : null;
}
