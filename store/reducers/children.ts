import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Child,
  ChildrenState,
  ChildStatus,
  MarkVisitRequest,
  VisitStatus,
} from '../types/children';
import { logoutCompleted } from './auth';

const initialState: ChildrenState = {
  items: [],
  listStatus: 'idle',
  refreshing: false,
  statusById: {},
  markingIds: [],
  markError: null,
};

const EMPTY_STATUS: ChildStatus = { value: null, loading: false, error: false, notice: null };

function statusOf(state: ChildrenState, childId: string): ChildStatus {
  if (!state.statusById[childId]) {
    state.statusById[childId] = { ...EMPTY_STATUS };
  }
  return state.statusById[childId];
}

const childrenSlice = createSlice({
  name: 'children',
  initialState,
  reducers: {
    /** Загрузка списка; refresh — потянули вниз, список на экране не прячем */
    loadChildrenStart: (state, action: PayloadAction<{ refresh?: boolean } | undefined>) => {
      if (action.payload?.refresh) {
        state.refreshing = true;
      } else if (state.listStatus !== 'loaded') {
        state.listStatus = 'loading';
      }
    },
    loadChildrenSuccess: (state, action: PayloadAction<Child[]>) => {
      state.items = action.payload;
      state.listStatus = 'loaded';
      state.refreshing = false;
      const ids = new Set(action.payload.map((child) => child.id));
      for (const id of Object.keys(state.statusById)) {
        if (!ids.has(id)) {
          delete state.statusById[id];
        }
      }
    },
    loadChildrenFailure: (state) => {
      state.refreshing = false;
      // Если список уже был, оставляем его на экране
      if (state.listStatus !== 'loaded') {
        state.listStatus = 'failed';
      }
    },
    /** Перечитать статусы всех детей: экран снова в фокусе или приложение вернулось из фона */
    refreshStatuses: () => {},
    loadStatusStart: (state, action: PayloadAction<string>) => {
      const status = statusOf(state, action.payload);
      status.loading = true;
    },
    loadStatusSuccess: (state, action: PayloadAction<{ childId: string; status: VisitStatus }>) => {
      const status = statusOf(state, action.payload.childId);
      // Подсказка «статус изменился» живёт до следующего обновления статуса
      status.notice = null;
      status.value = action.payload.status;
      status.loading = false;
      status.error = false;
    },
    loadStatusFailure: (state, action: PayloadAction<string>) => {
      const status = statusOf(state, action.payload);
      status.loading = false;
      status.error = true;
    },
    markVisitStart: (state, action: PayloadAction<MarkVisitRequest>) => {
      const { childId } = action.payload;
      if (!state.markingIds.includes(childId)) {
        state.markingIds.push(childId);
      }
      statusOf(state, childId).notice = null;
    },
    markVisitSuccess: (state, action: PayloadAction<string>) => {
      state.markingIds = state.markingIds.filter((id) => id !== action.payload);
    },
    /** Статус сменился, пока пользователь смотрел на экран: отметку не отправили */
    markVisitStale: (state, action: PayloadAction<{ childId: string; notice: string }>) => {
      state.markingIds = state.markingIds.filter((id) => id !== action.payload.childId);
      statusOf(state, action.payload.childId).notice = action.payload.notice;
    },
    /** message: null — ошибку не показываем (например, 401: уже идёт выход) */
    markVisitFailure: (state, action: PayloadAction<{ childId: string; message: string | null }>) => {
      const { childId, message } = action.payload;
      state.markingIds = state.markingIds.filter((id) => id !== childId);
      state.markError = message ? { childId, message } : null;
    },
    clearMarkError: (state) => {
      state.markError = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  loadChildrenStart,
  loadChildrenSuccess,
  loadChildrenFailure,
  refreshStatuses,
  loadStatusStart,
  loadStatusSuccess,
  loadStatusFailure,
  markVisitStart,
  markVisitSuccess,
  markVisitStale,
  markVisitFailure,
  clearMarkError,
} = childrenSlice.actions;
export default childrenSlice.reducer;
