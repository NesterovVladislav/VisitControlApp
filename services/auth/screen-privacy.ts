import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

export const SCREEN_PRIVACY_KEY = 'visit-control-session';

let privacyQueue: Promise<boolean> = Promise.resolve(true);

async function applyScreenPrivacy(enabled: boolean): Promise<boolean> {
  try {
    if (enabled) {
      await ScreenCapture.preventScreenCaptureAsync(SCREEN_PRIVACY_KEY);
      if (Platform.OS === 'ios') {
        await ScreenCapture.enableAppSwitcherProtectionAsync(1);
      }
    } else {
      await ScreenCapture.allowScreenCaptureAsync(SCREEN_PRIVACY_KEY);
      if (Platform.OS === 'ios') {
        await ScreenCapture.disableAppSwitcherProtectionAsync();
      }
    }
    return true;
  } catch {
    return false;
  }
}

function enqueueScreenPrivacy(enabled: boolean): Promise<boolean> {
  const result = privacyQueue.then(() => applyScreenPrivacy(enabled));
  privacyQueue = result.catch(() => false);
  return result;
}

export function enableProtectedScreenPrivacy(): Promise<boolean> {
  return enqueueScreenPrivacy(true);
}

export function disableProtectedScreenPrivacy(): Promise<boolean> {
  return enqueueScreenPrivacy(false);
}

export function resetScreenPrivacyStateForTests(): void {
  privacyQueue = Promise.resolve(true);
}
