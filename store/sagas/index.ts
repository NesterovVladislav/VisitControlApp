import { all, fork } from 'redux-saga/effects';
import { watchLogin } from './auth';
import { watchRegistration } from './registration';
import { watchChildren } from './children';
import { watchChildRequests } from './child-requests';
import { watchVisits } from './visits';
import { watchVisitQueue } from './visit-queue';
import { watchRequests } from './requests';
import { watchProfile } from './profile';
import { watchPeople } from './people';
import { watchGroupMembership } from './group-membership';
import { watchGarden } from './garden';
import { watchGroupPeople } from './group-people';
import { watchOrganization } from './organization';
import { watchPhotos } from './photos';
import { watchChildLink } from './child-link';

// Здесь будут импортироваться и объединяться все sagas
export function* rootSaga() {
  console.log('[Root Saga] Starting root saga');
  yield all([
    fork(watchLogin),
    fork(watchRegistration),
    fork(watchChildren),
    fork(watchChildRequests),
    fork(watchVisits),
    fork(watchVisitQueue),
    fork(watchRequests),
    fork(watchProfile),
    fork(watchPeople),
    fork(watchGroupMembership),
    fork(watchGarden),
    fork(watchGroupPeople),
    fork(watchOrganization),
    fork(watchPhotos),
    fork(watchChildLink),
    // Пример: fork(visitsSaga),
  ]);
  console.log('[Root Saga] Root saga started');
}
