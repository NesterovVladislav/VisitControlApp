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
  /** Сколько детей группы ждут приёма: родитель отметил приход, сад ещё не подтвердил. В present не входят */
  pendingIn?: number;
  /** Сколько детей группы ждут выдачи: они ещё в саду и входят в present */
  pendingOut?: number;
}

/**
 * Филиал (GET /branch/list)
 */
export interface Branch {
  id: string;
  name: string;
}

/**
 * Кто сейчас в саду. groups === null — бэкенд ещё без разбивки по группам,
 * тогда все дети в withoutGroup, а филиалов нет.
 * withoutGroup — дети в саду, которые не состоят ни в одной группе: к филиалу они не привязаны.
 */
export interface Presence {
  total: number;
  groups: PresenceGroup[] | null;
  withoutGroup: PresentChild[];
  /** Активные филиалы по названию */
  branches: Branch[];
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
  /** ISO-время; на экране — часы сада, см. toWallClockIso */
  datetime: string;
  /** Нынешняя группа ребёнка (не на день отметки); null — без группы или старый бэкенд */
  group: { id: string; name: string; branchName: string | null } | null;
  /** Решение сада; нет — отметке подтверждение не требовалось */
  confirmation?: VisitConfirmation | null;
  /** Сотрудник, который принял или отдал ребёнка: «Петрова О.» */
  decidedBy?: string | null;
  /** Комментарий того, кто поставил отметку */
  comment?: string | null;
}

/** Решение сада по отметке прихода или ухода. */
export type VisitConfirmation = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

/** Отметка в очереди сотрудника (GET /visit/pending): ждёт «Принять» или «Отдать». */
export interface VisitQueueItem {
  id: string;
  status: 'IN' | 'OUT';
  childName: string;
  /** Пути к фотографиям ребёнка и взрослого относительно API */
  childPhotoUrl?: string | null;
  representativePhotoUrl?: string | null;
  representativeId: string;
  /** «Иванова А.» */
  representativeName: string;
  /** Кем приходится ребёнку: PARENT, RELATIVE, ACQUAINTANCE */
  linkRole: string | null;
  /** ISO-время; на экране — часы сада, см. toWallClockIso */
  datetime: string;
  comment: string | null;
  /** Группа ребёнка на момент отметки */
  group: { id: string; name: string } | null;
}

/** Какие группы сотрудник выбрал для очереди. Хранится на устройстве. */
export interface QueueFilter {
  groupIds: string[];
  withoutGroup: boolean;
}

export interface VisitQueue {
  items: VisitQueueItem[];
  /** Сколько отметок ждут вне выбранных групп */
  otherCount: number;
}

export interface VisitPage {
  items: VisitEntry[];
  page: number;
  last: boolean;
}

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

/** Одноразовый код для QR (POST /visit/handover). */
export interface HandoverToken {
  /** Содержимое QR-кода */
  token: string;
  /** Через сколько секунд код перестанет действовать */
  expiresIn: number;
}

/** Что получилось после скана QR-кода сотрудником (POST /visit/handover/redeem). */
export interface HandoverResult {
  status: 'IN' | 'OUT';
  childName: string;
  /** «Иванова А.» */
  representativeName: string;
  linkRole: string | null;
  groupName: string | null;
}

export interface VisitQueueState {
  /** Включено ли в саду подтверждение посещений; null — ещё не знаем */
  enabled: boolean | null;
  items: VisitQueueItem[];
  otherCount: number;
  status: LoadStatus;
  refreshing: boolean;
  /** Выбранные группы; null — вся очередь */
  filter: QueueFilter | null;
  /** Выбор групп прочитан с устройства */
  filterLoaded: boolean;
  /** Показать всю очередь поверх выбранных групп; до перезапуска приложения */
  showAll: boolean;
  /** Отметки, по которым сейчас отправляется решение */
  decidingIds: string[];
  /** Ошибка решения, которую экран показывает диалогом */
  error: string | null;
}

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
