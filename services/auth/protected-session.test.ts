import {
  PROTECTED_SESSION_STORAGE_KEY,
  ProtectedSessionStorage,
  createProtectedSessionRepository,
} from './protected-session';

const SALT = 'ab'.repeat(16);
const verifierFor = (pin: string, _salt: string) => (pin === '1234' ? '1' : '2').repeat(64);
const pinCrypto = {
  createPinSalt: jest.fn(async () => SALT),
  derivePinVerifier: jest.fn(async (pin: string, salt: string) => verifierFor(pin, salt)),
};

class MemoryStorage implements ProtectedSessionStorage {
  value: string | null;
  failNextGet = false;
  failNextSet = false;
  failNextDelete = false;

  constructor(value: string | null = null) {
    this.value = value;
  }

  async getItemAsync(_key: string): Promise<string | null> {
    if (this.failNextGet) {
      this.failNextGet = false;
      throw new Error('read failed');
    }
    return this.value;
  }

  async setItemAsync(_key: string, value: string): Promise<void> {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('write failed');
    }
    this.value = value;
  }

  async deleteItemAsync(_key: string): Promise<void> {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('delete failed');
    }
    this.value = null;
  }
}

describe('ProtectedSessionRepository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('begins and reloads a setup-required session without persisting a PIN', async () => {
    const storage = new MemoryStorage();
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await expect(repository.beginSession('jwt')).resolves.toEqual({
      version: 1,
      token: 'jwt',
      status: 'pin_setup_required',
      pinSalt: null,
      pinVerifier: null,
      failedPinAttempts: 0,
      biometricsEnabled: false,
    });
    expect(storage.value).not.toContain('1234');
    await expect(repository.load()).resolves.toMatchObject({ token: 'jwt', status: 'pin_setup_required' });
  });

  it('rejects an empty bearer token', async () => {
    const repository = createProtectedSessionRepository(new MemoryStorage(), pinCrypto);
    await expect(repository.beginSession('   ')).rejects.toThrow('token');
  });

  it('completes PIN setup and accepts the correct PIN', async () => {
    const repository = createProtectedSessionRepository(new MemoryStorage(), pinCrypto);
    await repository.beginSession('jwt');
    await expect(repository.completePinSetup('1234')).resolves.toMatchObject({
      status: 'ready',
      pinSalt: SALT,
      pinVerifier: verifierFor('1234', SALT),
      failedPinAttempts: 0,
    });
    await expect(repository.verifyPin('1234')).resolves.toMatchObject({
      kind: 'success',
      record: { token: 'jwt', failedPinAttempts: 0 },
    });
  });

  it('persists failed attempts and resets them after a successful PIN', async () => {
    const storage = new MemoryStorage();
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await repository.beginSession('jwt');
    await repository.completePinSetup('1234');
    await expect(repository.verifyPin('9999')).resolves.toEqual({ kind: 'failure', remainingAttempts: 4 });
    const reloaded = createProtectedSessionRepository(storage, pinCrypto);
    await expect(reloaded.load()).resolves.toMatchObject({ failedPinAttempts: 1 });
    await expect(reloaded.verifyPin('1234')).resolves.toMatchObject({
      kind: 'success',
      record: { failedPinAttempts: 0 },
    });
    await expect(reloaded.load()).resolves.toMatchObject({ failedPinAttempts: 0 });
  });

  it('clears the record on the fifth wrong PIN', async () => {
    const repository = createProtectedSessionRepository(new MemoryStorage(), pinCrypto);
    await repository.beginSession('jwt');
    await repository.completePinSetup('1234');
    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(repository.verifyPin('9999')).resolves.toEqual({
        kind: 'failure',
        remainingAttempts: 5 - attempt,
      });
    }
    await expect(repository.verifyPin('9999')).resolves.toEqual({ kind: 'sessionCleared' });
    await expect(repository.load()).resolves.toBeNull();
  });

  it('persists biometric preference only for a ready session', async () => {
    const repository = createProtectedSessionRepository(new MemoryStorage(), pinCrypto);
    await repository.beginSession('jwt');
    await expect(repository.setBiometricsEnabled(true)).rejects.toThrow('ready');
    await repository.completePinSetup('1234');
    await expect(repository.setBiometricsEnabled(true)).resolves.toMatchObject({ biometricsEnabled: true });
    await expect(repository.load()).resolves.toMatchObject({ biometricsEnabled: true });
  });

  it('clears an existing session explicitly', async () => {
    const repository = createProtectedSessionRepository(new MemoryStorage(), pinCrypto);
    await repository.beginSession('jwt');
    await repository.clear();
    await expect(repository.load()).resolves.toBeNull();
  });

  it.each([
    '{broken json',
    JSON.stringify({ version: 2, token: 'jwt' }),
    JSON.stringify({
      version: 1, token: '', status: 'pin_setup_required', pinSalt: null, pinVerifier: null,
      failedPinAttempts: 0, biometricsEnabled: false,
    }),
    JSON.stringify({
      version: 1, token: 'jwt', status: 'pin_setup_required', pinSalt: SALT, pinVerifier: null,
      failedPinAttempts: 0, biometricsEnabled: false,
    }),
    JSON.stringify({
      version: 1, token: 'jwt', status: 'ready', pinSalt: 'bad', pinVerifier: 'f'.repeat(64),
      failedPinAttempts: 0, biometricsEnabled: false,
    }),
    JSON.stringify({
      version: 1, token: 'jwt', status: 'ready', pinSalt: SALT, pinVerifier: 'f'.repeat(64),
      failedPinAttempts: 5, biometricsEnabled: false,
    }),
  ])('deletes malformed or unsupported records: %s', async (value) => {
    const storage = new MemoryStorage(value);
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await expect(repository.load()).resolves.toBeNull();
    expect(storage.value).toBeNull();
  });

  it('fails closed on a native read error', async () => {
    const storage = new MemoryStorage();
    storage.failNextGet = true;
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await expect(repository.load()).rejects.toThrow('read failed');
  });

  it('recovers the serialized chain after a rejected write', async () => {
    const storage = new MemoryStorage();
    storage.failNextSet = true;
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await expect(repository.beginSession('first')).rejects.toThrow('write failed');
    await expect(repository.beginSession('second')).resolves.toMatchObject({ token: 'second' });
  });

  it('recovers the serialized chain after a rejected delete', async () => {
    const storage = new MemoryStorage();
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await repository.beginSession('first');
    storage.failNextDelete = true;
    await expect(repository.clear()).rejects.toThrow('delete failed');
    await expect(repository.beginSession('second')).resolves.toMatchObject({ token: 'second' });
  });

  it('uses the single versioned SecureStore key', async () => {
    const storage = new MemoryStorage();
    const getSpy = jest.spyOn(storage, 'getItemAsync');
    const repository = createProtectedSessionRepository(storage, pinCrypto);
    await repository.load();
    expect(getSpy).toHaveBeenCalledWith(PROTECTED_SESSION_STORAGE_KEY);
  });
});
