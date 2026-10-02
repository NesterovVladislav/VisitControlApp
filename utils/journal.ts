import { VisitEntry } from '@/store/types/visits';
import { childrenLabel } from './garden';
import { dayTitle, localDayKey, timeOfDay } from './visit-dates';

const WITHOUT_GROUP_KEY = 'without-group';

/** Пребывание в саду: приход и уход. null — отметки нет (или она на ещё не загруженной странице). */
export interface JournalInterval {
  in: string | null;
  out: string | null;
}

/** Ребёнок в журнале за день: когда пришёл и ушёл, кто привёл и забрал. */
export interface JournalChildRow {
  key: string;
  childName: string;
  intervals: JournalInterval[];
  /** Кто отметил первый приход за день */
  broughtBy: string | null;
  /** Кто отметил последний уход за день */
  pickedUpBy: string | null;
  /** Сейчас в саду: сегодня и последний приход без ухода */
  inNow: boolean;
  /** День не сегодняшний, а ухода после прихода нет */
  exitMissing: boolean;
}

/** Группа в дне журнала. У первой группы дня — заголовок дня. */
export interface JournalSection {
  key: string;
  dayTitle: string | null;
  title: string;
  data: JournalChildRow[];
}

const collator = new Intl.Collator('ru');

function childRow(dayKey: string, entries: VisitEntry[], today: boolean): JournalChildRow {
  // Внутри дня — по времени, от утра к вечеру
  const sorted = [...entries].sort((a, b) => a.datetime.localeCompare(b.datetime));
  const intervals: JournalInterval[] = [];
  let broughtBy: string | null = null;
  let pickedUpBy: string | null = null;
  for (const entry of sorted) {
    const last = intervals[intervals.length - 1];
    if (entry.status === 'IN') {
      intervals.push({ in: entry.datetime, out: null });
      broughtBy ??= entry.representativeName;
    } else {
      if (last && last.in && !last.out) {
        last.out = entry.datetime;
      } else {
        intervals.push({ in: null, out: entry.datetime });
      }
      pickedUpBy = entry.representativeName;
    }
  }
  const last = intervals[intervals.length - 1];
  const open = Boolean(last?.in && !last.out);
  return {
    key: `${dayKey}|${sorted[0].childId}`,
    childName: sorted[0].childName,
    intervals,
    broughtBy,
    pickedUpBy,
    inNow: today && open,
    exitMissing: !today && open,
  };
}

/**
 * Журнал по дням, внутри дня — по группам (нынешняя группа ребёнка), в группе — по строке на ребёнка.
 * Группы по названию, «Без группы» — в конце дня; дети по имени. Филиал в заголовке — если филиалов несколько.
 */
export function journalSections(items: VisitEntry[], showBranch: boolean, now: Date = new Date()): JournalSection[] {
  const todayKey = localDayKey(now.toISOString());
  // Дни в порядке ленты (новые сверху); внутри дня — отметки по детям
  const days = new Map<string, { title: string; byChild: Map<string, VisitEntry[]> }>();
  for (const entry of items) {
    const dayKey = localDayKey(entry.datetime);
    let day = days.get(dayKey);
    if (!day) {
      day = { title: dayTitle(entry.datetime, now), byChild: new Map() };
      days.set(dayKey, day);
    }
    day.byChild.set(entry.childId, [...(day.byChild.get(entry.childId) ?? []), entry]);
  }

  const result: JournalSection[] = [];
  for (const [dayKey, day] of days) {
    const groups = new Map<string, { name: string; branchName: string | null; rows: JournalChildRow[] }>();
    for (const entries of day.byChild.values()) {
      // Группа — по последней отметке: у всех отметок ребёнка она одна и та же, нынешняя
      const group = entries[0].group;
      const groupKey = group?.id ?? WITHOUT_GROUP_KEY;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { name: group?.name ?? 'Без группы', branchName: group?.branchName ?? null, rows: [] });
      }
      groups.get(groupKey)!.rows.push(childRow(dayKey, entries, dayKey === todayKey));
    }
    const ordered = [...groups].sort(([aKey, a], [bKey, b]) => {
      if (aKey === WITHOUT_GROUP_KEY || bKey === WITHOUT_GROUP_KEY) {
        return aKey === WITHOUT_GROUP_KEY ? 1 : -1;
      }
      return collator.compare(a.name, b.name) || collator.compare(a.branchName ?? '', b.branchName ?? '');
    });
    ordered.forEach(([groupKey, group], index) => {
      const branch = showBranch && group.branchName ? ` · ${group.branchName}` : '';
      result.push({
        key: `${dayKey}|${groupKey}`,
        dayTitle: index === 0 ? day.title : null,
        title: `${group.name}${branch} · ${childrenLabel(group.rows.length)}`,
        data: group.rows.sort((a, b) => collator.compare(a.childName, b.childName)),
      });
    });
  }
  return result;
}

/** «08:40 → 17:30», «08:55 → ещё в саду», «? → 17:30», несколько пребываний — через запятую. */
export function intervalsLabel(row: Pick<JournalChildRow, 'intervals' | 'inNow' | 'exitMissing'>): string {
  return row.intervals
    .map((interval, index) => {
      const last = index === row.intervals.length - 1;
      const start = interval.in ? timeOfDay(interval.in) : '?';
      let end = interval.out ? timeOfDay(interval.out) : '?';
      if (!interval.out && last && row.inNow) {
        end = 'ещё в саду';
      } else if (!interval.out && last && row.exitMissing) {
        end = 'уход не отмечен';
      }
      return `${start} → ${end}`;
    })
    .join(', ');
}

/**
 * «Приход — Иванова А. · Уход — Иванов С.». Без глаголов «привела / забрал»: пол представителя сервер не отдаёт.
 */
export function representativesLabel(row: Pick<JournalChildRow, 'broughtBy' | 'pickedUpBy'>): string | null {
  const parts: string[] = [];
  if (row.broughtBy) {
    parts.push(`Приход — ${row.broughtBy}`);
  }
  if (row.pickedUpBy) {
    parts.push(`Уход — ${row.pickedUpBy}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
