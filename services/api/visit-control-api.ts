import { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { createApiClient, setupAuthToken } from './client';
import { RequestConfig, ApiResponse } from './types';
import { ApiError } from '../errors/api-error';
import { retryRequest, createRetryConfig } from './retry';
import { LoginCredentials, User } from '../../store/types/auth';
import { Child, ChildGroup, ChildVisit } from '../../store/types/children';
import { OrganizationBrand } from '../../store/types/organization';
import { PhotoRequest, PhotoRequestStatus } from '../../store/types/photos';
import {
  ChildChange,
  ChildChangeBody,
  ChildChangeStatus,
  ChildRequest,
  ChildRequestBody,
  ChildRequestDecision,
  ChildRequestStatus,
  OwnChild,
} from '../../store/types/child-requests';
import {
  Branch,
  HandoverResult,
  HandoverToken,
  Presence,
  PresenceGroup,
  PresentChild,
  QueueFilter,
  VisitConfirmation,
  VisitEntry,
  VisitPage,
  VisitQueue,
  VisitQueueItem,
} from '../../store/types/visits';
import {
  AssignableRole,
  ChildDecision,
  RegistrationRequestsPage,
  RegistrationRequestView,
} from '../../store/types/requests';
import { GardenGroup, PeoplePage, PeopleQuery, Person } from '../../store/types/people';
import { ProfileUpdate } from '../../utils/profile-edit';
import { getAuthToken, notifyUnauthorized } from '../auth/auth-token';
import { photoForm } from '../photos/photo-form';
import { PrivacyPolicy, PublicOrganization, RegistrationRequest } from '../../store/types/registration';

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
  /** Путь относительно API, например `/user/{key}/photo?v=…` */
  photo_url?: string | null;
}

interface PhotoRequestDto {
  external_key: string;
  status: PhotoRequestStatus;
  user: UserShortInfoDto;
  applicant?: UserShortInfoDto | null;
  image_url?: string | null;
  decision_comment?: string | null;
}

function mapPhotoRequest(dto: PhotoRequestDto): PhotoRequest {
  return {
    id: dto.external_key,
    status: dto.status,
    userId: dto.user.external_key,
    userName: `${dto.user.first_name} ${dto.user.surname}`.trim(),
    currentPhotoUrl: dto.user.photo_url ?? null,
    imageUrl: dto.image_url ?? null,
    reason: dto.decision_comment ?? null,
    applicantName: dto.applicant ? shortName(dto.applicant) : null,
  };
}

const MULTIPART: RequestConfig = { headers: { 'Content-Type': 'multipart/form-data' }, skipLogging: true };

interface UserDto extends UserShortInfoDto {
  email?: string | null;
  /** Нет у технического администратора */
  organization?: { external_key: string; name: string } | null;
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
  comment?: string;
}

interface VisitFullInfoDto {
  visitor: UserShortInfoDto;
  representative: UserShortInfoDto;
  status: 'IN' | 'OUT';
  datetime: string | number[];
  group?: { external_key: string; name: string; branch_name?: string | null } | null;
  /** Поля подтверждения — с бэкенда от 12.10.2026 (docs/visit-confirmation.md в visit-control-service) */
  external_key?: string;
  comment?: string | null;
  confirmation_status?: VisitConfirmation | null;
  confirmation_method?: 'BUTTON' | 'QR' | 'MANUAL' | null;
  decided_by?: UserShortInfoDto | null;
  decided_at?: string | number[] | null;
  decision_comment?: string | null;
  link_role?: string | null;
}

interface ChildVisitStatusDto {
  status?: 'IN' | 'OUT';
  decided_by?: UserShortInfoDto | null;
  decided_at?: string | number[] | null;
  pending?: VisitFullInfoDto | null;
  last_rejected?: VisitFullInfoDto | null;
}

interface VisitQueueDto {
  items: VisitFullInfoDto[];
  other_count: number;
}

