import { PresenceGroup, QueueFilter, VisitQueueItem } from '@/store/types/visits';
import { linkLabel } from './people-format';
import { timeOfDay } from './visit-dates';

/** Причины отклонения: первые подставляются в поле одним нажатием, свою можно вписать. */
export const REJECT_REASONS: Record<'IN' | 'OUT', string[]> = {
  IN: ['Ребёнка нет', 'Отметка по ошибке', 'Не принят по состоянию здоровья'],
  OUT: ['Ребёнка не забирали', 'Отметка по ошибке'],
};

/** Наибольшая длина причины отклонения (visit_log.decision_comment на бэкенде). */
export const REJECT_REASON_MAX_LENGTH = 500;

export interface QueueSection {
  key: string;
  title: string;
  data: VisitQueueItem[];
}

const WITHOUT_GROUP_KEY = 'without-group';
const collator = new Intl.Collator('ru');

/** Очередь по группам: группы по названию, «Без группы» — в конце; внутри группы — по времени отметки. */
export function queueSections(items: VisitQueueItem[]): QueueSection[] {
  const sections = new Map<string, QueueSection>();
  for (const item of items) {
    const key = item.group?.id ?? WITHOUT_GROUP_KEY;
    if (!sections.has(key)) {
      sections.set(key, { key, title: item.group?.name ?? 'Без группы', data: [] });
    }
    sections.get(key)!.data.push(item);
  }
  const ordered = [...sections.values()].sort((a, b) => {
    if (a.key === WITHOUT_GROUP_KEY || b.key === WITHOUT_GROUP_KEY) {
      return a.key === WITHOUT_GROUP_KEY ? 1 : -1;
    }
    return collator.compare(a.title, b.title);
  });
  ordered.forEach((section) => section.data.sort((a, b) => a.datetime.localeCompare(b.datetime)));
  return ordered;
}

/** «Приход — Иванова А. (родитель)» / «Забирает — Сидоров И. (родственник)» */
export function queueWhoLabel(item: Pick<VisitQueueItem, 'status' | 'representativeName' | 'linkRole'>): string {
  const action = item.status === 'IN' ? 'Привёл(а)' : 'Забирает';
  const link = item.linkRole ? ` (${linkLabel(item.linkRole, null)})` : '';
  return `${action} — ${item.representativeName}${link}`;
}

export function queueTime(item: Pick<VisitQueueItem, 'datetime'>): string {
  return timeOfDay(item.datetime);
}

/** «Все группы» или «Солнышко, Ромашка, без группы» — что сейчас выбрано для очереди. */
export function filterLabel(filter: QueueFilter | null, groups: Pick<PresenceGroup, 'id' | 'name'>[]): string {
  if (!filter || (filter.groupIds.length === 0 && !filter.withoutGroup)) {
    return 'Все группы';
  }
  const names = groups.filter((group) => filter.groupIds.includes(group.id)).map((group) => group.name);
  if (filter.withoutGroup) {
    names.push('без группы');
  }
  // Выбранные группы могли удалить: тогда показываем просто число
  return names.length > 0 ? names.join(', ') : 'Выбранные группы';
}
