import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Presence, VisitPage, VisitsState } from '../types/visits';
import { logout } from './auth';

const initialState: VisitsState = {
  present: {
    data: { total: 0, groups: null, withoutGroup: [] },
    status: 'idle',
    refreshing: false,
  },
  journal: {
    items: [],
    status: 'idle',
    refreshing: false,
    page: 0,
    last: false,
    loadingMore: false,
    loadMoreFailed: false,
  },
};

type RefreshPayload = { refresh?: boolean } | undefined;

/**
 * Вкладка «Посещение» администратора: кто сейчас в саду и журнал отметок.
 */
const visitsSlice = createSlice({
  name: 'visits',
  initialState,
  reducers: {
    loadPresentStart: (state, action: PayloadAction<RefreshPayload>) => {
      if (action.payload?.refresh) {
        state.present.refreshing = true;
      } else if (state.present.status !== 'loaded') {
        state.present.status = 'loading';
      }
    },
    loadPresentSuccess: (state, action: PayloadAction<Presence>) => {
      state.present.data = action.payload;
      state.present.status = 'loaded';
      state.present.refreshing = false;
    },
    loadPresentFailure: (state) => {
      state.present.refreshing = false;
      // Уже показанный список оставляем на экране
      if (state.present.status !== 'loaded') {
        state.present.status = 'failed';
      }
    },

    /** Первая страница журнала: открытие, возврат на вкладку, потянули вниз */
    loadJournalStart: (state, action: PayloadAction<RefreshPayload>) => {
      if (action.payload?.refresh) {
        state.journal.refreshing = true;
      } else if (state.journal.status !== 'loaded') {
        state.journal.status = 'loading';
      }
    },
    loadJournalMore: (state) => {
      // Дальше грузить нечего; saga проверяет то же условие и запрос не отправляет
      if (state.journal.last || state.journal.status !== 'loaded') {
        return;
      }
      state.journal.loadingMore = true;
      state.journal.loadMoreFailed = false;
    },
    loadJournalSuccess: (state, action: PayloadAction<VisitPage>) => {
      const { items, page, last } = action.payload;
      const journal = state.journal;
      if (page === 0) {
        journal.items = items;
        journal.status = 'loaded';
        journal.refreshing = false;
      } else if (page === journal.page + 1) {
        // Пагинация по смещению: если между запросами появились новые отметки, часть строк придёт повторно
        const known = new Set(journal.items.map((item) => item.key));
        journal.items.push(...items.filter((item) => !known.has(item.key)));
        journal.loadingMore = false;
      } else {
        // Ответ на устаревший запрос: пока он шёл, журнал обновили с первой страницы
        journal.loadingMore = false;
        return;
      }
      journal.page = page;
      journal.last = last;
    },
    loadJournalFailure: (state, action: PayloadAction<{ page: number }>) => {
      const journal = state.journal;
      if (action.payload.page === 0) {
        journal.refreshing = false;
        if (journal.status !== 'loaded') {
          journal.status = 'failed';
        }
      } else {
        journal.loadingMore = false;
        journal.loadMoreFailed = true;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState);
  },
});

export const {
  loadPresentStart,
  loadPresentSuccess,
  loadPresentFailure,
  loadJournalStart,
  loadJournalMore,
  loadJournalSuccess,
  loadJournalFailure,
} = visitsSlice.actions;
export default visitsSlice.reducer;
