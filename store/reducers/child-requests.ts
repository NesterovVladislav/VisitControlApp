import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  ChildChange,
  ChildChangeBody,
  ChildChangeStatus,
  ChildRequest,
  ChildRequestBody,
  ChildRequestDecision,
  ChildRequestsState,
  ChildRequestStatus,
  OwnChild,
} from '../types/child-requests';
import { logoutCompleted } from './auth';

const initialState: ChildRequestsState = {
  own: [],
  submitting: false,
  submitResult: null,
  submitError: null,
  cancellingIds: [],
  ownChildren: null,
  changeSubmitting: false,
  changeResult: null,
  changeError: null,
  changes: [],
  decidingChangeIds: [],
  pending: [],
  pendingStatus: 'idle',
  decidingIds: [],
  error: null,
};

/**
 * «Добавить мне ребёнка» из профиля и такие заявки у администратора (docs/profile-screen.md, «Мои дети»).
 */
const childRequestsSlice = createSlice({
  name: 'childRequests',
  initialState,
  reducers: {
    loadOwnChildRequests: () => {},
    loadOwnChildRequestsSuccess: (state, action: PayloadAction<ChildRequest[]>) => {
      state.own = action.payload;
    },
    submitChildStart: (state, _action: PayloadAction<ChildRequestBody>) => {
      state.submitting = true;
      state.submitError = null;
      state.submitResult = null;
    },
    submitChildSuccess: (state, action: PayloadAction<ChildRequestStatus>) => {
      state.submitting = false;
      state.submitResult = action.payload;
    },
    /** message: null — ошибку не показываем (например, 401: уже идёт выход) */
    submitChildFailure: (state, action: PayloadAction<string | null>) => {
      state.submitting = false;
      state.submitError = action.payload;
    },
    resetChildSubmit: (state) => {
      state.submitting = false;
      state.submitError = null;
      state.submitResult = null;
    },
    cancelChildRequestStart: (state, action: PayloadAction<string>) => {
      state.cancellingIds.push(action.payload);
    },
    cancelChildRequestFinished: (state, action: PayloadAction<{ id: string; message: string | null }>) => {
      state.cancellingIds = state.cancellingIds.filter((id) => id !== action.payload.id);
      if (action.payload.message) {
        state.error = action.payload.message;
      } else {
        state.own = state.own.filter((request) => request.id !== action.payload.id);
      }
    },
    /** Заявки сада для администратора; silent — не показывать загрузку */
    loadPendingChildRequests: (state, action: PayloadAction<{ silent?: boolean } | undefined>) => {
      if (!action.payload?.silent && state.pendingStatus !== 'loaded') {
        state.pendingStatus = 'loading';
      }
    },
    loadPendingChildRequestsSuccess: (state, action: PayloadAction<ChildRequest[]>) => {
      state.pending = action.payload;
      state.pendingStatus = 'loaded';
    },
    loadPendingChildRequestsFailure: (state) => {
      // Если заявки уже были, оставляем их на экране
      if (state.pendingStatus !== 'loaded') {
        state.pendingStatus = 'failed';
      }
    },
    decideChildRequestStart: (state, action: PayloadAction<{ id: string; decision: ChildRequestDecision }>) => {
      state.decidingIds.push(action.payload.id);
    },
    decideChildRequestFinished: (state, action: PayloadAction<{ id: string; message: string | null }>) => {
      state.decidingIds = state.decidingIds.filter((id) => id !== action.payload.id);
      if (action.payload.message) {
        state.error = action.payload.message;
      } else {
        state.pending = state.pending.filter((request) => request.id !== action.payload.id);
      }
    },
    clearChildRequestError: (state) => {
      state.error = null;
    },
    /** Свои дети с данными и изменениями, которые ждут решения сада */
    loadOwnChildren: () => {},
    loadOwnChildrenSuccess: (state, action: PayloadAction<OwnChild[]>) => {
      state.ownChildren = action.payload;
    },
    changeChildStart: (state, _action: PayloadAction<{ childId: string; data: ChildChangeBody }>) => {
      state.changeSubmitting = true;
      state.changeError = null;
      state.changeResult = null;
    },
    changeChildSuccess: (state, action: PayloadAction<ChildChangeStatus>) => {
      state.changeSubmitting = false;
      state.changeResult = action.payload;
    },
    /** message: null — ошибку не показываем (например, 401: уже идёт выход) */
    changeChildFailure: (state, action: PayloadAction<string | null>) => {
      state.changeSubmitting = false;
      state.changeError = action.payload;
    },
    resetChildChange: (state) => {
      state.changeSubmitting = false;
      state.changeError = null;
      state.changeResult = null;
    },
    /** Родитель отзывает своё изменение, пока сад его не рассмотрел */
    cancelChildChangeStart: (state, action: PayloadAction<string>) => {
      state.decidingChangeIds.push(action.payload);
    },
    /** Изменения данных детей сада для администратора */
    loadChildChanges: () => {},
    loadChildChangesSuccess: (state, action: PayloadAction<ChildChange[]>) => {
      state.changes = action.payload;
    },
    approveChildChangeStart: (state, action: PayloadAction<string>) => {
      state.decidingChangeIds.push(action.payload);
    },
    rejectChildChangeStart: (state, action: PayloadAction<{ id: string; comment: string }>) => {
      state.decidingChangeIds.push(action.payload.id);
    },
    /** Решение или отзыв отправлены: изменение уходит из списков; с ошибкой — остаётся */
    childChangeFinished: (state, action: PayloadAction<{ id: string; message: string | null }>) => {
      state.decidingChangeIds = state.decidingChangeIds.filter((id) => id !== action.payload.id);
      if (action.payload.message) {
        state.error = action.payload.message;
      } else {
        state.changes = state.changes.filter((change) => change.id !== action.payload.id);
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  loadOwnChildRequests,
  loadOwnChildRequestsSuccess,
  submitChildStart,
  submitChildSuccess,
  submitChildFailure,
  resetChildSubmit,
  cancelChildRequestStart,
  cancelChildRequestFinished,
  loadPendingChildRequests,
  loadPendingChildRequestsSuccess,
  loadPendingChildRequestsFailure,
  decideChildRequestStart,
  decideChildRequestFinished,
  clearChildRequestError,
  loadOwnChildren,
  loadOwnChildrenSuccess,
  changeChildStart,
  changeChildSuccess,
  changeChildFailure,
  resetChildChange,
  cancelChildChangeStart,
  loadChildChanges,
  loadChildChangesSuccess,
  approveChildChangeStart,
  rejectChildChangeStart,
  childChangeFinished,
} = childRequestsSlice.actions;
export default childRequestsSlice.reducer;
