import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  approveRequest,
  approveSuccess,
  loadRequestsFailure,
  loadRequestsStart,
  loadRequestsSuccess,
  rejectRequest,
  rejectSuccess,
  requestActionFailure,
  requestAlreadyProcessed,
  resendPassword,
  resendPasswordSuccess,
} from '../reducers/requests';
import { RootState } from '../reducers';
import { RegistrationRequestsPage, RegistrationRequestView } from '../types/requests';

export const REQUEST_MESSAGES = {
  network: 'Нет соединения с сервером. Проверьте интернет и обновите список: возможно, действие уже выполнено',
  generic: 'Не удалось выполнить действие. Попробуйте позже',
} as const;

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

function* loadRequestsSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const page: RegistrationRequestsPage = yield call([
      visitControlApi,
      visitControlApi.getRegistrationRequests,
    ]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadRequestsSuccess(page));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Requests Saga] Failed to load requests', error instanceof ApiError ? error.status : error);
    yield put(loadRequestsFailure());
  }
}

/** 404 и 409 ALREADY_PROCESSED значат одно: заявки в очереди больше нет */
function isGone(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || (error.status === 409 && error.data?.code === 'ALREADY_PROCESSED'))
  );
}

function toActionError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return REQUEST_MESSAGES.generic;
  }
  if (error.status === 401) {
    return null;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return REQUEST_MESSAGES.network;
  }
  return REQUEST_MESSAGES.generic;
}

function* handleActionError(request: RegistrationRequestView, error: unknown) {
  console.warn('[Requests Saga] Action failed', error instanceof ApiError ? error.status : error);
  if (isGone(error)) {
    yield put(requestAlreadyProcessed(request));
    return;
  }
  yield put(requestActionFailure(toActionError(error)));
}

function* approveSaga(action: PayloadAction<RegistrationRequestView>) {
  const request = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const passwordSent: boolean = yield call(
      [visitControlApi, visitControlApi.approveRegistration],
      request.id
    );
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(approveSuccess({ request, passwordSent }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield call(handleActionError, request, error);
  }
}

function* rejectSaga(action: PayloadAction<{ request: RegistrationRequestView; reason: string | null }>) {
  const { request, reason } = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.rejectRegistration], request.id, reason);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(rejectSuccess(request));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield call(handleActionError, request, error);
  }
}

function* resendPasswordSaga(action: PayloadAction<string>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const passwordSent: boolean = yield call([visitControlApi, visitControlApi.resetPassword], action.payload);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(resendPasswordSuccess({ id: action.payload, passwordSent }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Requests Saga] Password reset failed', error instanceof ApiError ? error.status : error);
    yield put(requestActionFailure(toActionError(error)));
  }
}

export function* watchRequests() {
  yield takeLatest(loadRequestsStart.type, loadRequestsSaga);
  // takeLeading: второе нажатие, пока идёт первый запрос, не отправляет второй
  yield takeLeading([approveRequest.type, rejectRequest.type, resendPassword.type], function* (
    action: PayloadAction<unknown>
  ) {
    if (approveRequest.match(action)) {
      yield call(approveSaga, action);
    } else if (rejectRequest.match(action)) {
      yield call(rejectSaga, action);
    } else if (resendPassword.match(action)) {
      yield call(resendPasswordSaga, action);
    }
  });
}
