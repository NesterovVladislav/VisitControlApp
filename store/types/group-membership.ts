import { Person, PersonGroup } from './people';
import { LoadStatus } from './visits';

/** Кого показывать на экране «Состав группы»: дети этой группы, без группы или все. */
export type CandidateFilter = 'inGroup' | 'withoutGroup' | 'all';

/**
 * Экран «Состав группы»: дети из GET /user/people, добавление — PUT /group/{key}/children/{childKey},
 * удаление — DELETE того же адреса.
 */
export interface GroupMembershipState {
  /** Группа, в которую добавляем */
  group: PersonGroup | null;
  filter: CandidateFilter;
  q: string;
  items: Person[];
  status: LoadStatus;
  page: number;
  last: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  /** Номер запроса первой страницы: ответ на устаревший запрос отбрасывается */
  requestId: number;
  /** Дети, которых сейчас добавляют или убирают */
  saving: Record<string, true>;
  /** Не удалось добавить или убрать: текст под именем ребёнка */
  failed: Record<string, string>;
}
