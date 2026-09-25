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
}
