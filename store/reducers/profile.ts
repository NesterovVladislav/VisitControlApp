import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PasswordField, PasswordFieldErrors, ProfileState } from '../types/profile';
import { ProfileEditErrors, ProfileEditField, ProfileUpdate } from '../../utils/profile-edit';

const initialState: ProfileState = {
  refreshing: false,
  saveStatus: 'idle',
  saveFieldErrors: {},
  saveError: null,
  passwordStatus: 'idle',
  passwordFieldErrors: {},
  passwordError: null,
};

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordFailurePayload {
  fieldErrors?: PasswordFieldErrors;
  formError?: string | null;
}

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    /** Перечитать GET /user. pull — показать индикатор RefreshControl. */
    refreshProfile: (state, action: PayloadAction<{ pull?: boolean } | undefined>) => {
      if (action.payload?.pull) {
        state.refreshing = true;
      }
    },
    refreshProfileDone: (state) => {
      state.refreshing = false;
    },
    // Пароли в state не сохраняются, action скрыт в store/devtools.ts
    changePasswordStart: (state, _action: PayloadAction<ChangePasswordPayload>) => {
      state.passwordStatus = 'submitting';
      state.passwordFieldErrors = {};
      state.passwordError = null;
    },
    changePasswordSuccess: (state) => {
      state.passwordStatus = 'changed';
    },
    changePasswordFailure: (state, action: PayloadAction<ChangePasswordFailurePayload>) => {
      state.passwordStatus = 'idle';
      state.passwordFieldErrors = action.payload.fieldErrors ?? {};
      state.passwordError = action.payload.formError ?? null;
    },
    /** Пользователь изменил поле — серверная ошибка под ним больше не актуальна. */
    clearPasswordFieldError: (state, action: PayloadAction<PasswordField>) => {
      delete state.passwordFieldErrors[action.payload];
    },
    saveProfileStart: (state, _action: PayloadAction<ProfileUpdate>) => {
      state.saveStatus = 'saving';
      state.saveFieldErrors = {};
      state.saveError = null;
    },
    saveProfileSuccess: (state) => {
      state.saveStatus = 'saved';
    },
    saveProfileFailure: (state, action: PayloadAction<{ fieldErrors?: ProfileEditErrors; formError?: string | null }>) => {
      state.saveStatus = 'idle';
      state.saveFieldErrors = action.payload.fieldErrors ?? {};
      state.saveError = action.payload.formError ?? null;
    },
    clearSaveFieldError: (state, action: PayloadAction<ProfileEditField>) => {
      delete state.saveFieldErrors[action.payload];
    },
    resetProfileSave: (state) => {
      state.saveStatus = 'idle';
      state.saveFieldErrors = {};
      state.saveError = null;
    },
    resetPasswordChange: (state) => {
      state.passwordStatus = 'idle';
      state.passwordFieldErrors = {};
      state.passwordError = null;
    },
  },
});

export const {
  refreshProfile,
  refreshProfileDone,
  changePasswordStart,
  changePasswordSuccess,
  changePasswordFailure,
  clearPasswordFieldError,
  resetPasswordChange,
  saveProfileStart,
  saveProfileSuccess,
  saveProfileFailure,
  clearSaveFieldError,
  resetProfileSave,
} = profileSlice.actions;
export default profileSlice.reducer;
