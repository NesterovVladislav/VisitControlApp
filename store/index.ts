import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import rootReducer, { RootState } from './reducers';
import { rootSaga } from './sagas';

// Создаем middleware для redux-saga
const sagaMiddleware = createSagaMiddleware();

// Конфигурация store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Отключаем проверку сериализуемости для redux-saga
        ignoredActions: [],
      },
    }).concat(sagaMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Запускаем rootSaga
sagaMiddleware.run(rootSaga);

// Типизированные хуки для использования в компонентах
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
