import { all, fork } from 'redux-saga/effects';
import { watchLogin } from './auth';

// Здесь будут импортироваться и объединяться все sagas
export function* rootSaga() {
  console.log('[Root Saga] Starting root saga');
  yield all([
    fork(watchLogin),
    // Пример: fork(visitsSaga),
  ]);
  console.log('[Root Saga] Root saga started');
}
