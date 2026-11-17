# Локальный стенд PWA с бэкендом из JAR

Понадобятся Java 21, Docker, Node.js, npm, JAR `visit-control-service.jar` и PostgreSQL-бэкап в формате `pg_dump -Fc`. Для проверки почты ниже используется Python 3.11. Команды рассчитаны на запуск из корня `VisitControlApp` в Bash или Zsh.

На стенде PostgreSQL слушает `127.0.0.1:15437`, бэкенд — `127.0.0.1:18180`, PWA — `127.0.0.1:18181`, SMTP — `127.0.0.1:18125`. Для другого стенда согласованно замените порты и имя контейнера.

## 1. Восстановить копию базы

Укажите пути к своему JAR и копии бэкапа. Используйте отдельный контейнер и свежие локальные секреты.

```sh
export JAR="$HOME/Downloads/visit-control-service.jar"
export DUMP="/абсолютный/путь/к/database.dump"
umask 077
export STAND="$(mktemp -d "${TMPDIR:-/tmp}/dobrovhod-local.XXXXXX")"
printf 'Каталог стенда: %s\n' "$STAND"

openssl rand -hex 24 > "$STAND/db-password"
openssl rand -hex 48 > "$STAND/jwt-secret"
openssl rand -hex 14 > "$STAND/test-password"
printf 'POSTGRES_PASSWORD=%s\nPOSTGRES_DB=visit_local\n' \
  "$(cat "$STAND/db-password")" > "$STAND/postgres.env"

# Если рядом с дампом сохранён SHA256SUMS, сверить только database.dump.
(
  cd "$(dirname "$DUMP")" &&
  awk '$2=="database.dump" || $2=="*database.dump" {print}' SHA256SUMS |
    shasum -a 256 -c -
)
```

Продолжите после успешной сверки. Если для дампа нет контрольной суммы, возьмите её из источника бэкапа. Для бэкапа ДоброВхода от 12.11.2026 проверена версия `postgres:16-alpine`. Для нового бэкапа сверяйте версию с его метаданными.

```sh
docker run -d --name dobrovhod-jar-local-pg \
  -p 127.0.0.1:15437:5432 --env-file "$STAND/postgres.env" postgres:16-alpine

# Дождаться «accepting connections» перед восстановлением.
docker exec dobrovhod-jar-local-pg pg_isready -h 127.0.0.1 -U postgres -d visit_local

docker exec -i dobrovhod-jar-local-pg \
  pg_restore --exit-on-error --no-owner --no-privileges -U postgres -d visit_local \
  < "$DUMP" > "$STAND/restore.log" 2>&1
```

`pg_restore` читает исходный дамп, а Liquibase применяет миграции к копии. Файл `postgres-globals.sql` для такого запуска не нужен. Бэкап, восстановленная база и локальные логи могут содержать пользовательские данные. Храните их локально и используйте для теста синтетическую учётную запись.

## 2. Запустить почту и JAR

В отдельном терминале запустите локальный SMTP-приёмник. В новом терминале задайте `STAND` тем же значением. Приёмник складывает сообщения в локальный лог и не отправляет их наружу.

```sh
umask 077
python3.11 -u -m smtpd -n -c DebuggingServer 127.0.0.1:18125 \
  > "$STAND/mail.log" 2>&1
```

В терминале с `STAND` и `JAR` из первого шага запустите бэкенд. `env -i` убирает унаследованные переменные базы, почты и ключи выпуска. `VISIT_TEST_USER_*` создаёт синтетического `TECH_ADMIN` без привязки к саду. Используйте уникальный адрес домена `.test`.

```sh
(
  cd "$STAND" || exit 1
  umask 077
  env -i "PATH=$PATH" SERVER_ADDRESS=127.0.0.1 SERVER_PORT=18180 \
    POSTGRES_DB_HOST=127.0.0.1 POSTGRES_DB_PORT=15437 \
    POSTGRES_DB_NAME=visit_local POSTGRES_DB_USER=postgres \
    POSTGRES_DB_PASSWORD="$(cat db-password)" JWT_SECRET="$(cat jwt-secret)" \
    AUTH_USER_ENABLED=true MAIL_ENABLED=true MAIL_HOST=127.0.0.1 MAIL_PORT=18125 \
    MAIL_SSL=false MAIL_FROM=local@example.test \
    PASSWORD_RESET_REVOKE_TOKENS=true VISIT_TEST_USER_ENABLED=true \
    VISIT_TEST_USER_EMAIL=password-reset-local@example.test \
    VISIT_TEST_USER_PASSWORD="$(cat test-password)" VISIT_TEST_USER_ROLE=TECH_ADMIN \
    java -jar "$JAR" > backend.log 2>&1
)
```

После запуска `curl -fsS http://127.0.0.1:18180/actuator/health` должен вернуть `UP`. Если запуск не завершился, проверьте ошибку в приватном `backend.log` и результат восстановления. Флаг `PASSWORD_RESET_REVOKE_TOKENS=true` проверяет отзыв на этом локальном стенде. Для первого выпуска порядок включения описан в [плане восстановления пароля](superpowers/plans/2026-11-17-password-reset.md).

## 3. Собрать PWA и пройти сценарий

В корне репозитория:

```sh
npm ci
EXPO_NO_DOTENV=1 npm run build:web
API_TARGET=http://127.0.0.1:18180 PORT=18181 npm run serve:web
```

Откройте [локальную PWA](http://127.0.0.1:18181). Сборка ходит по относительному `/api`, а прокси убирает этот префикс перед передачей запроса локальному JAR. HTTP-стенд подходит для проверки форм и HTTP API. Service worker оболочка регистрирует при запуске по HTTPS.

1. Войдите синтетической учётной записью с паролем из приватного файла `test-password`. Оставьте сеанс открытым.
2. В другом профиле браузера откройте «Забыли пароль?» и запросите код для того же адреса. Возьмите код из локального SMTP-лога. Проверьте неверный код, затем введите верный и сохраните новый пароль. Должно прийти письмо о смене пароля.
3. Продолжите вход после сброса. В прежнем браузере откройте профиль, чтобы он обратился к API. Ожидается `401` и возврат на вход.
4. В новом сеансе смените пароль через профиль. Проверьте, что `PATCH /user/password` возвращает `access_token`, последующий запрос профиля проходит, а вход предыдущим паролем отклоняется.

Для остановки нажмите Ctrl+C в терминалах PWA, JAR и SMTP. PostgreSQL можно остановить командой `docker stop dobrovhod-jar-local-pg` и позже запустить `docker start dobrovhod-jar-local-pg`. Если копия базы больше не нужна, удалите именно этот тестовый контейнер командой `docker rm -v dobrovhod-jar-local-pg` после остановки. Каталог `STAND` содержит локальные секреты и письма, поэтому храните его в приватном месте или удалите после проверки.
