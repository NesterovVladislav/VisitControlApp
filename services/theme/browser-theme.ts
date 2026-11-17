import { type ColorScheme, palettes } from '../../constants/palette';

export function syncBrowserTheme(scheme: ColorScheme): void {
  if (typeof document === 'undefined') return;
  const color = palettes[scheme].background;
  document.documentElement.style.colorScheme = scheme;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.content = color;
    meta.removeAttribute('media');
  });
}
