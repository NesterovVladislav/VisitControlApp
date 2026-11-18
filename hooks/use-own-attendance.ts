import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { AttendanceChild, getAttendanceTimeZone, getOwnAttendance } from '../services/api/own-attendance';
import { ApiError } from '../services/errors/api-error';
import { useAppSelector } from '../store';
import { dateInTimeZone } from '../utils/calendar-month';

type LoadResult<T> = {
  key: string;
  cacheScope?: number;
  value?: T;
  failed?: { status: number | null };
};

function useFocusedAttendanceRequest<T>(
  key: string | null,
  load: (signal: AbortSignal, update: (value: T) => void) => Promise<void>,
  cacheScope?: number
) {
  const [result, setResult] = useState<LoadResult<T> | null>(null);

  useFocusEffect(useCallback(() => {
    if (!key) return;
    let request: AbortController | undefined;
    const refresh = () => {
      request?.abort();
      const next = new AbortController();
      request = next;
      void load(next.signal, (value) => {
        if (!next.signal.aborted) setResult({ key, cacheScope, value });
      }).catch((error: unknown) => {
        if (next.signal.aborted) return;
        setResult((previous) => ({
          key,
          cacheScope,
          value: cacheScope !== undefined && previous?.cacheScope === cacheScope ? previous.value : undefined,
          failed: { status: error instanceof ApiError ? error.status : null },
        }));
      });
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      request?.abort();
      subscription.remove();
    };
  }, [key, load, cacheScope]));

  if (!key || !result) return null;
  if (result.key === key) return result;
  if (cacheScope !== undefined && result.cacheScope === cacheScope && result.value !== undefined) {
    return { key, cacheScope, value: result.value };
  }
  return null;
}

export function useAttendanceToday(enabled: boolean, retry = 0) {
  const scope = useAppSelector((state) => state.auth.sessionEpoch);
  const load = useCallback(async (signal: AbortSignal, update: (today: string) => void) => {
    const timeZone = await getAttendanceTimeZone(signal);
    if (signal.aborted) return;

    let today = dateInTimeZone(timeZone);
    update(today);
    const timer = setInterval(() => {
      const next = dateInTimeZone(timeZone);
      if (today === next) return;
      today = next;
      update(today);
    }, 30_000);
    signal.addEventListener('abort', () => clearInterval(timer), { once: true });
  }, []);
  return useFocusedAttendanceRequest(enabled ? `${scope}:${retry}` : null, load, scope);
}

export function useOwnAttendance(from?: string, to?: string, { child, today, revision = 0 }: {
  child?: string;
  today?: string;
  revision?: number | string;
} = {}) {
  const scope = useAppSelector((state) => state.auth.sessionEpoch);
  const load = useCallback(async (signal: AbortSignal, update: (rows: AttendanceChild[]) => void) => {
    if (from && to) update(await getOwnAttendance({ from, to }, child, signal));
  }, [from, to, child]);

  return useFocusedAttendanceRequest(from && to ? `${scope}:${from}:${to}:${child ?? ''}:${today ?? ''}:${revision}` : null, load);
}

export function hasAttendanceAccess(child: { linkRole: string }): boolean {
  return child.linkRole === 'PARENT' || child.linkRole === 'RELATIVE';
}
