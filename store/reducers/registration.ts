import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  PrivacyPolicy,
  PublicOrganization,
  RegistrationField,
  RegistrationFieldErrors,
  RegistrationRequest,
  RegistrationState,
} from '../types/registration';

const initialState: RegistrationState = {
  organizations: [],
  organizationsStatus: 'idle',
  organization: null,
  policy: null,
  policyStatus: 'idle',
  status: 'idle',
  fieldErrors: {},
  formError: null,
  consentResetCount: 0,
  sentToEmail: null,
};

export interface RegisterFailurePayload {
  fieldErrors?: RegistrationFieldErrors;
  formError?: string | null;
  resetConsent?: boolean;
  /** Сад не найден (удалён): вернуться к выбору сада. */
  resetOrganization?: boolean;
}

const registrationSlice = createSlice({
  name: 'registration',
  initialState,
  reducers: {
    loadOrganizationsStart: (state) => {
      state.organizationsStatus = 'loading';
    },
    loadOrganizationsSuccess: (state, action: PayloadAction<PublicOrganization[]>) => {
      state.organizations = action.payload;
      state.organizationsStatus = 'loaded';
    },
    loadOrganizationsFailure: (state) => {
      state.organizationsStatus = 'failed';
    },
    /**
     * Выбор сада. У другого сада другая политика ПДн: её загружаем заново, а согласие нужно дать ещё раз.
     * null — вернуться к списку садов.
     */
    selectOrganization: (state, action: PayloadAction<PublicOrganization | null>) => {
      if (state.organization?.id === action.payload?.id) {
        return;
      }
      state.organization = action.payload;
      state.policy = null;
      state.policyStatus = action.payload ? 'loading' : 'idle';
      state.formError = null;
      delete state.fieldErrors.consent;
      state.consentResetCount += 1;
    },
    loadPolicyStart: (state) => {
      state.policyStatus = 'loading';
    },
    loadPolicySuccess: (state, action: PayloadAction<PrivacyPolicy>) => {
      state.policy = action.payload;
      state.policyStatus = 'loaded';
    },
    loadPolicyFailure: (state) => {
      state.policy = null;
      state.policyStatus = 'failed';
    },
    registerStart: (state, _action: PayloadAction<RegistrationRequest>) => {
      state.status = 'submitting';
      state.fieldErrors = {};
      state.formError = null;
    },
    registerSuccess: (state, action: PayloadAction<string>) => {
      state.status = 'sent';
      state.sentToEmail = action.payload;
    },
    registerFailure: (state, action: PayloadAction<RegisterFailurePayload>) => {
      state.status = 'idle';
      state.fieldErrors = action.payload.fieldErrors ?? {};
      state.formError = action.payload.formError ?? null;
      if (action.payload.resetConsent) {
        state.consentResetCount += 1;
      }
    },
    /** Пользователь изменил поле — серверная ошибка под ним больше не актуальна. */
    clearFieldError: (state, action: PayloadAction<RegistrationField>) => {
      delete state.fieldErrors[action.payload];
    },
    clearFormError: (state) => {
      state.formError = null;
    },
    resetRegistration: () => initialState,
  },
});

export const {
  loadOrganizationsStart,
  loadOrganizationsSuccess,
  loadOrganizationsFailure,
  selectOrganization,
  loadPolicyStart,
  loadPolicySuccess,
  loadPolicyFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  clearFieldError,
  clearFormError,
  resetRegistration,
} = registrationSlice.actions;
export default registrationSlice.reducer;
