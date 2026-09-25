import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import createSagaMiddleware from 'redux-saga';

import { setUnauthorizedHandler } from '../services/auth/auth-token';
import { sanitizeReduxAction, sanitizeReduxState } from './devtools';
import rootReducer, { RootState } from './reducers';
import { bootstrapSession, sessionExpired } from './reducers/auth';
import { rootSaga } from './sagas';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [],
      },
    }).concat(sagaMiddleware),
  devTools: process.env.NODE_ENV !== 'production'
    ? {
        actionSanitizer: sanitizeReduxAction,
        stateSanitizer: sanitizeReduxState,
      }
    : false,
});

sagaMiddleware.run(rootSaga);

setUnauthorizedHandler(() => {
  store.dispatch(sessionExpired());
});

store.dispatch(bootstrapSession());

export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
