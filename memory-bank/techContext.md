# Tech Context: VisitControlApp

## Технологический стек

### Основные технологии
- **Framework**: Expo SDK 54
- **UI**: React Native 0.81.5
- **React**: 19.1.0
- **Routing**: Expo Router 6.0.15
- **Navigation**: React Navigation 7.x

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
  ├── _layout.tsx    # Корневой layout
  └── index.tsx      # Главный экран
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
<!-- Опиши используемые API и сервисы -->

## Ограничения и известные проблемы
<!-- Опиши технические ограничения -->
