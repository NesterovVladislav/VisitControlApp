import { AxiosInstance, AxiosResponse } from 'axios';
import { createApiClient } from './client';
import { RequestConfig, ApiResponse } from './types';
import { ApiError } from '../errors/api-error';
import { retryRequest, createRetryConfig } from './retry';
import { LoginCredentials, AuthResponse } from '../../store/types/auth';

/**
 * Клиент для работы с visitControlServer API
 */
class VisitControlApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = createApiClient('visitControlServer');
  }

  /**
   * Выполняет GET запрос
   * @param endpoint - endpoint для запроса
   * @param config - дополнительная конфигурация запроса
   * @returns данные ответа
   */
  async get<T = unknown>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(
        endpoint,
        config
      );
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : this.handleError(error);
    }
  }

  /**
   * Выполняет POST запрос
   * @param endpoint - endpoint для запроса
   * @param data - данные для отправки
   * @param config - дополнительная конфигурация запроса
   * @returns данные ответа
   */
  async post<T = unknown, D = unknown>(
    endpoint: string,
    data?: D,
    config?: RequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(
        endpoint,
        data,
        config
      );
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : this.handleError(error);
    }
  }

  /**
   * Выполняет PUT запрос
   * @param endpoint - endpoint для запроса
   * @param data - данные для отправки
   * @param config - дополнительная конфигурация запроса
   * @returns данные ответа
   */
  async put<T = unknown, D = unknown>(
    endpoint: string,
    data?: D,
    config?: RequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.put(
        endpoint,
        data,
        config
      );
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : this.handleError(error);
    }
  }

  /**
   * Выполняет PATCH запрос
   * @param endpoint - endpoint для запроса
   * @param data - данные для отправки
   * @param config - дополнительная конфигурация запроса
   * @returns данные ответа
   */
  async patch<T = unknown, D = unknown>(
    endpoint: string,
    data?: D,
    config?: RequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.patch(
        endpoint,
        data,
        config
      );
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : this.handleError(error);
    }
  }

  /**
   * Выполняет DELETE запрос
   * @param endpoint - endpoint для запроса
   * @param config - дополнительная конфигурация запроса
   * @returns данные ответа
   */
  async delete<T = unknown>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(
        endpoint,
        config
      );
      return response.data;
    } catch (error) {
      throw error instanceof ApiError ? error : this.handleError(error);
    }
  }

  /**
   * Обрабатывает ошибки запросов
   * @param error - ошибка
   * @throws ApiError
   */
  private handleError(error: unknown): never {
    if (error instanceof ApiError) {
      throw error;
    }

    // Если это не ApiError, создаем новый
    const apiError = new ApiError(
      'Произошла ошибка при выполнении запроса',
      null,
      '',
      null,
      error instanceof Error ? error : new Error(String(error))
    );

    throw apiError;
  }

  /**
   * Авторизация пользователя
   * @param credentials - данные для входа (email, password)
   * @returns данные авторизации (token, user)
   */
  async auth(credentials: LoginCredentials): Promise<AuthResponse> {
    // Мок успешного ответа (пока всегда возвращает успех)
    // TODO: Заменить на реальный запрос когда бэкенд будет готов
    const mockResponse: AuthResponse = {
      token: 'mock-token-' + Date.now(),
      user: {
        id: '1',
        email: credentials.email,
        name: 'Mock User',
      },
    };

    // Возвращаем мок с небольшой задержкой для имитации запроса
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockResponse);
      }, 100);
    });

    // Реальный код для запроса (закомментирован до готовности бэкенда):
    /*
    const requestConfig: RequestConfig = {
      timeout: 500, // Таймаут 500ms
      retries: 2, // 2 ретрая
      retryDelay: 100, // Задержка между попытками 100ms
    };

    return retryRequest(
      () => this.post<AuthResponse, LoginCredentials>('/auth', credentials, requestConfig),
      createRetryConfig(2, 100)
    );
    */
  }

  /**
   * Получить базовый URL клиента
   */
  getBaseURL(): string {
    return this.client.defaults.baseURL || '';
  }
}

// Создаем и экспортируем единственный экземпляр клиента
export const visitControlApi = new VisitControlApiClient();
