import { act, renderHook } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { palettes } from '../constants/palette';
import { makeStyles, usePalette } from './use-palette';
import { useColorScheme } from './use-color-scheme';
import { setThemePreference } from '../services/theme/theme-preference';

const useTestStyles = makeStyles((c) => ReactNative.StyleSheet.create({ screen: { backgroundColor: c.background } }));

describe('palette', () => {
  const store = { getItem: async () => null, setItem: async () => {} };
  beforeEach(() => jest.spyOn(ReactNative.Appearance, 'setColorScheme').mockImplementation(() => {}));
  afterEach(async () => {
    await act(async () => { await setThemePreference('system', store); });
    jest.restoreAllMocks();
  });

  it('updates all color consumers from a manual choice even when the system stays light', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
    const view = await renderHook(() => ({ scheme: useColorScheme(), c: usePalette(), styles: useTestStyles() }));
    await act(async () => { await setThemePreference('dark', store); });
    expect(view.result.current.scheme).toBe('dark');
    expect(view.result.current.c.background).toBe('#000');
    expect(view.result.current.styles.screen.backgroundColor).toBe('#000');
    await act(async () => { await setThemePreference('light', store); });
    expect(view.result.current.scheme).toBe('light');
    expect(view.result.current.c.background).toBe('#f5f5f5');
  });

  it('follows system changes only while the system option is selected', async () => {
    const system = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    const view = await renderHook(() => usePalette());
    expect(view.result.current.background).toBe('#000');
    await act(async () => { await setThemePreference('light', store); });
    expect(view.result.current.background).toBe('#f5f5f5');
    await act(async () => { await setThemePreference('system', store); });
    expect(view.result.current.background).toBe('#000');
    system.mockReturnValue('light');
    await view.rerender({});
    expect(view.result.current.background).toBe('#f5f5f5');
  });

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
