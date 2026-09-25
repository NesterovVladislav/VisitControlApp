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
}

export interface ChildStatus {
  /** null — статус ещё не загружен */
  value: VisitStatus | null;
  loading: boolean;
  error: boolean;
  /** Сообщение в карточке, например «Статус уже изменился» */
  notice: string | null;
}

export interface MarkVisitRequest {
  childId: string;
  /** Статус, который видел пользователь, когда нажимал кнопку */
  seenStatus: VisitStatus;
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
  /** Дети, по которым сейчас идёт отметка */
  markingIds: string[];
  /** Ошибка отметки, которую экран показывает диалогом */
  markError: MarkVisitError | null;
}

export function isInKindergarten(status: VisitStatus | null): boolean {
  return status === 'IN';
}
