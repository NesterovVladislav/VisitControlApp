import { renderHook, waitFor } from '@testing-library/react-native';

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
