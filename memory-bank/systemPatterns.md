# System Patterns: VisitControlApp

## Архитектурные паттерны

### Навигация
- Используется **Expo Router** (file-based routing)
- Файловая структура в `/app` определяет маршруты

### Структура компонентов
<!-- Опиши паттерны организации компонентов -->

### Управление состоянием
<!-- Опиши подход к state management -->

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
