import { useColorScheme } from 'react-native';
import { ColorScheme, Palette, palettes } from '../constants/palette';

/** Текущая тема: выбранная в профиле или системная (см. services/theme/theme-preference.ts). */
export function useScheme(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** Цвета текущей темы — для цветов в JSX: иконок, индикаторов, плейсхолдеров. */
export function usePalette(): Palette {
  return palettes[useScheme()];
}

/**
 * Стили, зависящие от темы. Вместо `const styles = StyleSheet.create({...})`:
 *
 *   const useStyles = makeStyles((c) => StyleSheet.create({ screen: { backgroundColor: c.background } }));
 *   // в компоненте
 *   const styles = useStyles();
 *
 * Стили каждой темы создаются один раз.
 */
export function makeStyles<T>(factory: (c: Palette) => T): () => T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return function useStyles(): T {
    const scheme = useScheme();
    return (cache[scheme] ??= factory(palettes[scheme]));
  };
}
