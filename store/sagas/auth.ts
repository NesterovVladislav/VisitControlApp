import { PayloadAction } from '@reduxjs/toolkit';
import {
  call,
  put,
  select,
  takeEvery,
  takeLatest,
  takeLeading,
} from 'redux-saga/effects';

import { visitControlApi } from '../../services/api';
import {
  getBiometricCapability,
  promptForBiometricUnlock,
} from '../../services/auth/biometrics';
import { ensureCurrentInstallation } from '../../services/auth/install-marker';
import {
  ProtectedSessionRecord,
  protectedSessionRepository,
} from '../../services/auth/protected-session';
import { clearAuthToken, setAuthToken } from '../../services/auth/auth-token';
import { loadChildrenStart } from '../reducers/children';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import {
  bootstrapLocked,
  bootstrapPinSetupRequired,
  bootstrapSession,
  bootstrapUnauthenticated,
  completePinSetup,
  loginFailure,
  loginStart,
  MAX_PIN_ATTEMPTS,
  logoutCompleted,
  logoutRequested,
  pinSetupCompleted,
  retryProtectedStorage,
  retrySessionValidation,
  sessionExpired,
  sessionValidationUnavailable,
  storageUnavailable,
  submitBiometricPreference,
  unlockFailed,
  unlockWithBiometrics,
  unlockWithPin,
  validationStarted,
  validationSucceeded,
} from '../reducers/auth';
import { ADMIN_ROLE, LoginCredentials, LogoutReason, User } from '../types/auth';

export const AUTH_ERRORS = {
  wrongCredentials: 'Неверный email или пароль',
  network: 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не удалось войти. Попробуйте позже',
  storage: 'Защищённое хранилище недоступно. Попробуйте ещё раз',
  wrongPin: 'Неверный PIN-код',
  tooManyPinAttempts: 'Слишком много неверных попыток. Войдите снова',
  biometricsUnavailable: 'Биометрия сейчас недоступна. Используйте PIN-код',
  biometricsLockedOut: 'Биометрия временно заблокирована. Используйте PIN-код',
  biometricsFailed: 'Не удалось подтвердить биометрию. Используйте PIN-код',
  validationUnavailable: 'Не удалось проверить сессию. Проверьте интернет и повторите',
  expired: 'Сессия истекла. Войдите снова',
} as const;

function toLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) return AUTH_ERRORS.generic;
  if (error.isNetworkError || error.isTimeoutError) return AUTH_ERRORS.network;
  if (error.status === 401 || error.status === 400) return AUTH_ERRORS.wrongCredentials;
  return AUTH_ERRORS.generic;
}

function isRetryableValidationError(error: unknown): boolean {
  return error instanceof ApiError &&
    (error.isNetworkError || error.isTimeoutError || error.isServerError());
}

function* failProtectedStorage() {
  clearAuthToken();
  yield put(storageUnavailable(AUTH_ERRORS.storage));
}

function* validateProtectedRecord(record: ProtectedSessionRecord) {
  setAuthToken(record.token);
  const expectedEpoch: number = yield select(
    (state: RootState) => state.auth.sessionEpoch,
  );
  yield put(validationStarted());

  try {
    const user: User = yield call([visitControlApi, visitControlApi.getMe]);
    const currentEpoch: number = yield select(
      (state: RootState) => state.auth.sessionEpoch,
    );
    if (currentEpoch !== expectedEpoch) return;
    yield put(validationSucceeded(user));
    // Администратору свои дети нужны сразу: по ним решаем, показывать ли переключатель в режим родителя.
    // Родителю список загрузит экран «Мои дети».
    if (user.role === ADMIN_ROLE) {
      yield put(loadChildrenStart());
    }
  } catch (error) {
    const currentEpoch: number = yield select(
      (state: RootState) => state.auth.sessionEpoch,
    );
    if (currentEpoch !== expectedEpoch) return;

    if (error instanceof ApiError && error.status === 401) {
      yield put(sessionExpired());
      return;
    }
    if (isRetryableValidationError(error)) {
      yield put(sessionValidationUnavailable(AUTH_ERRORS.validationUnavailable));
      return;
    }
    yield put(sessionValidationUnavailable(AUTH_ERRORS.validationUnavailable));
  }
}

export function* bootstrapSessionSaga() {
  clearAuthToken();
  try {
    yield call(ensureCurrentInstallation);
    const record: ProtectedSessionRecord | null = yield call(
      [protectedSessionRepository, protectedSessionRepository.load],
    );
    if (!record) {
      yield put(bootstrapUnauthenticated());
      return;
    }
    if (record.status === 'pin_setup_required') {
      yield put(bootstrapPinSetupRequired());
      return;
    }
    yield put(bootstrapLocked({
      biometricsEnabled: record.biometricsEnabled,
      remainingPinAttempts: Math.max(
        0,
        MAX_PIN_ATTEMPTS - record.failedPinAttempts,
      ),
    }));
  } catch {
    yield* failProtectedStorage();
  }
}

export function* loginSaga(action: PayloadAction<LoginCredentials>) {
  let token: string;
  try {
    token = yield call([visitControlApi, visitControlApi.login], action.payload);
  } catch (error) {
    clearAuthToken();
    yield put(loginFailure(toLoginError(error)));
    return;
  }

  setAuthToken(token);
  try {
    yield call(
      [protectedSessionRepository, protectedSessionRepository.beginSession],
      token,
    );
    yield put(bootstrapPinSetupRequired());
  } catch {
    yield* failProtectedStorage();
  }
}

