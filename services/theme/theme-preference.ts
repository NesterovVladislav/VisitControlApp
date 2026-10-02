import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

/** Тема, выбранная в профиле: как в системе, всегда светлая или всегда тёмная. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'visit-control.theme.v1';

export interface ThemePreferenceStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

let current: ThemePreference = 'system';
const listeners = new Set<() => void>();

function isPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Appearance.setColorScheme меняет тему всего приложения, в том числе системных Alert, клавиатуры и статус-бара;
 * useColorScheme() во всех экранах сразу видит новую тему. null — снова как в системе.
 */
function apply(preference: ThemePreference) {
  Appearance.setColorScheme(preference === 'system' ? null : preference);
}

export function getThemePreference(): ThemePreference {
  return current;
}

export function subscribeThemePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Выбор при запуске. Тема — настройка устройства, а не аккаунта: переживает выход, как язык системы.
 */
export async function loadThemePreference(store: ThemePreferenceStore = AsyncStorage): Promise<void> {
  try {
    const saved = await store.getItem(THEME_PREFERENCE_KEY);
    if (isPreference(saved) && saved !== current) {
      current = saved;
      apply(saved);
      listeners.forEach((listener) => listener());
    }
  } catch (error) {
    // Не прочиталось — остаётся тема системы
    console.warn('[Theme] Failed to load preference', error instanceof Error ? error.message : 'unknown');
  }
}

export async function setThemePreference(
  preference: ThemePreference,
  store: ThemePreferenceStore = AsyncStorage
): Promise<void> {
  current = preference;
  apply(preference);
  listeners.forEach((listener) => listener());
  try {
    await store.setItem(THEME_PREFERENCE_KEY, preference);
  } catch (error) {
    // Тема уже применена, не сохранится только до следующего запуска
    console.warn('[Theme] Failed to save preference', error instanceof Error ? error.message : 'unknown');
  }
}
