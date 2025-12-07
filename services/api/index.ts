/**
 * Экспорт всех API утилит и клиентов
 */

// Конфигурация бэкендов
export {
  BACKENDS,
  getBackendUrl,
  getBackendConfig,
  type BackendConfig,
} from './config';

// Типы
export type {
  HttpMethod,
  ApiResponse,
  RequestConfig,
  ApiErrorData,
  RequestMetadata,
} from './types';

// Базовый клиент
export {
  createApiClient,
  setupAuthToken,
  type GetAuthTokenFn,
} from './client';

// Утилиты для ретраев
export {
  retryRequest,
  createRetryConfig,
  type RetryConfig,
} from './retry';

// Клиенты для конкретных бэкендов
export { visitControlApi } from './visit-control-api';

// Ошибки
export { ApiError } from '../errors/api-error';
export { handleApiError, logApiError } from '../errors/error-handler';
