import { absenceDayDistance, shiftAbsenceDay } from './absence';
import { toIsoDate, visitControlApi } from './visit-control-api';

const statuses = ['FULL', 'FIRST_HALF', 'SECOND_HALF', 'NONE', 'NOT_IN_GROUP'] as const;
type AttendanceStatus = (typeof statuses)[number];
export type AttendanceRange = { from: string; to: string };
export type AttendanceDay = {
  date: string;
  working: boolean;
  future: boolean;
  holiday: string | null;
  status: AttendanceStatus;
  reason: string | null;
  absencePeriod?: AttendanceRange;
  paid: boolean;
};
export type AttendanceSummary = {
  full: number;
  half: number;
  absent: number;
  paid: number;
  reasons: { reason: string; count: number }[];
};
export type AttendanceChild = {
  id: string;
  name: string;
  groups: { name: string; branch: string | null; from: string; to: string | null }[];
  days: AttendanceDay[];
  summary: AttendanceSummary;
};

type WireDate = string | number[];
type WireDay = { date: WireDate; working: boolean; future: boolean; holiday?: string | null };
type WireChild = {
  external_key: string;
  full_name: string;
  groups: { name: string; branch_name?: string | null; from: WireDate; to: WireDate | null }[];
  days: AttendanceStatus[];
  absence_reasons: (string | null)[];
  absence_paid: boolean[];
  full_days: number;
  half_days: number;
  absences: number;
  absences_by_reason: Record<string, number>;
  absence_notices?: { from: WireDate; to: WireDate; reason: string }[];
  paid_absences: number;
};
type WireReport = { from: WireDate; to: WireDate; days: WireDay[]; children: WireChild[] };

const privateRequest = { skipLogging: true, skipErrorHandling: true };

function invalidReport(): never {
  throw new Error('Некорректный табель посещений');
}

function decodeDate(value: WireDate): string {
  const iso = toIsoDate(value);
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return invalidReport();
  const date = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return invalidReport();
  return iso;
}

function decodeChild(row: WireChild, days: Omit<AttendanceDay, 'status' | 'reason' | 'paid'>[]): AttendanceChild {
  if (!row || typeof row.external_key !== 'string' || typeof row.full_name !== 'string' ||
      !Array.isArray(row.groups) || ![row.days, row.absence_reasons, row.absence_paid]
        .every((values) => Array.isArray(values) && values.length === days.length)) return invalidReport();

  const counts = { full: row.full_days, half: row.half_days, absent: row.absences, paid: row.paid_absences };
  const validCount = (count: number) => Number.isInteger(count) && count >= 0;
  if (!Object.values(counts).every(validCount)) return invalidReport();

  const wireReasons = row.absences_by_reason;
  if (!wireReasons || typeof wireReasons !== 'object' || Array.isArray(wireReasons)) return invalidReport();
  const reasonCounts = Object.entries(wireReasons);
  if (!reasonCounts.every(([, count]) => validCount(count))) return invalidReport();
  const reasons = reasonCounts.filter(([, count]) => count > 0).map(([reason, count]) => ({ reason, count }));
  const wireNotices = row.absence_notices ?? [];
  if (!Array.isArray(wireNotices)) return invalidReport();
  const notices = wireNotices.map((notice) => {
    if (!notice || typeof notice.reason !== 'string' || !notice.reason) return invalidReport();
    const from = decodeDate(notice.from);
    const to = decodeDate(notice.to);
    if (from > to) return invalidReport();
    return { from, to, reason: notice.reason };
  });

  return {
    id: row.external_key,
    name: row.full_name,
    groups: row.groups.map((group) => {
      if (!group || typeof group.name !== 'string') return invalidReport();
      return {
        name: group.name,
        branch: typeof group.branch_name === 'string' ? group.branch_name : null,
        from: decodeDate(group.from),
        to: group.to == null ? null : decodeDate(group.to),
      };
    }),
    days: days.map((day, index) => {
      const status = row.days[index];
      const reason = row.absence_reasons[index];
      const paid = row.absence_paid[index];
      if (!statuses.includes(status) || (reason !== null && typeof reason !== 'string') || typeof paid !== 'boolean') {
        return invalidReport();
      }
      const absence = day.working && status === 'NONE' && reason ? reason : null;
      const notice = absence && notices.find((entry) =>
        entry.reason === absence && entry.from <= day.date && day.date <= entry.to
      );
      const absencePeriod = notice ? { from: notice.from, to: notice.to } : undefined;
      return { ...day, status, reason: absence, paid: absence !== null && paid, absencePeriod };
    }),
    summary: { ...counts, reasons },
  };
}

export async function getOwnAttendance(range: AttendanceRange, child?: string, signal?: AbortSignal) {
  const data = await visitControlApi.get<WireReport>('/user/me/children/attendance', {
    ...privateRequest, signal, params: { ...range, ...(child ? { child } : {}) },
  });
  if (!data || decodeDate(data.from) !== range.from || decodeDate(data.to) !== range.to ||
      !Array.isArray(data.children) || !Array.isArray(data.days) ||
      data.days.length !== absenceDayDistance(range.from, range.to) + 1) return invalidReport();

  const days = data.days.map((day, index) => {
    if (!day || typeof day.working !== 'boolean' || typeof day.future !== 'boolean' ||
        (day.holiday != null && typeof day.holiday !== 'string')) return invalidReport();
    const date = decodeDate(day.date);
    if (date !== shiftAbsenceDay(range.from, index)) return invalidReport();
    return { date, working: day.working, future: day.future, holiday: day.holiday ?? null };
  });
  if (child && (data.children.length > 1 || data.children.some((row) => row?.external_key !== child))) {
    return invalidReport();
  }
  return data.children.map((row) => decodeChild(row, days));
}

export async function getAttendanceTimeZone(signal: AbortSignal): Promise<string> {
  const { time_zone } = await visitControlApi.get<{ time_zone?: string }>('/organization/current', {
    ...privateRequest, signal,
  });
  if (typeof time_zone !== 'string' || !time_zone) throw new Error('Часовой пояс сада неизвестен');
  return time_zone;
}
