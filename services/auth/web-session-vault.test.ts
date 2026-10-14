import { webcrypto } from 'node:crypto';

import { BiometricEnrollmentError } from './biometric-enrollment-error';
import {
  VaultEnvironment,
  WEB_CREDENTIAL_STORAGE_KEY,
  WEB_VAULT_STORAGE_KEY,
  createWebSessionVault,
} from './web-session-vault';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;

function domError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

/** Секрет PRF как у настоящего ключа: зависит только от ключа и соли. */
async function prfSecret(authenticatorKey: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
  const joined = new Uint8Array(authenticatorKey.length + salt.length);
  joined.set(authenticatorKey);
  joined.set(salt, authenticatorKey.length);
  return subtle.digest('SHA-256', joined);
}

function bytes(source: BufferSource): Uint8Array {
  return source instanceof ArrayBuffer
    ? new Uint8Array(source)
    : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

interface FakeAuthenticatorOptions {
  /** Отдаёт ли секрет уже при создании ключа */
  prfOnCreate?: boolean;
  /** Браузер прямо говорит, что PRF нет */
  prfUnsupported?: boolean;
}

function fakeEnvironment(options: FakeAuthenticatorOptions = {}) {
  const store = new Map<string, string>();
  const authenticatorKey = new Uint8Array(32).fill(7);
  const rawId = new Uint8Array([1, 2, 3, 4]).buffer;

  const extensionResults = async (salt: BufferSource | undefined) => {
    if (options.prfUnsupported) return { prf: { enabled: false } };
    if (!salt) return { prf: { enabled: true } };
    return { prf: { enabled: true, results: { first: await prfSecret(authenticatorKey, bytes(salt)) } } };
  };

  const create = jest.fn(async (request?: CredentialCreationOptions) => {
    const salt = (request?.publicKey?.extensions as any)?.prf?.eval?.first as BufferSource | undefined;
    const results = await extensionResults(options.prfOnCreate ? salt : undefined);
    return { rawId, getClientExtensionResults: () => results } as unknown as Credential;
  });
  const get = jest.fn(async (request?: CredentialRequestOptions) => {
    const salt = (request?.publicKey?.extensions as any)?.prf?.eval?.first as BufferSource | undefined;
    const results = await extensionResults(salt);
    return { rawId, getClientExtensionResults: () => results } as unknown as Credential;
  });

  const env: VaultEnvironment = {
    credentials: { create, get } as unknown as VaultEnvironment['credentials'],
    publicKeyCredential: {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    },
    subtle,
    getRandomValues: (array) => webcrypto.getRandomValues(array),
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    },
    isSecureContext: true,
  };
  return { env, create, get, store };
}

