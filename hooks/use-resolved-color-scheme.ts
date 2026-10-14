import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePreference } from './use-theme-preference';

/** Explicit app preference wins; system mode continues following OS changes. */
export function useResolvedColorScheme() {
  const systemScheme = useSystemColorScheme();
  const [preference] = useThemePreference();
  return preference === 'system' ? systemScheme : preference;
}
