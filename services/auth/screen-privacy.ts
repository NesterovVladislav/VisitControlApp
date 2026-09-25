import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

export const SCREEN_PRIVACY_KEY = 'visit-control-session';

export async function enableProtectedScreenPrivacy(): Promise<boolean> {
  try {
    await ScreenCapture.preventScreenCaptureAsync(SCREEN_PRIVACY_KEY);
    if (Platform.OS === 'ios') {
      await ScreenCapture.enableAppSwitcherProtectionAsync(1);
    }
    return true;
  } catch {
    return false;
  }
}

export async function disableProtectedScreenPrivacy(): Promise<boolean> {
  try {
    await ScreenCapture.allowScreenCaptureAsync(SCREEN_PRIVACY_KEY);
    if (Platform.OS === 'ios') {
      await ScreenCapture.disableAppSwitcherProtectionAsync();
    }
    return true;
  } catch {
    return false;
  }
}
