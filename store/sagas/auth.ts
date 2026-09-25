import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import { loginStart, loginSuccess, loginFailure, logout } from '../reducers/auth';
import { visitControlApi } from '../../services/api';
import { clearAuthToken, setAuthToken } from '../../services/auth/auth-token';
import { LoginCredentials, User } from '../types/auth';
import { ApiError } from '../../services/errors/api-error';

export const AUTH_ERRORS = {
  wrongCredentials: 'Неверный email или пароль',
  network: 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не удалось войти. Попробуйте позже',
} as const;

function toLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return AUTH_ERRORS.generic;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return AUTH_ERRORS.network;
  }
  if (error.status === 401 || error.status === 400) {
    return AUTH_ERRORS.wrongCredentials;
  }
  return AUTH_ERRORS.generic;
}

/**
 * Вход: POST /token, затем GET /user — без профиля экранам не хватает своего external_key.
 * Учётные данные и профиль в лог не пишем.
 */
function* loginSaga(action: PayloadAction<LoginCredentials>) {
  try {
    const token: string = yield call([visitControlApi, visitControlApi.login], action.payload);
    setAuthToken(token);
    const user: User = yield call([visitControlApi, visitControlApi.getMe]);
    yield put(loginSuccess({ token, user }));
  } catch (error) {
    clearAuthToken();
    console.warn('[Auth Saga] Login failed', error instanceof ApiError ? error.status : 'unknown');
    yield put(loginFailure(toLoginError(error)));
  }
}

function logoutSaga() {
  clearAuthToken();
}

export function* watchLogin() {
  yield takeLatest(loginStart.type, loginSaga);
  yield takeLatest(logout.type, logoutSaga);
}
