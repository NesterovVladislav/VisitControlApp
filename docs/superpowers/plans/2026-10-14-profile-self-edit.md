# Самостоятельное изменение профиля Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Рекомендуемый способ — исполнение в текущем чате одним исполнителем и независимое ревью всего изменения перед выпуском.

**Goal:** Дать пользователям МП и PWA возможность сразу сохранять свои ФИО, дату рождения, пол и телефон.

**Architecture:** Расширить существующие форму профиля и `PUT /user/me`. Адресат определяется только из токена; сохранённый ответ обновляет единственный `state.auth.user`. Серверное изменение совместимо с предыдущим клиентом и выпускается первым.

**Tech Stack:** React Native, Expo SDK 54, TypeScript, Redux Saga, Java 21, Spring Boot 3.5.14, WebFlux, JPA, Jest, JUnit, H2.

**Spec:** `docs/superpowers/specs/2026-10-14-profile-self-edit-design.md`

## Global Constraints

- Клиентская ветка — `codex/native-api-domain`; исходный продуктовый коммит — `c48a818d065ea06231cf5fed4e22322bb1877b1d`.
- Роли — `PARENT`, `EMPLOYEE`, `ADMIN`, `DIRECTOR`, `TECH_ADMIN`. Сохранение непосредственное, заявки нет.
- Поля — `surname`, `first_name`, `patronymic`, `birth_date`, `phone`, `gender`; email и поля прав аккаунта не изменяются.
- Возраст — от 16 до 100 лет; имя и фамилия обязательны, длина до 255; телефон необязателен, заполненный — `+7` и десять цифр.
- Отсутствующий `gender` старого клиента сохраняет прежний пол. Существующее значение `null` также не очищает пол на сервере; новый клиент требует выбор.
- Клиентский релиз — 1.0.3; локальный номер Android и iOS сборки — 4. Android package и сертификат сохраняются.
- Серверная база — точный снимок `/opt/visit-control/source`, подготовленный отдельно от незавершённой локальной копии.
- Проверки записи используют вымышленные аккаунты и отдельную H2-базу; реальные профили и производственные учётные данные не используются.
- Полные тесты, типизация, сборки и независимое ревью обязательны. Публикуется текущая клиентская ветка; объединение с master не входит в выпуск.

## Review Focus

- Пользователь без `USER_WRITE` сохраняет только себя; подложенные `external_key`, `role`, `organization`, `status`, `password` не меняют адресата или права — HTTP-проверка задачи 1.
- Пол действительно сохраняется после перечитывания из БД; тест с одним вызовом сеттера недостаточен — интеграционная проверка задачи 1.
- Старый клиент не передаёт пол, а собственный телефон остаётся прежним — проверка совместимости задачи 1.
- Возраст 15 и 101 год, невозможная дата и занятый телефон дают ошибку без частичного сохранения — задачи 1 и 2.
- Ответ после смены сессии и отсутствие ответа сервера не подменяют аккаунт и не создают ложного сообщения о несохранении — проверка saga задачи 2.

---

### Task 1: Серверное сохранение своего профиля

**Files:** Серверные пути ниже относительны к изолированной рабочей копии снимка.

- Modify: `src/main/java/ru/dobrocode/visit/control/controller/ProfileController.java`
- Modify: `src/main/java/ru/dobrocode/visit/control/dto/UpdateOwnProfileDto.java`
- Modify: `src/main/java/ru/dobrocode/visit/control/entity/UserEntity.java`
- Modify: `src/main/java/ru/dobrocode/visit/control/service/ProfileService.java`
- Modify: `src/main/java/ru/dobrocode/visit/control/service/impl/ProfileServiceImpl.java`
- Modify: `src/test/java/ru/dobrocode/visit/control/controller/AdminOnlyAccessTest.java`
- Modify: `src/test/java/ru/dobrocode/visit/control/service/impl/ProfileServiceImplTest.java`
- Create: `src/test/java/ru/dobrocode/visit/control/controller/ProfileSelfEditIntegrationTest.java`
- Create: `src/test/java/ru/dobrocode/visit/control/ProfilePreviewLauncher.java` — только тестовый запуск локальной PWA с вымышленными аккаунтами в H2.
- Create: `docs/own-profile.md`

**Interfaces:**