interface GroupPresenceDto {
  external_key: string;
  name: string;
  branch_external_key?: string | null;
  total_children: number;
  present: UserShortInfoDto[];
  pending_in?: UserShortInfoDto[];
  pending_out?: UserShortInfoDto[];
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
    pendingIn: (dto.pending_in ?? []).length,
    pendingOut: (dto.pending_out ?? []).length,
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
 * Так бэкенд отдаёт время создания заявки на регистрацию: LocalDateTime без зоны по часам сервера (UTC).
 * Время отметок прихода и ухода — по часам сада, для него есть toWallClockIso.
 * Точность — как в PostgreSQL, до микросекунд:
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

/**
 * Время отметки с бэкенда → ISO-строка, которая на этом телефоне покажет те же часы и минуты.
 *
 * Отметки прихода и ухода бэкенд отдаёт уже по часам сада (`OrganizationTime.toOrganization`), без зоны:
 * `[2026, 10, 12, 15, 35, …]` — это 15:35 в саду. Считать такое время как UTC нельзя: телефон прибавит
 * свой сдвиг и покажет 22:35. Поэтому читаем его как «время на стене»: 15:35 остаётся 15:35 на любом телефоне.
 * Строку с явной зоной (`Z`, `+07:00`) переводим как обычно.
 */
export function toWallClockIso(value: string | number[]): string {
  let parts: number[];
  if (Array.isArray(value)) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nanos = 0] = value;
    parts = [year, month, day, hour, minute, second, Math.floor(nanos / 1_000_000)];
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(value.trim());
    if (!match) {
      return toUtcIso(value);
    }
    const [, year, month, day, hour, minute, second = '0', fraction = ''] = match;
    parts = [year, month, day, hour, minute, second, fraction.padEnd(3, '0').slice(0, 3)].map(Number);
  }
  const [year, month, day, hour, minute, second, millis] = parts;
  return new Date(year, month - 1, day, hour, minute, second, millis).toISOString();
}

/** «Иванова А.» */
function shortName(dto: UserShortInfoDto): string {
  const initial = dto.first_name ? ` ${dto.first_name.charAt(0)}.` : '';
  return `${dto.surname}${initial}`;
}

function mapVisit(dto: VisitFullInfoDto): VisitEntry {
  const datetime = toWallClockIso(dto.datetime);
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
    confirmation: dto.confirmation_status ?? null,
    decidedBy: dto.decided_by ? shortName(dto.decided_by) : null,
    comment: dto.comment ?? null,
  };
}

function mapQueueItem(dto: VisitFullInfoDto): VisitQueueItem {
  return {
    id: dto.external_key ?? '',
    status: dto.status,
    childName: `${dto.visitor.first_name} ${dto.visitor.surname}`.trim(),
    childPhotoUrl: dto.visitor.photo_url ?? null,
    representativePhotoUrl: dto.representative.photo_url ?? null,
    representativeId: dto.representative.external_key,
    representativeName: shortName(dto.representative),
    linkRole: dto.link_role ?? null,
    datetime: toWallClockIso(dto.datetime),
    comment: dto.comment ?? null,
    group: dto.group ? { id: dto.group.external_key, name: dto.group.name } : null,
  };
}

function mapChildVisit(dto: ChildVisitStatusDto | ''): ChildVisit {
  if (!dto || !dto.status) {
    // Старый бэкенд отвечал пустым телом, если отметок не было
    return { status: 'NONE', decidedBy: null, decidedAt: null, pending: null, rejected: null };
  }
  const pending = dto.pending;
  const rejected = dto.last_rejected;
  return {
    status: dto.status,
    decidedBy: dto.decided_by ? shortName(dto.decided_by) : null,
    decidedAt: dto.decided_at ? toWallClockIso(dto.decided_at) : null,
    pending: pending?.external_key
      ? { id: pending.external_key, status: pending.status, datetime: toWallClockIso(pending.datetime) }
      : null,
    rejected: rejected ? { status: rejected.status, reason: rejected.decision_comment ?? null } : null,
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
  role?: string | null;
  children?: RegistrationChildViewDto[] | null;
}

interface RegistrationChildMatchDto {
  external_key: string;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  birth_date?: string | number[] | null;
}

interface RegistrationChildViewDto extends RegistrationChildMatchDto {
  gender?: 'MALE' | 'FEMALE' | null;
  matches?: RegistrationChildMatchDto[] | null;
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
    role: dto.role ?? null,
    children: (dto.children ?? []).map((child) => ({
      id: child.external_key,
      surname: child.surname,
      firstName: child.first_name,
      patronymic: child.patronymic ?? null,
      birthDate: toIsoDate(child.birth_date),
      gender: child.gender ?? null,
      matches: (child.matches ?? []).map((match) => ({
        id: match.external_key,
        surname: match.surname,
        firstName: match.first_name,
        patronymic: match.patronymic ?? null,
        birthDate: toIsoDate(match.birth_date),
      })),
    })),
  };
}

