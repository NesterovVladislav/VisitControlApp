/**
 * Браузерная версия screen-privacy.ts. Запретить скриншоты и запись экрана из браузера нельзя
 * (docs/pwa-ios.md, «Что не переносится»). expo-screen-capture в браузере бросает ошибку, а ошибка
 * здесь означает «защита не включилась» — и защитная заставка закрыла бы приложение навсегда.
 * Поэтому в браузере защита считается включённой: больше сделать нечего.
 * Заставка при сворачивании остаётся — её показывает use-session-lifecycle.
 */
export const SCREEN_PRIVACY_KEY = 'visit-control-session';

export function screenshotsAllowed(): boolean {
  return true;
}

export async function enableProtectedScreenPrivacy(): Promise<boolean> {
  return true;
}

export async function disableProtectedScreenPrivacy(): Promise<boolean> {
  return true;
}

export function resetScreenPrivacyStateForTests(): void {}
