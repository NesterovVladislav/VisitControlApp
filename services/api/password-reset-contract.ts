import { AxiosError, AxiosHeaders } from 'axios';

import { ApiError } from '../errors/api-error';

export type ResetCodeTiming = { resend_after_sec: number; code_ttl_sec: number };
export type VerifiedResetCode = { reset_token: string; expires_in_sec: number };

export class PasswordResetError extends Error {
  constructor(
    readonly status: number | null,
    readonly code?: string,
    readonly attemptsLeft?: number,
    readonly retryAt?: number,
  ) {
    super('Запрос восстановления пароля не выполнен');
    this.name = 'PasswordResetError';
  }
}

export function sanitizePasswordResetError(error: unknown): PasswordResetError {
  if (!(error instanceof ApiError)) return new PasswordResetError(null);
  const data = error.data;
  const attempts = data?.attempts_left;
  const original = error.originalError;
  const headers = original instanceof AxiosError ? original.response?.headers : undefined;
  const header = headers instanceof AxiosHeaders
    ? headers.get('Retry-After')
    : Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'retry-after')?.[1];
  const value = typeof header === 'string' || typeof header === 'number' ? String(header).trim() : '';
  const now = Date.now();
  const retryAt = !value ? NaN : /^\d+$/.test(value) ? now + Number(value) * 1000 : Date.parse(value);
  const code = data?.code;
  return new PasswordResetError(
    error.status,
    code === 'RESET_CODE_INVALID' || code === 'VALIDATION' ? code : undefined,
    typeof attempts === 'number' && Number.isSafeInteger(attempts) && attempts >= 0 ? attempts : undefined,
    Number.isFinite(retryAt) && retryAt > now ? retryAt : undefined,
  );
}
