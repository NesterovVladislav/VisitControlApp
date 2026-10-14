import {
  getThemePreference,
  loadThemePreference,
  setThemePreference,
  subscribeThemePreference,
  THEME_PREFERENCE_KEY,
} from './theme-preference';

// React Native Web exposes the system preference, but has no setColorScheme.
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Appearance: {
    getColorScheme: () => 'light',
    addChangeListener: () => ({ remove() {} }),
  },
}));

function memoryStore(saved: string | null = null) {
  const data: Record<string, string> = saved ? { [THEME_PREFERENCE_KEY]: saved } : {};
  return {
    data,
    getItem: async (key: string) => data[key] ?? null,
    setItem: async (key: string, value: string) => { data[key] = value; },
  };
}

afterEach(async () => {
  await setThemePreference('system', memoryStore());
});

it('applies and persists a browser selection when the native appearance setter is unavailable', async () => {
  const store = memoryStore();
  let notifiedPreference: string | undefined;
  const unsubscribe = subscribeThemePreference(() => { notifiedPreference = getThemePreference(); });
  try {
    await expect(setThemePreference('dark', store)).resolves.toBeUndefined();
    expect(notifiedPreference).toBe('dark');
    expect(store.data[THEME_PREFERENCE_KEY]).toBe('dark');
  } finally {
    unsubscribe();
  }
});

it('notifies browser consumers when restoring a saved selection', async () => {
  let notifiedPreference: string | undefined;
  const unsubscribe = subscribeThemePreference(() => { notifiedPreference = getThemePreference(); });
  try {
    await loadThemePreference(memoryStore('light'));
    expect(notifiedPreference).toBe('light');
  } finally {
    unsubscribe();
  }
});
