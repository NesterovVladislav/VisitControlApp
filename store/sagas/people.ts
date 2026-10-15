import { PayloadAction } from '@reduxjs/toolkit';
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
  resetPersonPassword,
  resetPersonPasswordFinished,
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

export const PASSWORD_RESET_ERRORS = {
  forbidden: 'Сбросить пароль можно только пользователю с ролью ниже вашей.',
  notFound: 'Пользователь не найден. Обновите список.',
  inactive: 'Пользователь отключён, пароль ему не сбросить.',
  noEmail: 'У пользователя нет email, новый пароль некуда отправить.',
  network: 'Нет связи с сервером. Пароль не сброшен, попробуйте ещё раз.',
  generic: 'Не удалось сбросить пароль. Попробуйте ещё раз.',
};

/** Текст ошибки сброса; null — сообщение не нужно (401: приложение само выходит из аккаунта). */
export function toPasswordResetError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return PASSWORD_RESET_ERRORS.generic;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return PASSWORD_RESET_ERRORS.network;
  }
  switch (error.status) {
    case 401:
      return null;
    case 400:
      return PASSWORD_RESET_ERRORS.noEmail;
    case 403:
      return PASSWORD_RESET_ERRORS.forbidden;
    case 404:
      return PASSWORD_RESET_ERRORS.notFound;
    case 409:
      return PASSWORD_RESET_ERRORS.inactive;
    default:
      return PASSWORD_RESET_ERRORS.generic;
  }
}

export function* resetPasswordSaga(action: PayloadAction<string>) {
  const personId = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const sent: boolean = yield call([visitControlApi, visitControlApi.resetPassword], personId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(resetPersonPasswordFinished({ personId, status: sent ? 'sent' : 'notSent', message: null }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[People Saga] Password reset failed', error instanceof ApiError ? error.status : 'unknown');
    yield put(resetPersonPasswordFinished({ personId, status: 'failed', message: toPasswordResetError(error) }));
  }
}

export function* watchPeople() {
  // takeLatest: при быстром наборе в поиске нужен только ответ на последний запрос
  yield takeLatest(loadPeople.type, loadFirstPageSaga);
  // takeLeading: onEndReached срабатывает несколько раз подряд, следующая страница нужна одна
  yield takeLeading(loadMorePeople.type, loadMoreSaga);
  yield takeLeading(loadPeopleFilters.type, loadFiltersSaga);
  // takeLeading: повторное нажатие, пока идёт сброс, второе письмо не отправляет
  yield takeLeading(resetPersonPassword.type, resetPasswordSaga);
}
