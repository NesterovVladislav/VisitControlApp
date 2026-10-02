import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import {
  gardenEditFailed,
  gardenEditSucceeded,
  loadWithoutGroupCount,
  loadWithoutGroupCountSuccess,
  startGardenEdit,
} from '../reducers/garden';
import { GardenEdit, GardenEditError } from '../types/garden';
import { PeoplePage } from '../types/people';
import { refreshAfterGardenChange } from './garden-refresh';

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

/** Число детей без группы: страница из одного человека, нужен только totalElements. */
export function* loadWithoutGroupCountSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const page: PeoplePage = yield call(
      [visitControlApi, visitControlApi.getPeople],
      { category: 'CHILD', q: '', groupFilter: { kind: 'withoutGroup' } },
      0,
      1
    );
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadWithoutGroupCountSuccess(page.total));
  } catch (error) {
    // Карточка «Дети без группы» просто не покажется; повторим при следующем открытии вкладки
    console.warn('[Garden Saga] Failed to count children without group', error instanceof ApiError ? error.status : 'unknown');
  }
}

export function toGardenEditError(error: unknown): GardenEditError {
  if (!(error instanceof ApiError)) {
    return { kind: 'generic' };
  }
  if (error.isNetworkError || error.isTimeoutError) {
    return { kind: 'network' };
  }
  if (error.status === 404) {
    return { kind: 'gone' };
  }
  const code = error.data?.code;
  if (error.status === 409 && code === 'NAME_TAKEN') {
    return { kind: 'nameTaken' };
  }
  if (error.status === 409 && (code === 'BRANCH_NOT_EMPTY' || code === 'GROUP_NOT_EMPTY')) {
    const count = error.data?.groups_count ?? error.data?.children_count;
    return { kind: 'notEmpty', count: typeof count === 'number' ? count : null };
  }
  return { kind: 'generic' };
}

function* perform(edit: GardenEdit) {
  const api = visitControlApi;
  switch (edit.type) {
    case 'saveBranch': {
      const branch: { id: string } = edit.id
        ? yield call([api, api.renameBranch], edit.id, edit.name)
        : yield call([api, api.createBranch], edit.name);
      return edit.id ? null : branch.id;
    }
    case 'deleteBranch':
      yield call([api, api.deleteBranch], edit.id);
      return null;
    case 'saveGroup': {
      const group: { id: string } = edit.id
        ? yield call([api, api.updateGroup], edit.id, edit.name, edit.branchId)
        : yield call([api, api.createGroup], edit.name, edit.branchId);
      return edit.id ? null : group.id;
    }
    case 'deleteGroup':
      yield call([api, api.deleteGroup], edit.id);
      return null;
  }
}

export function* gardenEditSaga(action: PayloadAction<GardenEdit>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const createdId: string | null = yield* perform(action.payload);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield* refreshAfterGardenChange();
    yield put(gardenEditSucceeded({ createdId }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    console.warn('[Garden Saga] Edit failed', action.payload.type, error instanceof ApiError ? error.status : 'unknown');
    const editError = toGardenEditError(error);
    if (editError.kind === 'gone' || editError.kind === 'notEmpty') {
      // Данные на экране устарели: филиал удалили или в группу добавили детей
      yield* refreshAfterGardenChange();
    }
    yield put(gardenEditFailed(editError));
  }
}

export function* watchGarden() {
  yield takeLatest(loadWithoutGroupCount.type, loadWithoutGroupCountSaga);
  // takeLeading: двойное нажатие «Сохранить» не создаст две одинаковые группы
  yield takeLeading(startGardenEdit.type, gardenEditSaga);
}
