import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  GardenGroup,
  PasswordReset,
  PeoplePage,
  PeopleQuery,
  PeopleState,
  PersonDeactivation,
  RoleChange,
  StaffRole,
} from '../types/people';
import { logoutCompleted } from './auth';

const initialState: PeopleState = {
  query: { category: 'CHILD', q: '', groupFilter: { kind: 'all' } },
  items: [],
  total: 0,
  status: 'idle',
  refreshing: false,
  page: 0,
  last: false,
  loadingMore: false,
  loadMoreFailed: false,
  requestId: 0,
  passwordReset: null,
  deactivation: null,
  roleChange: null,
  filterOptions: { status: 'idle', groups: [], branches: [] },
};

function sameQuery(a: PeopleQuery, b: PeopleQuery): boolean {
  return a.category === b.category && a.q === b.q && JSON.stringify(a.groupFilter) === JSON.stringify(b.groupFilter);
}

/**
 * Вкладка «Люди» администратора: одна страница за раз из GET /user/people.
 */
const peopleSlice = createSlice({
  name: 'people',
  initialState,
  reducers: {
    /**
     * Первая страница: открытие вкладки, смена группы, поиска или фильтра, потянули вниз.
     * Новый запрос — список сбрасывается, при обновлении того же запроса — остаётся на экране.
     */
    loadPeople: (state, action: PayloadAction<{ query?: PeopleQuery; refresh?: boolean } | undefined>) => {
      const query = action.payload?.query;
      state.requestId += 1;
      state.loadMoreFailed = false;
      state.loadingMore = false;
      if (query && !sameQuery(query, state.query)) {
        state.query = query;
        state.items = [];
        state.total = 0;
        state.status = 'loading';
        state.refreshing = false;
      } else if (action.payload?.refresh) {
        state.refreshing = true;
      } else if (state.status !== 'loaded') {
        state.status = 'loading';
      }
    },
    loadMorePeople: (state) => {
      // Дальше грузить нечего; saga проверяет то же условие и запрос не отправляет
      if (state.last || state.status !== 'loaded' || state.loadingMore) {
        return;
      }
      state.loadingMore = true;
      state.loadMoreFailed = false;
    },
    loadPeopleSuccess: (state, action: PayloadAction<{ requestId: number; result: PeoplePage }>) => {
      const { requestId, result } = action.payload;
      // Ответ на устаревший запрос: пока он шёл, сменили поиск или группу
      if (requestId !== state.requestId) {
        return;
      }
      if (result.page === 0) {
        state.items = result.items;
        state.status = 'loaded';
        state.refreshing = false;
      } else if (result.page === state.page + 1) {
        // Страницы по смещению: если между запросами кто-то добавился, строки могут повториться
        const known = new Set(state.items.map((person) => person.id));
        state.items.push(...result.items.filter((person) => !known.has(person.id)));
        state.loadingMore = false;
      } else {
        state.loadingMore = false;
        return;
      }
      state.page = result.page;
      state.last = result.last;
      state.total = result.total;
    },
    loadPeopleFailure: (state, action: PayloadAction<{ requestId: number; page: number }>) => {
      if (action.payload.requestId !== state.requestId) {
        return;
      }
      if (action.payload.page === 0) {
        state.refreshing = false;
        if (state.status !== 'loaded') {
          state.status = 'failed';
        }
      } else {
        state.loadingMore = false;
        state.loadMoreFailed = true;
      }
    },

    /** Группы и филиалы для фильтра детей «Все группы ▾». */
    loadPeopleFilters: (state) => {
      if (state.filterOptions.status !== 'loaded') {
        state.filterOptions.status = 'loading';
      }
    },
    loadPeopleFiltersSuccess: (
      state,
      action: PayloadAction<{ groups: GardenGroup[]; branches: { id: string; name: string }[] }>
    ) => {
      state.filterOptions = { status: 'loaded', ...action.payload };
    },
    loadPeopleFiltersFailure: (state) => {
      if (state.filterOptions.status !== 'loaded') {
        state.filterOptions.status = 'failed';
      }
    },

    /** Администратор подтвердил «Сбросить пароль»; пока идёт один сброс, второй не начинаем. */
    resetPersonPassword: (state, action: PayloadAction<string>) => {
      if (state.passwordReset?.status === 'pending') {
        return;
      }
      state.passwordReset = { personId: action.payload, status: 'pending', message: null };
    },
    resetPersonPasswordFinished: (state, action: PayloadAction<PasswordReset>) => {
      if (state.passwordReset?.personId === action.payload.personId) {
        state.passwordReset = action.payload;
      }
    },
    /** Администратор подтвердил «Деактивировать»; пока идёт одна деактивация, вторую не начинаем. */
    deactivatePerson: (state, action: PayloadAction<string>) => {
      if (state.deactivation?.status === 'pending') {
        return;
      }
      state.deactivation = { personId: action.payload, status: 'pending', message: null };
    },
    deactivatePersonFinished: (state, action: PayloadAction<PersonDeactivation>) => {
      if (state.deactivation?.personId !== action.payload.personId) {
        return;
      }
      state.deactivation = action.payload;
      // Список показывает только активных: отключённого убираем сразу, не перезагружая страницы
      if (action.payload.status === 'done' && state.items.some((person) => person.id === action.payload.personId)) {
        state.items = state.items.filter((person) => person.id !== action.payload.personId);
        state.total = Math.max(0, state.total - 1);
      }
    },
    /** Директор подтвердил смену роли; пока идёт одна смена, вторую не начинаем. */
    changePersonRole: (state, action: PayloadAction<{ personId: string; role: StaffRole }>) => {
      if (state.roleChange?.status === 'pending') {
        return;
      }
      state.roleChange = { ...action.payload, status: 'pending', message: null };
    },
    changePersonRoleFinished: (state, action: PayloadAction<RoleChange>) => {
      if (state.roleChange?.personId !== action.payload.personId) {
        return;
      }
      state.roleChange = action.payload;
      if (action.payload.status === 'done') {
        const person = state.items.find((item) => item.id === action.payload.personId);
        if (person) {
          person.role = action.payload.role;
        }
      }
    },
    /** Результат смены роли показан. */
    clearRoleChange: (state) => {
      if (state.roleChange?.status !== 'pending') {
        state.roleChange = null;
      }
    },
    /** Результат деактивации показан. */
    clearDeactivation: (state) => {
      if (state.deactivation?.status !== 'pending') {
        state.deactivation = null;
      }
    },
    /** Результат сброса показан. */
    clearPasswordReset: (state) => {
      if (state.passwordReset?.status !== 'pending') {
        state.passwordReset = null;
      }
    },
  },
  extraReducers: (builder) => {
    // Телефоны и email людей сада не должны пережить выход из аккаунта
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  loadPeople,
  loadMorePeople,
  loadPeopleSuccess,
  loadPeopleFailure,
  loadPeopleFilters,
  loadPeopleFiltersSuccess,
  loadPeopleFiltersFailure,
  resetPersonPassword,
  resetPersonPasswordFinished,
  clearPasswordReset,
  deactivatePerson,
  deactivatePersonFinished,
  clearDeactivation,
  changePersonRole,
  changePersonRoleFinished,
  clearRoleChange,
} = peopleSlice.actions;
export default peopleSlice.reducer;
