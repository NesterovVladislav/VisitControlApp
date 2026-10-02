import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth';
import registrationReducer from './registration';
import childrenReducer from './children';
import visitsReducer from './visits';
import requestsReducer from './requests';
import profileReducer from './profile';
import peopleReducer from './people';
import groupMembershipReducer from './group-membership';
import gardenReducer from './garden';
import groupPeopleReducer from './group-people';

// Здесь будут импортироваться и объединяться все reducers
const rootReducer = combineReducers({
  auth: authReducer,
  registration: registrationReducer,
  children: childrenReducer,
  visits: visitsReducer,
  requests: requestsReducer,
  profile: profileReducer,
  people: peopleReducer,
  groupMembership: groupMembershipReducer,
  garden: gardenReducer,
  groupPeople: groupPeopleReducer,
  // Пример: visits: visitsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