interface ChildRequestDto {
  external_key: string;
  status: ChildRequestStatus;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  birth_date?: string | number[] | null;
  gender?: 'MALE' | 'FEMALE' | null;
  applicant?: UserShortInfoDto | null;
  applicant_role?: string | null;
  matches?: {
    external_key: string;
    surname: string;
    first_name: string;
    patronymic?: string | null;
    birth_date?: string | number[] | null;
  }[];
}

interface ChildChangeDto {
  external_key: string;
  status: ChildChangeStatus;
  child_external_key: string;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  birth_date?: string | number[] | null;
  old_surname?: string | null;
  old_first_name?: string | null;
  old_patronymic?: string | null;
  old_birth_date?: string | number[] | null;
  decision_comment?: string | null;
  applicant?: UserShortInfoDto | null;
}

interface OwnChildDto {
  external_key: string;
  surname: string;
  first_name: string;
  patronymic?: string | null;
  birth_date?: string | number[] | null;
  gender?: 'MALE' | 'FEMALE' | null;
  link_role?: string | null;
  can_edit?: boolean;
  can_edit_photo?: boolean;
  photo_url?: string | null;
  change?: ChildChangeDto | null;
}

function mapChildChange(dto: ChildChangeDto): ChildChange {
  return {
    id: dto.external_key,
    status: dto.status,
    childId: dto.child_external_key,
    next: {
      surname: dto.surname,
      firstName: dto.first_name,
      patronymic: dto.patronymic ?? null,
      birthDate: dto.birth_date ? toIsoDate(dto.birth_date) : null,
    },
    previous: {
      surname: dto.old_surname ?? '',
      firstName: dto.old_first_name ?? '',
      patronymic: dto.old_patronymic ?? null,
      birthDate: dto.old_birth_date ? toIsoDate(dto.old_birth_date) : null,
    },
    reason: dto.decision_comment ?? null,
    applicantName: dto.applicant ? shortName(dto.applicant) : null,
  };
}

function mapOwnChild(dto: OwnChildDto): OwnChild {
  return {
    id: dto.external_key,
    surname: dto.surname,
    firstName: dto.first_name,
    patronymic: dto.patronymic ?? null,
    birthDate: dto.birth_date ? toIsoDate(dto.birth_date) : null,
    gender: dto.gender ?? null,
    linkRole: dto.link_role ?? null,
    canEdit: dto.can_edit === true,
    canEditPhoto: dto.can_edit_photo === true,
    photoUrl: dto.photo_url ?? null,
    change: dto.change ? mapChildChange(dto.change) : null,
  };
}

function mapChildRequest(dto: ChildRequestDto): ChildRequest {
  return {
    id: dto.external_key,
    status: dto.status,
    surname: dto.surname,
    firstName: dto.first_name,
    patronymic: dto.patronymic ?? null,
    birthDate: dto.birth_date ? toIsoDate(dto.birth_date) : null,
    gender: dto.gender ?? null,
    applicantName: dto.applicant ? shortName(dto.applicant) : null,
    applicantRole: dto.applicant_role ?? null,
    matches: (dto.matches ?? []).map((match) => ({
      id: match.external_key,
      surname: match.surname,
      firstName: match.first_name,
      patronymic: match.patronymic ?? null,
      birthDate: match.birth_date ? toIsoDate(match.birth_date) : null,
    })),
  };
}

/**
 * Тело подтверждения заявки: роль, если её сменили, и решение по каждому ребёнку.
 */
export function toApproveBody(roleId: string | null, decisions: Record<string, ChildDecision>) {
  return {
    ...(roleId ? { role_external_key: roleId } : {}),
    children: Object.entries(decisions).map(([id, decision]) => ({
      external_key: id,
      decision: decision.kind,
      ...(decision.kind === 'LINK' ? { child_external_key: decision.childId } : {}),
    })),
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
    organization: dto.organization
      ? { id: dto.organization.external_key, name: dto.organization.name }
      : null,
    photoUrl: dto.photo_url ?? null,
  };
}

