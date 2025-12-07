import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { BackendConfig, getBackendUrl, getBackendConfig } from './config';
import { RequestConfig, RequestMetadata } from './types';
import { handleApiError, logApiError } from '../errors/error-handler';
import { ApiError } from '../errors/api-error';

/**
 * Создает настроенный экземпляр axios для работы с API
 * @param backendName - имя бэкенда из конфигурации
 * @returns настроенный экземпляр axios
 */
export function createApiClient(backendName: string): AxiosInstance {
  const config = getBackendConfig(backendName);
  const baseURL = getBackendUrl(backendName);

  // Создаем экземпляр axios с базовыми настройками
  const client = axios.create({
    baseURL,
    timeout: config.timeout || 10000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor - выполняется перед каждым запросом
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Здесь можно добавить токен авторизации в будущем
      // const token = getAuthToken();
      // if (token && config.headers) {
      //   config.headers.Authorization = `Bearer ${token}`;
      // }

      // Логирование запросов в режиме разработки
      if (__DEV__ && !(config as RequestConfig).skipLogging) {
        const metadata: RequestMetadata = {
          method: (config.method?.toUpperCase() || 'GET') as any,
          url: `${config.baseURL}${config.url}`,
          timestamp: Date.now(),
        };
        console.log('[API Request]', metadata.method, metadata.url, {
          params: config.params,
          data: config.data,
        });
      }

      return config;
    },
    (error) => {
      // Обработка ошибок при формировании запроса
      const apiError = handleApiError(error);
      logApiError(apiError);
      return Promise.reject(apiError);
    }
  );

  // Response interceptor - выполняется после каждого ответа
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Логирование успешных ответов в режиме разработки
      if (__DEV__ && !(response.config as RequestConfig).skipLogging) {
        const requestConfig = response.config as RequestConfig;
        const metadata: RequestMetadata = {
          method: (requestConfig.method?.toUpperCase() || 'GET') as any,
          url: `${requestConfig.baseURL}${requestConfig.url}`,
          timestamp: Date.now(),
        };
        console.log('[API Response]', metadata.method, metadata.url, {
          status: response.status,
          data: response.data,
        });
      }

      return response;
    },
    (error) => {
      // Обработка ошибок ответа
      const apiError = handleApiError(error);

      // Логируем ошибку, если не указано пропустить обработку
      const requestConfig = error.config as RequestConfig;
      if (!requestConfig?.skipErrorHandling) {
        logApiError(apiError);
      }

      return Promise.reject(apiError);
    }
  );

  return client;
}

/**
 * Тип для функции получения токена авторизации
 * Можно будет использовать в будущем для добавления аутентификации
 */
export type GetAuthTokenFn = () => string | null;

/**
 * Настройка токена авторизации для клиента
 * @param client - экземпляр axios клиента
 * @param getToken - функция для получения токена
 */
export function setupAuthToken(
  client: AxiosInstance,
  getToken: GetAuthTokenFn
): void {
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}
