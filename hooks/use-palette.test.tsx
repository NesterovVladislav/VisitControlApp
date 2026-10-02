import { renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { palettes } from '../constants/palette';
import { makeStyles, usePalette } from './use-palette';

const useTestStyles = makeStyles((c) => ReactNative.StyleSheet.create({ screen: { backgroundColor: c.background } }));

describe('palette', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives light or dark colors and styles for the current scheme, the same object each render', async () => {
    const scheme = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    const dark = await renderHook(() => ({ c: usePalette(), styles: useTestStyles() }));
    expect(dark.result.current.c).toBe(palettes.dark);
    expect(dark.result.current.styles.screen.backgroundColor).toBe(palettes.dark.background);
    const first = dark.result.current.styles;
    await dark.rerender({});
    expect(dark.result.current.styles).toBe(first);

    scheme.mockReturnValue(null);
    const light = await renderHook(() => useTestStyles());
    expect(light.result.current.screen.backgroundColor).toBe(palettes.light.background);
  });
});
