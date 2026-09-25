/**
 * Токен текущей сессии. Пока хранится только в памяти: после перезапуска приложения нужен повторный вход.
 * TODO: хранить в expo-secure-store и восстанавливать сессию при старте (этап 1 в docs/backend-integration.md).
 */
let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getAuthToken(): string | null {
  return token;
}

export function setAuthToken(value: string): void {
  token = value;
}

export function clearAuthToken(): void {
  token = null;
}

/**
 * Что делать, когда сервер отверг токен (401). Регистрируется в store/index.ts,
 * чтобы API-слой не импортировал store напрямую.
 */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