describe('web session vault', () => {
  it('stores the token encrypted and gives it back after Face ID', async () => {
    const { env, store } = fakeEnvironment({ prfOnCreate: true });
    const vault = createWebSessionVault(env);

    await vault.enroll('secret-jwt');

    const raw = store.get(WEB_VAULT_STORAGE_KEY)!;
    expect(raw).toBeDefined();
    expect(raw).not.toContain('secret-jwt');
    expect(vault.hasStoredSession()).toBe(true);

    // Новая страница — та же запись, тот же ключ на устройстве
    const reopened = createWebSessionVault(env);
    await expect(reopened.unlock()).resolves.toEqual({ kind: 'success', token: 'secret-jwt' });
  });

  it('asks for the secret separately when the browser gives none on creation', async () => {
    const { env, create, get } = fakeEnvironment({ prfOnCreate: false });
    const vault = createWebSessionVault(env);

    await vault.enroll('secret-jwt');

    expect(create).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    await expect(vault.unlock()).resolves.toEqual({ kind: 'success', token: 'secret-jwt' });
  });

  it('reuses the created key when Safari wants another tap to confirm', async () => {
    const { env, create, get } = fakeEnvironment({ prfOnCreate: false });
    const vault = createWebSessionVault(env);
    get.mockRejectedValueOnce(domError('NotAllowedError'));

    await expect(vault.enroll('secret-jwt')).rejects.toEqual(new BiometricEnrollmentError('confirmationRequired'));
    expect(vault.hasStoredSession()).toBe(false);

    await vault.enroll('secret-jwt');

    expect(create).toHaveBeenCalledTimes(1);
    await expect(vault.unlock()).resolves.toEqual({ kind: 'success', token: 'secret-jwt' });
  });

  it('reuses the device key after logout instead of creating another passkey', async () => {
    const { env, create, get } = fakeEnvironment({ prfOnCreate: true });
    const vault = createWebSessionVault(env);
    await vault.enroll('first-jwt');
    vault.clear();

    await vault.enroll('second-jwt');

    expect(create).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    await expect(vault.unlock()).resolves.toEqual({ kind: 'success', token: 'second-jwt' });
  });

  it('forgets a saved key that no longer works, so the next tap creates a new one', async () => {
    const { env, create, get } = fakeEnvironment({ prfOnCreate: true });
    const vault = createWebSessionVault(env);
    await vault.enroll('first-jwt');
    vault.clear();
    get.mockRejectedValueOnce(domError('NotAllowedError'));

    await expect(vault.enroll('second-jwt')).rejects.toEqual(new BiometricEnrollmentError('cancelled'));
    expect(env.storage.getItem(WEB_CREDENTIAL_STORAGE_KEY)).toBeNull();

    await vault.enroll('second-jwt');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('reports a closed Face ID prompt as cancelled', async () => {
    const { env, create } = fakeEnvironment();
    create.mockRejectedValueOnce(domError('NotAllowedError'));

    await expect(createWebSessionVault(env).enroll('secret-jwt')).rejects.toEqual(
      new BiometricEnrollmentError('cancelled'),
    );
  });

  it('refuses enrollment when the browser has no PRF', async () => {
    const { env } = fakeEnvironment({ prfUnsupported: true });

    await expect(createWebSessionVault(env).enroll('secret-jwt')).rejects.toEqual(
      new BiometricEnrollmentError('unsupported'),
    );
    expect(env.storage.getItem(WEB_VAULT_STORAGE_KEY)).toBeNull();
  });

  it('keeps the stored token when unlock is cancelled', async () => {
    const { env, get } = fakeEnvironment({ prfOnCreate: true });
    const vault = createWebSessionVault(env);
    await vault.enroll('secret-jwt');
    get.mockRejectedValueOnce(domError('NotAllowedError'));

    await expect(vault.unlock()).resolves.toEqual({ kind: 'cancelled' });
    expect(vault.hasStoredSession()).toBe(true);
  });

  it('fails to unlock a tampered record', async () => {
    const { env, store } = fakeEnvironment({ prfOnCreate: true });
    const vault = createWebSessionVault(env);
    await vault.enroll('secret-jwt');
    const record = JSON.parse(store.get(WEB_VAULT_STORAGE_KEY)!);
    store.set(WEB_VAULT_STORAGE_KEY, JSON.stringify({ ...record, ciphertext: `${record.ciphertext.slice(0, -2)}AA` }));

    await expect(vault.unlock()).resolves.toEqual({ kind: 'failed' });
  });

  it('drops a corrupted record', () => {
    const { env, store } = fakeEnvironment();
    store.set(WEB_VAULT_STORAGE_KEY, '{not json');

    expect(createWebSessionVault(env).hasStoredSession()).toBe(false);
    expect(store.has(WEB_VAULT_STORAGE_KEY)).toBe(false);
  });

  it('forgets the token on clear', async () => {
    const { env } = fakeEnvironment({ prfOnCreate: true });
    const vault = createWebSessionVault(env);
    await vault.enroll('secret-jwt');

    vault.clear();

    expect(vault.hasStoredSession()).toBe(false);
    await expect(vault.unlock()).resolves.toEqual({ kind: 'unavailable' });
  });

  it('is unavailable without HTTPS, WebAuthn or a built-in sensor', async () => {
    const insecure = fakeEnvironment().env;
    insecure.isSecureContext = false;
    await expect(createWebSessionVault(insecure).isAvailable()).resolves.toBe(false);

    const noSensor = fakeEnvironment().env;
    noSensor.publicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false };
    await expect(createWebSessionVault(noSensor).isAvailable()).resolves.toBe(false);

    const noPrf = fakeEnvironment().env;
    noPrf.publicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      getClientCapabilities: async () => ({ 'extension:prf': false }),
    };
    await expect(createWebSessionVault(noPrf).isAvailable()).resolves.toBe(false);

    await expect(createWebSessionVault(fakeEnvironment().env).isAvailable()).resolves.toBe(true);
  });
});
