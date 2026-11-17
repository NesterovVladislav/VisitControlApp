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
  if (rotation?.previous === token) {
    rotation.unauthorized = true;
    return;
  }
  unauthorizedHandler?.();
}

type TokenRotation = {
  previous: string;
  unauthorized: boolean;
  done: Promise<void>;
};

let rotation: TokenRotation | undefined;

/** Дождаться PATCH и записи токена, прежде чем завершать сессию из-за старого 401. */
export function deferUnauthorizedDuringRotation(previous: string): () => void {
  let resolve!: () => void;
  const done = new Promise<void>((finish) => { resolve = finish; });
  const pending = { previous, unauthorized: false, done };
  rotation = pending;
  return () => {
    resolve();
    if (rotation !== pending) return;
    rotation = undefined;
    if (pending.unauthorized && token === previous) notifyUnauthorized();
  };
}

export function waitForTokenRotation(previous: string): Promise<void> | undefined {
  return rotation?.previous === previous ? rotation.done : undefined;
}
