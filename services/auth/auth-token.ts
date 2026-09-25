/** Токен разблокированной сессии; постоянное хранение изолировано в protected-session. */
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
