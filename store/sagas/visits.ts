import { call, put, race, select, take, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  loadJournalFailure,
  loadJournalMore,
  loadJournalStart,
  loadJournalSuccess,
  loadPresentFailure,
  presentAccessDenied,
  journalAccessDenied,
  loadPresentStart,
  loadPresentSuccess,
} from '../reducers/visits';
import { RootState } from '../reducers';
import { Presence, VisitPage } from '../types/visits';

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

function denied(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 401);
}

function logFailure(what: string, error: unknown) {
  console.warn(`[Visits Saga] Failed to load ${what}`, error instanceof ApiError ? error.status : error);
}

function* loadPresentSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const presence: Presence = yield call([visitControlApi, visitControlApi.getPresence]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadPresentSuccess(presence));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    logFailure('present children', error);
    yield put(denied(error) ? presentAccessDenied() : loadPresentFailure());
  }
}

const journalRevision = (state: RootState) => state.visits.journal.revision;

function* loadJournalPage(page: number) {
  const revision: number = yield select(journalRevision);
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const result: VisitPage = yield call([visitControlApi, visitControlApi.getVisits], page);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    const currentRevision: number = yield select(journalRevision);
    if (currentRevision === revision) yield put(loadJournalSuccess(result));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    logFailure(`journal page ${page}`, error);
    const currentRevision: number = yield select(journalRevision);
    if (currentRevision === revision) yield put(denied(error) ? journalAccessDenied() : loadJournalFailure({ page }));
  }
}

function* loadJournalFirstPageSaga() {
  yield call(loadJournalPage, 0);
}

function* loadJournalMoreSaga() {
  const { page, last, status, refreshing }: RootState['visits']['journal'] = yield select(
    (state: RootState) => state.visits.journal
  );
  if (last || refreshing || status !== 'loaded') {
    return;
  }
  // Освободить обработчик пагинации сразу при обновлении первой страницы.
  yield race({ nextPage: call(loadJournalPage, page + 1), refresh: take(loadJournalStart.type) });
}

export function* watchVisits() {
  yield takeLatest(loadPresentStart.type, loadPresentSaga);
  yield takeLatest(loadJournalStart.type, loadJournalFirstPageSaga);
  // takeLeading: onEndReached срабатывает несколько раз подряд, следующая страница нужна одна
  yield takeLeading(loadJournalMore.type, loadJournalMoreSaga);
}
