# Welcome to your Expo app 👋

## ДоброВход: адрес API и сборки

Нативные Android/iOS-клиенты используют `https://core.dobrovhod.ru/api`.
Этот адрес задан для `preview` и `production` в `eas.json`, а также используется
по умолчанию в Expo Go. Локальные `.env` могут переопределять адрес: если после
переключения ветки Expo Go продолжает обращаться к старому серверу, проверьте
`EXPO_PUBLIC_API_URL` и полностью перезагрузите приложение.

PWA собирается отдельно командой `npm run build:web` с относительным `/api`:
на опубликованном `https://app.dobrovhod.ru` API обслуживает тот же домен.
Относительный `/api` не следует передавать нативной сборке.

Профиль `preview` выпускает APK для внутреннего распространения; `production`
сохраняет штатный формат публикации EAS. Обычные сборки больше не включают
`EXPO_PUBLIC_ALLOW_INSECURE_HTTP`: разрешение HTTP требуется только для явно
отмеченного локального стенда. Значение переменной в окружении EAS тоже должно
отсутствовать или отличаться от `1`.

Для локального APK (нужны JDK, Android SDK/NDK и установленные зависимости):

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://core.dobrovhod.ru/api npx expo prebuild --platform android --no-install
cd android
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=https://core.dobrovhod.ru/api ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Результат: `android/app/build/outputs/apk/release/app-release.apk`.
Этот вариант для современных ARM64-устройств. Для других архитектур изменить
`reactNativeArchitectures`. Локальный APK использует тестовую подпись шаблона
Expo; подпись релиза для магазина выбирается отдельно через EAS/keystore.
Перед установкой поверх прежнего APK нужно сравнить их сертификаты подписи.

Версия локальной сборки — `1.0.1`, Android `versionCode=2`; EAS с
`appVersionSource=remote` управляет Android-кодом версии на своей стороне.

Смена DNS сама по себе не обновляет установленный APK. Для перехода на новый
адрес нужно установить новую сборку. Нужна проверка входа, восстановления
сессии, фотографий и QR на реальном телефоне.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
