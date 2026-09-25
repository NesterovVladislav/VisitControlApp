import { getBackendUrl } from './config';

describe('API environment config', () => {
  const originalUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFlag = process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP;
  const originalDev = __DEV__;

  afterEach(() => {
    Object.defineProperty(global, '__DEV__', { configurable: true, value: originalDev });
    if (originalUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalUrl;
    }
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP;
    } else {
      process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP = originalFlag;
    }
  });

  it('uses the test stand as a local fallback', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getBackendUrl('visitControlServer')).toBe('http://93.77.168.178/api');
  });

  it('uses and normalises the environment-specific URL', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid/api/';
    expect(getBackendUrl('visitControlServer')).toBe('https://api.example.invalid/api');
  });

  it('fails fast when a release build has no HTTPS API URL', () => {
    Object.defineProperty(global, '__DEV__', { configurable: true, value: false });
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP;

    expect(() => getBackendUrl('visitControlServer')).toThrow(
      'EXPO_PUBLIC_API_URL must be set to an HTTPS URL for release builds',
    );
  });
});
