import type { RequestConfig } from './types';
import { toIsoDate, visitControlApi } from './visit-control-api';

type WireDate = string | number[];
type DateRange = { from: string; to: string };
type WireRange = { from: WireDate; to: WireDate };

export type AbsenceReason = { code: string; name: string; comment_required: boolean };
export type AbsenceOption = DateRange & { working_days: number; paid_days: string[] };
export type AbsenceNotice = DateRange & {
  external_key: string;
  reason: string;
  comment?: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  editable: boolean;
  cancellable: boolean;
  return_date: string | null;
  paid_days: { date: string; waived: boolean }[];
  cancel_effect?: { kind: 'CANCEL' | 'SHORTEN' | 'NONE'; return_date: string | null } | null;
};

type WireNotice = Omit<AbsenceNotice, keyof DateRange | 'return_date' | 'paid_days' | 'cancel_effect'> & WireRange & {
  return_date?: WireDate | null;
  paid_days?: { date: WireDate; waived: boolean }[];
  cancel_effect?: { kind: 'CANCEL' | 'SHORTEN' | 'NONE'; return_date?: WireDate | null } | null;
};

export type AbsenceRules = {
  today_date: string;
  earliest_from: string;
  first_free_day?: string;
  max_days: number | null;
  max_days_ahead?: number | null;
  supports_exact_paid_days?: boolean;
  can_report: boolean;
  deadline_enabled: boolean;
  deadline: string | null;
  time_zone: string;
  today: AbsenceOption | null;
  tomorrow: AbsenceOption | null;
  period: AbsenceOption | null;
  current: AbsenceNotice | null;
  reasons: AbsenceReason[];
};

type WireOption = Omit<AbsenceOption, keyof DateRange | 'paid_days'> & WireRange & { paid_days: WireDate[] };
type WireRules = Omit<AbsenceRules, 'today_date' | 'earliest_from' | 'first_free_day' | 'today' | 'tomorrow' | 'period' | 'current'> & {
  today_date: WireDate;
  earliest_from: WireDate;
  first_free_day?: WireDate;
  today?: WireOption;
  tomorrow?: WireOption;
  period?: WireOption;
  current?: WireNotice;
};

const config: RequestConfig = { skipLogging: true, skipErrorHandling: true };

function date(value: WireDate): string {
  const iso = toIsoDate(value);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Некорректная дата отсутствия');
  return iso;
}

function option(value?: WireOption): AbsenceOption | null {
  if (!value) return null;
  return { ...value, from: date(value.from), to: date(value.to), paid_days: value.paid_days.map(date) };
}

function notice(value: WireNotice): AbsenceNotice {
  return {
    ...value,
    from: date(value.from),
    to: date(value.to),
    return_date: toIsoDate(value.return_date),
    paid_days: (value.paid_days ?? []).map((day) => ({ ...day, date: date(day.date) })),
    cancel_effect: value.cancel_effect && {
      ...value.cancel_effect,
      return_date: toIsoDate(value.cancel_effect.return_date),
    },
  };
}

export function absencePaidDates(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.flatMap((item) => {
    const parsed = typeof item === 'string' || Array.isArray(item) ? toIsoDate(item) : null;
    return parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? [parsed] : [];
  }))].sort() : [];
}

export async function getAbsenceRules(child: string, signal?: AbortSignal, period?: DateRange): Promise<AbsenceRules> {
  const data = await visitControlApi.get<WireRules>('/absence/rules', { ...config, signal, params: { child, ...period } });
  return {
    ...data,
    today_date: date(data.today_date),
    earliest_from: date(data.earliest_from),
    first_free_day: data.first_free_day ? date(data.first_free_day) : undefined,
    today: option(data.today),
    tomorrow: option(data.tomorrow),
    period: option(data.period),
    current: data.current ? notice(data.current) : null,
  };
}

export async function getChildAbsences(child: string, from: string, signal?: AbortSignal): Promise<AbsenceNotice[]> {
  const data = await visitControlApi.get<WireNotice[]>('/absence', { ...config, signal, params: { child, from } });
  return data.map(notice).filter((entry) => entry.status === 'ACTIVE')
    .sort((left, right) => left.from.localeCompare(right.from));
}

export function absenceDayDistance(from: string, to: string): number {
  return (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000;
}

export function shiftAbsenceDay(day: string, offset: number): string {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

type AbsenceWrite = {
  to: string;
  reason: string;
  comment: string;
  accept_paid_days: boolean;
  accepted_paid_days?: string[];
};

export async function createAbsence(
  body: AbsenceWrite & { child_external_key: string; from: string },
): Promise<AbsenceNotice> {
  return notice(await visitControlApi.post<WireNotice>('/absence', body, config));
}

export async function updateAbsence(key: string, body: Partial<AbsenceWrite>): Promise<AbsenceNotice> {
  return notice(await visitControlApi.patch<WireNotice>('/absence/' + encodeURIComponent(key), body, config));
}

export async function cancelAbsence(key: string): Promise<AbsenceNotice> {
  return notice(await visitControlApi.post<WireNotice>('/absence/' + encodeURIComponent(key) + '/cancel', undefined, config));
}
