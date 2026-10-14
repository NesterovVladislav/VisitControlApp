/**
 * Браузерная версия protected-session.ts (docs/pwa-ios.md, «Защита сессии»).
 *
 * Keychain в браузере нет, PIN без него почти ничего не защищает — поэтому PIN в PWA не используется.
 * Токен хранится в памяти страницы; с Face ID — ещё и зашифрованным (web-session-vault.ts).
 * Интерфейс тот же, что на телефоне: сага работает с репозиторием одинаково.
 */
import { webSession } from './web-session';

import type {
  ProtectedSessionRecord,
  ProtectedSessionRepository,
} from './protected-session';

export type {
  PinAttemptResult,
  ProtectedSessionRecord,
  ProtectedSessionRepository,
  ProtectedSessionStorage,
} from './protected-session';

export const PROTECTED_SESSION_STORAGE_KEY = 'visit-control.protected-session.v1';

function toRecord(token: string, biometricsEnabled: boolean): ProtectedSessionRecord {
  return {
    version: 1,
    token,
    status: 'ready',
    pinSalt: null,
    pinVerifier: null,
    failedPinAttempts: 0,
    biometricsEnabled,
  };
}

function pinUnsupported(): never {
  throw new Error('PIN is not used in the browser');
}

export const protectedSessionRepository: ProtectedSessionRepository = {
  async load() {
    const session = webSession().current();
    if (session) return toRecord(session.token, session.biometricsEnabled);
    // Сохранён зашифрованный токен: приложение откроется экраном разблокировки по Face ID.
    // Сам токен станет известен только после Face ID, до этого он сагам не нужен
    if (webSession().hasStoredSession()) return toRecord('', true);
    return null;
  },

  async beginSession(token) {
    const session = webSession().begin(token);
    return toRecord(session.token, session.biometricsEnabled);
  },

  completePinSetup: async () => pinUnsupported(),

  verifyPin: async () => pinUnsupported(),

  // После разблокировки по Face ID токен уже расшифрован (biometrics.web.ts)
  async resetFailedPinAttempts() {
    const session = webSession().current();
    if (!session) throw new Error('Protected session is not available');
    return toRecord(session.token, session.biometricsEnabled);
  },

  /** @throws BiometricEnrollmentError — Face ID не включился; сессия при этом остаётся */
  async setBiometricsEnabled(enabled) {
    const session = enabled ? await webSession().enableBiometrics() : webSession().disableBiometrics();
    return toRecord(session.token, session.biometricsEnabled);
  },

  async clear() {
    webSession().clear();
  },
};
