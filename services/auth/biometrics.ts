import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricCapability =
  | {
      available: true;
      types: LocalAuthentication.AuthenticationType[];
    }
  | {
      available: false;
      reason: 'noHardware' | 'notEnrolled' | 'notStrong' | 'unsupported' | 'nativeError';
      types: [];
    };

export type BiometricPromptResult =
  | { kind: 'success' }
  | { kind: 'cancelled' }
  | { kind: 'lockedOut' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) {
      return { available: false, reason: 'noHardware', types: [] };
    }
    if (!(await LocalAuthentication.isEnrolledAsync())) {
      return { available: false, reason: 'notEnrolled', types: [] };
    }

    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (
      Platform.OS === 'android' &&
      level !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
    ) {
      return { available: false, reason: 'notStrong', types: [] };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.length === 0) {
      return { available: false, reason: 'unsupported', types: [] };
    }
    return { available: true, types };
  } catch {
    return { available: false, reason: 'nativeError', types: [] };
  }
}

function normalizePromptResult(
  result: LocalAuthentication.LocalAuthenticationResult,
): BiometricPromptResult {
  if (result.success) return { kind: 'success' };

  switch (result.error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return { kind: 'cancelled' };
    case 'lockout':
      return { kind: 'lockedOut' };
    case 'not_available':
    case 'not_enrolled':
    case 'passcode_not_set':
      return { kind: 'unavailable' };
    default:
      return { kind: 'failed' };
  }
}

let inFlightPrompt: Promise<BiometricPromptResult> | null = null;

export function promptForBiometricUnlock(): Promise<BiometricPromptResult> {
  if (inFlightPrompt) return inFlightPrompt;

  inFlightPrompt = LocalAuthentication.authenticateAsync({
    promptMessage: 'Разблокировать Visit Control',
    cancelLabel: 'Использовать PIN',
    fallbackLabel: '',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
  })
    .then(normalizePromptResult)
    .catch((): BiometricPromptResult => ({ kind: 'unavailable' }))
    .finally(() => {
      inFlightPrompt = null;
    });

  return inFlightPrompt;
}
