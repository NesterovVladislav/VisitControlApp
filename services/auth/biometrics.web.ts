/**
 * Браузерная версия biometrics.ts: Face ID / Touch ID через WebAuthn (web-session-vault.ts).
 * expo-local-authentication в браузере — заглушка, которая всегда отвечает «датчика нет».
 */
import { AuthenticationType } from 'expo-local-authentication';

import { webSession } from './web-session';

import type { BiometricCapability, BiometricPromptResult } from './biometrics';

export type { BiometricCapability, BiometricPromptResult } from './biometrics';

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    if (await webSession().isBiometricAvailable()) {
      return { available: true, types: [AuthenticationType.FACIAL_RECOGNITION] };
    }
    return { available: false, reason: 'unsupported', types: [] };
  } catch {
    return { available: false, reason: 'nativeError', types: [] };
  }
}

let inFlightPrompt: Promise<BiometricPromptResult> | null = null;

/** Face ID и расшифровка токена. Вызывать только по нажатию: иначе Safari не покажет окно Face ID. */
export function promptForBiometricUnlock(): Promise<BiometricPromptResult> {
  if (inFlightPrompt) return inFlightPrompt;

  inFlightPrompt = webSession()
    .unlockWithBiometrics()
    .then((result): BiometricPromptResult => ({ kind: result.kind === 'success' ? 'success' : result.kind }))
    .catch((): BiometricPromptResult => ({ kind: 'failed' }))
    .finally(() => {
      inFlightPrompt = null;
    });

  return inFlightPrompt;
}
