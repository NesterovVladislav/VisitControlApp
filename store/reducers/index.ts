import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth';

// Здесь будут импортироваться и объединяться все reducers
const rootReducer = combineReducers({
  auth: authReducer,
  // Пример: visits: visitsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
