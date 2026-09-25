import { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { createApiClient, setupAuthToken } from './client';
import { RequestConfig, ApiResponse } from './types';
import { ApiError } from '../errors/api-error';
import { retryRequest, createRetryConfig } from './retry';
import { LoginCredentials, User } from '../../store/types/auth';
import { Child, VisitStatus } from '../../store/types/children';
import { getAuthToken, notifyUnauthorized } from '../auth/auth-token';
import { PrivacyPolicy, RegistrationRequest } from '../../store/types/registration';

// DTO бэкенда в snake_case живут только здесь, наружу отдаются модели в camelCase.

interface AuthRequestDto {
  username: string;
  password: string;
}

interface AuthResponseDto {
  access_token: string;
}

interface UserShortInfoDto {
  external_key: string;
  first_name: string;
  surname: string;
  patronymic?: string | null;
}

interface UserDto extends UserShortInfoDto {
  email?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  role: { role: string };
}

interface ChildRepresentativeDto {
  child_external_key: string;
  representative_external_key: string;
  role: { role: string };
  child?: UserShortInfoDto;
}

interface VisitDto {
  visitor_external_key: string;
  representative_external_key: string;
  status: 'IN' | 'OUT';
}

function mapUser(dto: UserDto): User {
  return {
    id: dto.external_key,
    email: dto.email ?? '',
    firstName: dto.first_name,
    surname: dto.surname,
    patronymic: dto.patronymic ?? null,
    gender: dto.gender ?? null,
    role: dto.role.role,
  };
}

function mapChild(dto: ChildRepresentativeDto): Child {
  return {
    id: dto.child_external_key,
    firstName: dto.child?.first_name ?? '',
    surname: dto.child?.surname ?? '',
    linkRole: dto.role.role,
  };
}

/**
 * Клиент для работы с visitControlServer API
 */
class VisitControlApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = createApiClient('visitControlServer');
    setupAuthToken(this.client, getAuthToken);
    // Сервер отверг токен сессии — выходим. 401 на сам POST /token (неверный пароль) сюда не относится:
    // у этого запроса нет заголовка Authorization.
    this.client.interceptors.response.use(undefined, (error) => {
      const original = error instanceof ApiError ? error.originalError : null;
      const hadToken = original instanceof AxiosError && Boolean(original.config?.headers?.Authorization);
      if (error instanceof ApiError && error.status === 401 && hadToken) {
        notifyUnauthorized();
      }
      return Promise.reject(error);
    });
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
   * Вход: POST /token → access_token.
   * Бэкенд ищет пользователя по email, но поле называется username.
   * Без ретраев и без логирования: в теле пароль.
   */
  async login(credentials: LoginCredentials): Promise<string> {
    const response = await this.post<AuthResponseDto, AuthRequestDto>(
      '/token',
      { username: credentials.email, password: credentials.password },
      { skipLogging: true }
    );
    return response.access_token;
  }

  /**
   * Текущий пользователь по токену.
   */
  async getMe(): Promise<User> {
    const dto = await retryRequest(
      () => this.get<UserDto>('/user', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return mapUser(dto);
  }

  /**
   * Дети, привязанные к представителю.
   */
  async getMyChildren(representativeKey: string): Promise<Child[]> {
    const links = await retryRequest(
      () =>
        this.get<ChildRepresentativeDto[]>('/child-representative/children', {
          params: { representative_external_key: representativeKey },
          skipLogging: true,
        }),
      createRetryConfig(2, 500)
    );
    return links.map(mapChild);
  }

  /**
   * Статус по последней отметке ребёнка. Если отметок не было, сервер отвечает 200 с пустым телом.
   */
  async getActualStatus(childKey: string): Promise<VisitStatus> {
    const dto = await retryRequest(
      () => this.get<VisitDto | ''>(`/visit/actual_status/${childKey}`),
      createRetryConfig(2, 500)
    );
    return dto && dto.status ? dto.status : 'NONE';
  }

  /**
   * Отметка «привёл / забрал». Без ретраев: повтор после таймаута может записать вторую отметку.
   */
  async createVisit(childKey: string, representativeKey: string, status: 'IN' | 'OUT'): Promise<void> {
    await this.post<VisitDto, VisitDto>('/visit', {
      visitor_external_key: childKey,
      representative_external_key: representativeKey,
      status,
    });
  }

  /**
   * Текущая политика обработки персональных данных. Доступно без токена.
   * GET безопасно повторять, поэтому при сетевых ошибках и 5xx делаем 2 ретрая.
   */
  async getPrivacyPolicy(): Promise<PrivacyPolicy> {
    return retryRequest(
      () => this.get<PrivacyPolicy>('/registration/policy'),
      createRetryConfig(2, 500)
    );
  }

  /**
   * Заявка на регистрацию. Доступно без токена.
   * Без ретраев: повтор после таймаута может создать вторую заявку.
   * Без логирования: тело запроса содержит персональные данные.
   */
  async register(request: RegistrationRequest): Promise<void> {
    await this.post<unknown, RegistrationRequest>('/registration', request, {
      skipLogging: true,
    });
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
