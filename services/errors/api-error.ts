import { AxiosError } from 'axios';
import { ApiErrorData } from '../api/types';

/**
 * Кастомный класс ошибок API
 * Расширяет стандартный Error для более удобной работы с ошибками API
 */
export class ApiError extends Error {
  public readonly status: number | null;
  public readonly statusText: string;
  public readonly data: ApiErrorData | null;
  public readonly originalError: AxiosError | Error;
  public readonly isNetworkError: boolean;
  public readonly isTimeoutError: boolean;

  constructor(
    message: string,
    status: number | null = null,
    statusText: string = '',
    data: ApiErrorData | null = null,
    originalError?: AxiosError | Error
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.originalError = originalError || new Error(message);

    // Определяем тип ошибки
    if (originalError instanceof AxiosError) {
      this.isNetworkError = !originalError.response;
      this.isTimeoutError = originalError.code === 'ECONNABORTED';
    } else {
      this.isNetworkError = false;
      this.isTimeoutError = false;
    }

    // Сохраняем стек трейс
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Получить сообщение об ошибке из данных ответа
   */
  getErrorMessage(): string {
    if (this.data?.message) {
      return this.data.message;
    }
    return this.message;
  }

  /**
   * Получить детализированные ошибки валидации
   */
  getValidationErrors(): Record<string, string[]> | null {
    return this.data?.errors || null;
  }

  /**
   * Проверка, является ли ошибка ошибкой валидации (400)
   */
  isValidationError(): boolean {
    return this.status === 400;
  }

  /**
   * Проверка, является ли ошибка ошибкой авторизации (401)
   */
  isUnauthorizedError(): boolean {
    return this.status === 401;
  }

  /**
   * Проверка, является ли ошибка ошибкой доступа (403)
   */
  isForbiddenError(): boolean {
    return this.status === 403;
  }

  /**
   * Проверка, является ли ошибка ошибкой "не найдено" (404)
   */
  isNotFoundError(): boolean {
    return this.status === 404;
  }

  /**
   * Проверка, является ли ошибка серверной ошибкой (5xx)
   */
  isServerError(): boolean {
    return this.status !== null && this.status >= 500;
  }

  /**
   * Форматированное сообщение об ошибке для логирования
   */
  toLogString(): string {
    const parts = [
      `[ApiError] ${this.getErrorMessage()}`,
      this.status !== null && `Status: ${this.status} ${this.statusText}`,
      this.isNetworkError && 'Type: Network Error',
      this.isTimeoutError && 'Type: Timeout Error',
      this.data && `Data: ${JSON.stringify(this.data)}`,
    ].filter(Boolean);

    return parts.join(' | ');
  }
}
