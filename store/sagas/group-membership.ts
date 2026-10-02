import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeEvery, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import {
  loadCandidates,
  loadCandidatesFailure,
  loadCandidatesSuccess,
  loadMoreCandidates,
  putChildInGroup,
  changeMembershipFailure,
  putChildInGroupSuccess,
  removeChildFromGroup,
  removeChildFromGroupSuccess,
} from '../reducers/group-membership';
import { refreshAfterGardenChange } from './garden-refresh';
import { CandidateFilter, GroupMembershipState } from '../types/group-membership';
import { PeopleGroupFilter, PeoplePage, PeopleQuery, Person, PersonGroup } from '../types/people';

export const MEMBERSHIP_MESSAGES = {
  network: 'Нет соединения. Повторить',
  gone: 'Ребёнок или группа удалены. Обновите список',
  generic: 'Не удалось добавить. Повторить',
  removeGeneric: 'Не удалось убрать из группы. Повторить',
} as const;

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;
const selectMembership = (state: RootState) => state.groupMembership;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

function groupFilterOf(filter: CandidateFilter, group: PersonGroup | null): PeopleGroupFilter {
  if (filter === 'inGroup' && group) {
    return { kind: 'group', id: group.id, name: group.name };
  }
  return filter === 'withoutGroup' ? { kind: 'withoutGroup' } : { kind: 'all' };
}

function* loadPage(page: number) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { group, filter, q, requestId }: GroupMembershipState = yield select(selectMembership);
  const query: PeopleQuery = {
    category: 'CHILD',
    q,
    groupFilter: groupFilterOf(filter, group),
  };
  try {
    const result: PeoplePage = yield call([visitControlApi, visitControlApi.getPeople], query, page);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadCandidatesSuccess({ requestId, result }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    // В ответе персональные данные, в лог — только код
    console.warn('[Group Membership Saga] Failed to load children', error instanceof ApiError ? error.status : 'unknown');
    yield put(loadCandidatesFailure({ requestId, page }));
  }
}

export function* loadFirstPageSaga() {
  yield call(loadPage, 0);
}

export function* loadMoreSaga() {
  const { page, last, status }: GroupMembershipState = yield select(selectMembership);
  if (last || status !== 'loaded') {
    return;
  }
  yield call(loadPage, page + 1);
}

function toMessage(error: unknown, generic: string): string {
  if (error instanceof ApiError && (error.isNetworkError || error.isTimeoutError)) {
    return MEMBERSHIP_MESSAGES.network;
  }
  if (error instanceof ApiError && error.status === 404) {
    return MEMBERSHIP_MESSAGES.gone;
  }
  return generic;
}

export function* putChildInGroupSaga(action: PayloadAction<Person>) {
  const child = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { group }: GroupMembershipState = yield select(selectMembership);
  if (!group) {
    return;
  }
  try {
    yield call([visitControlApi, visitControlApi.putChildInGroup], group.id, child.id);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(putChildInGroupSuccess({ childId: child.id, group }));
    yield* refreshAfterGardenChange();
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Group Membership Saga] Failed to put child in group', error instanceof ApiError ? error.status : 'unknown');
    // 401 разлогинивает общий обработчик, строку всё равно разблокируем
    yield put(changeMembershipFailure({ childId: child.id, message: toMessage(error, MEMBERSHIP_MESSAGES.generic) }));
  }
}

export function* removeChildFromGroupSaga(action: PayloadAction<Person>) {
  const child = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { group }: GroupMembershipState = yield select(selectMembership);
  if (!group) {
    return;
  }
  try {
    yield call([visitControlApi, visitControlApi.removeChildFromGroup], group.id, child.id);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(removeChildFromGroupSuccess({ childId: child.id }));
    yield* refreshAfterGardenChange();
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Group Membership Saga] Failed to remove child from group', error instanceof ApiError ? error.status : 'unknown');
    yield put(
      changeMembershipFailure({ childId: child.id, message: toMessage(error, MEMBERSHIP_MESSAGES.removeGeneric) })
    );
  }
}

export function* watchGroupMembership() {
  // takeLatest: при быстром наборе в поиске нужен только ответ на последний запрос
  yield takeLatest(loadCandidates.type, loadFirstPageSaga);
  // takeLeading: onEndReached срабатывает несколько раз подряд, следующая страница нужна одна
  yield takeLeading(loadMoreCandidates.type, loadMoreSaga);
  // Детей добавляют по одному, но подряд: каждый запрос независим
  yield takeEvery(putChildInGroup.type, putChildInGroupSaga);
  yield takeEvery(removeChildFromGroup.type, removeChildFromGroupSaga);
}
