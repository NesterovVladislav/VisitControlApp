import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CandidateFilter, GroupMembershipState } from '../types/group-membership';
import { PeoplePage, Person, PersonGroup } from '../types/people';
import { logoutCompleted } from './auth';

const initialState: GroupMembershipState = {
  group: null,
  filter: 'withoutGroup',
  q: '',
  items: [],
  status: 'idle',
  page: 0,
  last: false,
  loadingMore: false,
  loadMoreFailed: false,
  requestId: 0,
  saving: {},
  failed: {},
};

/**
 * Состав группы: администратор добавляет и убирает детей (docs/admin-screens.md, «Состав группы»).
 */
const groupMembershipSlice = createSlice({
  name: 'groupMembership',
  initialState,
  reducers: {
    /** Первая страница: открытие экрана, смена фильтра или поиска. Список сбрасывается. */
    loadCandidates: (state, action: PayloadAction<{ group: PersonGroup; filter: CandidateFilter; q: string }>) => {
      const { group, filter, q } = action.payload;
      if (state.group?.id !== group.id) {
        state.saving = {};
        state.failed = {};
      }
      state.group = group;
      state.filter = filter;
      state.q = q;
      state.items = [];
      state.status = 'loading';
      state.page = 0;
      state.last = false;
      state.loadingMore = false;
      state.loadMoreFailed = false;
      state.requestId += 1;
    },
    loadMoreCandidates: (state) => {
      // Дальше грузить нечего; saga проверяет то же условие и запрос не отправляет
      if (state.last || state.status !== 'loaded' || state.loadingMore) {
        return;
      }
      state.loadingMore = true;
      state.loadMoreFailed = false;
    },
    loadCandidatesSuccess: (state, action: PayloadAction<{ requestId: number; result: PeoplePage }>) => {
      const { requestId, result } = action.payload;
      // Ответ на устаревший запрос: пока он шёл, сменили поиск или фильтр
      if (requestId !== state.requestId) {
        return;
      }
      if (result.page === 0) {
        state.items = result.items;
        state.status = 'loaded';
      } else if (result.page === state.page + 1) {
        // Страницы по смещению: добавленные в группу дети уходят из «Без группы», строки могут повториться
        const known = new Set(state.items.map((person) => person.id));
        state.items.push(...result.items.filter((person) => !known.has(person.id)));
        state.loadingMore = false;
      } else {
        state.loadingMore = false;
        return;
      }
      state.page = result.page;
      state.last = result.last;
    },
    loadCandidatesFailure: (state, action: PayloadAction<{ requestId: number; page: number }>) => {
      if (action.payload.requestId !== state.requestId) {
        return;
      }
      if (action.payload.page === 0) {
        state.status = 'failed';
      } else {
        state.loadingMore = false;
        state.loadMoreFailed = true;
      }
    },

    /** Добавить ребёнка в текущую группу. Строка остаётся в списке и показывает «В группе». */
    putChildInGroup: (state, action: PayloadAction<Person>) => {
      state.saving[action.payload.id] = true;
      delete state.failed[action.payload.id];
    },
    putChildInGroupSuccess: (state, action: PayloadAction<{ childId: string; group: PersonGroup }>) => {
      const { childId, group } = action.payload;
      delete state.saving[childId];
      const child = state.items.find((person) => person.id === childId);
      if (child) {
        child.group = group;
      }
    },
    changeMembershipFailure: (state, action: PayloadAction<{ childId: string; message: string }>) => {
      delete state.saving[action.payload.childId];
      state.failed[action.payload.childId] = action.payload.message;
    },

    /**
     * Убрать ребёнка из текущей группы (после подтверждения на экране). Строка остаётся в списке
     * с «Без группы» — вернуть можно тем же «＋».
     */
    removeChildFromGroup: (state, action: PayloadAction<Person>) => {
      state.saving[action.payload.id] = true;
      delete state.failed[action.payload.id];
    },
    removeChildFromGroupSuccess: (state, action: PayloadAction<{ childId: string }>) => {
      const { childId } = action.payload;
      delete state.saving[childId];
      const child = state.items.find((person) => person.id === childId);
      if (child) {
        child.group = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  loadCandidates,
  loadMoreCandidates,
  loadCandidatesSuccess,
  loadCandidatesFailure,
  putChildInGroup,
  putChildInGroupSuccess,
  changeMembershipFailure,
  removeChildFromGroup,
  removeChildFromGroupSuccess,
} = groupMembershipSlice.actions;
export default groupMembershipSlice.reducer;
