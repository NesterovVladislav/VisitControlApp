import {
  INSTALLATION_MARKER_KEY,
  InstallationMarkerStore,
  ensureCurrentInstallation,
} from './install-marker';

class MemoryMarkerStore implements InstallationMarkerStore {
  value: string | null;
  failGet = false;
  failSet = false;

  constructor(value: string | null = null) {
    this.value = value;
  }

  async getItem(_key: string): Promise<string | null> {
    if (this.failGet) throw new Error('marker read failed');
    return this.value;
  }

  async setItem(_key: string, value: string): Promise<void> {
    if (this.failSet) throw new Error('marker write failed');
    this.value = value;
  }
}

describe('ensureCurrentInstallation', () => {
  it('clears keychain state before recording a first installation', async () => {
    const markerStore = new MemoryMarkerStore();
    const calls: string[] = [];
    const repository = { clear: jest.fn(async () => { calls.push('clear'); }) };
    const setSpy = jest.spyOn(markerStore, 'setItem').mockImplementation(async (_key, value) => {
      calls.push('set');
      markerStore.value = value;
    });
    await ensureCurrentInstallation(markerStore, repository);
    expect(repository.clear).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(INSTALLATION_MARKER_KEY, '1');
    expect(calls).toEqual(['clear', 'set']);
  });

  it('keeps a protected session during a normal upgrade', async () => {
    const markerStore = new MemoryMarkerStore('1');
    const repository = { clear: jest.fn(async () => undefined) };
    await ensureCurrentInstallation(markerStore, repository);
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it('removes a stale iOS Keychain session when the app marker is missing', async () => {
    const markerStore = new MemoryMarkerStore();
    const repository = { clear: jest.fn(async () => undefined) };
    await ensureCurrentInstallation(markerStore, repository);
    expect(repository.clear).toHaveBeenCalledTimes(1);
    expect(markerStore.value).toBe('1');
  });

  it('does not touch SecureStore when marker reading fails', async () => {
    const markerStore = new MemoryMarkerStore();
    markerStore.failGet = true;
    const repository = { clear: jest.fn(async () => undefined) };
    await expect(ensureCurrentInstallation(markerStore, repository)).rejects.toThrow('marker read failed');
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it('fails if writing the marker fails, after stale session cleanup', async () => {
    const markerStore = new MemoryMarkerStore();
    markerStore.failSet = true;
    const repository = { clear: jest.fn(async () => undefined) };
    await expect(ensureCurrentInstallation(markerStore, repository)).rejects.toThrow('marker write failed');
    expect(repository.clear).toHaveBeenCalledTimes(1);
  });

  it('uses a namespaced marker key', async () => {
    const markerStore = new MemoryMarkerStore('1');
    const getSpy = jest.spyOn(markerStore, 'getItem');
    await ensureCurrentInstallation(markerStore, { clear: jest.fn(async () => undefined) });
    expect(getSpy).toHaveBeenCalledWith(INSTALLATION_MARKER_KEY);
  });
});
