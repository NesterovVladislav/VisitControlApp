import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getAttendanceTimeZone } from '../services/api/own-attendance';
import { useAttendanceToday } from './use-own-attendance';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../services/api/own-attendance', () => ({ getAttendanceTimeZone: jest.fn() }));
jest.mock('../store', () => ({
  useAppSelector: (select: (state: { auth: { sessionEpoch: number } }) => number) => select({ auth: { sessionEpoch: 10 } }),
}));

it('retains the garden date when fetching the timezone fails after a successful load', async () => {
  jest.mocked(getAttendanceTimeZone)
    .mockResolvedValueOnce('UTC+07:00')
    .mockRejectedValueOnce(new Error('Offline'));
  const hook = await renderHook(({ retry }: { retry: number }) => useAttendanceToday(true, retry), { initialProps: { retry: 0 } });
  await waitFor(() => expect(hook.result.current?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  const today = hook.result.current?.value;

  await hook.rerender({ retry: 1 });
  await waitFor(() => expect(hook.result.current?.failed).toBeDefined());
  expect(hook.result.current?.value).toBe(today);
});

it('updates the date after midnight in the garden timezone while the screen stays open', async () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2026-11-20T16:59:50Z'));
    jest.mocked(getAttendanceTimeZone).mockResolvedValueOnce('UTC+07:00');
    const hook = await renderHook(() => useAttendanceToday(true));
    expect(hook.result.current?.value).toBe('2026-11-20');
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(hook.result.current?.value).toBe('2026-11-21');
    await hook.unmount();
  } finally {
    jest.useRealTimers();
  }
});
