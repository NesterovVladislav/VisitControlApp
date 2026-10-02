import { GardenEditError } from '@/store/types/garden';
import { Presence, PresenceGroup } from '@/store/types/visits';
import { plural } from './plural';
import { BranchSummary, WITHOUT_GROUP_ID, branchSummaries, groupsOf } from './presence';

/** Длина названия филиала и группы — как @Size(max = 100) на бэкенде. */
export const NAME_MAX_LENGTH = 100;

export function childrenLabel(count: number): string {
  return `${count} ${plural(count, ['ребёнок', 'ребёнка', 'детей'])}`;
}

export function groupsLabel(count: number): string {
  return `${count} ${plural(count, ['группа', 'группы', 'групп'])}`;
}

/**
 * Строки экрана филиалов «Сада»: филиалы и при необходимости «Другие группы». Строки «Без группы» из «Посещения»
 * здесь нет: в «Саде» дети без группы считаются все, а не только те, кто сейчас в саду.
 */
export function gardenBranches(presence: Presence): BranchSummary[] {
  return branchSummaries(presence).filter((item) => item.id !== WITHOUT_GROUP_ID);
}

/** «4 группы · 58 детей» или «Групп пока нет». */
export function branchSubtitle(item: Pick<BranchSummary, 'groupCount' | 'total'>): string {
  if (item.groupCount === 0) {
    return 'Групп пока нет';
  }
  return `${groupsLabel(item.groupCount)} · ${childrenLabel(item.total ?? 0)}`;
}

/** «18 детей · в саду 15» или «Детей пока нет». */
export function groupSubtitle(group: Pick<PresenceGroup, 'totalChildren' | 'present'>): string {
  if (group.totalChildren === 0) {
    return 'Детей пока нет';
  }
  return `${childrenLabel(group.totalChildren)} · в саду ${group.present.length}`;
}

export function findPresenceGroup(presence: Presence, groupId: string): PresenceGroup | null {
  return presence.groups?.find((group) => group.id === groupId) ?? null;
}

/** Названия, с которыми новое совпадать не должно: активные филиалы или группы филиала, кроме изменяемого. */
export function takenNames(presence: Presence, kind: 'branch' | 'group', branchId: string | null, selfId: string | null): string[] {
  const items = kind === 'branch' ? presence.branches : branchId ? groupsOf(presence, branchId) : [];
  return items.filter((item) => item.id !== selfId).map((item) => item.name);
}

/** Как на бэкенде: пробелы по краям не считаются, регистр не важен. */
export function isNameTaken(name: string, taken: string[]): boolean {
  const normalized = name.trim().toLocaleLowerCase('ru');
  return taken.some((item) => item.trim().toLocaleLowerCase('ru') === normalized);
}

/**
 * Почему нельзя удалить: «В филиале „Центральный“ 4 группы…» или «В группе „Ромашка“ 18 детей…».
 */
export function notEmptyMessage(kind: 'branch' | 'group', name: string, count: number | null): string {
  if (kind === 'branch') {
    const what = count ? `${groupsLabel(count)}` : 'есть группы';
    return `В филиале «${name}» ${what}. Сначала удалите их или перенесите в другой филиал`;
  }
  const what = count ? `${childrenLabel(count)}` : 'есть дети';
  return `В группе «${name}» ${what}. Сначала переведите их в другие группы или уберите из группы`;
}

/** Текст ошибки изменения для диалога или сообщения. */
export function gardenErrorMessage(error: GardenEditError, kind: 'branch' | 'group', name: string): string {
  switch (error.kind) {
    case 'nameTaken':
      return 'Такое название уже есть';
    case 'notEmpty':
      return notEmptyMessage(kind, name, error.count);
    case 'gone':
      return kind === 'branch' ? 'Филиал уже удалён' : 'Группа уже удалена';
    case 'network':
      return 'Нет соединения. Попробуйте ещё раз';
    case 'generic':
      return 'Не удалось сохранить изменения. Попробуйте позже';
  }
}
