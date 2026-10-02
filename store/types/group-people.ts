import { Person } from './people';
import { LoadStatus } from './visits';

/**
 * Список людей вкладки «Сад»: дети или родители группы, либо дети без группы (с поиском).
 */
export type GroupPeopleQuery =
  | { kind: 'group'; groupId: string; category: 'CHILD' | 'PARENT' }
  | { kind: 'withoutGroup'; q: string };

export interface GroupPeopleState {
  query: GroupPeopleQuery | null;
  items: Person[];
  total: number;
  status: LoadStatus;
  refreshing: boolean;
  page: number;
  last: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  /** Номер запроса первой страницы: ответ на устаревший запрос отбрасывается */
  requestId: number;
  /** «Дети без группы»: кого сейчас распределяют */
  saving: Record<string, true>;
  /** «Дети без группы»: не удалось добавить в группу — текст под именем */
  failed: Record<string, string>;
}
