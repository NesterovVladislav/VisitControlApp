import { VisitEntry } from '@/store/types/visits';
import { childrenLabel } from './garden';
import { dayTitle, localDayKey, timeOfDay } from './visit-dates';

const WITHOUT_GROUP_KEY = 'without-group';

/**
 * Пребывание в саду: приход и уход. null — отметки нет (или она на ещё не загруженной странице).
 * Кто привёл, забрал, принял и отдал — у каждого пребывания свои: за день их может быть несколько.
 */
export interface JournalInterval {
  in: string | null;
  out: string | null;
  broughtBy: string | null;
  pickedUpBy: string | null;
  acceptedBy: string | null;
  releasedBy: string | null;
  /** Приход или уход, который сад так и не подтвердил */
  unconfirmed: boolean;
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
  /** Сотрудник, который принял ребёнка (первый приход за день) */
  acceptedBy: string | null;
  /** Сотрудник, который отдал ребёнка (последний уход за день) */
  releasedBy: string | null;
  /** Есть отметка, которую сад так и не подтвердил */
  unconfirmed: boolean;
  /** Комментарии к отметкам дня, по времени */
  comments: string[];
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
  let acceptedBy: string | null = null;
  let releasedBy: string | null = null;
  let unconfirmed = false;
  const comments: string[] = [];
  for (const entry of sorted) {
    const last = intervals[intervals.length - 1];
    unconfirmed ||= entry.confirmation === 'PENDING';
    if (entry.comment) {
      comments.push(entry.comment);
    }
    const decidedBy = entry.confirmation === 'CONFIRMED' ? entry.decidedBy ?? null : null;
    const pending = entry.confirmation === 'PENDING';
    if (entry.status === 'IN') {
      intervals.push({
        in: entry.datetime,
        out: null,
        broughtBy: entry.representativeName,
        pickedUpBy: null,
        acceptedBy: decidedBy,
        releasedBy: null,
        unconfirmed: pending,
      });
      if (broughtBy === null) {
        broughtBy = entry.representativeName;
        acceptedBy = entry.confirmation === 'CONFIRMED' ? entry.decidedBy ?? null : null;
      }
    } else {
      if (last && last.in && !last.out) {
        last.out = entry.datetime;
        last.pickedUpBy = entry.representativeName;
        last.releasedBy = decidedBy;
        last.unconfirmed ||= pending;
      } else {
        intervals.push({
          in: null,
          out: entry.datetime,
          broughtBy: null,
          pickedUpBy: entry.representativeName,
          acceptedBy: null,
          releasedBy: decidedBy,
          unconfirmed: pending,
        });
      }
      pickedUpBy = entry.representativeName;
      releasedBy = entry.confirmation === 'CONFIRMED' ? entry.decidedBy ?? null : null;
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
    acceptedBy,
    releasedBy,
    unconfirmed,
    comments,
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
    // Отклонённые садом и отменённые родителем отметки — не посещения
    if (entry.confirmation === 'REJECTED' || entry.confirmation === 'CANCELLED') {
      continue;
    }
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

/**
 * «08:40 → 17:30», «08:55 → ещё в саду», «? → 17:30» — по строке на каждое пребывание за день, от утра к вечеру.
 */
export function intervalLabels(row: Pick<JournalChildRow, 'intervals' | 'inNow' | 'exitMissing'>): string[] {
  return row.intervals.map((interval, index) => {
    const last = index === row.intervals.length - 1;
    const start = interval.in ? timeOfDay(interval.in) : '?';
    let end = interval.out ? timeOfDay(interval.out) : '?';
    if (!interval.out && last && row.inNow) {
      end = 'ещё в саду';
    } else if (!interval.out && last && row.exitMissing) {
      end = 'уход не отмечен';
    }
    return `${start} → ${end}`;
  });
}

/**
 * «Приход — Иванова А. · Уход — Иванов С.». Без глаголов «привела / забрал»: пол представителя сервер не отдаёт.
 */
export function representativesLabel(row: Pick<JournalInterval, 'broughtBy' | 'pickedUpBy'>): string | null {
  const parts: string[] = [];
  if (row.broughtBy) {
    parts.push(`Приход — ${row.broughtBy}`);
  }
  if (row.pickedUpBy) {
    parts.push(`Уход — ${row.pickedUpBy}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * «Принял(а) — Петрова О. · Отдал(а) — Петрова О. · не подтверждён» — что сделал сад.
 * null — подтверждения по отметкам дня нет.
 */
export function confirmationLabel(
  row: Pick<JournalInterval, 'acceptedBy' | 'releasedBy' | 'unconfirmed'>
): string | null {
  const parts: string[] = [];
  if (row.acceptedBy) {
    parts.push(`Принял(а) — ${row.acceptedBy}`);
  }
  if (row.releasedBy) {
    parts.push(`Отдал(а) — ${row.releasedBy}`);
  }
  if (row.unconfirmed) {
    parts.push('не подтверждён');
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
