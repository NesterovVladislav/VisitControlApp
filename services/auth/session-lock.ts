export const SESSION_LOCK_TIMEOUT_MS = 300_000;

export interface SessionTimestamp {
  monotonicMs: number;
  wallClockMs: number;
}

export function shouldLockAfterBackground(
  startedAt: SessionTimestamp | null,
  now: SessionTimestamp,
): boolean {
  if (startedAt === null) return false;

  const elapsed = [
    now.monotonicMs - startedAt.monotonicMs,
    now.wallClockMs - startedAt.wallClockMs,
  ];
  return elapsed.some((value) => value >= SESSION_LOCK_TIMEOUT_MS);
}
