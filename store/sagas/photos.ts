import { PayloadAction } from '@reduxjs/toolkit';
import { Image } from 'expo-image';
import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { RootState } from '../reducers';
import { logoutCompleted } from '../reducers/auth';
import { loadOwnChildren } from '../reducers/child-requests';
import { loadChildrenStart } from '../reducers/children';
import {
  approvePhotoRequestStart,
  cancelPhotoRequestFinished,
  cancelPhotoRequestStart,
  decidePhotoRequestFinished,
  deletePhotoStart,
  loadOwnPhotoRequests,
  loadOwnPhotoRequestsSuccess,
  loadPendingPhotoRequests,
  loadPendingPhotoRequestsSuccess,
  photoFinished,
  rejectPhotoRequestStart,
  submitPhotoStart,
} from '../reducers/photos';
import { refreshProfile } from '../reducers/profile';
import { PhotoRequest, PhotoTarget } from '../types/photos';

export const PHOTO_MESSAGES = {
  pending: 'Фотография уже отправлена и ждёт подтверждения сада. Чтобы заменить её, сначала отзовите заявку',
  invalid: 'Эта фотография не подходит. Выберите другой снимок',
  notParent: 'Менять фотографию ребёнка может только его родитель',
  gone: 'Ребёнок не найден: возможно, его уже удалили из сада',
  alreadyDecided: 'Заявку уже рассмотрели',
  network: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз',
  generic: 'Не получилось. Попробуйте позже',
} as const;

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;

function* isCurrentSession(expectedEpoch: number) {
  const currentEpoch: number = yield select(selectSessionEpoch);
  return currentEpoch === expectedEpoch;
}

export function photoErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return PHOTO_MESSAGES.generic;
  if (error.isNetworkError || error.isTimeoutError) return PHOTO_MESSAGES.network;
  const code = String(error.data?.code ?? '');
  if (code === 'PHOTO_CHANGE_PENDING') return PHOTO_MESSAGES.pending;
  if (code === 'INVALID_PHOTO') return PHOTO_MESSAGES.invalid;
  if (code === 'ALREADY_PROCESSED') return PHOTO_MESSAGES.alreadyDecided;
  if (error.status === 403) return PHOTO_MESSAGES.notParent;
  if (error.status === 404) return PHOTO_MESSAGES.gone;
  return PHOTO_MESSAGES.generic;
}

/** После замены или удаления фотографии: свежие ссылки в профиле и в списках своих детей. */
function* refreshOwner(target: PhotoTarget) {
  if (target.childId) {
    yield put(loadOwnChildren());
    yield put(loadChildrenStart({ refresh: true }));
  } else {
    yield put(refreshProfile());
  }
  yield put(loadOwnPhotoRequests());
}

function* loadOwnSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const requests: PhotoRequest[] = yield call([visitControlApi, visitControlApi.getMyPhotoRequests]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadOwnPhotoRequestsSuccess(requests));
  } catch (error) {
    // Бэкенд без фотографий отвечает 404: раздел просто остаётся без заявок
    console.warn('[Photos Saga] Failed to load own requests', error instanceof ApiError ? error.status : error);
  }
}

export function* submitPhotoSaga(action: PayloadAction<PhotoTarget & { uri: string }>) {
  const { uri, ...target } = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.submitPhoto], uri, target.childId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(photoFinished({ userId: target.userId }));
    yield call(refreshOwner, target);
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(photoFinished({ userId: target.userId, error: photoErrorMessage(error) }));
  }
}

export function* deletePhotoSaga(action: PayloadAction<PhotoTarget>) {
  const target = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.deleteMyPhoto], target.childId);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(photoFinished({ userId: target.userId }));
    yield call(refreshOwner, target);
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(photoFinished({ userId: target.userId, error: photoErrorMessage(error) }));
  }
}

function* cancelSaga(action: PayloadAction<string>) {
  const id = action.payload;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call([visitControlApi, visitControlApi.cancelMyPhotoRequest], id);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(cancelPhotoRequestFinished({ id }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(cancelPhotoRequestFinished({ id, error: photoErrorMessage(error) }));
    // Заявку могли уже решить: показываем, что с ней стало
    yield put(loadOwnPhotoRequests());
  }
}

function* loadPendingSaga() {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const requests: PhotoRequest[] = yield call([visitControlApi, visitControlApi.getPhotoRequests]);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(loadPendingPhotoRequestsSuccess(requests));
  } catch (error) {
    console.warn('[Photos Saga] Failed to load pending requests', error instanceof ApiError ? error.status : error);
  }
}

function* decide(id: string, request: () => Promise<void>) {
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    yield call(request);
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    yield put(decidePhotoRequestFinished({ id }));
  } catch (error) {
    if (!(yield* isCurrentSession(sessionEpoch))) return;
    const decided = error instanceof ApiError && (error.status === 409 || error.status === 404);
    // Нет связи — заявка остаётся в списке, её можно решить ещё раз
    yield put(decidePhotoRequestFinished({ id, error: photoErrorMessage(error), keep: !decided }));
  }
}

function* approveSaga(action: PayloadAction<string>) {
  const id = action.payload;
  yield call(decide, id, () => visitControlApi.approvePhotoRequest(id));
}

function* rejectSaga(action: PayloadAction<{ id: string; comment: string }>) {
  const { id, comment } = action.payload;
  yield call(decide, id, () => visitControlApi.rejectPhotoRequest(id, comment));
}

/**
 * Выход из аккаунта: фотографии с устройства удаляются. На общем телефоне следующий пользователь
 * не должен увидеть чужие лица из кэша.
 */
function* clearPhotoCacheSaga() {
  try {
    yield call([Image, Image.clearMemoryCache]);
    yield call([Image, Image.clearDiskCache]);
  } catch (error) {
    console.warn('[Photos Saga] Failed to clear image cache', error instanceof Error ? error.message : 'unknown');
  }
}

export function* watchPhotos() {
  yield takeLatest(loadOwnPhotoRequests.type, loadOwnSaga);
  yield takeEvery(submitPhotoStart.type, submitPhotoSaga);
  yield takeEvery(deletePhotoStart.type, deletePhotoSaga);
  yield takeEvery(cancelPhotoRequestStart.type, cancelSaga);
  yield takeLatest(loadPendingPhotoRequests.type, loadPendingSaga);
  yield takeEvery(approvePhotoRequestStart.type, approveSaga);
  yield takeEvery(rejectPhotoRequestStart.type, rejectSaga);
  yield takeEvery(logoutCompleted.type, clearPhotoCacheSaga);
}
