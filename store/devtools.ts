const SECRET_ACTION_TYPES = new Set([
  'auth/loginStart',
  'auth/completePinSetup',
  'auth/unlockWithPin',
]);

const SENSITIVE_KEY = /token|password|pin/i;
const REDACTED = '[REDACTED]';

export function sanitizeReduxAction<T extends { type?: unknown; payload?: unknown }>(
  action: T,
): T {
  if (typeof action.type !== 'string' || !SECRET_ACTION_TYPES.has(action.type)) {
    return action;
  }
  return { ...action, payload: REDACTED };
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(child),
    ]),
  );
}

export function sanitizeReduxState<T>(state: T): T {
  return sanitizeValue(state) as T;
}
