import { LoadStatus } from './visits';

/** Группа во вкладке «Люди»: дети, родители, сотрудники (параметр category у GET /user/people). */
export type PeopleCategory = 'CHILD' | 'PARENT' | 'STAFF';

/** Группа сада, в которой состоит ребёнок. */
export interface PersonGroup {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
}

/** Ребёнок в строке родителя: «мама: Мария». */
export interface PersonChild {
  id: string;
  firstName: string;
  surname: string;
  /** Роль связи: PARENT, RELATIVE, ACQUAINTANCE */
  linkRole: string | null;
}

/** Строка списка «Люди» (GET /user/people). */
export interface Person {
  id: string;
  surname: string;
  firstName: string;
  patronymic: string | null;
  /** Путь к фотографии относительно API; нет фотографии — null */
  photoUrl?: string | null;
  /** Роль пользователя: DIRECTOR, ADMIN, EMPLOYEE, PARENT, VISITOR */
  role: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  /** ISO `YYYY-MM-DD` */
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  /** Только у детей; null — ребёнок не в группе */
  group: PersonGroup | null;
  /** Только у детей: сейчас в саду */
  present: boolean | null;
  /** Только у родителей */
  children: PersonChild[] | null;
}

/** Фильтр детей по группе. */
export type PeopleGroupFilter =
  | { kind: 'all' }
  | { kind: 'group'; id: string; name: string }
  | { kind: 'withoutGroup' };

export interface PeopleQuery {
  category: PeopleCategory;
  q: string;
  /** Только для детей */
  groupFilter: PeopleGroupFilter;
}

export interface PeoplePage {
  items: Person[];
  page: number;
  last: boolean;
  total: number;
}

/** Группа сада для фильтра «Все группы ▾». */
export interface GardenGroup {
  id: string;
  name: string;
  branchId: string | null;
}

export interface PeopleState {
  query: PeopleQuery;
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
  filterOptions: {
    status: LoadStatus;
    groups: GardenGroup[];
    branches: { id: string; name: string }[];
  };
}
