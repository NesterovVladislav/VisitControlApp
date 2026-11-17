/**
 * Сессия в браузере: токен в памяти страницы и, если включён Face ID, зашифрованная копия
 * в web-session-vault. Общая для protected-session.web.ts и biometrics.web.ts: разблокировка
 * по Face ID сразу даёт токен, а сага забирает его через репозиторий, как на телефоне.
 */
import {
  VaultUnlockResult,
  WebSessionVault,
  browserVaultEnvironment,
  createWebSessionVault,
} from './web-session-vault';

export interface UnlockedWebSession {
  token: string;
  biometricsEnabled: boolean;
}

export interface WebSession {
  /** Токен разблокированной сессии; null — не входили или страницу перезагрузили */
  current(): UnlockedWebSession | null;
  hasStoredSession(): boolean;
  replaceToken(expectedToken: string, token: string): Promise<boolean>;
  begin(token: string): UnlockedWebSession;
  enableBiometrics(): Promise<UnlockedWebSession>;
  disableBiometrics(): UnlockedWebSession;
  isBiometricAvailable(): Promise<boolean>;
  unlockWithBiometrics(): Promise<VaultUnlockResult>;
  clear(): void;
}

export function createWebSession(vault: WebSessionVault): WebSession {
  let session: UnlockedWebSession | null = null;

  const requireSession = (): UnlockedWebSession => {
    if (!session) throw new Error('Web session is not unlocked');
    return session;
  };

  return {
    current: () => session,

    hasStoredSession: () => vault.hasStoredSession(),

    begin(token) {
      if (token.trim().length === 0) throw new Error('Session token must not be empty');
      // Новый вход заменяет сохранённую сессию: она могла быть от другого аккаунта
      vault.clear();
      session = { token, biometricsEnabled: false };
      return session;
    },

    async replaceToken(expectedToken, token) {
      const previous = session;
      if (previous?.token !== expectedToken) return false;
      if (!token.trim()) throw new Error('Session token must not be empty');
      if (previous.biometricsEnabled) {
        await vault.replaceToken(token);
      }
      if (session !== previous) return false;
      session = { ...previous, token };
      return true;
    },

    async enableBiometrics() {
      const { token } = requireSession();
      await vault.enroll(token);
      session = { token, biometricsEnabled: true };
      return session;
    },

    disableBiometrics() {
      const { token } = requireSession();
      vault.clear();
      session = { token, biometricsEnabled: false };
      return session;
    },

    isBiometricAvailable: () => vault.isAvailable(),

    async unlockWithBiometrics() {
      const result = await vault.unlock();
      if (result.kind === 'success') {
        session = { token: result.token, biometricsEnabled: true };
      }
      return result;
    },

    clear() {
      session = null;
      vault.clearOwnedSession();
    },
  };
}

let shared: WebSession | null = null;

/** Одна сессия на страницу. Создаётся при первом обращении: окружение браузера есть только во время работы. */
export function webSession(): WebSession {
  shared ??= createWebSession(createWebSessionVault(browserVaultEnvironment()));
  return shared;
}
