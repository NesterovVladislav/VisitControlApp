import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth';
import registrationReducer from './registration';
import childrenReducer from './children';
import childRequestsReducer from './child-requests';
import visitsReducer from './visits';
import visitQueueReducer from './visit-queue';
import requestsReducer from './requests';
import profileReducer from './profile';
import peopleReducer from './people';
import groupMembershipReducer from './group-membership';
import gardenReducer from './garden';
import groupPeopleReducer from './group-people';
import organizationReducer from './organization';
import photosReducer from './photos';
import childLinkReducer from './child-link';

// Здесь будут импортироваться и объединяться все reducers
const rootReducer = combineReducers({
  auth: authReducer,
  registration: registrationReducer,
  children: childrenReducer,
  childRequests: childRequestsReducer,
  visits: visitsReducer,
  visitQueue: visitQueueReducer,
  requests: requestsReducer,
  profile: profileReducer,
  people: peopleReducer,
  groupMembership: groupMembershipReducer,
  garden: gardenReducer,
  groupPeople: groupPeopleReducer,
  organization: organizationReducer,
  photos: photosReducer,
  childLink: childLinkReducer,
  // Пример: visits: visitsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
