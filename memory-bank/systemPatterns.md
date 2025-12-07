# System Patterns: VisitControlApp

## Архитектурные паттерны

### Навигация
- Используется **Expo Router** (file-based routing)
- Файловая структура в `/app` определяет маршруты

### Структура компонентов
<!-- Опиши паттерны организации компонентов -->

### Управление состоянием
- Используется **Redux Toolkit** для управления глобальным состоянием
- **Redux Saga** для асинхронных операций и side effects
- Структура store организована по типам файлов:
  - `reducers/` - все reducers объединяются в корневом reducer
  - `sagas/` - все sagas объединяются в корневой saga
  - `actions/` - action creators (при необходимости)
  - `types/` - TypeScript типы для store

#### Использование в компонентах
```tsx
import { useAppDispatch, useAppSelector } from '@/store';

export default function Component() {
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.someSlice.data);

  // Использование dispatch и selector
}
```

#### Создание нового слайса с saga
1. Создать reducer в `store/reducers/` (или использовать `createSlice`)
2. Добавить reducer в `store/reducers/index.ts`
3. Создать saga в `store/sagas/`
4. Добавить saga в `store/sagas/index.ts`

### Работа с API

#### Структура API клиентов
- Централизованная конфигурация в `services/api/config.ts`
- Базовый клиент с interceptors в `services/api/client.ts`
- Специализированные клиенты для каждого бэкенда
- Единообразная обработка ошибок через `ApiError`

#### Использование API клиентов в Redux Saga
```tsx
import { call, put, takeLatest } from 'redux-saga/effects';
import { visitControlApi } from '@/services/api';
import { ApiError } from '@/services/errors/api-error';

function* fetchDataSaga(action) {
  try {
    const data = yield call(visitControlApi.get, '/endpoint');
    yield put({ type: 'FETCH_SUCCESS', payload: data });
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', error.getErrorMessage());
      yield put({ type: 'FETCH_FAILURE', payload: error.message });
    }
  }
}
```

#### Добавление нового бэкенда
1. Добавить конфигурацию в `services/api/config.ts`:
```tsx
export const BACKENDS: Record<string, BackendConfig> = {
  // ... существующие бэкенды
  newBackend: {
    host: 'api.example.com',
    port: 443,
    protocol: 'https',
    basePath: '/v1',
    timeout: 15000,
  },
};
```

2. Создать специализированный клиент (опционально):
```tsx
import { createApiClient } from './client';

class NewBackendApiClient {
  private client = createApiClient('newBackend');
  // ... методы клиента
}

export const newBackendApi = new NewBackendApiClient();
```

#### Обработка ошибок API
- Все ошибки автоматически преобразуются в `ApiError`
- Логирование ошибок в консоль (в режиме разработки)
- Методы для проверки типа ошибки: `isNetworkError()`, `isUnauthorizedError()`, и т.д.

### Стилизация
<!-- Опиши подход к стилям -->
- Inline styles (по умолчанию)

## Соглашения по коду

### Именование файлов
- Компоненты: `kebab-case.tsx` (например, `themed-text.tsx`)
- Хуки: `use-*.ts` (например, `use-color-scheme.ts`)

### Структура компонента
```tsx
import { View, Text } from "react-native";

export default function ComponentName() {
  return (
    <View>
      <Text>Content</Text>
    </View>
  );
}
```

## Паттерны для будущего использования
<!-- Добавляй сюда паттерны по мере развития проекта -->
