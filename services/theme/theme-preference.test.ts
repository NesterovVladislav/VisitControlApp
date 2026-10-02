import { Appearance } from 'react-native';

import {
  THEME_PREFERENCE_KEY,
  getThemePreference,
  loadThemePreference,
  setThemePreference,
  subscribeThemePreference,
} from './theme-preference';

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: jest.fn(async (key: string) => data[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data[key] = value;
    }),
  };
}

describe('theme preference', () => {
  let setColorScheme: jest.SpyInstance;

  beforeEach(() => {
    setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await setThemePreference('system', memoryStore());
    jest.restoreAllMocks();
  });

  it('applies and saves the choice and tells subscribers', async () => {
    const store = memoryStore();
    const listener = jest.fn();
    const unsubscribe = subscribeThemePreference(listener);

    await setThemePreference('dark', store);

    expect(getThemePreference()).toBe('dark');
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
    expect(store.data[THEME_PREFERENCE_KEY]).toBe('dark');
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('goes back to the system theme', async () => {
    await setThemePreference('light', memoryStore());
    await setThemePreference('system', memoryStore());
    expect(setColorScheme).toHaveBeenLastCalledWith(null);
  });

  it('restores the saved choice on launch and ignores garbage', async () => {
    await loadThemePreference(memoryStore({ [THEME_PREFERENCE_KEY]: 'light' }));
    expect(getThemePreference()).toBe('light');
    expect(setColorScheme).toHaveBeenLastCalledWith('light');

    setColorScheme.mockClear();
    await loadThemePreference(memoryStore({ [THEME_PREFERENCE_KEY]: 'purple' }));
    expect(getThemePreference()).toBe('light');
    expect(setColorScheme).not.toHaveBeenCalled();
  });

  it('keeps the applied theme when saving fails', async () => {
    const broken = { getItem: jest.fn(), setItem: jest.fn().mockRejectedValue(new Error('disk')) };
    await setThemePreference('dark', broken);
    expect(getThemePreference()).toBe('dark');
  });
});
