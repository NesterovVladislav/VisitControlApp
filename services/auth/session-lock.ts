export const SESSION_LOCK_TIMEOUT_MS = 300_000;

export function shouldLockAfterBackground(
  startedAt: number | null,
  now: number,
): boolean {
  if (startedAt === null || now < startedAt) return false;
  return now - startedAt >= SESSION_LOCK_TIMEOUT_MS;
}
