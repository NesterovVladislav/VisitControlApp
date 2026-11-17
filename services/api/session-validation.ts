import { AxiosError } from 'axios';

import { ApiError } from '../errors/api-error';
import { createRetryConfig } from './retry';

export const SESSION_VALIDATION_TIMEOUT_MS = 8_000;
const ATTEMPT_TIMEOUT_MS = 4_000;
const RETRY_DELAY_MS = 500;

type SessionRequestConfig = { signal: AbortSignal; timeout: number };

function timeoutError(): ApiError {
  return new ApiError(
    'Превышено время проверки сессии', null, '', null,
    new AxiosError('Session validation timed out', 'ECONNABORTED'),
  );
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(timeoutError()); return; }
    const onAbort = () => {
      clearTimeout(timer);
      reject(timeoutError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, RETRY_DELAY_MS);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Both attempts, backoff and transport stalls share one session-check deadline. */
export async function requestSessionProfile<T>(
  request: (config: SessionRequestConfig) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const { retryCondition } = createRetryConfig(1, RETRY_DELAY_MS);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(timeoutError());
      controller.abort();
    }, SESSION_VALIDATION_TIMEOUT_MS);
  });

  const attempt = () => {
    const remaining = SESSION_VALIDATION_TIMEOUT_MS - (Date.now() - startedAt);
    if (controller.signal.aborted || remaining <= 0) throw timeoutError();
    return request({
      signal: controller.signal,
      timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
    });
  };

  const run = async () => {
    try {
      return await attempt();
    } catch (error) {
      if (controller.signal.aborted || !(error instanceof ApiError) || !retryCondition?.(error)) {
        throw error;
      }
      await waitForRetry(controller.signal);
      return attempt();
    }
  };

  try {
    const result = await Promise.race([run(), deadline]);
    // A resumed JS thread may handle the response before an overdue timer.
    if (Date.now() - startedAt >= SESSION_VALIDATION_TIMEOUT_MS) throw timeoutError();
    return result;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}
