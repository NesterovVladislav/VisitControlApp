import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeEvery, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  approveChildChangeStart,
  cancelChildChangeStart,
  cancelChildRequestFinished,
  changeChildFailure,
  changeChildStart,
  changeChildSuccess,
  childChangeFinished,
  loadChildChanges,
  loadChildChangesSuccess,
  loadOwnChildren,
  loadOwnChildrenSuccess,
  rejectChildChangeStart,
  cancelChildRequestStart,
  decideChildRequestFinished,
  decideChildRequestStart,
  loadOwnChildRequests,
  loadOwnChildRequestsSuccess,
  loadPendingChildRequests,
  loadPendingChildRequestsFailure,
  loadPendingChildRequestsSuccess,
  submitChildFailure,
  submitChildStart,
  submitChildSuccess,
} from '../reducers/child-requests';
import { loadChildrenStart } from '../reducers/children';
import { RootState } from '../reducers';
import {
  ChildChange,
  ChildChangeBody,
  ChildChangeStatus,
  ChildRequest,
  ChildRequestBody,
  ChildRequestDecision,
  ChildRequestStatus,
  OwnChild,
} from '../types/child-requests';

export const CHILD_REQUEST_MESSAGES = {
  exists: 'Заявка на этого ребёнка уже отправлена и ждёт подтверждения',
  linked: 'Этот ребёнок уже есть в списке ваших детей',
  invalid: 'Проверьте данные ребёнка',
  network: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не получилось. Попробуйте позже',
  alreadyDecided: 'Заявку уже рассмотрели',
  childGone: 'Ребёнок не найден: возможно, его уже удалили из сада',
  changePending: 'По этому ребёнку уже есть изменение, которое ждёт подтверждения сада',
  notParent: 'Менять данные ребёнка может только его родитель',
} as const;

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

/** Понятный текст ошибки; null — не показываем (401: интерсептор уже выходит из аккаунта). */
export function toChildRequestError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return CHILD_REQUEST_MESSAGES.generic;
  }
  if (error.status === 401) {
    return null;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return CHILD_REQUEST_MESSAGES.network;
  }
  const code = String(error.data?.code ?? '');
  if (code === 'CHILD_REQUEST_EXISTS') {
    return CHILD_REQUEST_MESSAGES.exists;
  }
  if (code === 'CHILD_ALREADY_LINKED') {
    return CHILD_REQUEST_MESSAGES.linked;
  }
  if (code === 'CHILD_CHANGE_PENDING') {
    return CHILD_REQUEST_MESSAGES.changePending;
  }
  if (error.status === 403) {
    return CHILD_REQUEST_MESSAGES.notParent;
  }
  if (code === 'ALREADY_PROCESSED') {
    return CHILD_REQUEST_MESSAGES.alreadyDecided;
  }
  if (error.status === 404) {
    return CHILD_REQUEST_MESSAGES.childGone;
  }
  if (error.status === 400) {
    return CHILD_REQUEST_MESSAGES.invalid;
  }
  return CHILD_REQUEST_MESSAGES.generic;
}

function* loadOwnSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const requests: ChildRequest[] = yield call([visitControlApi, visitControlApi.getMyChildRequests]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadOwnChildRequestsSuccess(requests));
  } catch (error) {
    // Старый бэкенд без заявок на ребёнка: раздел в профиле просто без заявок
    console.warn('[Child Requests Saga] Failed to load own', error instanceof ApiError ? error.status : error);
  }
}

function* submitSaga(action: PayloadAction<ChildRequestBody>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const status: ChildRequestStatus = yield call([visitControlApi, visitControlApi.addMyChild], action.payload);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(submitChildSuccess(status));
    // Ребёнок добавлен сразу — он появится в «Мои дети»; заявка — в списке заявок профиля
    yield put(status === 'ADDED' ? loadChildrenStart({ refresh: true }) : loadOwnChildRequests());
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Requests Saga] Failed to submit', error instanceof ApiError ? error.status : error);
    yield put(submitChildFailure(toChildRequestError(error)));
  }
}

function* cancelSaga(action: PayloadAction<string>) {
  const id = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.cancelMyChildRequest], id);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(cancelChildRequestFinished({ id, message: null }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(cancelChildRequestFinished({ id, message: toChildRequestError(error) }));
    // Заявку мог рассмотреть администратор: показываем, что с ней на самом деле
    yield put(loadOwnChildRequests());
    yield put(loadChildrenStart({ refresh: true }));
  }
}

function* loadPendingSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const requests: ChildRequest[] = yield call([visitControlApi, visitControlApi.getChildRequests]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadPendingChildRequestsSuccess(requests));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Requests Saga] Failed to load pending', error instanceof ApiError ? error.status : error);
    yield put(loadPendingChildRequestsFailure());
  }
}

function* decideSaga(action: PayloadAction<{ id: string; decision: ChildRequestDecision }>) {
  const { id, decision } = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.decideChildRequest], id, decision);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(decideChildRequestFinished({ id, message: null }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Requests Saga] Failed to decide', error instanceof ApiError ? error.status : error);
    yield put(decideChildRequestFinished({ id, message: toChildRequestError(error) }));
    // Заявку мог решить другой администратор
    yield put(loadPendingChildRequests({ silent: true }));
  }
}

function* loadOwnChildrenSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const children: OwnChild[] = yield call([visitControlApi, visitControlApi.getOwnChildren]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadOwnChildrenSuccess(children));
  } catch (error) {
    // Старый бэкенд без карточек детей: в профиле остаются имена из «Мои дети», без правки
    console.warn('[Child Requests Saga] Failed to load own children', error instanceof ApiError ? error.status : error);
  }
}

function* changeChildSaga(action: PayloadAction<{ childId: string; data: ChildChangeBody }>) {
  const { childId, data } = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const status: ChildChangeStatus = yield call([visitControlApi, visitControlApi.changeMyChild], childId, data);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(changeChildSuccess(status));
    yield put(loadOwnChildren());
    if (status === 'APPROVED') {
      // Имя ребёнка изменилось и на экране «Мои дети»
      yield put(loadChildrenStart({ refresh: true }));
    }
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Requests Saga] Failed to change child', error instanceof ApiError ? error.status : error);
    yield put(changeChildFailure(toChildRequestError(error)));
    yield put(loadOwnChildren());
  }
}

/** Отзыв своего изменения и решения администратора устроены одинаково: запрос, затем свежие списки. */
function* finishChildChange(id: string, request: () => Promise<void>, admin: boolean) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  let message: string | null = null;
  try {
    yield call(request);
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Requests Saga] Failed to finish child change', error instanceof ApiError ? error.status : error);
    message = toChildRequestError(error);
  }
  if (!(yield* isCurrentSession(sessionEpoch))) return;
  yield put(childChangeFinished({ id, message }));
  // Изменение мог решить другой администратор или отозвать заявитель: списки берём с сервера
  yield put(admin ? loadChildChanges() : loadOwnChildren());
}

function* cancelChildChangeSaga(action: PayloadAction<string>) {
  const id = action.payload;
  yield call(finishChildChange, id, () => visitControlApi.cancelMyChildChange(id), false);
}

function* loadChildChangesSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const changes: ChildChange[] = yield call([visitControlApi, visitControlApi.getChildChanges]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadChildChangesSuccess(changes));
  } catch (error) {
    console.warn('[Child Requests Saga] Failed to load child changes', error instanceof ApiError ? error.status : error);
  }
}

function* approveChildChangeSaga(action: PayloadAction<string>) {
  const id = action.payload;
  yield call(finishChildChange, id, () => visitControlApi.approveChildChange(id), true);
}

function* rejectChildChangeSaga(action: PayloadAction<{ id: string; comment: string }>) {
  const { id, comment } = action.payload;
  yield call(finishChildChange, id, () => visitControlApi.rejectChildChange(id, comment), true);
}

export function* watchChildRequests() {
  yield takeLatest(loadOwnChildren.type, loadOwnChildrenSaga);
  yield takeLeading(changeChildStart.type, changeChildSaga);
  yield takeEvery(cancelChildChangeStart.type, cancelChildChangeSaga);
  yield takeLatest(loadChildChanges.type, loadChildChangesSaga);
  yield takeEvery(approveChildChangeStart.type, approveChildChangeSaga);
  yield takeEvery(rejectChildChangeStart.type, rejectChildChangeSaga);
  yield takeLatest(loadOwnChildRequests.type, loadOwnSaga);
  // takeLeading: двойное нажатие «Добавить» не отправит двух заявок
  yield takeLeading(submitChildStart.type, submitSaga);
  yield takeEvery(cancelChildRequestStart.type, cancelSaga);
  yield takeLatest(loadPendingChildRequests.type, loadPendingSaga);
  yield takeEvery(decideChildRequestStart.type, decideSaga);
}
