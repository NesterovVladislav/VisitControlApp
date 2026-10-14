import { LoadStatus } from './visits';

/**
 * Заявка на регистрацию из GET /registration/requests
 */
export interface RegistrationRequestView {
  /** external_key заявителя: он же ключ будущего пользователя */
  id: string;
  surname: string;
  firstName: string;
  patronymic: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  email: string;
  phone: string | null;
  /** ISO-время подачи в UTC */
  created: string;
  /** Кем регистрируется: PARENT или EMPLOYEE. Эту роль получит пользователь, если её не сменить */
  role: string | null;
  /** Дети из заявки родителя */
  children: RequestChild[];
}

/**
 * Ребёнок из заявки. Пользователем станет при подтверждении — по решению администратора.
 */
export interface RequestChild {
  /** Ключ ребёнка в заявке, по нему передаётся решение */
  id: string;
  surname: string;
  firstName: string;
  patronymic: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  /** Дети сада с тем же именем и датой рождения: возможно, ребёнка уже записал второй родитель */
  matches: RequestChildMatch[];
}

export interface RequestChildMatch {
  id: string;
  surname: string;
  firstName: string;
  patronymic: string | null;
  birthDate: string | null;
}

/**
 * Что сделать с ребёнком из заявки: создать нового, связать родителя с ребёнком сада или не добавлять.
 */
export type ChildDecision = { kind: 'CREATE' } | { kind: 'LINK'; childId: string } | { kind: 'SKIP' };

/** Роль, которую администратор может выдать (GET /user/roles) */
export interface AssignableRole {
  id: string;
  name: string;
}

export interface ApproveRequestPayload {
  request: RegistrationRequestView;
  /** Другая роль вместо роли из заявки; null — оставить */
  roleId: string | null;
  /** Решение по каждому ребёнку из заявки, по ключу ребёнка */
  decisions: Record<string, ChildDecision>;
}

export interface RegistrationRequestsPage {
  items: RegistrationRequestView[];
  total: number;
}

export type RequestActionKind = 'approve' | 'reject' | 'resendPassword';

/**
 * Чем закончилась обработка заявки. Хранится, чтобы экран заявки мог показать результат,
 * хотя сама заявка уже убрана из списка.
 */
export interface RequestOutcome {
  request: RegistrationRequestView;
  result: 'approved' | 'rejected' | 'alreadyProcessed';
  /** Для approved: ушло ли письмо с паролем */
  passwordSent?: boolean;
  /** Для approved: сколько детей создано или связано с родителем */
  childrenAdded?: number;
}

export interface RequestsState {
  items: RegistrationRequestView[];
  /** Всего ожидающих заявок — для значка на вкладке */
  total: number;
  status: LoadStatus;
  refreshing: boolean;
  /** Заявка, по которой идёт запрос, и какой */
  processing: { id: string; kind: RequestActionKind } | null;
  outcomes: Record<string, RequestOutcome>;
  /** Ошибка действия, экран показывает её диалогом */
  actionError: string | null;
  /** Роли, которые можно выдать при подтверждении */
  roles: AssignableRole[];
  rolesStatus: LoadStatus;
}
