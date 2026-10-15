import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import {
  linkCandidatesFailed,
  linkCandidatesLoaded,
  linkChild,
  linkChildFinished,
  openChildLink,
  searchLinkCandidates,
} from '../reducers/child-link';
import { loadPeople } from '../reducers/people';
import { ChildLinkState, LinkChildPayload } from '../types/child-link';
import { PeoplePage } from '../types/people';

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;
const selectChildLink = (state: RootState) => state.childLink;

/** Сколько детей показываем в поиске: дальше — уточнить запрос. */
export const CANDIDATES_PAGE_SIZE = 30;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

export const CHILD_LINK_ERRORS = {
  duplicate: 'Ребёнок уже привязан к этому человеку.',
  forbidden: 'Нет прав привязывать детей.',
  notFound: 'Ребёнок или взрослый не найден. Обновите список.',
  invalid: 'Этого человека нельзя привязать к ребёнку.',
  network: 'Нет связи с сервером. Ребёнок не привязан, попробуйте ещё раз.',
  generic: 'Не удалось привязать ребёнка. Попробуйте ещё раз.',
};

/** Текст ошибки привязки; null — сообщение не нужно (401: приложение само выходит из аккаунта). */
export function toChildLinkError(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return CHILD_LINK_ERRORS.generic;
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return CHILD_LINK_ERRORS.network;
  }
  switch (error.status) {
    case 401:
      return null;
    case 400:
      return CHILD_LINK_ERRORS.invalid;
    case 403:
      return CHILD_LINK_ERRORS.forbidden;
    case 404:
      return CHILD_LINK_ERRORS.notFound;
    case 409:
      return CHILD_LINK_ERRORS.duplicate;
    default:
      return CHILD_LINK_ERRORS.generic;
  }
}

export function* loadCandidatesSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { q, requestId }: ChildLinkState = yield select(selectChildLink);
  try {
    const page: PeoplePage = yield call(
      [visitControlApi, visitControlApi.getPeople],
      { category: 'CHILD', q, groupFilter: { kind: 'all' } },
      0,
      CANDIDATES_PAGE_SIZE
    );
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(linkCandidatesLoaded({ requestId, items: page.items }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Link Saga] Failed to load children', error instanceof ApiError ? error.status : 'unknown');
    yield put(linkCandidatesFailed({ requestId }));
  }
}

export function* linkChildSaga(action: PayloadAction<LinkChildPayload>) {
  const { child, linkRole } = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  const { adult }: ChildLinkState = yield select(selectChildLink);
  if (!adult) return;
  try {
    yield call([visitControlApi, visitControlApi.linkChild], child.id, adult.id, linkRole);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(linkChildFinished({ childId: child.id, status: 'linked', message: null }));
    // В строке родителя появится «мама: Мария»
    yield put(loadPeople({ refresh: true }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Child Link Saga] Link failed', error instanceof ApiError ? error.status : 'unknown');
    yield put(linkChildFinished({ childId: child.id, status: 'failed', message: toChildLinkError(error) }));
  }
}

export function* watchChildLink() {
  // takeLatest: при быстром наборе в поиске нужен только ответ на последний запрос
  yield takeLatest([openChildLink.type, searchLinkCandidates.type], loadCandidatesSaga);
  // takeLeading: повторное нажатие, пока идёт привязка, вторую связь не создаёт
  yield takeLeading(linkChild.type, linkChildSaga);
}
