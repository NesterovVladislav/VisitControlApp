jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
}));
jest.mock('../services/auth/screen-privacy', () => ({
  enableProtectedScreenPrivacy: jest.fn(),
  disableProtectedScreenPrivacy: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';

import {
  disableProtectedScreenPrivacy,
  enableProtectedScreenPrivacy,
} from '../services/auth/screen-privacy';
import { useAppDispatch } from '../store';
import { lockSession } from '../store/reducers/auth';
import { useSessionLifecycle } from './use-session-lifecycle';

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockEnablePrivacy = enableProtectedScreenPrivacy as jest.MockedFunction<
  typeof enableProtectedScreenPrivacy
>;
const mockDisablePrivacy = disableProtectedScreenPrivacy as jest.MockedFunction<
  typeof disableProtectedScreenPrivacy
>;

describe('useSessionLifecycle', () => {
  let appStateHandler: ((state: AppStateStatus) => void) | undefined;
  let now: number;
  const dispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    now = 1_000;
    mockUseAppDispatch.mockReturnValue(dispatch);
    mockEnablePrivacy.mockResolvedValue(true);
    mockDisablePrivacy.mockResolvedValue(true);
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler;
      return { remove: jest.fn() };
    });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the React shield immediately while inactive or backgrounded', async () => {
    const { result } = await renderHook(() => useSessionLifecycle('authenticated'));
    await waitFor(() => expect(mockEnablePrivacy).toHaveBeenCalled());

    await act(() => appStateHandler?.('inactive'));
    expect(result.current.privacyShieldVisible).toBe(true);
    await act(() => appStateHandler?.('background'));
    expect(result.current.privacyShieldVisible).toBe(true);
  });

  it('hides the shield on a short resume without locking', async () => {
    const { result } = await renderHook(() => useSessionLifecycle('authenticated'));
    await waitFor(() => expect(mockEnablePrivacy).toHaveBeenCalled());
    await act(() => appStateHandler?.('background'));
    now = 300_999;
    await act(() => appStateHandler?.('active'));

    expect(dispatch).not.toHaveBeenCalled();
    expect(result.current.privacyShieldVisible).toBe(false);
  });

  it('locks before revealing after five minutes', async () => {
    const { result } = await renderHook(() => useSessionLifecycle('authenticated'));
    await waitFor(() => expect(mockEnablePrivacy).toHaveBeenCalled());
    await act(() => appStateHandler?.('background'));
    now = 301_000;
    await act(() => appStateHandler?.('active'));

    expect(dispatch).toHaveBeenCalledWith(lockSession());
    expect(result.current.privacyShieldVisible).toBe(false);
  });

  it('does not reset the original timestamp on duplicate inactive events', async () => {
    await renderHook(() => useSessionLifecycle('authenticated'));
    await waitFor(() => expect(mockEnablePrivacy).toHaveBeenCalled());
    await act(() => appStateHandler?.('inactive'));
    now = 200_000;
    await act(() => appStateHandler?.('background'));
    now = 301_000;
    await act(() => appStateHandler?.('active'));

    expect(dispatch).toHaveBeenCalledWith(lockSession());
  });

  it('keeps the React shield when native protection fails', async () => {
    mockEnablePrivacy.mockResolvedValue(false);
    const { result } = await renderHook(() => useSessionLifecycle('authenticated'));
    await waitFor(() => expect(result.current.privacyShieldVisible).toBe(true));
  });

  it('disables native privacy for the unauthenticated phase', async () => {
    await renderHook(() => useSessionLifecycle('unauthenticated'));
    await waitFor(() => expect(mockDisablePrivacy).toHaveBeenCalledTimes(1));
  });
});
