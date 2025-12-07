import { call, put, takeLatest } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import { loginStart, loginSuccess, loginFailure } from '../reducers/auth';
import { visitControlApi } from '../../services/api';
import { LoginCredentials, AuthResponse } from '../types/auth';
import { ApiError } from '../../services/errors/api-error';

/**
 * Saga для обработки авторизации
 */
function* loginSaga(action: PayloadAction<LoginCredentials>) {
  try {
    console.log('[Auth Saga] Login started with credentials:', action.payload);

    // Вызываем API метод авторизации
    // Ретраи и таймауты обрабатываются на уровне API клиента
    const response: AuthResponse = yield call(
      visitControlApi.auth,
      action.payload
    );

    console.log('[Auth Saga] Login success:', response);

    // При успехе диспатчим success action
    yield put(loginSuccess(response));
  } catch (error) {
    console.error('[Auth Saga] Login error:', error);

    // Обрабатываем ошибку
    let errorMessage = 'Авторизация не удалась. Пожалуйста, попробуйте еще раз.';

    if (error instanceof ApiError) {
      // Используем сообщение из API ошибки, если доступно
      errorMessage = error.getErrorMessage() || errorMessage;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Диспатчим failure action с сообщением об ошибке
    yield put(loginFailure(errorMessage));
  }
}

/**
 * Watcher saga для отслеживания действий авторизации
 */
export function* watchLogin() {
  console.log('[Auth Saga] Watcher started, listening for:', loginStart.type);
  yield takeLatest(loginStart.type, loginSaga);
}
