import { AxiosRequestConfig } from 'axios';

/**
 * Типы HTTP методов
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Обертка для успешного ответа API
 */
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  message?: string;
}

/**
 * Конфигурация запроса
 */
export interface RequestConfig extends AxiosRequestConfig {
  skipErrorHandling?: boolean; // Пропустить автоматическую обработку ошибок
  skipLogging?: boolean; // Пропустить логирование запроса
  retries?: number; // Количество повторных попыток при ошибке
  retryDelay?: number; // Задержка между попытками в мс
  timeout?: number; // Таймаут запроса в мс (переопределяет timeout из конфигурации клиента)
}

/**
 * Тип для данных ошибки API
 */
export interface ApiErrorData {
  message?: string;
  errors?: Record<string, string[]>;
  code?: string | number;
  [key: string]: unknown;
}

/**
 * Метаданные запроса для логирования
 */
export interface RequestMetadata {
  method: HttpMethod;
  url: string;
  timestamp: number;
  duration?: number;
}