interface OrganizationPublicDto {
  external_key: string;
  name: string;
  address?: string | null;
  /** Путь относительно API, например `/organization/public/{key}/logo?v=…` */
  logo_url?: string | null;
  registration_available: boolean;
}

function mapChild(dto: ChildRepresentativeDto): Child {
  return {
    id: dto.child_external_key,
    firstName: dto.child?.first_name ?? '',
    surname: dto.child?.surname ?? '',
    linkRole: dto.role.role,
    photoUrl: dto.child?.photo_url ?? null,
  };
}

interface PersonDto {
  external_key: string;
  photo_url?: string | null;
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
    photoUrl: dto.photo_url ?? null,
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
   * Группа своего ребёнка: дети группы и кто из них сейчас в саду. О других детях — только фамилия и имя.
   */
  async getChildGroup(childId: string): Promise<ChildGroup> {
    const dto = await retryRequest(
      () =>
        this.get<{
          group_name?: string | null;
          children?: { surname: string; first_name: string; present?: boolean; own?: boolean }[];
        }>(`/user/me/children/${childId}/group`, { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return {
      name: dto.group_name ?? null,
      children: (dto.children ?? []).map((member) => ({
        surname: member.surname,
        firstName: member.first_name,
        present: member.present === true,
        own: member.own === true,
      })),
    };
  }

  /**
   * Где ребёнок сегодня: в саду или нет, отметка, которая ждёт решения сада, и последнее отклонение.
   */
  async getActualStatus(childKey: string): Promise<ChildVisit> {
    const dto = await retryRequest(
      () => this.get<ChildVisitStatusDto | ''>(`/visit/actual_status/${childKey}`, { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return mapChildVisit(dto);
  }

  /**
   * Включено ли в саду подтверждение посещений сотрудником (GET /organization/current).
   * На бэкенде без этой настройки — выключено.
   */
  async getVisitConfirmationEnabled(): Promise<boolean> {
    const dto = await retryRequest(
      () => this.get<{ visit_confirmation?: boolean }>('/organization/current'),
      createRetryConfig(2, 500)
    );
    return dto.visit_confirmation === true;
  }

  /**
   * Название и логотип своего сада для шапки (GET /organization/current). Картинка открыта без токена.
   */
  async getOrganizationBrand(): Promise<OrganizationBrand> {
    const dto = await retryRequest(
      () => this.get<{ external_key: string; name: string; logo_url?: string | null }>('/organization/current'),
      createRetryConfig(2, 500)
    );
    return {
      id: dto.external_key,
      name: dto.name,
      logoUrl: dto.logo_url ? `${this.getBaseURL()}${dto.logo_url}` : null,
    };
  }

  /**
   * Сегодняшние отметки, которые ждут решения сотрудника. filter === null — вся очередь.
   */
  async getVisitQueue(filter: QueueFilter | null): Promise<VisitQueue> {
    const params: Record<string, string> = {};
    if (filter) {
      if (filter.groupIds.length > 0) {
        params.group_external_keys = filter.groupIds.join(',');
      }
      if (filter.withoutGroup) {
        params.without_group = 'true';
      }
    }
    const dto = await retryRequest(
      () => this.get<VisitQueueDto>('/visit/pending', { params, skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return { items: dto.items.map(mapQueueItem), otherCount: dto.other_count };
  }

  /** Сотрудник принял ребёнка или отдал его. Без ретраев: решение по отметке принимается один раз. */
  async confirmVisit(markId: string): Promise<void> {
    await this.post(`/visit/${markId}/confirm`);
  }

  /** Сотрудник отклонил отметку с причиной. */
  async rejectVisit(markId: string, comment: string): Promise<void> {
    await this.post(`/visit/${markId}/reject`, { comment });
  }

  /**
   * Добавить себе ребёнка. Администратор и директор добавляют сразу (ADDED), остальные подают заявку (PENDING).
   * Без ретраев: повтор после таймаута создал бы вторую заявку.
   */
  async addMyChild(child: ChildRequestBody): Promise<ChildRequestStatus> {
    const dto = await this.post<ChildRequestDto, ChildRequestBody>('/user/me/children', child, {
      skipLogging: true,
    });
    return dto.status;
  }

  /** Свои дети с данными для карточки в профиле и изменением, которое ждёт решения сада. */
  async getOwnChildren(): Promise<OwnChild[]> {
    const list = await retryRequest(
      () => this.get<OwnChildDto[]>('/user/me/children', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return list.map(mapOwnChild);
  }

  /**
   * Изменить ФИО и дату рождения ребёнка. Администратор и директор меняют сразу (APPROVED), родитель подаёт
   * изменение на подтверждение (PENDING). Без ретраев: это запись.
   */
  async changeMyChild(childId: string, data: ChildChangeBody): Promise<ChildChangeStatus> {
    const dto = await this.put<ChildChangeDto, ChildChangeBody>(`/user/me/children/${childId}`, data, {
      skipLogging: true,
    });
    return dto.status;
  }

  /** Отозвать своё изменение данных ребёнка, пока его не рассмотрели. */
  async cancelMyChildChange(id: string): Promise<void> {
    await this.delete(`/user/me/children/changes/${id}`);
  }

  /** Изменения данных детей сада, которые ждут администратора. */
  async getChildChanges(): Promise<ChildChange[]> {
    const list = await retryRequest(
      () => this.get<ChildChangeDto[]>('/registration/child-changes', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return list.map(mapChildChange);
  }

  /** Администратор подтверждает изменение: данные ребёнка меняются. */
  async approveChildChange(id: string): Promise<void> {
    await this.post(`/registration/child-changes/${id}/approve`, undefined, { skipLogging: true });
  }

  /** Администратор отклоняет изменение с причиной. */
  async rejectChildChange(id: string, comment: string): Promise<void> {
    await this.post(`/registration/child-changes/${id}/reject`, { comment }, { skipLogging: true });
  }

  /**
   * Отправить фотографию: свою или своего ребёнка (childId). Администратор и директор меняют её сразу (APPROVED),
   * остальные подают на подтверждение сада (PENDING). uri — файл на устройстве, уже квадратный JPEG.
   * Без ретраев: это запись.
   */
  async submitPhoto(uri: string, childId?: string): Promise<PhotoRequest> {
    const endpoint = childId ? `/user/me/children/${childId}/photo` : '/user/me/photo';
    const dto = await this.put<PhotoRequestDto, FormData>(endpoint, await photoForm(uri), MULTIPART);
    return mapPhotoRequest(dto);
  }

  /** Убрать действующую фотографию: свою или своего ребёнка. Сразу, без заявки. */
  async deleteMyPhoto(childId?: string): Promise<void> {
    await this.delete(childId ? `/user/me/children/${childId}/photo` : '/user/me/photo', { skipLogging: true });
  }

  /** Свои заявки на фотографию (на себя и на детей): ждут решения или недавно отклонены садом. */
  async getMyPhotoRequests(): Promise<PhotoRequest[]> {
    const list = await retryRequest(
      () => this.get<PhotoRequestDto[]>('/user/me/photo-requests', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return list.map(mapPhotoRequest);
  }

  /** Отозвать свою заявку на фотографию, пока её не рассмотрели. */
  async cancelMyPhotoRequest(id: string): Promise<void> {
    await this.delete(`/user/me/photo-requests/${id}`, { skipLogging: true });
  }

  /** Заявки на фотографию, которые ждут администратора. */
  async getPhotoRequests(): Promise<PhotoRequest[]> {
    const list = await retryRequest(
      () => this.get<PhotoRequestDto[]>('/registration/photo-requests', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return list.map(mapPhotoRequest);
  }

  /** Администратор подтверждает фотографию: она становится действующей. */
  async approvePhotoRequest(id: string): Promise<void> {
    await this.post(`/registration/photo-requests/${id}/approve`, undefined, { skipLogging: true });
  }

  /** Администратор отклоняет фотографию с причиной. */
  async rejectPhotoRequest(id: string, comment: string): Promise<void> {
    await this.post(`/registration/photo-requests/${id}/reject`, { comment }, { skipLogging: true });
  }

  /** Свои заявки на добавление ребёнка: ждут решения или недавно отклонены садом. */
  async getMyChildRequests(): Promise<ChildRequest[]> {
    const list = await retryRequest(
      () => this.get<ChildRequestDto[]>('/user/me/children/requests', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return list.map(mapChildRequest);
  }

  /** Отозвать свою заявку, пока её не рассмотрели. */
  async cancelMyChildRequest(id: string): Promise<void> {
    await this.delete(`/user/me/children/requests/${id}`);
  }

  /** Заявки сада на добавление ребёнка, которые ждут администратора. */
  async getChildRequests(): Promise<ChildRequest[]> {
    const list = await retryRequest(
      () => this.get<ChildRequestDto[]>('/registration/child-requests', { skipLogging: true }),
      createRetryConfig(2, 500)
    );
    return list.map(mapChildRequest);
  }

  /** Решение администратора: завести ребёнка, привязать ребёнка сада или не добавлять. */
  async decideChildRequest(id: string, decision: ChildRequestDecision): Promise<void> {
    await this.post(
      `/registration/child-requests/${id}/decide`,
      {
        decision: decision.kind,
        ...(decision.kind === 'LINK' ? { child_external_key: decision.childId } : {}),
      },
      { skipLogging: true }
    );
  }

  /**
   * Одноразовый код для QR: представитель привёл ребёнка или забирает его. Без ретраев: новый код
   * отменяет прежний.
   */
  async issueHandover(childKey: string, status: 'IN' | 'OUT', comment?: string): Promise<HandoverToken> {
    const trimmed = comment?.trim();
    const dto = await this.post<{ token: string; expires_in: number }>(
      '/visit/handover',
      { visitor_external_key: childKey, status, ...(trimmed ? { comment: trimmed } : {}) },
      { skipLogging: true }
    );
    return { token: dto.token, expiresIn: dto.expires_in };
  }

  /** Сотрудник отсканировал QR-код: ребёнок принят или отдан. Без ретраев: код срабатывает один раз. */
  async redeemHandover(token: string): Promise<HandoverResult> {
    const dto = await this.post<VisitFullInfoDto>('/visit/handover/redeem', { token }, { skipLogging: true });
    return {
      status: dto.status,
      childName: `${dto.visitor.first_name} ${dto.visitor.surname}`.trim(),
      representativeName: shortName(dto.representative),
      linkRole: dto.link_role ?? null,
      groupName: dto.group?.name ?? null,
    };
  }

  /** Родитель отменил свою отметку, пока сад не принял решение. */
  async cancelVisit(markId: string): Promise<void> {
    await this.post(`/visit/${markId}/cancel`);
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
  async approveRegistration(
    id: string,
    roleId: string | null = null,
    decisions: Record<string, ChildDecision> = {}
  ): Promise<boolean> {
    const result = await this.post<ApprovalResultDto>(
      `/registration/requests/${id}/approve`,
      toApproveBody(roleId, decisions)
    );
    return result.password_sent;
  }

  /**
   * Роли, которые текущий пользователь может выдать: только ниже своей.
   */
  async getAssignableRoles(): Promise<AssignableRole[]> {
    const result = await retryRequest(
      () => this.get<{ external_key: string; role: string }[]>('/user/roles'),
      createRetryConfig(2, 500)
    );
    return result.map((dto) => ({ id: dto.external_key, name: dto.role }));
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
  async createVisit(
    childKey: string,
    representativeKey: string,
    status: 'IN' | 'OUT',
    comment?: string
  ): Promise<void> {
    const trimmed = comment?.trim();
    await this.post<VisitDto, VisitDto>('/visit', {
      visitor_external_key: childKey,
      representative_external_key: representativeKey,
      status,
      ...(trimmed ? { comment: trimmed } : {}),
    });
  }

  /**
   * Сады для экрана регистрации, по названию. Доступно без токена.
   */
  async getPublicOrganizations(): Promise<PublicOrganization[]> {
    const result = await retryRequest(
      () => this.get<OrganizationPublicDto[]>('/organization/public/list'),
      createRetryConfig(2, 500)
    );
    return result.map((dto) => ({
      id: dto.external_key,
      name: dto.name,
      address: dto.address ?? null,
      logoUrl: dto.logo_url ? `${this.getBaseURL()}${dto.logo_url}` : null,
      registrationAvailable: dto.registration_available,
    }));
  }

  /**
   * Текущая политика обработки персональных данных сада. Доступно без токена.
   * GET безопасно повторять, поэтому при сетевых ошибках и 5xx делаем 2 ретрая.
   */
  async getPrivacyPolicy(organizationId: string): Promise<PrivacyPolicy> {
    return retryRequest(
      () =>
        this.get<PrivacyPolicy>('/registration/policy', {
          params: { organization_external_key: organizationId },
        }),
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
