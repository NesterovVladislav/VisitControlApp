import { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { createApiClient, setupAuthToken } from './client';
import { RequestConfig, ApiResponse } from './types';
import { ApiError } from '../errors/api-error';
import { retryRequest, createRetryConfig } from './retry';
import { LoginCredentials, User } from '../../store/types/auth';
import { Child, VisitStatus } from '../../store/types/children';
import { Branch, Presence, PresenceGroup, PresentChild, VisitEntry, VisitPage } from '../../store/types/visits';
import { RegistrationRequestsPage, RegistrationRequestView } from '../../store/types/requests';
import { GardenGroup, PeoplePage, PeopleQuery, Person } from '../../store/types/people';
import { ProfileUpdate } from '../../utils/profile-edit';
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
  birth_date?: string | number[] | null;
  phone?: string | null;
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
  group?: { external_key: string; name: string; branch_name?: string | null } | null;
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

interface BranchDto {
  external_key: string;
  name: string;
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
    group: dto.group
      ? { id: dto.group.external_key, name: dto.group.name, branchName: dto.group.branch_name ?? null }
      : null,
  };
}

export interface RegistrationRequestViewDto {
  external_key: string;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  /** Стенд отдаёт LocalDate массивом [год, месяц, день], хотя в схеме OpenAPI — строка */
  birth_date?: string | number[] | null;
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

export function mapRegistrationRequest(dto: RegistrationRequestViewDto): RegistrationRequestView {
  return {
    id: dto.external_key,
    surname: dto.surname,
    firstName: dto.first_name,
    patronymic: dto.patronymic ?? null,
    birthDate: toIsoDate(dto.birth_date),
    gender: dto.gender ?? null,
    email: dto.email,
    phone: dto.phone ?? null,
    created: toUtcIso(dto.created),
  };
}

interface ChangePasswordDto {
  old_password: string;
  new_password: string;
}

/**
 * LocalDate с бэкенда → `YYYY-MM-DD`. Массив `[год, месяц, день]` — формат Jackson с WRITE_DATES_AS_TIMESTAMPS.
 */
export function toIsoDate(value: string | number[] | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    const [year, month, day] = value;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return value;
}

function mapUser(dto: UserDto): User {
  return {
    id: dto.external_key,
    email: dto.email ?? '',
    firstName: dto.first_name,
    surname: dto.surname,
    patronymic: dto.patronymic ?? null,
    gender: dto.gender ?? null,
    birthDate: toIsoDate(dto.birth_date),
    phone: dto.phone ?? null,
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

interface PersonDto {
  external_key: string;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  role?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  birth_date?: string | number[] | null;
  phone?: string | null;
  email?: string | null;
  group?: {
    external_key: string;
    name: string;
    branch_external_key?: string | null;
    branch_name?: string | null;
  } | null;
  present?: boolean | null;
  children?: {
    external_key: string;
    first_name: string;
    surname: string;
    link_role?: string | null;
  }[] | null;
}

interface GroupDto {
  external_key: string;
  name: string;
  branch_external_key?: string | null;
}

function mapPerson(dto: PersonDto): Person {
  return {
    id: dto.external_key,
    surname: dto.surname,
    firstName: dto.first_name,
    patronymic: dto.patronymic ?? null,
    role: dto.role ?? null,
    gender: dto.gender ?? null,
    birthDate: toIsoDate(dto.birth_date),
    phone: dto.phone ?? null,
    email: dto.email ?? null,
    group: dto.group
      ? {
          id: dto.group.external_key,
          name: dto.group.name,
          branchId: dto.group.branch_external_key ?? null,
          branchName: dto.group.branch_name ?? null,
        }
      : null,
    present: dto.present ?? null,
    children: dto.children
      ? dto.children.map((child) => ({
          id: child.external_key,
          firstName: child.first_name,
          surname: child.surname,
          linkRole: child.link_role ?? null,
        }))
      : null,
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
    // Выходим только если сервер отверг токен текущей сессии. Запоздалый 401 от
    // предыдущего аккаунта не должен завершать сессию нового пользователя.
    this.client.interceptors.response.use(undefined, (error) => {
      const original = error instanceof ApiError ? error.originalError : null;
      const requestAuthorization = original instanceof AxiosError
        ? original.config?.headers?.Authorization
        : undefined;
      const currentToken = getAuthToken();
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        currentToken &&
        requestAuthorization === `Bearer ${currentToken}`
      ) {
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
   * Изменение своих личных данных — только администратор (PUT /user/me). Без ретраев: это запись.
   */
  async updateMe(update: ProfileUpdate): Promise<User> {
    const dto = await this.put<UserDto, ProfileUpdate>('/user/me', update, { skipLogging: true });
    return mapUser(dto);
  }

  /**
   * Смена своего пароля: пользователь определяется по токену.
   * Без ретраев: если первый запрос дошёл, повтор со старым паролем вернёт «неверный текущий пароль».
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.patch<void, ChangePasswordDto>(
      '/user/password',
      { old_password: oldPassword, new_password: newPassword },
      { skipLogging: true }
    );
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
   * Кто сейчас в саду: все активные группы сада с присутствием (GET /group/presence без фильтра по филиалу)
   * и список филиалов. Разбивка по филиалам — на клиенте по branchId группы: так одним запросом известны
   * счётчики всех филиалов для экрана выбора.
   * На бэкенде без /group/presence (404) — плоский список из /group/children/present без групп и филиалов.
   */
  async getPresence(): Promise<Presence> {
    const retry = createRetryConfig(2, 500);
    try {
      const [dto, branches] = await Promise.all([
        retryRequest(() => this.get<KindergartenPresenceDto>('/group/presence', { skipLogging: true }), retry),
        this.getBranches(),
      ]);
      return {
        total: dto.total_present,
        groups: dto.groups.map(mapPresenceGroup),
        withoutGroup: dto.without_group.map(mapPresentChild),
        branches,
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
    return { total: children.length, groups: null, withoutGroup: children, branches: [] };
  }

  /**
   * Активные филиалы по названию.
   */
  async getBranches(): Promise<Branch[]> {
    const list = await retryRequest(
      () => this.get<BranchDto[]>('/branch/list'),
      createRetryConfig(2, 500)
    );
    return list
      .map((dto) => ({ id: dto.external_key, name: dto.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  /**
   * Журнал посещений всего сада, новые сверху. Страницы с нуля. По 100: журнал собирает отметки дня в строки
   * по детям, и чем крупнее страница, тем реже день обрывается на границе страниц.
   */
  async getVisits(page: number, size = 100): Promise<VisitPage> {
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
   * Страница людей одной группы вкладки «Люди»: поиск, фильтр по группе и сортировка — на сервере.
   */
  async getPeople(query: PeopleQuery, page: number, size = 30): Promise<PeoplePage> {
    const params: Record<string, string | number | boolean> = { category: query.category, page, size };
    const q = query.q.trim();
    if (q) {
      params.q = q;
    }
    if (query.category === 'CHILD' && query.groupFilter.kind === 'group') {
      params.group_external_key = query.groupFilter.id;
    }
    if (query.category === 'CHILD' && query.groupFilter.kind === 'withoutGroup') {
      params.without_group = true;
    }
    const result = await retryRequest(
      () => this.get<PageWithTotalDto<PersonDto>>('/user/people', { params, skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return {
      items: result.content.map(mapPerson),
      page: result.number,
      last: result.last,
      total: result.totalElements,
    };
  }

  /**
   * Поместить ребёнка в группу (в том числе пустую). Из прежней группы ребёнок переводится,
   * повтор ничего не меняет. Только администратор.
   */
  async putChildInGroup(groupId: string, childId: string): Promise<void> {
    await this.put(`/group/${groupId}/children/${childId}`, undefined, { skipLogging: true });
  }

  /**
   * Убрать ребёнка из группы — он остаётся без группы. Повтор ничего не меняет. Только администратор.
   */
  async removeChildFromGroup(groupId: string, childId: string): Promise<void> {
    await this.delete(`/group/${groupId}/children/${childId}`, { skipLogging: true });
  }

  /**
   * Новый филиал. 409 NAME_TAKEN — филиал с таким названием уже есть.
   */
  async createBranch(name: string): Promise<Branch> {
    const dto = await this.post<BranchDto, { name: string }>('/branch', { name });
    return { id: dto.external_key, name: dto.name };
  }

  /**
   * Переименовать филиал. 409 NAME_TAKEN, 404 — филиал удалён.
   */
  async renameBranch(id: string, name: string): Promise<Branch> {
    const dto = await this.put<BranchDto, { name: string }>(`/branch/${id}`, { name });
    return { id: dto.external_key, name: dto.name };
  }

  /**
   * Удалить пустой филиал. 409 BRANCH_NOT_EMPTY с groups_count — в филиале есть группы.
   */
  async deleteBranch(id: string): Promise<void> {
    await this.delete(`/branch/${id}`);
  }

  /**
   * Новая группа в филиале. 409 NAME_TAKEN — в филиале уже есть группа с таким названием.
   */
  async createGroup(name: string, branchId: string): Promise<GardenGroup> {
    const dto = await this.post<GroupDto, { name: string; branch_external_key: string }>('/group', {
      name,
      branch_external_key: branchId,
    });
    return { id: dto.external_key, name: dto.name, branchId: dto.branch_external_key ?? null };
  }

  /**
   * Переименовать группу или перенести в другой филиал; дети остаются в группе.
   */
  async updateGroup(id: string, name: string, branchId: string): Promise<GardenGroup> {
    const dto = await this.put<GroupDto, { name: string; branch_external_key: string }>(`/group/${id}`, {
      name,
      branch_external_key: branchId,
    });
    return { id: dto.external_key, name: dto.name, branchId: dto.branch_external_key ?? null };
  }

  /**
   * Удалить пустую группу. 409 GROUP_NOT_EMPTY с children_count — в группе есть дети.
   */
  async deleteGroup(id: string): Promise<void> {
    await this.delete(`/group/${id}`);
  }

  /**
   * Активные группы сада — для фильтра детей по группе.
   */
  async getGroups(): Promise<GardenGroup[]> {
    const list = await retryRequest(() => this.get<GroupDto[]>('/group/list'), createRetryConfig(2, 500));
    return list
      .map((dto) => ({ id: dto.external_key, name: dto.name, branchId: dto.branch_external_key ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
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
