import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  AppMode,
  AuthState,
  LoginCredentials,
  LogoutReason,
  User,
  isStaffRole,
} from '../types/auth';

export const MAX_PIN_ATTEMPTS = 5;

export const initialAuthState: AuthState = {
  phase: 'bootstrapping',
  setupStep: null,
  isLoading: true,
  error: null,
  notice: null,
  user: null,
  biometricsAvailable: false,
  biometricsEnabled: false,
  remainingPinAttempts: MAX_PIN_ATTEMPTS,
  sessionEpoch: 0,
  mode: 'parent',
  selectedModeOwnerId: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    bootstrapSession: (state) => {
      state.phase = 'bootstrapping';
      state.setupStep = null;
      state.isLoading = true;
      state.error = null;
      state.user = null;
    },
    bootstrapUnauthenticated: (
      state,
      action: PayloadAction<{ notice?: string } | undefined>,
    ) => {
      state.phase = 'unauthenticated';
      state.setupStep = null;
      state.isLoading = false;
      state.error = null;
      state.notice = action.payload?.notice ?? null;
      state.user = null;
      state.biometricsAvailable = false;
      state.biometricsEnabled = false;
      state.remainingPinAttempts = MAX_PIN_ATTEMPTS;
    },
    bootstrapPinSetupRequired: (state) => {
      state.phase = 'pinSetupRequired';
      state.setupStep = 'createPin';
      state.isLoading = false;
      state.error = null;
      state.notice = null;
      state.user = null;
      state.biometricsAvailable = false;
      state.biometricsEnabled = false;
      state.remainingPinAttempts = MAX_PIN_ATTEMPTS;
      state.sessionEpoch += 1;
    },
    bootstrapLocked: (
      state,
      action: PayloadAction<{
        biometricsEnabled: boolean;
        remainingPinAttempts: number;
      }>,
    ) => {
      state.phase = 'locked';
      state.setupStep = null;
      state.isLoading = false;
      state.error = null;
      state.notice = null;
      state.user = null;
      state.biometricsAvailable = false;
      state.biometricsEnabled = action.payload.biometricsEnabled;
      state.remainingPinAttempts = action.payload.remainingPinAttempts;
      state.sessionEpoch += 1;
    },
    loginStart: (state, _action: PayloadAction<LoginCredentials>) => {
      state.isLoading = true;
      state.error = null;
      state.notice = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.phase = 'unauthenticated';
      state.setupStep = null;
      state.isLoading = false;
      state.error = action.payload;
      state.user = null;
      state.biometricsAvailable = false;
      state.biometricsEnabled = false;
      state.remainingPinAttempts = MAX_PIN_ATTEMPTS;
    },
    completePinSetup: (state, _action: PayloadAction<{ pin: string }>) => {
      state.isLoading = true;
      state.error = null;
    },
    pinSetupCompleted: (
      state,
      action: PayloadAction<{ biometricsAvailable: boolean }>,
    ) => {
      state.phase = 'pinSetupRequired';
      state.setupStep = 'offerBiometrics';
      state.isLoading = false;
      state.error = null;
      state.biometricsAvailable = action.payload.biometricsAvailable;
    },
    submitBiometricPreference: (
      state,
      _action: PayloadAction<{ enabled: boolean }>,
    ) => {
      state.isLoading = true;
      state.error = null;
    },
    unlockWithPin: (state, _action: PayloadAction<{ pin: string }>) => {
      state.isLoading = true;
      state.error = null;
    },
    unlockWithBiometrics: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    unlockFailed: (
      state,
      action: PayloadAction<{ error: string | null; remainingAttempts?: number }>,
    ) => {
      state.phase = 'locked';
      state.isLoading = false;
      state.error = action.payload.error;
      if (action.payload.remainingAttempts !== undefined) {
        state.remainingPinAttempts = action.payload.remainingAttempts;
      }
    },
    validationStarted: (state) => {
      state.phase = 'validating';
      state.isLoading = true;
      state.error = null;
      state.user = null;
      state.remainingPinAttempts = MAX_PIN_ATTEMPTS;
    },
    validationSucceeded: (state, action: PayloadAction<User>) => {
      state.phase = 'authenticated';
      state.isLoading = false;
      state.error = null;
      state.notice = null;
      state.user = action.payload;
      const staff = isStaffRole(action.payload.role);
      const keepSelection = staff && state.selectedModeOwnerId === action.payload.id;
      state.mode = staff
        ? (keepSelection ? state.mode : 'admin')
        : 'parent';
      if (!keepSelection) state.selectedModeOwnerId = null;
      state.remainingPinAttempts = MAX_PIN_ATTEMPTS;
    },
    /** Свежие данные из GET /user. Чужой ответ (другой аккаунт, сессия закрыта) не применяется. */
    userRefreshed: (state, action: PayloadAction<User>) => {
      if (state.phase === 'authenticated' && state.user?.id === action.payload.id) {
        state.user = action.payload;
      }
    },
    sessionValidationUnavailable: (state, action: PayloadAction<string>) => {
      state.phase = 'validationUnavailable';
      state.isLoading = false;
      state.error = action.payload;
      state.user = null;
    },
    retrySessionValidation: (state) => {
      state.phase = 'validating';
      state.isLoading = true;
      state.error = null;
      state.user = null;
    },
    storageUnavailable: (state, action: PayloadAction<string>) => {
      state.phase = 'storageUnavailable';
      state.setupStep = null;
      state.isLoading = false;
      state.error = action.payload;
      state.user = null;
    },
    retryProtectedStorage: (state) => {
      state.phase = 'bootstrapping';
      state.setupStep = null;
      state.isLoading = true;
      state.error = null;
      state.user = null;
    },
    lockSession: (state) => {
      if (
        state.phase !== 'authenticated' &&
        state.phase !== 'validating' &&
        state.phase !== 'validationUnavailable'
      ) return;
      state.phase = 'locked';
      state.isLoading = false;
      state.error = null;
      state.user = null;
      state.sessionEpoch += 1;
    },
    switchMode: (state, action: PayloadAction<AppMode>) => {
      // Переключаться может только персонал (администратор, сотрудник), родитель всегда в режиме родителя
      if (state.phase === 'authenticated' && state.user && isStaffRole(state.user.role)) {
        state.mode = action.payload;
        state.selectedModeOwnerId = state.user.id;
      }
    },
    logoutRequested: (
      state,
      _action: PayloadAction<{ reason: Exclude<LogoutReason, 'expired'> }>,
    ) => {
      state.isLoading = true;
      state.error = null;
    },
    sessionExpired: (state) => {
      if (state.phase === 'unauthenticated') return;
      state.isLoading = true;
      state.error = null;
    },
    logoutCompleted: (
      state,
      action: PayloadAction<{ reason: LogoutReason; notice?: string }>,
    ) => {
      const sessionEpoch = state.sessionEpoch + 1;
      Object.assign(state, initialAuthState, {
        phase: 'unauthenticated',
        isLoading: false,
        notice: action.payload.notice ?? null,
        sessionEpoch,
      });
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  bootstrapSession,
  bootstrapUnauthenticated,
  bootstrapPinSetupRequired,
  bootstrapLocked,
  loginStart,
  loginFailure,
  completePinSetup,
  pinSetupCompleted,
  submitBiometricPreference,
  unlockWithPin,
  unlockWithBiometrics,
  unlockFailed,
  validationStarted,
  validationSucceeded,
  userRefreshed,
  sessionValidationUnavailable,
  retrySessionValidation,
  storageUnavailable,
  retryProtectedStorage,
  lockSession,
  switchMode,
  logoutRequested,
  sessionExpired,
  logoutCompleted,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
