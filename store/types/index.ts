import { RootState as RootStateType } from '../reducers';
import { rootSaga } from '../sagas';

// Реэкспорт типов для удобства
export type RootState = RootStateType;
export type RootSaga = typeof rootSaga;

// AppDispatch экспортируется из store/index.ts
