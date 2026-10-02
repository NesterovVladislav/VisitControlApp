import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeEvery, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import {
  assignChild,
  assignChildFailure,
  assignChildSuccess,
  loadGroupPeople,
  loadGroupPeopleFailure,
  loadGroupPeopleSuccess,
  loadMoreGroupPeople,
} from '../reducers/group-people';
import { GroupPeopleQuery, GroupPeopleState } from '../types/group-people';
import { PeoplePage, PeopleQuery, Person, PersonGroup } from '../types/people';
import { refreshAfterGardenChange } from './garden-refresh';
import { MEMBERSHIP_MESSAGES } from './group-membership';

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;
const selectGroupPeople = (state: RootState) => state.groupPeople;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

export function toPeopleQuery(query: GroupPeopleQuery): PeopleQuery {
  if (query.kind === 'withoutGroup') {
    return { category: 'CHILD', q: query.q, groupFilter: { kind: 'withoutGroup' } };
  }
  // Название группы API не нужно, только id
  return { category: query.category, q: '', groupFilter: { kind: 'group', id: query.groupId, name: '' } };
}

function* loadPage(page: number) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { query, requestId }: GroupPeopleState = yield select(selectGroupPeople);
  if (!query) {
    return;
  }
  try {
    const result: PeoplePage = yield call([visitControlApi, visitControlApi.getPeople], toPeopleQuery(query), page);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadGroupPeopleSuccess({ requestId, result }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    // В ответе персональные данные, в лог — только код
    console.warn('[Group People Saga] Failed to load page', page, error instanceof ApiError ? error.status : 'unknown');
    yield put(loadGroupPeopleFailure({ requestId, page }));
  }
}

export function* loadFirstPageSaga() {
  yield call(loadPage, 0);
}

export function* loadMoreSaga() {
  const { page, last, status }: GroupPeopleState = yield select(selectGroupPeople);
  if (last || status !== 'loaded') {
    return;
  }
  yield call(loadPage, page + 1);
}

export function* assignChildSaga(action: PayloadAction<{ child: Person; group: PersonGroup }>) {
  const { child, group } = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.putChildInGroup], group.id, child.id);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(assignChildSuccess({ childId: child.id }));
    yield* refreshAfterGardenChange();
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Group People Saga] Failed to assign child', error instanceof ApiError ? error.status : 'unknown');
    let message: string = MEMBERSHIP_MESSAGES.generic;
    if (error instanceof ApiError && (error.isNetworkError || error.isTimeoutError)) {
      message = MEMBERSHIP_MESSAGES.network;
    } else if (error instanceof ApiError && error.status === 404) {
      message = MEMBERSHIP_MESSAGES.gone;
    }
    yield put(assignChildFailure({ childId: child.id, message }));
  }
}

export function* watchGroupPeople() {
  // takeLatest: при быстром наборе в поиске и смене вкладки нужен только ответ на последний запрос
  yield takeLatest(loadGroupPeople.type, loadFirstPageSaga);
  // takeLeading: onEndReached срабатывает несколько раз подряд, следующая страница нужна одна
  yield takeLeading(loadMoreGroupPeople.type, loadMoreSaga);
  yield takeEvery(assignChild.type, assignChildSaga);
}
