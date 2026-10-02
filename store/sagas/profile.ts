import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { PASSWORD_MESSAGES } from '../../utils/password-validation';
import { RootState } from '../reducers';
import { userRefreshed } from '../reducers/auth';
import {
  ChangePasswordFailurePayload,
  ChangePasswordPayload,
  changePasswordFailure,
  changePasswordStart,
  changePasswordSuccess,
  refreshProfile,
  refreshProfileDone,
  saveProfileFailure,
  saveProfileStart,
  saveProfileSuccess,
} from '../reducers/profile';
import { ProfileEditErrors, ProfileUpdate, serverFieldToProfileField } from '../../utils/profile-edit';
import { User } from '../types/auth';

export const PASSWORD_ERRORS = {
  wrongCurrent: 'Неверный текущий пароль',
  noResponse:
    'Сервер не ответил, и пароль мог уже смениться. Если при повторе текущий пароль не подойдёт, введите в это поле новый',
  generic: 'Не удалось сменить пароль. Попробуйте позже',
} as const;

export const SAVE_ERRORS = {
  phoneTaken: 'Этот номер уже привязан к другому аккаунту',
  serverRejected: 'Сервер не принял значение, проверьте поле',
  forbidden: 'Менять личные данные сам может только администратор',
  network: 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не удалось сохранить. Попробуйте ещё раз',
} as const;

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

/**
 * Переводит ошибку смены пароля в ошибки формы. В лог — только код ответа.
 */
export function toChangePasswordFailure(error: unknown): ChangePasswordFailurePayload {
  if (!(error instanceof ApiError)) {
    return { formError: PASSWORD_ERRORS.generic };
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return { formError: PASSWORD_ERRORS.noResponse };
  }
  if (error.status === 400) {
    if (error.data?.code === 'VALIDATION') {
      const fields = Object.keys(error.getValidationErrors() ?? {});
      return fields.includes('new_password')
        ? { fieldErrors: { newPassword: PASSWORD_MESSAGES.length } }
        : { formError: PASSWORD_ERRORS.generic };
    }
    // Неверный текущий пароль бэкенд отдаёт как 400 без тела
    return { fieldErrors: { currentPassword: PASSWORD_ERRORS.wrongCurrent } };
  }
  return { formError: PASSWORD_ERRORS.generic };
}

/**
 * Переводит ошибку сохранения своих данных в ошибки формы.
 */
export function toSaveProfileFailure(error: unknown): { fieldErrors?: ProfileEditErrors; formError?: string } {
  if (!(error instanceof ApiError)) {
    return { formError: SAVE_ERRORS.generic };
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return { formError: SAVE_ERRORS.network };
  }
  if (error.status === 409 && error.data?.code === 'PHONE_TAKEN') {
    return { fieldErrors: { phone: SAVE_ERRORS.phoneTaken } };
  }
  if (error.status === 403) {
    return { formError: SAVE_ERRORS.forbidden };
  }
  if (error.status === 400 && error.data?.code === 'VALIDATION') {
    const fieldErrors: ProfileEditErrors = {};
    for (const serverField of Object.keys(error.getValidationErrors() ?? {})) {
      const field = serverFieldToProfileField(serverField);
      if (field) {
        fieldErrors[field] = SAVE_ERRORS.serverRejected;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors };
    }
  }
  return { formError: SAVE_ERRORS.generic };
}

export function* saveProfileSaga(action: PayloadAction<ProfileUpdate>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const user: User = yield call([visitControlApi, visitControlApi.updateMe], action.payload);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(userRefreshed(user));
    yield put(saveProfileSuccess());
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Profile Saga] Profile save failed', error instanceof ApiError ? error.status : 'unknown');
    yield put(saveProfileFailure(toSaveProfileFailure(error)));
  }
}

export function* refreshProfileSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const user: User = yield call([visitControlApi, visitControlApi.getMe]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(userRefreshed(user));
  } catch (error) {
    // Фоновое обновление: на экране остаются данные с момента входа, 401 обработан интерсептором
    console.warn('[Profile Saga] Failed to refresh profile', error instanceof ApiError ? error.status : 'unknown');
  } finally {
    yield put(refreshProfileDone());
  }
}

export function* changePasswordSaga(action: PayloadAction<ChangePasswordPayload>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call(
      [visitControlApi, visitControlApi.changePassword],
      action.payload.currentPassword,
      action.payload.newPassword
    );
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(changePasswordSuccess());
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Profile Saga] Password change failed', error instanceof ApiError ? error.status : 'unknown');
    yield put(changePasswordFailure(toChangePasswordFailure(error)));
  }
}

export function* watchProfile() {
  yield takeLatest(refreshProfile.type, refreshProfileSaga);
  // takeLeading: второй запрос со старым паролем после успешного первого вернул бы «неверный пароль»
  yield takeLeading(changePasswordStart.type, changePasswordSaga);
  // takeLeading: двойной тап по «Сохранить» не отправляет второй запрос
  yield takeLeading(saveProfileStart.type, saveProfileSaga);
}
