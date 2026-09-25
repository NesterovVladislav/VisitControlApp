/**
 * Ребёнок, который сейчас в саду (GET /group/children/present)
 */
export interface PresentChild {
  id: string;
  firstName: string;
  surname: string;
}

/**
 * Группа на экране «Кто в саду» (GET /group/presence)
 */
export interface PresenceGroup {
  id: string;
  name: string;
  branchId: string | null;
  /** Сколько всего детей в группе */
  totalChildren: number;
  /** Кто из группы сейчас в саду */
  present: PresentChild[];
}

/**
 * Кто сейчас в саду. groups === null — бэкенд ещё без разбивки по группам,
 * тогда все дети в withoutGroup.
 */
export interface Presence {
  total: number;
  groups: PresenceGroup[] | null;
  withoutGroup: PresentChild[];
}

/**
 * Отметка в журнале посещений (GET /visit/list)
 */
export interface VisitEntry {
  /** Своего id у отметки в API нет: ребёнок + время + статус */
  key: string;
  childId: string;
  childName: string;
  representativeName: string;
  status: 'IN' | 'OUT';
  /** ISO-время в UTC */
  datetime: string;
}

export interface VisitPage {
  items: VisitEntry[];
  page: number;
  last: boolean;
}

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

export interface VisitsState {
  present: {
    data: Presence;
    status: LoadStatus;
    refreshing: boolean;
  };
  journal: {
    items: VisitEntry[];
    status: LoadStatus;
    refreshing: boolean;
    /** Номер последней загруженной страницы, с нуля */
    page: number;
    last: boolean;
    loadingMore: boolean;
    loadMoreFailed: boolean;
  };
}
