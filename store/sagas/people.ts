import { all, call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import {
  loadMorePeople,
  loadPeople,
  loadPeopleFailure,
  loadPeopleFilters,
  loadPeopleFiltersFailure,
  loadPeopleFiltersSuccess,
  loadPeopleSuccess,
} from '../reducers/people';
import { GardenGroup, PeoplePage, PeopleState } from '../types/people';
import { Branch } from '../types/visits';

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;
const selectPeople = (state: RootState) => state.people;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

function logFailure(what: string, error: unknown) {
  // В ответе персональные данные, в лог — только код
  console.warn(`[People Saga] Failed to load ${what}`, error instanceof ApiError ? error.status : 'unknown');
}

function* loadPage(page: number) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { query, requestId }: PeopleState = yield select(selectPeople);
  try {
    const result: PeoplePage = yield call([visitControlApi, visitControlApi.getPeople], query, page);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadPeopleSuccess({ requestId, result }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    logFailure(`people page ${page}`, error);
    yield put(loadPeopleFailure({ requestId, page }));
  }
}

export function* loadFirstPageSaga() {
  yield call(loadPage, 0);
}

export function* loadMoreSaga() {
  const { page, last, status }: PeopleState = yield select(selectPeople);
  if (last || status !== 'loaded') {
    return;
  }
  yield call(loadPage, page + 1);
}

export function* loadFiltersSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const [groups, branches]: [GardenGroup[], Branch[]] = yield all([
      call([visitControlApi, visitControlApi.getGroups]),
      call([visitControlApi, visitControlApi.getBranches]),
    ]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadPeopleFiltersSuccess({ groups, branches }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    logFailure('groups', error);
    yield put(loadPeopleFiltersFailure());
  }
}

export function* watchPeople() {
  // takeLatest: при быстром наборе в поиске нужен только ответ на последний запрос
  yield takeLatest(loadPeople.type, loadFirstPageSaga);
  // takeLeading: onEndReached срабатывает несколько раз подряд, следующая страница нужна одна
  yield takeLeading(loadMorePeople.type, loadMoreSaga);
  yield takeLeading(loadPeopleFilters.type, loadFiltersSaga);
}
