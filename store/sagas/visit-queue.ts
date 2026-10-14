import { PayloadAction } from '@reduxjs/toolkit';
import * as Haptics from 'expo-haptics';
import { call, put, select, takeEvery, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { loadQueueFilter, saveQueueFilter } from '../../services/visits/queue-filter';
import {
  confirmMarkStart,
  decideMarkFailure,
  decideMarkSuccess,
  loadQueueFailure,
  loadQueueStart,
  loadQueueSuccess,
  openQueue,
  queueAvailability,
  queueFilterLoaded,
  rejectMarkStart,
  setQueueFilter,
  setQueueShowAll,
} from '../reducers/visit-queue';
import { loadPresentStart } from '../reducers/visits';
import { RootState } from '../reducers';
import { QueueFilter, VisitQueue } from '../types/visits';

export const QUEUE_MESSAGES = {
  alreadyDecided: 'По этой отметке уже принято решение',
  ownMark: 'Свою отметку подтверждает другой сотрудник',
  network: 'Не удалось сохранить. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не удалось сохранить. Попробуйте позже',
} as const;

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;
const selectUserId = (state: RootState) => state.auth.user?.id ?? null;
const selectQueue = (state: RootState) => state.visitQueue;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

/**
 * Первый вход в «Посещение»: включено ли подтверждение в саду, какие группы сотрудник выбрал в прошлый раз,
 * затем сама очередь. Если настройку узнать не удалось, очередь не показываем и спросим ещё раз при следующем входе.
 */
function* openQueueSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  let enabled = false;
  try {
    enabled = yield call([visitControlApi, visitControlApi.getVisitConfirmationEnabled]);
  } catch (error) {
    console.warn('[Visit Queue Saga] Failed to load organization', error instanceof ApiError ? error.status : error);
    return;
  }
  if (!(yield* isCurrentSession(sessionEpoch))) return;
  yield put(queueAvailability(enabled));
  if (!enabled) {
    return;
  }
  const { filterLoaded }: RootState['visitQueue'] = yield select(selectQueue);
  const userId: string | null = yield select(selectUserId);
  if (!filterLoaded && userId) {
    const filter: QueueFilter | null = yield call(loadQueueFilter, userId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(queueFilterLoaded(filter));
  }
  yield put(loadQueueStart({ silent: true }));
}

function* loadQueueSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { filter, showAll }: RootState['visitQueue'] = yield select(selectQueue);
  try {
    const queue: VisitQueue = yield call([visitControlApi, visitControlApi.getVisitQueue], showAll ? null : filter);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadQueueSuccess(queue));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Visit Queue Saga] Failed to load queue', error instanceof ApiError ? error.status : error);
    yield put(loadQueueFailure());
  }
}

function* setQueueFilterSaga(action: PayloadAction<QueueFilter | null>) {
  const userId: string | null = yield select(selectUserId);
  if (userId) {
    try {
      yield call(saveQueueFilter, userId, action.payload);
    } catch {
      // Выбор действует до перезапуска приложения
    }
  }
  yield put(loadQueueStart());
}

function* decide(id: string, request: () => Promise<void>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call(request);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(decideMarkSuccess(id));
    try {
      yield call(Haptics.notificationAsync, Haptics.NotificationFeedbackType.Success);
    } catch {
      // Вибрация необязательна
    }
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Visit Queue Saga] Failed to decide', error instanceof ApiError ? error.status : error);
    yield put(decideMarkFailure({ id, message: toDecisionError(error) }));
  }
  // Очередь и «Кто в саду» берём с сервера: решение мог принять и другой сотрудник
  yield put(loadQueueStart({ silent: true }));
  yield put(loadPresentStart({ refresh: true }));
}

function* confirmMarkSaga(action: PayloadAction<string>) {
  const id = action.payload;
  yield call(decide, id, () => visitControlApi.confirmVisit(id));
}

function* rejectMarkSaga(action: PayloadAction<{ id: string; comment: string }>) {
  const { id, comment } = action.payload;
  yield call(decide, id, () => visitControlApi.rejectVisit(id, comment));
}

export function toDecisionError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return QUEUE_MESSAGES.generic;
  }
  if (error.status === 401) {
    return null;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return QUEUE_MESSAGES.network;
  }
  if (error.status === 409 || error.status === 404) {
    return QUEUE_MESSAGES.alreadyDecided;
  }
  if (error.status === 403 && error.data?.code === 'SELF_CONFIRMATION') {
    return QUEUE_MESSAGES.ownMark;
  }
  return QUEUE_MESSAGES.generic;
}

export function* watchVisitQueue() {
  yield takeLeading(openQueue.type, openQueueSaga);
  yield takeLatest(loadQueueStart.type, loadQueueSaga);
  yield takeLatest(setQueueFilter.type, setQueueFilterSaga);
  yield takeLatest(setQueueShowAll.type, function* reloadQueue() {
    yield put(loadQueueStart());
  });
  // takeEvery: решение по одной отметке не должно отменять решение по другой
  yield takeEvery(confirmMarkStart.type, confirmMarkSaga);
  yield takeEvery(rejectMarkStart.type, rejectMarkSaga);
}
