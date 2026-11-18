import { visitControlApi, toIsoDate } from './visit-control-api';
import { formatBirthDate } from '../../utils/profile-format';

type DateValue = string | number[];
type AbsenceDayReportDto = {
  date: DateValue;
  working: boolean;
  deadline_at: DateValue | null;
  total_children: number | null;
  absent_children: number;
  absent_late: number;
  branches: {
    external_key: string | null;
    name: string;
    groups: {
      external_key: string | null;
      name: string;
      total_children: number | null;
      absences: {
        external_key: string;
        child: { full_name: string };
        from: DateValue;
        to: DateValue;
        reason: string;
        comment: string | null;
        created_by: { full_name: string } | null;
        created: DateValue;
        remaining_working_days: number | null;
        paid_days?: { date: DateValue; waived: boolean }[];
      }[];
    }[];
  }[];
};

const reasons: Readonly<Record<string, string>> = {
  ILLNESS: 'Болезнь',
  VACATION: 'Отпуск',
  FAMILY: 'Семейные обстоятельства',
  OTHER: 'Другое',
};

function requiredDate(value: DateValue): string {
  const iso = toIsoDate(value);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso))) {
    throw new Error('Некорректная календарная дата в списке отсутствий');
  }
  return iso;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Значения с сервера уже по часам сада. Пояс устройства применять не нужно. */
function wallClock(value: DateValue | null): string | null {
  if (!value) return null;
  const parsed = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value) : null;
  if (typeof value === 'string') return parsed ? `${formatBirthDate(parsed[1])} в ${parsed[2]}` : null;
  const [year, month, day, hours, minutes = 0] = value;
  if (!Number.isInteger(hours)) return null;
  return `${pad(day)}.${pad(month)}.${year} в ${pad(hours)}:${pad(minutes)}`;
}

export function decodeAbsenceDay(dto: AbsenceDayReportDto) {
  const date = requiredDate(dto.date);
  return {
    date,
    working: dto.working,
    deadline: wallClock(dto.deadline_at),
    totalChildren: dto.total_children,
    absentChildren: dto.absent_children,
    lateChildren: dto.absent_late,
    branches: dto.branches.map((branch) => {
      const id = branch.external_key ?? 'no-branch';
      return {
        id,
        name: branch.name,
        groups: branch.groups.map((group) => ({
          id: group.external_key ?? `${id}-no-group`,
          name: group.name,
          totalChildren: group.total_children,
          absences: group.absences.map((absence) => {
            const paidDay = absence.paid_days?.find((day) => requiredDate(day.date) === date);
            return {
              id: absence.external_key,
              childName: absence.child.full_name,
              from: requiredDate(absence.from),
              to: requiredDate(absence.to),
              reason: reasons[absence.reason] ?? 'Причина не указана',
              comment: absence.comment,
              author: absence.created_by?.full_name,
              created: wallClock(absence.created),
              remainingDays: absence.remaining_working_days,
              late: Boolean(paidDay),
              charged: paidDay?.waived === false,
            };
          }),
        })),
      };
    }),
  };
}

export type AbsenceDay = ReturnType<typeof decodeAbsenceDay>;
export type AbsenceDayRow = AbsenceDay['branches'][number]['groups'][number]['absences'][number];

export async function getAbsenceDay(date?: string, signal?: AbortSignal): Promise<AbsenceDay> {
  const result = await visitControlApi.get<AbsenceDayReportDto>('/absence/day', {
    params: date ? { date } : undefined,
    signal,
    skipLogging: true,
    skipErrorHandling: true,
  });
  return decodeAbsenceDay(result);
}

/** Запрос проверяет календарь сада, а выходные по договорённости всегда нерабочие. */
export async function getNeighboringAbsenceDay(date: string, direction: -1 | 1, signal: AbortSignal): Promise<AbsenceDay> {
  const cursor = new Date(`${date}T00:00:00Z`);
  for (let day = 0; day < 31; day++) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const report = await getAbsenceDay(cursor.toISOString().slice(0, 10), signal);
    if (report.working) return report;
  }
  throw new Error('Ближайший рабочий день не найден');
}
