import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GroupPeopleQuery, GroupPeopleState } from '../types/group-people';
import { PeoplePage, Person, PersonGroup } from '../types/people';
import { logoutCompleted } from './auth';

const initialState: GroupPeopleState = {
  query: null,
  items: [],
  total: 0,
  status: 'idle',
  refreshing: false,
  page: 0,
  last: false,
  loadingMore: false,
  loadMoreFailed: false,
  requestId: 0,
  saving: {},
  failed: {},
};

function sameQuery(a: GroupPeopleQuery | null, b: GroupPeopleQuery): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Люди группы во вкладке «Сад» (дети или родители) и «Дети без группы» — одна страница за раз из GET /user/people.
 */
const groupPeopleSlice = createSlice({
  name: 'groupPeople',
  initialState,
  reducers: {
    /**
     * Первая страница: открытие экрана, смена вкладки или поиска, потянули вниз.
     * Новый запрос — список сбрасывается, обновление того же — остаётся на экране.
     */
    loadGroupPeople: (state, action: PayloadAction<{ query?: GroupPeopleQuery; refresh?: boolean }>) => {
      const { query, refresh } = action.payload;
      state.requestId += 1;
      state.loadMoreFailed = false;
      state.loadingMore = false;
      if (query && !sameQuery(state.query, query)) {
        if (state.query?.kind !== query.kind) {
          state.saving = {};
          state.failed = {};
        }
        state.query = query;
        state.items = [];
        state.total = 0;
        state.status = 'loading';
        state.refreshing = false;
      } else if (refresh) {
        state.refreshing = true;
      } else if (state.status !== 'loaded') {
        state.status = 'loading';
      }
    },
    loadMoreGroupPeople: (state) => {
      // Дальше грузить нечего; saga проверяет то же условие и запрос не отправляет
      if (state.last || state.status !== 'loaded' || state.loadingMore) {
        return;
      }
      state.loadingMore = true;
      state.loadMoreFailed = false;
    },
    loadGroupPeopleSuccess: (state, action: PayloadAction<{ requestId: number; result: PeoplePage }>) => {
      const { requestId, result } = action.payload;
      // Ответ на устаревший запрос: пока он шёл, сменили группу, вкладку или поиск
      if (requestId !== state.requestId) {
        return;
      }
      if (result.page === 0) {
        state.items = result.items;
        state.status = 'loaded';
        state.refreshing = false;
      } else if (result.page === state.page + 1) {
        // Страницы по смещению: распределённые дети уходят из выборки, строки могут повториться
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
    loadGroupPeopleFailure: (state, action: PayloadAction<{ requestId: number; page: number }>) => {
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

    /** «Дети без группы»: добавить ребёнка в выбранную группу. После успеха строка уходит из списка. */
    assignChild: (state, action: PayloadAction<{ child: Person; group: PersonGroup }>) => {
      state.saving[action.payload.child.id] = true;
      delete state.failed[action.payload.child.id];
    },
    assignChildSuccess: (state, action: PayloadAction<{ childId: string }>) => {
      const { childId } = action.payload;
      delete state.saving[childId];
      const before = state.items.length;
      state.items = state.items.filter((person) => person.id !== childId);
      if (state.items.length < before && state.total > 0) {
        state.total -= 1;
      }
    },
    assignChildFailure: (state, action: PayloadAction<{ childId: string; message: string }>) => {
      delete state.saving[action.payload.childId];
      state.failed[action.payload.childId] = action.payload.message;
    },
  },
  extraReducers: (builder) => {
    // Телефоны родителей не должны пережить выход из аккаунта
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  loadGroupPeople,
  loadMoreGroupPeople,
  loadGroupPeopleSuccess,
  loadGroupPeopleFailure,
  assignChild,
  assignChildSuccess,
  assignChildFailure,
} = groupPeopleSlice.actions;
export default groupPeopleSlice.reducer;
