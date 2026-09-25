import * as SecureStore from 'expo-secure-store';

import { createPinSalt, derivePinVerifier } from './pin-crypto';

export const PROTECTED_SESSION_STORAGE_KEY = 'visit-control.protected-session.v1';
const HEX_32 = /^[0-9a-f]{32}$/i;
const HEX_64 = /^[0-9a-f]{64}$/i;
const MAX_FAILED_PIN_ATTEMPTS = 5;

export type ProtectedSessionRecord = {
  version: 1;
  token: string;
  status: 'pin_setup_required' | 'ready';
  pinSalt: string | null;
  pinVerifier: string | null;
  failedPinAttempts: number;
  biometricsEnabled: boolean;
};

export type PinAttemptResult =
  | { kind: 'success'; record: ProtectedSessionRecord }
  | { kind: 'failure'; remainingAttempts: number }
  | { kind: 'sessionCleared' };

export interface ProtectedSessionStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

type PinCrypto = {
  createPinSalt(): Promise<string>;
  derivePinVerifier(pin: string, salt: string): Promise<string>;
};

export interface ProtectedSessionRepository {
  load(): Promise<ProtectedSessionRecord | null>;
  beginSession(token: string): Promise<ProtectedSessionRecord>;
  completePinSetup(pin: string): Promise<ProtectedSessionRecord>;
  verifyPin(pin: string): Promise<PinAttemptResult>;
  setBiometricsEnabled(enabled: boolean): Promise<ProtectedSessionRecord>;
  clear(): Promise<void>;
}

function isRecord(value: unknown): value is ProtectedSessionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ProtectedSessionRecord>;
  if (
    record.version !== 1 ||
    typeof record.token !== 'string' ||
    record.token.trim().length === 0 ||
    !Number.isInteger(record.failedPinAttempts) ||
    (record.failedPinAttempts ?? -1) < 0 ||
    (record.failedPinAttempts ?? MAX_FAILED_PIN_ATTEMPTS) >= MAX_FAILED_PIN_ATTEMPTS ||
    typeof record.biometricsEnabled !== 'boolean'
  ) {
    return false;
  }

  if (record.status === 'pin_setup_required') {
    return (
      record.pinSalt === null &&
      record.pinVerifier === null &&
      record.failedPinAttempts === 0 &&
      record.biometricsEnabled === false
    );
  }

  return (
    record.status === 'ready' &&
    typeof record.pinSalt === 'string' &&
    HEX_32.test(record.pinSalt) &&
    typeof record.pinVerifier === 'string' &&
    HEX_64.test(record.pinVerifier)
  );
}

export function createProtectedSessionRepository(
  storage: ProtectedSessionStorage,
  crypto: PinCrypto = { createPinSalt, derivePinVerifier },
): ProtectedSessionRepository {
  let writeChain: Promise<unknown> = Promise.resolve();

  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = writeChain.catch(() => undefined).then(operation);
    writeChain = result;
    return result;
  };

  const readRecord = async (): Promise<ProtectedSessionRecord | null> => {
    const raw = await storage.getItemAsync(PROTECTED_SESSION_STORAGE_KEY);
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await storage.deleteItemAsync(PROTECTED_SESSION_STORAGE_KEY);
      return null;
    }

    if (!isRecord(parsed)) {
      await storage.deleteItemAsync(PROTECTED_SESSION_STORAGE_KEY);
      return null;
    }

    return parsed;
  };

  const persist = async (record: ProtectedSessionRecord): Promise<ProtectedSessionRecord> => {
    await storage.setItemAsync(PROTECTED_SESSION_STORAGE_KEY, JSON.stringify(record));
    return record;
  };

  const requireRecord = async (): Promise<ProtectedSessionRecord> => {
    const record = await readRecord();
    if (!record) throw new Error('Protected session is not available');
    return record;
  };

  return {
    load: () => serialize(readRecord),

    beginSession: (token) => serialize(async () => {
      if (token.trim().length === 0) throw new Error('Session token must not be empty');
      return persist({
        version: 1,
        token,
        status: 'pin_setup_required',
        pinSalt: null,
        pinVerifier: null,
        failedPinAttempts: 0,
        biometricsEnabled: false,
      });
    }),

    completePinSetup: (pin) => serialize(async () => {
      const record = await requireRecord();
      if (record.status !== 'pin_setup_required') throw new Error('PIN setup is already complete');
      const pinSalt = await crypto.createPinSalt();
      if (!HEX_32.test(pinSalt)) throw new Error('PIN salt must contain exactly 32 hexadecimal characters');
      const pinVerifier = await crypto.derivePinVerifier(pin, pinSalt);
      if (!HEX_64.test(pinVerifier)) throw new Error('PIN verifier must contain exactly 64 hexadecimal characters');
      return persist({
        ...record,
        status: 'ready',
        pinSalt,
        pinVerifier,
        failedPinAttempts: 0,
      });
    }),

    verifyPin: (pin) => serialize(async () => {
      const record = await requireRecord();
      if (record.status !== 'ready' || record.pinSalt === null || record.pinVerifier === null) {
        throw new Error('Protected session is not ready');
      }
      const actualVerifier = await crypto.derivePinVerifier(pin, record.pinSalt);
      if (actualVerifier === record.pinVerifier) {
        const verifiedRecord = record.failedPinAttempts === 0
          ? record
          : await persist({ ...record, failedPinAttempts: 0 });
        return { kind: 'success', record: verifiedRecord };
      }

      const failedPinAttempts = record.failedPinAttempts + 1;
      if (failedPinAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
        await storage.deleteItemAsync(PROTECTED_SESSION_STORAGE_KEY);
        return { kind: 'sessionCleared' };
      }

      await persist({ ...record, failedPinAttempts });
      return { kind: 'failure', remainingAttempts: MAX_FAILED_PIN_ATTEMPTS - failedPinAttempts };
    }),

    setBiometricsEnabled: (enabled) => serialize(async () => {
      const record = await requireRecord();
      if (record.status !== 'ready') throw new Error('Protected session is not ready');
      return persist({ ...record, biometricsEnabled: enabled });
    }),

    clear: () => serialize(() => storage.deleteItemAsync(PROTECTED_SESSION_STORAGE_KEY)),
  };
}

export const protectedSessionRepository = createProtectedSessionRepository(SecureStore);
