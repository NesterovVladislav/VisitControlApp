import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth';
import registrationReducer from './registration';
import childrenReducer from './children';

// Здесь будут импортироваться и объединяться все reducers
const rootReducer = combineReducers({
  auth: authReducer,
  registration: registrationReducer,
  children: childrenReducer,
  // Пример: visits: visitsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
