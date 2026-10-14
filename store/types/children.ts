/**
 * Статус ребёнка по последней отметке. NONE — отметок ещё не было.
 */
export type VisitStatus = 'IN' | 'OUT' | 'NONE';

export interface Child {
  id: string;
  firstName: string;
  surname: string;
  /** Роль связи «ребёнок — представитель»: PARENT, RELATIVE, ACQUAINTANCE */
  linkRole: string;
  /** Путь к фотографии относительно API; нет фотографии — null */
  photoUrl?: string | null;
}

/** Отметка родителя, которая ждёт решения сотрудника сада. */
export interface PendingMark {
  id: string;
  status: 'IN' | 'OUT';
  /** ISO-время; на экране — часы сада, см. toWallClockIso */
  datetime: string;
}

/** Отметка, которую сад отклонил; показывается, пока родитель не поставит новую. */
export interface RejectedMark {
  status: 'IN' | 'OUT';
  reason: string | null;
}

/**
 * Где ребёнок сегодня (GET /visit/actual_status). Статус меняет только подтверждение сада:
 * пока приход ждёт сотрудника, ребёнок «не в саду», пока уход ждёт — ещё «в саду».
 */
export interface ChildVisit {
  status: VisitStatus;
  /** Сотрудник, который принял или отдал ребёнка: «Петрова О.» */
  decidedBy: string | null;
  /** Когда принял или отдал, ISO-время; на экране — часы сада */
  decidedAt: string | null;
  pending: PendingMark | null;
  rejected: RejectedMark | null;
}

export interface ChildStatus {
  /** null — статус ещё не загружен */
  value: VisitStatus | null;
  /** Подтверждение сада по последней отметке; null — статус ещё не загружен */
  visit: ChildVisit | null;
  loading: boolean;
  error: boolean;
  /** Сообщение в карточке, например «Статус уже изменился» */
  notice: string | null;
}

export interface MarkVisitRequest {
  childId: string;
  /** Статус, который видел пользователь, когда нажимал кнопку */
  seenStatus: VisitStatus;
  /** Комментарий для сада, например кто на самом деле привёл ребёнка */
  comment?: string;
}

export interface MarkVisitError {
  childId: string;
  message: string;
}

export interface ChildrenState {
  items: Child[];
  listStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  refreshing: boolean;
  statusById: Record<string, ChildStatus>;
  /** Дети, по которым сейчас идёт отметка или её отмена */
  markingIds: string[];
  /** Ошибка отметки, которую экран показывает диалогом */
  markError: MarkVisitError | null;
  /** В саду включено подтверждение посещений: родителю доступен QR-код ребёнка */
  qrAvailable: boolean;
}

export function isInKindergarten(status: VisitStatus | null): boolean {
  return status === 'IN';
}

/** Наибольшая длина комментария к отметке (visit_log.comment на бэкенде). */
export const VISIT_COMMENT_MAX_LENGTH = 256;

/** Ребёнок в группе, как его видит родитель другого ребёнка: только фамилия, имя и в саду ли он сейчас. */
export interface ChildGroupMember {
  surname: string;
  firstName: string;
  present: boolean;
  /** Тот самый ребёнок, чью группу открыли */
  own: boolean;
}

/** Группа своего ребёнка (GET /user/me/children/{id}/group). name === null — ребёнок без группы. */
export interface ChildGroup {
  name: string | null;
  /** По фамилии и имени */
  children: ChildGroupMember[];
}
