import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { QueueFilter, VisitQueue, VisitQueueState } from '../types/visits';
import { logoutCompleted } from './auth';

const initialState: VisitQueueState = {
  enabled: null,
  items: [],
  otherCount: 0,
  status: 'idle',
  refreshing: false,
  filter: null,
  filterLoaded: false,
  showAll: false,
  decidingIds: [],
  error: null,
};

/**
 * Очередь отметок прихода и ухода, которые ждут решения сотрудника (docs/admin-screens.md, «Очередь»).
 */
const visitQueueSlice = createSlice({
  name: 'visitQueue',
  initialState,
  reducers: {
    /** Узнать, включено ли подтверждение в саду, прочитать выбор групп и загрузить очередь */
    openQueue: () => {},
    queueAvailability: (state, action: PayloadAction<boolean>) => {
      state.enabled = action.payload;
      if (!action.payload) {
        state.items = [];
        state.otherCount = 0;
      }
    },
    queueFilterLoaded: (state, action: PayloadAction<QueueFilter | null>) => {
      state.filter = action.payload;
      state.filterLoaded = true;
    },
    /** Сотрудник выбрал группы; null — показать всю очередь */
    setQueueFilter: (state, action: PayloadAction<QueueFilter | null>) => {
      state.filter = action.payload;
      state.filterLoaded = true;
      state.showAll = false;
    },
    /** «Ещё N ждут в других группах»: показать всю очередь, не меняя выбранные группы */
    setQueueShowAll: (state, action: PayloadAction<boolean>) => {
      state.showAll = action.payload;
    },
    /** refresh — потянули вниз; silent — фоновый опрос, индикаторы не показываем */
    loadQueueStart: (state, action: PayloadAction<{ refresh?: boolean; silent?: boolean } | undefined>) => {
      if (action.payload?.refresh) {
        state.refreshing = true;
      } else if (!action.payload?.silent && state.status !== 'loaded') {
        state.status = 'loading';
      }
    },
    loadQueueSuccess: (state, action: PayloadAction<VisitQueue>) => {
      state.items = action.payload.items;
      state.otherCount = action.payload.otherCount;
      state.status = 'loaded';
      state.refreshing = false;
    },
    loadQueueFailure: (state) => {
      state.refreshing = false;
      // Если очередь уже была, оставляем её на экране
      if (state.status !== 'loaded') {
        state.status = 'failed';
      }
    },
    /** «Принять» или «Отдать» */
    confirmMarkStart: (state, action: PayloadAction<string>) => {
      state.decidingIds.push(action.payload);
    },
    rejectMarkStart: (state, action: PayloadAction<{ id: string; comment: string }>) => {
      state.decidingIds.push(action.payload.id);
    },
    /** Решение принято: отметка уходит из очереди, не дожидаясь перезагрузки */
    decideMarkSuccess: (state, action: PayloadAction<string>) => {
      state.decidingIds = state.decidingIds.filter((id) => id !== action.payload);
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    /** message: null — ошибку не показываем (например, 401: уже идёт выход) */
    decideMarkFailure: (state, action: PayloadAction<{ id: string; message: string | null }>) => {
      state.decidingIds = state.decidingIds.filter((id) => id !== action.payload.id);
      state.error = action.payload.message;
    },
    clearQueueError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  openQueue,
  queueAvailability,
  queueFilterLoaded,
  setQueueFilter,
  setQueueShowAll,
  loadQueueStart,
  loadQueueSuccess,
  loadQueueFailure,
  confirmMarkStart,
  rejectMarkStart,
  decideMarkSuccess,
  decideMarkFailure,
  clearQueueError,
} = visitQueueSlice.actions;
export default visitQueueSlice.reducer;
