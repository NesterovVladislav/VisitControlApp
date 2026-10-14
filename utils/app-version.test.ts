import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { getAppVersionLabel } from './app-version';

jest.mock('expo-application', () => ({
  __esModule: true,
  nativeApplicationVersion: '1.0.2',
  nativeBuildVersion: '3',
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { version: '9.0.0' } },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare' },
}));

describe('version shown in the profile', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Object.assign(Application, { nativeApplicationVersion: '1.0.2', nativeBuildVersion: '3' });
    Object.assign(Constants, { executionEnvironment: ExecutionEnvironment.Bare, expoConfig: { version: '9.0.0' } });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it.each(['android', 'ios'])('shows the installed %s binary even when the JS config is newer', (os) => {
    Object.defineProperty(Platform, 'OS', { value: os });
    expect(getAppVersionLabel()).toBe('Версия 1.0.2 · сборка 3');
  });

  it('shows the loaded PWA version without a native build number', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    expect(getAppVersionLabel()).toBe('Версия 9.0.0');
  });

  it('shows the project version in Expo Go instead of the host application version', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    Constants.executionEnvironment = ExecutionEnvironment.StoreClient;
    expect(getAppVersionLabel()).toBe('Версия 9.0.0');
  });

  it('omits the build suffix when the installed version has no build metadata', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    Object.assign(Application, { nativeBuildVersion: null });
    expect(getAppVersionLabel()).toBe('Версия 1.0.2');
  });

  it('does not claim that missing native metadata is the newer JS version', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    Object.assign(Application, { nativeApplicationVersion: null });
    expect(getAppVersionLabel()).toBe('Версия недоступна');
  });

  it('handles a PWA bundle without version metadata', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    Object.assign(Constants, { expoConfig: null });
    expect(getAppVersionLabel()).toBe('Версия недоступна');
  });
});