- Consumes: `ProfileService.updateOwnProfile(String email, UpdateOwnProfileDto update): UserDto`, существующие `UserRepository`, `UserMapper`, `Gender` и `ApiException`.
- Produces: прежний `PUT /user/me`, разрешённый авторизованному пользователю; дополнительное необязательное поле `gender: MALE | FEMALE`. Успех — `200 UserDto`; ошибки — `400 VALIDATION`, `409 PHONE_TAKEN`, `401` без действующей сессии.
- Test helper: `updateProfile(String email, Map<String, Object> body): WebTestClient.ResponseSpec` получает токен через настоящий `/token` для вымышленного аккаунта; `reloadUser(String email): UserEntity` читает новую запись после очистки persistence context.

- [ ] **Step 1:** Скопировать только исходный код, тесты, Maven wrapper, `pom.xml`, `checkstyle.xml`, Dockerfile и документацию действующего сервера в `deploy/profile-self-edit-2026-10-14/backend-baseline`; сохранить SHA256 каждого файла. Сделать отдельную рабочую копию `backend-source`; не переносить `.env`, базы, ключи, сборочные каталоги и файлы Git. Выполнить исходный `./mvnw -B -Djib.skip=true -Ddependency-check.skip=true test` и записать результат.
- [ ] **Step 2:** Добавить HTTP- и JPA-тесты для всех пяти ролей, анонимного запроса, подложенных полей аккаунта, старого тела без `gender`, своего и занятого телефона, возраста и сохранения пола. Минимальные ожидаемые результаты:

```java
updateProfile("parent@example.test", changedProfile).expectStatus().isOk();
assertThat(reloadUser("parent@example.test").getGender()).isEqualTo(Gender.MALE);
assertThat(reloadUser("other@example.test").getSurname()).isEqualTo("Другой");
assertThat(reloadUser("parent@example.test").getRole().getName()).isEqualTo("PARENT");
```

- [ ] **Step 3:** Запустить `./mvnw -B -Djib.skip=true -Dtest=ProfileSelfEditIntegrationTest,ProfileServiceImplTest test`. Убедиться, что новый сценарий родителя получает `403` и пол не сохраняется на прежнем коде.
- [ ] **Step 4:** Поменять защиту `updateMe` на `isAuthenticated()`, добавить `Gender gender` в DTO без обязательности для старых клиентов, снять `updatable = false` у `UserEntity.gender` и присваивать пол только при ненулевом значении. В `ProfileServiceImpl` до изменения сущности проверять возраст через `Period.between(birthDate, LocalDate.now()).getYears()`; ошибка — `ApiException(BAD_REQUEST, VALIDATION, ..., Map.of("errors", Map.of("birth_date", ...)))`. Сохранить определение пользователя по email токена и существующую проверку телефона. Удалить только `ProfileController#updateMe` из перечня административных операций в старом тесте.
- [ ] **Step 5:** Повторить точечные тесты, затем `./mvnw -B -Djib.skip=true -Ddependency-check.skip=true verify`. Проверить `Tests run`, `Failures: 0`, `Errors: 0` и `BUILD SUCCESS`.
- [ ] **Step 6:** Добавить тестовый `ProfilePreviewLauncher.main(String[] args)`: запускать приложение с тестовым classpath, профилем `test`, адресом `127.0.0.1:5221` и отдельной `jdbc:h2:mem:profile-preview` БД; создать вымышленные аккаунты пяти ролей. Раздавать только локальный стенд; код помощника не входит в основной JAR. Описать контракт в `docs/own-profile.md`; сохранить узкий серверный патч, исходный снимок и контрольные суммы.

### Task 2: Общая форма МП и PWA

**Files:**

- Modify: `app/profile/index.tsx`, `app/profile/edit.tsx`
- Modify: `utils/profile-edit.ts`, `utils/profile-edit.test.ts`
- Modify: `store/sagas/profile.ts`, `store/sagas/profile.test.ts`
- Modify: `services/api/visit-control-api.ts`, `services/api/visit-control-api.test.ts`
- Modify: `components/profile-edit-access.test.tsx`
- Create: `components/profile-edit-screen.test.tsx`
- Modify: `docs/profile-screen.md`

**Interfaces:**

- Consumes: контракт задачи 1, `SegmentedControl`, `saveProfileStart(ProfileUpdate)`, `userRefreshed(User)`.
- Produces: `ProfileEditForm.gender: 'MALE' | 'FEMALE' | null`, `ProfileUpdate.gender: 'MALE' | 'FEMALE'`, поле ошибок `gender`, прежние функции `formFromUser`, `isProfileChanged`, `validateProfileField`, `validateProfileForm`, `toProfileUpdate`, `serverFieldToProfileField` с поддержкой пола.

