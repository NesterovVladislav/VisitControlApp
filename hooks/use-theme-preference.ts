import { useSyncExternalStore } from 'react';
import {
  ThemePreference,
  getThemePreference,
  setThemePreference,
  subscribeThemePreference,
} from '../services/theme/theme-preference';

/** Выбранная тема и её смена — для переключателя в профиле. */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribeThemePreference, getThemePreference, () => 'system' as const);
  return [preference, (next) => void setThemePreference(next)];
}
