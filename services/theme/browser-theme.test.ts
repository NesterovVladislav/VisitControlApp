/** @jest-environment jsdom */
import { syncBrowserTheme } from './browser-theme';

it('keeps browser surfaces and theme-color aligned with the app selection instead of the OS media query', () => {
  document.head.innerHTML = '<meta name="theme-color" content="#fff" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#000" media="(prefers-color-scheme: dark)">';

  syncBrowserTheme('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(document.body.style.backgroundColor).toBe('rgb(0, 0, 0)');
  expect(Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map(meta => [meta.content, meta.getAttribute('media')])).toEqual([['#000', null], ['#000', null]]);

  syncBrowserTheme('light');
  expect(document.documentElement.style.colorScheme).toBe('light');
  expect(document.body.style.backgroundColor).toBe('rgb(245, 245, 245)');
  expect(Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map(meta => meta.content)).toEqual(['#f5f5f5', '#f5f5f5']);
});
