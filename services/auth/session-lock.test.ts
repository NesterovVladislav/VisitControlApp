import {
  SESSION_LOCK_TIMEOUT_MS,
  shouldLockAfterBackground,
} from './session-lock';

describe('session lock timeout', () => {
  it('uses an exact five-minute threshold', () => {
    expect(SESSION_LOCK_TIMEOUT_MS).toBe(300_000);
    expect(shouldLockAfterBackground(1_000, 300_999)).toBe(false);
    expect(shouldLockAfterBackground(1_000, 301_000)).toBe(true);
    expect(shouldLockAfterBackground(1_000, 301_001)).toBe(true);
  });

  it('does not lock for missing or backwards timestamps', () => {
    expect(shouldLockAfterBackground(null, 301_000)).toBe(false);
    expect(shouldLockAfterBackground(10_000, 9_000)).toBe(false);
  });
});
