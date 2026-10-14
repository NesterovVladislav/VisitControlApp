import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeLatest } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { serverFieldToFormField } from '../../utils/registration-validation';
import { RootState } from '../reducers';
import {
  loadOrganizationsFailure,
  loadOrganizationsStart,
  loadOrganizationsSuccess,
  loadPolicyFailure,
  loadPolicyStart,
  loadPolicySuccess,
  registerFailure,
  RegisterFailurePayload,
  registerStart,
  registerSuccess,
  selectOrganization,
} from '../reducers/registration';
import {
  PrivacyPolicy,
  PublicOrganization,
  RegistrationFieldErrors,
  RegistrationRequest,
} from '../types/registration';

export const REGISTRATION_ERRORS = {
  emailTaken: 'Этот email уже зарегистрирован',
  phoneTaken: 'Этот номер уже зарегистрирован',
  policyOutdated: 'Политика обработки данных обновилась. Ознакомьтесь с ней и подтвердите согласие ещё раз',
  serverRejected: 'Сервер не принял значение, проверьте поле',
  tooManyRequests: 'Слишком много заявок с этого устройства. Попробуйте через час',
  unavailable: 'Регистрация временно недоступна. Попробуйте позже',
  children: 'Сервер не принял данные детей. Проверьте ФИО и даты рождения',
  organizationNotFound: 'Этот сад больше не принимает заявки. Выберите сад заново',
  network: 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не удалось зарегистрироваться. Попробуйте позже',
} as const;

export function* loadOrganizationsSaga() {
  try {
    const organizations: PublicOrganization[] = yield call([
      visitControlApi,
      visitControlApi.getPublicOrganizations,
    ]);
    yield put(loadOrganizationsSuccess(organizations));
    // Сад один — выбирать не из чего, сразу показываем форму
    if (organizations.length === 1 && organizations[0].registrationAvailable) {
      yield put(selectOrganization(organizations[0]));
    }
  } catch (error) {
    console.warn('[Registration Saga] Failed to load organizations', error instanceof ApiError ? error.status : error);
    yield put(loadOrganizationsFailure());
  }
}

export function* loadPolicySaga() {
  const organization: PublicOrganization | null = yield select(
    (state: RootState) => state.registration.organization
  );
  if (!organization) {
    return;
  }
  try {
    const policy: PrivacyPolicy = yield call(
      [visitControlApi, visitControlApi.getPrivacyPolicy],
      organization.id
    );
    yield put(loadPolicySuccess(policy));
  } catch (error) {
    console.warn('[Registration Saga] Failed to load privacy policy', error instanceof ApiError ? error.status : error);
    yield put(loadPolicyFailure());
  }
}

/**
 * Переводит ошибку API в ошибки формы. Персональные данные в лог не пишем — только код ответа.
 */
export function toRegisterFailure(error: unknown): RegisterFailurePayload {
  if (!(error instanceof ApiError)) {
    return { formError: REGISTRATION_ERRORS.generic };
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return { formError: REGISTRATION_ERRORS.network };
  }
  const code = error.data?.code;
  if (error.status === 409 && code === 'EMAIL_TAKEN') {
    return { fieldErrors: { email: REGISTRATION_ERRORS.emailTaken } };
  }
  if (error.status === 409 && code === 'PHONE_TAKEN') {
    return { fieldErrors: { phone: REGISTRATION_ERRORS.phoneTaken } };
  }
  if (error.status === 409 && code === 'POLICY_OUTDATED') {
    return { fieldErrors: { consent: REGISTRATION_ERRORS.policyOutdated }, resetConsent: true };
  }
  if (error.status === 400 && code === 'VALIDATION') {
    const fieldErrors: RegistrationFieldErrors = {};
    for (const serverField of Object.keys(error.getValidationErrors() ?? {})) {
      const field = serverFieldToFormField(serverField);
      if (field) {
        fieldErrors[field] = REGISTRATION_ERRORS.serverRejected;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors };
    }
    if (Object.keys(error.getValidationErrors() ?? {}).some((field) => field.startsWith('children'))) {
      return { formError: REGISTRATION_ERRORS.children };
    }
  }
  if (error.status === 404) {
    return { formError: REGISTRATION_ERRORS.organizationNotFound, resetOrganization: true };
  }
  if (error.status === 429) {
    return { formError: REGISTRATION_ERRORS.tooManyRequests };
  }
  if (error.status === 503) {
    return { formError: REGISTRATION_ERRORS.unavailable };
  }
  return { formError: REGISTRATION_ERRORS.generic };
}

export function* registerSaga(action: PayloadAction<RegistrationRequest>) {
  try {
    yield call([visitControlApi, visitControlApi.register], action.payload);
    yield put(registerSuccess(action.payload.email));
  } catch (error) {
    const failure = toRegisterFailure(error);
    console.warn('[Registration Saga] Registration failed', error instanceof ApiError ? error.status : 'unknown',
      error instanceof ApiError ? error.data?.code : '');
    // Сначала к списку садов: смена сада сбрасывает ошибку формы, а её нужно показать
    if (failure.resetOrganization) {
      yield put(selectOrganization(null));
      yield put(loadOrganizationsStart());
    }
    yield put(registerFailure(failure));
    if (failure.resetConsent) {
      yield put(loadPolicyStart());
    }
  }
}

export function* watchRegistration() {
  yield takeLatest(loadOrganizationsStart.type, loadOrganizationsSaga);
  // Сад сменили, пока грузилась политика прежнего, — запрос по прежнему отменяется
  yield takeLatest([loadPolicyStart.type, selectOrganization.type], loadPolicySaga);
  yield takeLatest(registerStart.type, registerSaga);
}
