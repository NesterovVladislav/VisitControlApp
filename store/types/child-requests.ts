import { RequestChildMatch } from './requests';
import { LoadStatus } from './visits';

/** Что стало с просьбой добавить ребёнка: добавлен сразу, ждёт администратора или сад не добавил. */
export type ChildRequestStatus = 'ADDED' | 'PENDING' | 'REJECTED';

/**
 * Просьба пользователя добавить ему ребёнка (POST /user/me/children). Администратор и директор добавляют
 * ребёнка себе сразу, остальные подают заявку, которую подтверждает администратор сада.
 */
export interface ChildRequest {
  id: string;
  status: ChildRequestStatus;
  surname: string;
  firstName: string;
  patronymic: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  /** Кто просит: «Иванова А.». Только в списке у администратора */
  applicantName: string | null;
  /** Роль заявителя: PARENT, EMPLOYEE. Только в списке у администратора */
  applicantRole: string | null;
  /** Дети сада с тем же именем и датой рождения. Только в списке у администратора */
  matches: RequestChildMatch[];
}

/** Данные ребёнка для запроса */
export interface ChildRequestBody {
  surname: string;
  first_name: string;
  patronymic?: string;
  /** YYYY-MM-DD */
  birth_date: string;
  gender: 'MALE' | 'FEMALE';
}

/** Что стало с изменением данных ребёнка. */
export type ChildChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** ФИО и дата рождения ребёнка: то, что можно менять. Пол не меняется. */
export interface ChildData {
  surname: string;
  firstName: string;
  patronymic: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
}

/**
 * Изменение данных ребёнка (PUT /user/me/children/{id}). Администратор и директор меняют данные сразу,
 * родитель подаёт изменение на подтверждение администратору сада.
 */
export interface ChildChange {
  id: string;
  status: ChildChangeStatus;
  childId: string;
  /** Что предлагается */
  next: ChildData;
  /** Что было на момент подачи */
  previous: ChildData;
  /** Причина отклонения */
  reason: string | null;
  /** Кто предложил: «Иванова А.». Только в списке у администратора */
  applicantName: string | null;
}

/** Свой ребёнок с данными для карточки в профиле (GET /user/me/children). */
export interface OwnChild extends ChildData {
  id: string;
  gender: 'MALE' | 'FEMALE' | null;
  /** Кем пользователь приходится ребёнку: PARENT, RELATIVE, ACQUAINTANCE */
  linkRole: string | null;
  /** Родитель или администратор сада: может менять данные ребёнка */
  canEdit: boolean;
  /** Родитель: может менять фотографию ребёнка */
  canEditPhoto?: boolean;
  /** Путь к фотографии относительно API; нет фотографии — null */
  photoUrl?: string | null;
  /** Изменение, которое ждёт решения сада или недавно отклонено */
  change: ChildChange | null;
}

/** Новые данные ребёнка для запроса */
export interface ChildChangeBody {
  surname: string;
  first_name: string;
  patronymic?: string;
  /** YYYY-MM-DD */
  birth_date: string;
}

/** Решение администратора по заявке */
export type ChildRequestDecision = { kind: 'CREATE' } | { kind: 'LINK'; childId: string } | { kind: 'SKIP' };

export interface ChildRequestsState {
  /** Свои заявки: ждут решения или недавно отклонены садом */
  own: ChildRequest[];
  /** Отправляется просьба добавить ребёнка */
  submitting: boolean;
  /** Чем закончилась последняя просьба; экран показывает диалог и сбрасывает */
  submitResult: ChildRequestStatus | null;
  submitError: string | null;
  /** Свои заявки, которые сейчас отзываются */
  cancellingIds: string[];
  /** Свои дети с данными; null — ещё не загружены или бэкенд их не отдаёт */
  ownChildren: OwnChild[] | null;
  /** Отправляется изменение данных ребёнка */
  changeSubmitting: boolean;
  /** Чем закончилось последнее изменение; экран показывает диалог и сбрасывает */
  changeResult: ChildChangeStatus | null;
  changeError: string | null;
  /** Изменения данных детей сада, которые ждут администратора */
  changes: ChildChange[];
  /** Изменения, по которым отправляется решение или отзыв */
  decidingChangeIds: string[];
  /** Заявки сада, которые ждут администратора */
  pending: ChildRequest[];
  pendingStatus: LoadStatus;
  /** Заявки, по которым отправляется решение */
  decidingIds: string[];
  /** Ошибка отзыва или решения, которую экран показывает диалогом */
  error: string | null;
}
