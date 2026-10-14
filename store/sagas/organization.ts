import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { loadOrganizationBrand, saveOrganizationBrand } from '../../services/organization/organization-brand';
import { RootState } from '../reducers';
import { bootstrapSession, validationSucceeded } from '../reducers/auth';
import { brandLoaded } from '../reducers/organization';
import { User } from '../types/auth';
import { OrganizationBrand } from '../types/organization';

const selectSessionEpoch = (state: RootState) => state.auth.sessionEpoch;
const selectBrand = (state: RootState) => state.organization.brand;

/**
 * Запуск приложения: сад последнего входа — для логотипа на экране входа и чтобы шапка не мигала заглушкой,
 * пока сервер отвечает.
 */
export function* restoreBrandSaga() {
  const remembered: OrganizationBrand | null = yield call(loadOrganizationBrand);
  const current: OrganizationBrand | null = yield select(selectBrand);
  if (remembered && !current) {
    yield put(brandLoaded(remembered));
  }
}

/**
 * Вход и разблокировка: логотип сада пользователя. У технического администратора сада нет.
 * Не удалось загрузить — в шапке остаётся заглушка с буквой, спросим при следующем входе.
 */
export function* loadBrandSaga(action: PayloadAction<User>) {
  if (!action.payload.organization) return;
  const sessionEpoch: number = yield select(selectSessionEpoch);
  try {
    const brand: OrganizationBrand = yield call([visitControlApi, visitControlApi.getOrganizationBrand]);
    const currentEpoch: number = yield select(selectSessionEpoch);
    if (currentEpoch !== sessionEpoch) return;
    yield put(brandLoaded(brand));
    yield call(saveOrganizationBrand, brand);
  } catch (error) {
    console.warn('[Organization Saga] Failed to load organization', error instanceof ApiError ? error.status : error);
  }
}

export function* watchOrganization() {
  yield takeLeading(bootstrapSession.type, restoreBrandSaga);
  yield takeLatest(validationSucceeded.type, loadBrandSaga);
}