- [ ] **Step 1:** Изменить тест доступа: все пять ролей получают кнопку «Изменить», открывающую `/profile/edit`; подсказки про администратора нет. Добавить проверки начального пола, изменения только пола, обязательного выбора, тела запроса и ошибок поля. В тесте реальной формы проверить кнопку сохранения, отсутствие подтверждения, блокировку двойного нажатия и сохранение ввода при ошибке.

```typescript
expect(formFromUser(parent).gender).toBe('FEMALE');
expect(isProfileChanged({ ...initial, gender: 'MALE' }, initial)).toBe(true);
expect(toProfileUpdate({ ...initial, gender: 'MALE' }).gender).toBe('MALE');
expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
```

- [ ] **Step 2:** Запустить связанные Jest-файлы через `npm run test:ci -- utils/profile-edit.test.ts components/profile-edit-access.test.tsx components/profile-edit-screen.test.tsx`. Зафиксировать падение из-за недоступной кнопки и отсутствующего поля пола.
- [ ] **Step 3:** Показать кнопку «Изменить» всем ролям, убрать подсказку про администратора, добавить в форму существующий `SegmentedControl` с «Женский»/«Мужской». Включить пол во все проверки и сравнение формы. Для подтверждённого выбора отправлять `gender` через прежний API; сообщения о доступе больше не должны ссылаться на роль администратора.
- [ ] **Step 4:** В saga сохранить обновление `state.auth.user` только при совпадающем `sessionEpoch`. Для сетевого отсутствия ответа использовать сообщение: «Не удалось получить ответ сервера. Изменения могли сохраниться — проверьте соединение и обновите профиль». Добавить проверку запоздалого ответа сохранения; включить её вместе с существующими проверками общего обновления имени и ошибок сервера. HTTP-запись не повторять автоматически.
- [ ] **Step 5:** Обновить документацию профиля: непосредственное редактирование всеми ролями, поля и ошибки; удалить противоречащий раздел про заявки. Выполнить `npm run test:ci`, `npm run typecheck`, `git diff --check`; проверить полный зелёный результат и сохранить клиентский коммит.

### Task 3: Проверка и выпуск 1.0.3

**Files:**

- Modify: `app.json`, `package.json`, `package-lock.json`
- Create: `deploy/profile-self-edit-2026-10-14/` вне Git клиента — стенд, патч сервера, сборки, журналы проверок, данные релиза и отката.

**Interfaces:**

- Consumes: сервер задачи 1 и клиент задачи 2; проверенный серверный JAR, APK, `dist/` PWA и SHA256 файлов.
- Produces: опубликованный `codex/native-api-domain`, сервер с новым поведением, PWA 1.0.3 и APK 1.0.3 (4), проверяемый отчёт приёмки.

- [ ] **Step 1:** Синхронизировать версию 1.0.3 в package/lock/app.json, Android `versionCode: 4`, iOS `buildNumber: "4"`. Выполнить `npm run build:web`, Android prebuild и release-сборку arm64; проверить версию и сертификат в APK.
- [ ] **Step 2:** Поднять локальный сервер задачей 1 с H2 и прокси PWA `127.0.0.1:5223`, направляющий `/api/*` только на `127.0.0.1:5221` со снятием префикса `/api`. Через браузер открыть настоящую форму, изменить данные, сохранить и перечитать профиль. Проверить родителя и сотрудника, изменение пола, обе темы, 320/375/1440 px, сохранение ввода при ошибке и клавиатуру; сохранить скриншоты и результаты.
- [ ] **Step 3:** Запросить независимое read-only ревью точного клиентского коммита и точного серверного патча относительно сохранённой базы. Исправить подтверждённые замечания до выпуска; после изменения повторить затронутые проверки.
- [ ] **Step 4:** Сверить SHA256 серверной базы перед выкладкой. Собрать совместимый серверный образ, сохранить предыдущие образ и исходный код, заменить только backend-сервис с существующими настройками и дождаться `health: UP`; выполнить анонимные проверки защиты. При неуспехе вернуть предыдущий образ.
- [ ] **Step 5:** Опубликовать клиентскую ветку без force push. Выложить PWA через существующие каталог релизов и атомарное переключение `current`, сохранив предыдущий релиз; сверить опубликованные файлы, API health, админку, логотип регистрации и политики кэширования. При неуспехе вернуть предыдущий PWA-релиз.
- [ ] **Step 6:** Проверить финальные HEAD и чистоту клиентской ветки, остановить локальный стенд, закрыть временные вкладки и передать ссылки на PWA, APK и отчёт. Отдельно отметить фактически не выполненные проверки на физических устройствах и сборку iOS.
