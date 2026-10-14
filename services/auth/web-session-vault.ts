/**
 * Хранение токена в браузере с разблокировкой по Face ID / Touch ID (docs/pwa-ios.md, «Защита сессии»).
 *
 * В браузере нет Keychain и нет нативной биометрии. Замена — WebAuthn с расширением PRF:
 * - при включении создаётся ключ входа (passkey) на устройстве;
 * - после Face ID ключ выдаёт секрет PRF — всегда один и тот же для этого ключа и этой «соли»;
 * - из секрета получается ключ AES-GCM, им шифруется токен в localStorage.
 * Без Face ID токен не расшифровать. Бэкенд не участвует: подпись WebAuthn никто не проверяет,
 * нужен только секрет.
 *
 * Без Face ID токен живёт только в памяти страницы: закрыл приложение — вход по паролю.
 *
 * Используется только браузерными модулями (protected-session.web.ts, biometrics.web.ts).
 * Сам файл без суффикса .web, чтобы его можно было проверить тестами.
 */
import { BiometricEnrollmentError } from './biometric-enrollment-error';

export const WEB_VAULT_STORAGE_KEY = 'visit-control.web-session.v1';
/**
 * Ключ входа этого устройства. Не секрет: без Face ID он бесполезен. Переживает выход из аккаунта,
 * чтобы при следующем входе не создавать ещё один «ДоброВход» в Связке ключей.
 */
export const WEB_CREDENTIAL_STORAGE_KEY = 'visit-control.web-credential.v1';

/** Так ключ входа подписан в «Паролях» на iPhone */
const RP_NAME = 'ДоброВход';
const WEBAUTHN_TIMEOUT_MS = 60_000;
const HKDF_INFO = 'visit-control.session-token.v1';

/** Байты на обычном ArrayBuffer: WebCrypto и WebAuthn не принимают SharedArrayBuffer */
type Bytes = Uint8Array<ArrayBuffer>;

/** Что лежит в localStorage. Токен — только зашифрованным. */
export interface StoredVault {
  version: 1;
  credentialId: string;
  /** Соль PRF: от неё зависит секрет */
  prfSalt: string;
  iv: string;
  ciphertext: string;
}

export type VaultUnlockResult =
  | { kind: 'success'; token: string }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