export function* completePinSetupSaga(
  action: PayloadAction<{ pin: string }>,
) {
  try {
    yield call(
      [protectedSessionRepository, protectedSessionRepository.completePinSetup],
      action.payload.pin,
    );
    const capability: Awaited<ReturnType<typeof getBiometricCapability>> =
      yield call(getBiometricCapability);
    yield put(pinSetupCompleted({ biometricsAvailable: capability.available }));
  } catch {
    yield* failProtectedStorage();
  }
}

export function* submitBiometricPreferenceSaga(
  action: PayloadAction<{ enabled: boolean }>,
) {
  try {
    const record: ProtectedSessionRecord = yield call(
      [protectedSessionRepository, protectedSessionRepository.setBiometricsEnabled],
      action.payload.enabled,
    );
    yield* validateProtectedRecord(record);
  } catch {
    yield* failProtectedStorage();
  }
}

export function* unlockWithPinSaga(action: PayloadAction<{ pin: string }>) {
  try {
    const result: Awaited<ReturnType<typeof protectedSessionRepository.verifyPin>> =
      yield call(
        [protectedSessionRepository, protectedSessionRepository.verifyPin],
        action.payload.pin,
      );

    if (result.kind === 'failure') {
      yield put(unlockFailed({
        error: AUTH_ERRORS.wrongPin,
        remainingAttempts: result.remainingAttempts,
      }));
      return;
    }
    if (result.kind === 'sessionCleared') {
      clearAuthToken();
      yield put(logoutCompleted({
        reason: 'expired',
        notice: AUTH_ERRORS.tooManyPinAttempts,
      }));
      return;
    }
    yield* validateProtectedRecord(result.record);
  } catch {
    yield* failProtectedStorage();
  }
}

export function* unlockWithBiometricsSaga() {
  const result: Awaited<ReturnType<typeof promptForBiometricUnlock>> =
    yield call(promptForBiometricUnlock);

  if (result.kind !== 'success') {
    const error = result.kind === 'cancelled'
      ? null
      : result.kind === 'lockedOut'
        ? AUTH_ERRORS.biometricsLockedOut
        : result.kind === 'unavailable'
          ? AUTH_ERRORS.biometricsUnavailable
          : AUTH_ERRORS.biometricsFailed;
    yield put(unlockFailed({ error }));
    return;
  }

  try {
    const record: ProtectedSessionRecord = yield call(
      [protectedSessionRepository, protectedSessionRepository.resetFailedPinAttempts],
    );
    yield* validateProtectedRecord(record);
  } catch {
    yield* failProtectedStorage();
  }
}

export function* retrySessionValidationSaga() {
  try {
    const record: ProtectedSessionRecord | null = yield call(
      [protectedSessionRepository, protectedSessionRepository.load],
    );
    if (!record) {
      clearAuthToken();
      yield put(logoutCompleted({ reason: 'expired', notice: AUTH_ERRORS.expired }));
      return;
    }
    if (record.status === 'pin_setup_required') {
      clearAuthToken();
      yield put(bootstrapPinSetupRequired());
      return;
    }
    yield* validateProtectedRecord(record);
  } catch {
    yield* failProtectedStorage();
  }
}

let cleanupInFlight = false;
let pendingCleanupReason: LogoutReason | null = null;

function noticeFor(reason: LogoutReason): string | undefined {
  return reason === 'expired' ? AUTH_ERRORS.expired : undefined;
}

function* cleanupByReason(reason: LogoutReason) {
  if (cleanupInFlight) return;
  cleanupInFlight = true;
  pendingCleanupReason = reason;
  clearAuthToken();

  try {
    yield call([protectedSessionRepository, protectedSessionRepository.clear]);
    pendingCleanupReason = null;
    yield put(logoutCompleted({ reason, notice: noticeFor(reason) }));
  } catch {
    yield put(storageUnavailable(AUTH_ERRORS.storage));
  } finally {
    cleanupInFlight = false;
  }
}

export function* cleanupSessionSaga(
  action:
    | ReturnType<typeof sessionExpired>
    | ReturnType<typeof logoutRequested>,
) {
  if (action.type === sessionExpired.type) {
    const phase: RootState['auth']['phase'] = yield select(
      (state: RootState) => state.auth.phase,
    );
    if (phase === 'unauthenticated') return;
  }
  const reason: LogoutReason = action.type === sessionExpired.type
    ? 'expired'
    : action.payload.reason;
  yield* cleanupByReason(reason);
}

export function* retryProtectedStorageSaga() {
  if (pendingCleanupReason) {
    yield* cleanupByReason(pendingCleanupReason);
    return;
  }
  yield* bootstrapSessionSaga();
}

export function resetAuthSagaStateForTests(): void {
  cleanupInFlight = false;
  pendingCleanupReason = null;
}

export function* watchLogin() {
  yield takeLatest(bootstrapSession.type, bootstrapSessionSaga);
  yield takeLatest(retryProtectedStorage.type, retryProtectedStorageSaga);
  yield takeLeading(loginStart.type, loginSaga);
  yield takeLatest(completePinSetup.type, completePinSetupSaga);
  yield takeLatest(submitBiometricPreference.type, submitBiometricPreferenceSaga);
  yield takeLatest(unlockWithPin.type, unlockWithPinSaga);
  yield takeLatest(unlockWithBiometrics.type, unlockWithBiometricsSaga);
  yield takeLatest(retrySessionValidation.type, retrySessionValidationSaga);
  yield takeEvery(logoutRequested.type, cleanupSessionSaga);
  yield takeEvery(sessionExpired.type, cleanupSessionSaga);
}
