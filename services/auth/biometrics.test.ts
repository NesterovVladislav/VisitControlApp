jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import * as LocalAuthentication from 'expo-local-authentication';

import { getBiometricCapability, promptForBiometricUnlock } from './biometrics';

const mocked = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

describe('biometric adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.hasHardwareAsync.mockResolvedValue(true);
    mocked.isEnrolledAsync.mockResolvedValue(true);
    mocked.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
    mocked.supportedAuthenticationTypesAsync.mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
  });

  it('reports unavailable when biometric hardware is missing', async () => {
    mocked.hasHardwareAsync.mockResolvedValue(false);
    await expect(getBiometricCapability()).resolves.toEqual({
      available: false,
      reason: 'noHardware',
      types: [],
    });
  });

  it('reports unavailable when no biometrics are enrolled', async () => {
    mocked.isEnrolledAsync.mockResolvedValue(false);
    await expect(getBiometricCapability()).resolves.toEqual({
      available: false,
      reason: 'notEnrolled',
      types: [],
    });
  });

  it('rejects weak-only Android biometrics', async () => {
    mocked.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK);
    await expect(getBiometricCapability()).resolves.toEqual({
      available: false,
      reason: 'notStrong',
      types: [],
    });
  });

  it('returns supported types for strong Android biometrics', async () => {
    mocked.supportedAuthenticationTypesAsync.mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    await expect(getBiometricCapability()).resolves.toEqual({
      available: true,
      types: [
        LocalAuthentication.AuthenticationType.FINGERPRINT,
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ],
    });
  });

  it('normalises capability native errors to unavailable', async () => {
    mocked.hasHardwareAsync.mockRejectedValue(new Error('native failure'));
    await expect(getBiometricCapability()).resolves.toEqual({
      available: false,
      reason: 'nativeError',
      types: [],
    });
  });

  it.each([
    [{ success: true } as const, { kind: 'success' }],
    [{ success: false, error: 'user_cancel' } as const, { kind: 'cancelled' }],
    [{ success: false, error: 'system_cancel' } as const, { kind: 'cancelled' }],
    [{ success: false, error: 'app_cancel' } as const, { kind: 'cancelled' }],
    [{ success: false, error: 'lockout' } as const, { kind: 'lockedOut' }],
    [{ success: false, error: 'not_available' } as const, { kind: 'unavailable' }],
    [{ success: false, error: 'not_enrolled' } as const, { kind: 'unavailable' }],
    [{ success: false, error: 'authentication_failed' } as const, { kind: 'failed' }],
  ])('normalises prompt result %#', async (nativeResult, expected) => {
    mocked.authenticateAsync.mockResolvedValue(nativeResult);
    await expect(promptForBiometricUnlock()).resolves.toEqual(expected);
    expect(mocked.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    }));
  });

  it('normalises thrown prompt errors without leaking them to UI', async () => {
    mocked.authenticateAsync.mockRejectedValue(new Error('native failure'));
    await expect(promptForBiometricUnlock()).resolves.toEqual({ kind: 'unavailable' });
  });

  it('shares one in-flight native prompt between rapid callers', async () => {
    let resolveNative: ((value: { success: true }) => void) | undefined;
    mocked.authenticateAsync.mockImplementation(() => new Promise((resolve) => {
      resolveNative = resolve;
    }));

    const first = promptForBiometricUnlock();
    const second = promptForBiometricUnlock();

    expect(first).toBe(second);
    expect(mocked.authenticateAsync).toHaveBeenCalledTimes(1);
    resolveNative?.({ success: true });
    await expect(first).resolves.toEqual({ kind: 'success' });
  });
});