export interface VaultEnvironment {
  credentials: Pick<CredentialsContainer, 'create' | 'get'> | null;
  /** PublicKeyCredential из window; нет — WebAuthn в браузере не поддерживается */
  publicKeyCredential: {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
  } | null;
  subtle: SubtleCrypto;
  getRandomValues: (array: Bytes) => Bytes;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  isSecureContext: boolean;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  view.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Bytes {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isStoredVault(value: unknown): value is StoredVault {
  if (!value || typeof value !== 'object') return false;
  const vault = value as Partial<StoredVault>;
  return (
    vault.version === 1 &&
    typeof vault.credentialId === 'string' && vault.credentialId.length > 0 &&
    typeof vault.prfSalt === 'string' && vault.prfSalt.length > 0 &&
    typeof vault.iv === 'string' && vault.iv.length > 0 &&
    typeof vault.ciphertext === 'string' && vault.ciphertext.length > 0
  );
}

interface StoredCredential {
  version: 1;
  credentialId: string;
  prfSalt: string;
}

function isStoredCredential(value: unknown): value is StoredCredential {
  if (!value || typeof value !== 'object') return false;
  const credential = value as Partial<StoredCredential>;
  return (
    credential.version === 1 &&
    typeof credential.credentialId === 'string' && credential.credentialId.length > 0 &&
    typeof credential.prfSalt === 'string' && credential.prfSalt.length > 0
  );
}

function isNotAllowed(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

function prfFirstResult(credential: Credential | null): ArrayBuffer | null {
  const results = (credential as PublicKeyCredential | null)?.getClientExtensionResults?.() as
    | { prf?: { enabled?: boolean; results?: { first?: BufferSource } } }
    | undefined;
  const first = results?.prf?.results?.first;
  if (!first) return null;
  if (first instanceof ArrayBuffer) return first;
  const view = first as ArrayBufferView;
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer;
}

function prfReportedUnsupported(credential: Credential | null): boolean {
  const results = (credential as PublicKeyCredential | null)?.getClientExtensionResults?.() as
    | { prf?: { enabled?: boolean } }
    | undefined;
  return results?.prf?.enabled === false;
}

export interface WebSessionVault {
  /** Можно ли предлагать Face ID: есть WebAuthn, встроенный датчик и, если браузер сообщает, PRF. */
  isAvailable(): Promise<boolean>;
  /** Есть ли сохранённый зашифрованный токен — тогда приложение открывается экраном разблокировки. */
  hasStoredSession(): boolean;
  /**
   * Включить Face ID: создать ключ входа, получить секрет, зашифровать и сохранить токен.
   * Вызывать только по нажатию: Safari запускает WebAuthn только в ответ на действие пользователя.
   * @throws BiometricEnrollmentError
   */
  enroll(token: string): Promise<void>;
  /** Face ID → секрет → расшифрованный токен. Тоже только по нажатию. */
  unlock(): Promise<VaultUnlockResult>;
  /**
   * Удалить сохранённый токен (выход из аккаунта). Ключ входа остаётся в Связке ключей и запоминается:
   * при следующем включении Face ID он используется снова.
   */
  clear(): void;
}

export function createWebSessionVault(env: VaultEnvironment): WebSessionVault {
  /**
   * Ключ создан, но секрет при создании не выдан. Тогда нужен второй запрос Face ID; если Safari
   * откажет без нового нажатия, повторное нажатие «Включить» возьмёт этот ключ, а не создаст ещё один.
   */
  let pendingCredential: { credentialId: string; prfSalt: string } | null = null;

  const random = (length: number): Bytes => env.getRandomValues(new Uint8Array(length));

  const readStored = (): StoredVault | null => {
    const raw = env.storage.getItem(WEB_VAULT_STORAGE_KEY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredVault(parsed)) return parsed;
    } catch {
      // повреждённая запись — удаляем ниже
    }
    env.storage.removeItem(WEB_VAULT_STORAGE_KEY);
    return null;
  };

  const readCredential = (): StoredCredential | null => {
    const raw = env.storage.getItem(WEB_CREDENTIAL_STORAGE_KEY);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredCredential(parsed)) return parsed;
    } catch {
      // повреждённая запись — удаляем ниже
    }
    env.storage.removeItem(WEB_CREDENTIAL_STORAGE_KEY);
    return null;
  };

  const rememberCredential = (credentialId: string, prfSalt: string) => {
    const credential: StoredCredential = { version: 1, credentialId, prfSalt };
    env.storage.setItem(WEB_CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
  };

  const deriveKey = async (secret: ArrayBuffer, usage: KeyUsage): Promise<CryptoKey> => {
    const material = await env.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return env.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode(HKDF_INFO),
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      [usage],
    );
  };

