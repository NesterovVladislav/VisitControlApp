import { all, fork } from 'redux-saga/effects';
import { watchLogin } from './auth';
import { watchRegistration } from './registration';
import { watchChildren } from './children';
import { watchVisits } from './visits';
import { watchRequests } from './requests';

// Здесь будут импортироваться и объединяться все sagas
export function* rootSaga() {
  console.log('[Root Saga] Starting root saga');
  yield all([
    fork(watchLogin),
    fork(watchRegistration),
    fork(watchChildren),
    fork(watchVisits),
    fork(watchRequests),
    // Пример: fork(visitsSaga),
  ]);
  console.log('[Root Saga] Root saga started');
}
