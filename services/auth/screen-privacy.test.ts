jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(),
  allowScreenCaptureAsync: jest.fn(),
  enableAppSwitcherProtectionAsync: jest.fn(),
  disableAppSwitcherProtectionAsync: jest.fn(),
}));

import * as ScreenCapture from 'expo-screen-capture';

import {
  SCREEN_PRIVACY_KEY,
  disableProtectedScreenPrivacy,
  enableProtectedScreenPrivacy,
  resetScreenPrivacyStateForTests,
} from './screen-privacy';

const mocked = ScreenCapture as jest.Mocked<typeof ScreenCapture>;

describe('native screen privacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetScreenPrivacyStateForTests();
    mocked.preventScreenCaptureAsync.mockResolvedValue();
    mocked.allowScreenCaptureAsync.mockResolvedValue();
    mocked.enableAppSwitcherProtectionAsync.mockResolvedValue();
    mocked.disableAppSwitcherProtectionAsync.mockResolvedValue();
  });

  it('prevents capture and protects the iOS app switcher', async () => {
    await expect(enableProtectedScreenPrivacy()).resolves.toBe(true);
    expect(mocked.preventScreenCaptureAsync).toHaveBeenCalledWith(SCREEN_PRIVACY_KEY);
    expect(mocked.enableAppSwitcherProtectionAsync).toHaveBeenCalledWith(1);
  });

  it('re-allows capture and disables iOS app-switcher protection', async () => {
    await expect(disableProtectedScreenPrivacy()).resolves.toBe(true);
    expect(mocked.allowScreenCaptureAsync).toHaveBeenCalledWith(SCREEN_PRIVACY_KEY);
    expect(mocked.disableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
  });

  it('normalises native failures without throwing', async () => {
    mocked.preventScreenCaptureAsync.mockRejectedValue(new Error('native'));
    await expect(enableProtectedScreenPrivacy()).resolves.toBe(false);

    mocked.allowScreenCaptureAsync.mockRejectedValue(new Error('native'));
    await expect(disableProtectedScreenPrivacy()).resolves.toBe(false);
  });

it('serialises competing updates so the latest privacy request wins', async () => {
  let finishDisable: (() => void) | undefined;
  mocked.allowScreenCaptureAsync.mockImplementationOnce(
    () => new Promise<void>((resolve) => { finishDisable = resolve; }),
  );

  const disabling = disableProtectedScreenPrivacy();
  await Promise.resolve();
  const enabling = enableProtectedScreenPrivacy();
  expect(mocked.preventScreenCaptureAsync).not.toHaveBeenCalled();

  finishDisable?.();
  await expect(Promise.all([disabling, enabling])).resolves.toEqual([true, true]);
  expect(mocked.allowScreenCaptureAsync.mock.invocationCallOrder[0])
    .toBeLessThan(mocked.preventScreenCaptureAsync.mock.invocationCallOrder[0]);
});
});