  const requestSecret = async (credentialId: string, prfSalt: string): Promise<ArrayBuffer | null> => {
    if (!env.credentials) return null;
    const assertion = await env.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }],
        userVerification: 'required',
        timeout: WEBAUTHN_TIMEOUT_MS,
        extensions: { prf: { eval: { first: fromBase64Url(prfSalt) } } } as AuthenticationExtensionsClientInputs,
      },
    });
    return prfFirstResult(assertion);
  };

  const sealAndStore = async (token: string, secret: ArrayBuffer, credentialId: string, prfSalt: string) => {
    const key = await deriveKey(secret, 'encrypt');
    const iv = random(12);
    const ciphertext = await env.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
    const vault: StoredVault = {
      version: 1,
      credentialId,
      prfSalt,
      iv: toBase64Url(iv),
      ciphertext: toBase64Url(ciphertext),
    };
    env.storage.setItem(WEB_VAULT_STORAGE_KEY, JSON.stringify(vault));
  };

  return {
    async isAvailable() {
      if (!env.isSecureContext || !env.credentials || !env.publicKeyCredential) return false;
      try {
        const platform = await env.publicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
        if (!platform) return false;
        const capabilities = await env.publicKeyCredential.getClientCapabilities?.();
        // Браузер прямо сказал, что PRF нет. Не сказал ничего — проверим при включении
        return capabilities?.['extension:prf'] !== false;
      } catch {
        return false;
      }
    },

    hasStoredSession() {
      return readStored() !== null;
    },

    async enroll(token) {
      if (!env.credentials) throw new BiometricEnrollmentError('unsupported');

      let credentialId: string;
      let prfSalt: string;
      let secret: ArrayBuffer | null = null;
      const saved = pendingCredential ? null : readCredential();

      if (pendingCredential) {
        ({ credentialId, prfSalt } = pendingCredential);
      } else if (saved) {
        ({ credentialId, prfSalt } = saved);
      } else {
        prfSalt = toBase64Url(random(32));
        let credential: Credential | null;
        try {
          credential = await env.credentials.create({
            publicKey: {
              rp: { name: RP_NAME },
              user: { id: random(16), name: RP_NAME, displayName: RP_NAME },
              challenge: random(32),
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 },
              ],
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'preferred',
                userVerification: 'required',
              },
              timeout: WEBAUTHN_TIMEOUT_MS,
              extensions: { prf: { eval: { first: fromBase64Url(prfSalt) } } } as AuthenticationExtensionsClientInputs,
            },
          });
        } catch (error) {
          throw new BiometricEnrollmentError(isNotAllowed(error) ? 'cancelled' : 'failed');
        }
        if (!credential) throw new BiometricEnrollmentError('cancelled');
        if (prfReportedUnsupported(credential)) throw new BiometricEnrollmentError('unsupported');

        credentialId = toBase64Url((credential as PublicKeyCredential).rawId);
        secret = prfFirstResult(credential);
      }

      if (!secret) {
        // Часть браузеров выдаёт секрет только при входе, не при создании ключа
        try {
          secret = await requestSecret(credentialId, prfSalt);
        } catch (error) {
          if (saved) {
            // Отказ по сохранённому ключу: окно закрыли или ключ удалили в «Паролях» — Safari эти случаи
            // не различает. Забываем ключ: следующее нажатие создаст новый, а не упрётся в удалённый
            env.storage.removeItem(WEB_CREDENTIAL_STORAGE_KEY);
            throw new BiometricEnrollmentError(isNotAllowed(error) ? 'cancelled' : 'failed');
          }
          pendingCredential = { credentialId, prfSalt };
          throw new BiometricEnrollmentError(isNotAllowed(error) ? 'confirmationRequired' : 'failed');
        }
        if (!secret) {
          pendingCredential = null;
          env.storage.removeItem(WEB_CREDENTIAL_STORAGE_KEY);
          throw new BiometricEnrollmentError('unsupported');
        }
      }

      pendingCredential = null;
      try {
        await sealAndStore(token, secret, credentialId, prfSalt);
        rememberCredential(credentialId, prfSalt);
      } catch {
        throw new BiometricEnrollmentError('failed');
      }
    },

    async unlock() {
      const stored = readStored();
      if (!stored || !env.credentials) return { kind: 'unavailable' };

      let secret: ArrayBuffer | null;
      try {
        secret = await requestSecret(stored.credentialId, stored.prfSalt);
      } catch (error) {
        return isNotAllowed(error) ? { kind: 'cancelled' } : { kind: 'failed' };
      }
      if (!secret) return { kind: 'unavailable' };

      try {
        const key = await deriveKey(secret, 'decrypt');
        const plain = await env.subtle.decrypt(
          { name: 'AES-GCM', iv: fromBase64Url(stored.iv) },
          key,
          fromBase64Url(stored.ciphertext),
        );
        const token = new TextDecoder().decode(plain);
        return token.trim().length > 0 ? { kind: 'success', token } : { kind: 'failed' };
      } catch {
        return { kind: 'failed' };
      }
    },

    clear() {
      pendingCredential = null;
      env.storage.removeItem(WEB_VAULT_STORAGE_KEY);
    },
  };
}

/** Окружение текущей страницы. Вне браузера (тесты, сборка) — без WebAuthn и с пустым хранилищем. */
export function browserVaultEnvironment(): VaultEnvironment {
  const hasWindow = typeof window !== 'undefined';
  const memory = new Map<string, string>();
  const fallbackStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  return {
    credentials: hasWindow && typeof navigator !== 'undefined' && navigator.credentials ? navigator.credentials : null,
    publicKeyCredential: hasWindow && 'PublicKeyCredential' in window
      ? (window.PublicKeyCredential as unknown as VaultEnvironment['publicKeyCredential'])
      : null,
    subtle: globalThis.crypto.subtle,
    getRandomValues: (array) => globalThis.crypto.getRandomValues(array),
    storage: hasWindow && window.localStorage ? window.localStorage : fallbackStorage,
    isSecureContext: hasWindow ? window.isSecureContext : false,
  };
}
