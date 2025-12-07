import { AxiosError, AxiosRequestConfig } from 'axios';
import { ApiError } from '../errors/api-error';

/**
 * Конфигурация для ретраев запроса
 */
export interface RetryConfig {
  retries: number; // Количество повторных попыток
  retryDelay?: number; // Задержка между попытками в мс (по умолчанию 0)
  retryCondition?: (error: ApiError) => boolean; // Условие для ретрая
}

/**
 * Дефолтная конфигурация ретраев
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 0,
  retryDelay: 0,
};

/**
 * Проверяет, нужно ли повторять запрос при данной ошибке
 * @param error - ошибка API
 * @returns true если нужно повторить запрос
 */
function shouldRetry(error: ApiError): boolean {
  // Повторяем при сетевых ошибках и таймаутах
  if (error.isNetworkError || error.isTimeoutError) {
    return true;
  }

  // Повторяем при серверных ошибках (5xx)
  if (error.isServerError()) {
    return true;
  }

  // Не повторяем при клиентских ошибках (4xx кроме 408, 429)
  if (error.status !== null && error.status >= 400 && error.status < 500) {
    // Повторяем только для таймаута (408) и слишком много запросов (429)
    return error.status === 408 || error.status === 429;
  }

  return false;
}

/**
 * Задержка перед следующей попыткой
 * @param attemptNumber - номер попытки (начиная с 0)
 * @param retryDelay - базовая задержка
 * @returns задержка в мс
 */
function getRetryDelay(attemptNumber: number, retryDelay: number): number {
  // Экспоненциальная задержка: delay * 2^attemptNumber
  return retryDelay * Math.pow(2, attemptNumber);
}

/**
 * Выполняет запрос с ретраями
 * @param requestFn - функция для выполнения запроса
 * @param config - конфигурация запроса с настройками ретраев
 * @returns результат запроса
 */
export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const { retries, retryDelay = 0, retryCondition = shouldRetry } = config;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error instanceof ApiError ? error : null;

      // Если это не ApiError или не нужно повторять - выбрасываем ошибку
      if (!lastError || !retryCondition(lastError)) {
        throw error;
      }

      // Если это последняя попытка - выбрасываем ошибку
      if (attempt === retries) {
        throw error;
      }

      // Вычисляем задержку перед следующей попыткой
      const delay = getRetryDelay(attempt, retryDelay);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Этот код не должен выполниться, но TypeScript требует возврата
  throw lastError || new ApiError('Неизвестная ошибка при выполнении запроса');
}

/**
 * Создает конфигурацию ретраев для конкретного запроса
 * @param retries - количество повторных попыток
 * @param retryDelay - задержка между попытками в мс
 * @returns конфигурация ретраев
 */
export function createRetryConfig(
  retries: number,
  retryDelay: number = 0
): RetryConfig {
  return {
    retries,
    retryDelay,
    retryCondition: shouldRetry,
  };
}
