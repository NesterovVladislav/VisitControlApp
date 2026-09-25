import {
  SESSION_LOCK_TIMEOUT_MS,
  shouldLockAfterBackground,
} from './session-lock';

describe('session lock timeout', () => {
  it('uses an exact five-minute threshold', () => {
    expect(SESSION_LOCK_TIMEOUT_MS).toBe(300_000);
    const startedAt = { monotonicMs: 1_000, wallClockMs: 10_000 };
    expect(shouldLockAfterBackground(startedAt, {
      monotonicMs: 300_999,
      wallClockMs: 309_999,
    })).toBe(false);
    expect(shouldLockAfterBackground(startedAt, {
      monotonicMs: 301_000,
      wallClockMs: 310_000,
    })).toBe(true);
  });

  it('locks when wall-clock time includes device sleep excluded by the monotonic clock', () => {
    expect(shouldLockAfterBackground(
      { monotonicMs: 1_000, wallClockMs: 10_000 },
      { monotonicMs: 2_000, wallClockMs: 310_000 },
    )).toBe(true);
  });

  it('does not lock for missing or backwards timestamps', () => {
    expect(shouldLockAfterBackground(null, {
      monotonicMs: 301_000,
      wallClockMs: 310_000,
    })).toBe(false);
    expect(shouldLockAfterBackground(
      { monotonicMs: 10_000, wallClockMs: 10_000 },
      { monotonicMs: 9_000, wallClockMs: 9_000 },
    )).toBe(false);
  });
});
