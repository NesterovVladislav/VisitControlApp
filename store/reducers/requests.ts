import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  ApproveRequestPayload,
  AssignableRole,
  RegistrationRequestsPage,
  RegistrationRequestView,
  RequestOutcome,
  RequestsState,
} from '../types/requests';
import { logoutCompleted } from './auth';

const initialState: RequestsState = {
  items: [],
  total: 0,
  status: 'idle',
  refreshing: false,
  processing: null,
  outcomes: {},
  actionError: null,
  roles: [],
  rolesStatus: 'idle',
};

/** Заявка обработана: убираем из списка и запоминаем результат для экрана заявки */
function finish(state: RequestsState, outcome: RequestOutcome) {
  const id = outcome.request.id;
  if (state.items.some((item) => item.id === id)) {
    state.items = state.items.filter((item) => item.id !== id);
    state.total = Math.max(state.total - 1, 0);
  }
  state.outcomes[id] = outcome;
  state.processing = null;
}

/**
 * Вкладка «Заявки» администратора.
 */
const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {
    loadRequestsStart: (state, action: PayloadAction<{ refresh?: boolean } | undefined>) => {
      if (action.payload?.refresh) {
        state.refreshing = true;
      } else if (state.status !== 'loaded') {
        state.status = 'loading';
      }
    },
    loadRequestsSuccess: (state, action: PayloadAction<RegistrationRequestsPage>) => {
      state.items = action.payload.items;
      state.total = action.payload.total;
      state.status = 'loaded';
      state.refreshing = false;
    },
    loadRequestsFailure: (state) => {
      state.refreshing = false;
      if (state.status !== 'loaded') {
        state.status = 'failed';
      }
    },

    approveRequest: (state, action: PayloadAction<ApproveRequestPayload>) => {
      state.processing = { id: action.payload.request.id, kind: 'approve' };
      state.actionError = null;
    },
    loadRolesStart: (state) => {
      if (state.rolesStatus !== 'loaded') {
        state.rolesStatus = 'loading';
      }
    },
    loadRolesSuccess: (state, action: PayloadAction<AssignableRole[]>) => {
      state.roles = action.payload;
      state.rolesStatus = 'loaded';
    },
    loadRolesFailure: (state) => {
      if (state.rolesStatus !== 'loaded') {
        state.rolesStatus = 'failed';
      }
    },
    rejectRequest: (
      state,
      action: PayloadAction<{ request: RegistrationRequestView; reason: string | null }>
    ) => {
      state.processing = { id: action.payload.request.id, kind: 'reject' };
      state.actionError = null;
    },
    resendPassword: (state, action: PayloadAction<string>) => {
      state.processing = { id: action.payload, kind: 'resendPassword' };
      state.actionError = null;
    },
    approveSuccess: (
      state,
      action: PayloadAction<{ request: RegistrationRequestView; passwordSent: boolean; childrenAdded: number }>
    ) => {
      finish(state, { ...action.payload, result: 'approved' });
    },
    rejectSuccess: (state, action: PayloadAction<RegistrationRequestView>) => {
      finish(state, { request: action.payload, result: 'rejected' });
    },
    /** Заявку уже подтвердил или отклонил другой администратор */
    requestAlreadyProcessed: (state, action: PayloadAction<RegistrationRequestView>) => {
      finish(state, { request: action.payload, result: 'alreadyProcessed' });
    },
    resendPasswordSuccess: (state, action: PayloadAction<{ id: string; passwordSent: boolean }>) => {
      const outcome = state.outcomes[action.payload.id];
      if (outcome) {
        outcome.passwordSent = action.payload.passwordSent;
      }
      state.processing = null;
    },
    /** message: null — ошибку не показываем (401: уже идёт выход) */
    requestActionFailure: (state, action: PayloadAction<string | null>) => {
      state.processing = null;
      state.actionError = action.payload;
    },
    clearActionError: (state) => {
      state.actionError = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  loadRequestsStart,
  loadRequestsSuccess,
  loadRequestsFailure,
  approveRequest,
  loadRolesStart,
  loadRolesSuccess,
  loadRolesFailure,
  rejectRequest,
  resendPassword,
  approveSuccess,
  rejectSuccess,
  requestAlreadyProcessed,
  resendPasswordSuccess,
  requestActionFailure,
  clearActionError,
} = requestsSlice.actions;
export default requestsSlice.reducer;
