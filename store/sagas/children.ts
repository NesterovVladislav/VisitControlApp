import { PayloadAction } from '@reduxjs/toolkit';
import * as Haptics from 'expo-haptics';
import { all, call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  loadChildrenFailure,
  loadChildrenStart,
  loadChildrenSuccess,
  loadStatusFailure,
  loadStatusStart,
  loadStatusSuccess,
  markVisitFailure,
  markVisitStale,
  markVisitStart,
  markVisitSuccess,
  refreshStatuses,
} from '../reducers/children';
import { RootState } from '../reducers';
import { Child, isInKindergarten, MarkVisitRequest, VisitStatus } from '../types/children';

export const CHILDREN_MESSAGES = {
  statusChanged: 'Статус уже изменился, проверьте ещё раз',
  noAccess: 'Нет доступа к отметкам этого ребёнка',
  network: 'Не удалось отметить. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не удалось отметить. Попробуйте позже',
} as const;

const selectUserId = (state: RootState) => state.auth.user?.id ?? null;
const selectChildIds = (state: RootState) => state.children.items.map((child) => child.id);
const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

function byName(a: Child, b: Child): number {
  return `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, 'ru');
}

function* loadStatusSaga(action: PayloadAction<string>) {
  const childId = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const status: VisitStatus = yield call([visitControlApi, visitControlApi.getActualStatus], childId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadStatusSuccess({ childId, status }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Children Saga] Failed to load status', error instanceof ApiError ? error.status : error);
    yield put(loadStatusFailure(childId));
  }
}

function* loadChildrenSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const userId: string | null = yield select(selectUserId);
  if (!userId) {
    yield put(loadChildrenFailure());
    return;
  }
  try {
    const children: Child[] = yield call([visitControlApi, visitControlApi.getMyChildren], userId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadChildrenSuccess([...children].sort(byName)));
    yield put(refreshStatuses());
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Children Saga] Failed to load children', error instanceof ApiError ? error.status : error);
    yield put(loadChildrenFailure());
  }
}

function* refreshStatusesSaga() {
  const ids: string[] = yield select(selectChildIds);
  yield all(ids.map((id) => put(loadStatusStart(id))));
}

/**
 * Отметка «привёл / забрал».
 * 1. Перечитываем статус: если его уже сменил другой представитель, ничего не отправляем.
 * 2. POST /visit без ретраев.
 * 3. Статус после отметки берём с сервера, а не выставляем локально.
 */
function* markVisitSaga(action: PayloadAction<MarkVisitRequest>) {
  const { childId, seenStatus } = action.payload;
  const target = isInKindergarten(seenStatus) ? 'OUT' : 'IN';
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const userId: string | null = yield select(selectUserId);
  if (!userId) {
    yield put(markVisitFailure({ childId, message: null }));
    return;
  }

  try {
    const current: VisitStatus = yield call([visitControlApi, visitControlApi.getActualStatus], childId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadStatusSuccess({ childId, status: current }));
    if (isInKindergarten(current) !== isInKindergarten(seenStatus)) {
      yield put(markVisitStale({ childId, notice: CHILDREN_MESSAGES.statusChanged }));
      return;
    }
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(markVisitFailure({ childId, message: toMarkError(error) }));
    return;
  }

  try {
    yield call([visitControlApi, visitControlApi.createVisit], childId, userId, target);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    // После таймаута неизвестно, дошла ли отметка: смотрим на статус на сервере.
    if (error instanceof ApiError && error.isTimeoutError) {
      const applied: boolean = yield call(isStatusApplied, childId, target, sessionEpoch);
      if (!(yield* isCurrentSession(sessionEpoch))) return;
      if (applied) {
        yield call(finishMark, childId, sessionEpoch);
        return;
      }
    }
    console.warn('[Children Saga] Failed to mark visit', error instanceof ApiError ? error.status : error);
    yield put(markVisitFailure({ childId, message: toMarkError(error) }));
    // Связь с ребёнком могли удалить — обновляем список
    if (error instanceof ApiError && error.status === 400) {
      yield put(loadChildrenStart());
    }
    return;
  }

  // Напрямую, а не через put: иначе takeEvery запустит второй такой же запрос
  yield call(loadStatusSaga, loadStatusStart(childId));
  if (!(yield* isCurrentSession(sessionEpoch))) return;
  yield call(finishMark, childId, sessionEpoch);
}

function* isStatusApplied(childId: string, target: 'IN' | 'OUT', sessionEpoch: number) {
  try {
    const status: VisitStatus = yield call([visitControlApi, visitControlApi.getActualStatus], childId);
    if (!(yield* isCurrentSession(sessionEpoch))) return false;
    yield put(loadStatusSuccess({ childId, status }));
    return isInKindergarten(status) === (target === 'IN');
  } catch {
    return false;
  }
}

function* finishMark(childId: string, sessionEpoch: number) {
  if (!(yield* isCurrentSession(sessionEpoch))) return;
  yield put(markVisitSuccess(childId));
  try {
    yield call(Haptics.notificationAsync, Haptics.NotificationFeedbackType.Success);
  } catch {
    // Вибрация необязательна
  }
}

function toMarkError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return CHILDREN_MESSAGES.generic;
  }
  if (error.status === 401) {
    // Интерсептор уже выходит из аккаунта
    return null;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return CHILDREN_MESSAGES.network;
  }
  if (error.status === 400 || error.status === 403) {
    return CHILDREN_MESSAGES.noAccess;
  }
  return CHILDREN_MESSAGES.generic;
}

export function* watchChildren() {
  yield takeLatest(loadChildrenStart.type, loadChildrenSaga);
  yield takeLatest(refreshStatuses.type, refreshStatusesSaga);
  yield takeEvery(loadStatusStart.type, loadStatusSaga);
  // takeEvery: отметка по одному ребёнку не должна отменять отметку по другому
  yield takeEvery(markVisitStart.type, markVisitSaga);
}
