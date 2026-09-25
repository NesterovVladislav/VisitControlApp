import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  loadJournalFailure,
  loadJournalMore,
  loadJournalStart,
  loadJournalSuccess,
  loadPresentFailure,
  loadPresentStart,
  loadPresentSuccess,
} from '../reducers/visits';
import { RootState } from '../reducers';
import { Presence, VisitPage } from '../types/visits';

function logFailure(what: string, error: unknown) {
  console.warn(`[Visits Saga] Failed to load ${what}`, error instanceof ApiError ? error.status : error);
}

function* loadPresentSaga() {
  try {
    const presence: Presence = yield call([visitControlApi, visitControlApi.getPresence]);
    yield put(loadPresentSuccess(presence));
  } catch (error) {
    logFailure('present children', error);
    yield put(loadPresentFailure());
  }
}

function* loadJournalPage(page: number) {
  try {
    const result: VisitPage = yield call([visitControlApi, visitControlApi.getVisits], page);
    yield put(loadJournalSuccess(result));
  } catch (error) {
    logFailure(`journal page ${page}`, error);
    yield put(loadJournalFailure({ page }));
  }
}

function* loadJournalFirstPageSaga() {
  yield call(loadJournalPage, 0);
}

function* loadJournalMoreSaga() {
  const { page, last, status }: RootState['visits']['journal'] = yield select(
    (state: RootState) => state.visits.journal
  );
  if (last || status !== 'loaded') {
    return;
  }
  yield call(loadJournalPage, page + 1);
}

export function* watchVisits() {
  yield takeLatest(loadPresentStart.type, loadPresentSaga);
  yield takeLatest(loadJournalStart.type, loadJournalFirstPageSaga);
  // takeLeading: onEndReached срабатывает несколько раз подряд, следующая страница нужна одна
  yield takeLeading(loadJournalMore.type, loadJournalMoreSaga);
}
