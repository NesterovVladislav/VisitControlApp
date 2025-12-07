# Tech Context: VisitControlApp

## Технологический стек

### Основные технологии
- **Framework**: Expo SDK 54
- **UI**: React Native 0.81.5
- **React**: 19.1.0
- **Routing**: Expo Router 6.0.15
- **Navigation**: React Navigation 7.x

### Управление состоянием
- **Redux Toolkit** (`@reduxjs/toolkit`) - современный Redux с встроенными утилитами
- **React Redux** (`react-redux`) - связка React и Redux
- **Redux Saga** (`redux-saga`) - middleware для асинхронных операций и side effects

### Работа с API
- **Axios** (`axios`) - библиотека для HTTP-запросов
- Централизованная система API-клиентов в `/services/api`
- Поддержка множественных бэкендов с гибкой конфигурацией
- Обработка ошибок и логирование запросов

### Дополнительные библиотеки
- `expo-image` - работа с изображениями
- `expo-haptics` - тактильная обратная связь
- `expo-font` - пользовательские шрифты
- `react-native-reanimated` - анимации
- `react-native-gesture-handler` - обработка жестов
- `react-native-screens` - оптимизация навигации

### Инструменты разработки
- **TypeScript**: ~5.9.2
- **ESLint**: ^9.25.0 с конфигом expo

## Структура проекта
```
/app                 # Основные экраны (Expo Router)
  ├── _layout.tsx    # Корневой layout с Redux Provider
  └── index.tsx      # Главный экран
/store               # Redux store
  ├── index.ts       # Конфигурация store и типизированные хуки
  ├── actions/       # Action creators (если используются)
  ├── reducers/      # Reducers
  │   └── index.ts   # Корневой reducer
  ├── sagas/         # Redux Saga
  │   └── index.ts   # Корневая saga
  └── types/         # TypeScript типы для store
/services            # Сервисы и утилиты
  /api               # API клиенты
    ├── config.ts    # Конфигурация всех бэкендов
    ├── types.ts     # TypeScript типы для API
    ├── client.ts    # Базовый API-клиент
    ├── visit-control-api.ts  # Клиент для visitControlServer
    └── index.ts     # Экспорт всех утилит
  /errors            # Обработка ошибок
    ├── api-error.ts      # Класс ошибок API
    └── error-handler.ts  # Обработчик ошибок
/app-example         # Примеры компонентов (можно удалить)
```

## Настройка окружения
<!-- Опиши, как настроить проект локально -->

```bash
# Установка зависимостей
npm install

# Запуск проекта
npm start
```

## API и внешние сервисы

### Бэкенды

#### visitControlServer
- **URL**: `http://localhost:8080/api`
- **Описание**: Основной бэкенд для управления посещениями
- **Клиент**: `visitControlApi` из `services/api`

### Конфигурация бэкендов

Все бэкенды настраиваются в `services/api/config.ts`:
- Централизованное управление хостами, портами, протоколами
- Легкое добавление новых бэкендов
- Поддержка различных timeout и basePath для каждого бэкенда

## Ограничения и известные проблемы
<!-- Опиши технические ограничения -->
