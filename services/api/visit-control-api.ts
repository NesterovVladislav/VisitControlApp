import { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { createApiClient, setupAuthToken } from './client';
import { RequestConfig, ApiResponse } from './types';
import { ApiError } from '../errors/api-error';
import { retryRequest, createRetryConfig } from './retry';
import { LoginCredentials, User } from '../../store/types/auth';
import { Child, VisitStatus } from '../../store/types/children';
import { Presence, PresenceGroup, PresentChild, VisitEntry, VisitPage } from '../../store/types/visits';
import { RegistrationRequestsPage, RegistrationRequestView } from '../../store/types/requests';
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

interface VisitFullInfoDto {
  visitor: UserShortInfoDto;
  representative: UserShortInfoDto;
  status: 'IN' | 'OUT';
  datetime: string | number[];
}

interface GroupPresenceDto {
  external_key: string;
  name: string;
  branch_external_key?: string | null;
  total_children: number;
  present: UserShortInfoDto[];
}

interface KindergartenPresenceDto {
  total_present: number;
  groups: GroupPresenceDto[];
  without_group: UserShortInfoDto[];
}

function mapPresentChild(dto: UserShortInfoDto): PresentChild {
  return { id: dto.external_key, firstName: dto.first_name, surname: dto.surname };
}

function byName(a: PresentChild, b: PresentChild): number {
  return `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, 'ru');
}

function mapPresenceGroup(dto: GroupPresenceDto): PresenceGroup {
  return {
    id: dto.external_key,
    name: dto.name,
    branchId: dto.branch_external_key ?? null,
    totalChildren: dto.total_children,
    present: dto.present.map(mapPresentChild),
  };
}

interface PageDto<T> {
  content: T[];
  number: number;
  last: boolean;
}

/**
 * Время с бэкенда → ISO-строка в UTC с миллисекундами, которую понимает любой движок JS.
 *
 * Бэкенд отдаёт LocalDateTime без зоны (пишет его в UTC) и с точностью PostgreSQL до микросекунд:
 * `2026-09-25T08:40:12.482915`. Hermes не разбирает больше трёх цифр дробной части — `new Date()` даёт
 * Invalid Date, поэтому разбираем строку сами. Массив `[год, месяц, день, час, мин, сек, нс]` — формат
 * Jackson с WRITE_DATES_AS_TIMESTAMPS, на случай если настройку сервера поменяют.
 */
export function toUtcIso(value: string | number[]): string {
  let parts: number[];
  let offsetMinutes = 0;
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanos = 0] = value;
    parts = [year, month, day, hour, minute, second, Math.floor(nanos / 1_000_000)];
  } else {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(
        value.trim()
      );
    if (!match) {
      return value;
    }
    const [, year, month, day, hour, minute, second = '0', fraction = '', zone] = match;
    parts = [year, month, day, hour, minute, second, fraction.padEnd(3, '0').slice(0, 3)].map(Number);
    if (zone && zone !== 'Z') {
      const digits = zone.slice(1).replace(':', '');
      const sign = zone.startsWith('-') ? -1 : 1;
      offsetMinutes = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
    }
  }
  const [year, month, day, hour, minute, second, millis] = parts;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60_000;
  return new Date(utc).toISOString();
}

/** «Иванова А.» */
function shortName(dto: UserShortInfoDto): string {
  const initial = dto.first_name ? ` ${dto.first_name.charAt(0)}.` : '';
  return `${dto.surname}${initial}`;
}

function mapVisit(dto: VisitFullInfoDto): VisitEntry {
  const datetime = toUtcIso(dto.datetime);
  return {
    key: `${dto.visitor.external_key}|${datetime}|${dto.status}`,
    childId: dto.visitor.external_key,
    childName: `${dto.visitor.first_name} ${dto.visitor.surname}`.trim(),
    representativeName: shortName(dto.representative),
    status: dto.status,
    datetime,
  };
}

interface RegistrationRequestViewDto {
  external_key: string;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  birth_date?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  email: string;
  phone?: string | null;
  created: string | number[];
}

interface PageWithTotalDto<T> extends PageDto<T> {
  totalElements: number;
}

interface ApprovalResultDto {
  status: string;
  password_sent: boolean;
}

function mapRegistrationRequest(dto: RegistrationRequestViewDto): RegistrationRequestView {
  return {
    id: dto.external_key,
    surname: dto.surname,
    firstName: dto.first_name,
    patronymic: dto.patronymic ?? null,
    birthDate: dto.birth_date ?? null,
    gender: dto.gender ?? null,
    email: dto.email,
    phone: dto.phone ?? null,
    created: toUtcIso(dto.created),
  };
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
   * Кто сейчас в саду, по группам. Если на бэкенде ещё нет GET /group/presence (404),
   * берём плоский список GET /group/children/present без групп.
   */
  async getPresence(): Promise<Presence> {
    const retry = createRetryConfig(2, 500);
    try {
      const dto = await retryRequest(
        () => this.get<KindergartenPresenceDto>('/group/presence', { skipLogging: true }),
        retry
      );
      return {
        total: dto.total_present,
        groups: dto.groups.map(mapPresenceGroup),
        withoutGroup: dto.without_group.map(mapPresentChild),
      };
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        throw error;
      }
    }
    const list = await retryRequest(
      () => this.get<UserShortInfoDto[]>('/group/children/present', { skipLogging: true }),
      retry
    );
    const children = list.map(mapPresentChild).sort(byName);
    return { total: children.length, groups: null, withoutGroup: children };
  }

  /**
   * Журнал посещений всего сада, новые сверху. Страницы с нуля.
   */
  async getVisits(page: number, size = 30): Promise<VisitPage> {
    const result = await retryRequest(
      () =>
        this.get<PageDto<VisitFullInfoDto>>('/visit/list', {
          params: { page, size, sortBy: 'created', sortOrder: 'DESC' },
          skipLogging: true,
        }),
      createRetryConfig(2, 500)
    );
    return { items: result.content.map(mapVisit), page: result.number, last: result.last };
  }

  /**
   * Заявки на регистрацию, ожидающие подтверждения, старые сначала.
   * Берём одну страницу максимального размера (100): после подтверждения заявки уходят из выборки,
   * и следующие страницы по смещению пропускали бы заявки.
   */
  async getRegistrationRequests(): Promise<RegistrationRequestsPage> {
    const result = await retryRequest(
      () =>
        this.get<PageWithTotalDto<RegistrationRequestViewDto>>('/registration/requests', {
          params: { page: 0, size: 100 },
          skipLogging: true,
        }),
      createRetryConfig(2, 500)
    );
    return { items: result.content.map(mapRegistrationRequest), total: result.totalElements };
  }

  /**
   * Подтвердить заявку: сервер активирует пользователя и отправляет письмо с паролем.
   * Без ретраев: повтор после таймаута получит 409 ALREADY_PROCESSED.
   * @returns ушло ли письмо с паролем
   */
  async approveRegistration(id: string): Promise<boolean> {
    const result = await this.post<ApprovalResultDto>(`/registration/requests/${id}/approve`);
    return result.password_sent;
  }

  /**
   * Отклонить заявку. Причина необязательна, до 500 символов.
   */
  async rejectRegistration(id: string, reason: string | null): Promise<void> {
    await this.post(`/registration/requests/${id}/reject`, reason ? { reason } : {}, {
      skipLogging: true,
    });
  }

  /**
   * Выдать новый пароль и отправить его письмом.
   * @returns ушло ли письмо
   */
  async resetPassword(userId: string): Promise<boolean> {
    const result = await this.post<{ password_sent: boolean }>(`/user/${userId}/password/reset`);
    return result.password_sent;
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
