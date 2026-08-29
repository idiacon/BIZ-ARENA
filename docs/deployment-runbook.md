# Развёртывание Biz Arena: VPS/VDS и Vercel

Biz Arena состоит из двух частей:

- stateful backend: Node.js, WebSocket и SQLite;
- статический браузерный интерфейс из папки `public`.

Для рабочего класса backend должен постоянно работать на VPS/VDS или выделенном сервере. Vercel используется только как дополнительный хостинг интерфейса и не заменяет backend.

## Вариант A — всё на одном VPS/VDS

Это основной и самый простой вариант.

### 1. Собрать пакет

На Windows в корне проекта:

```powershell
npm run release:vps-package
```

Готовый архив:

```text
dist/BizArena-VPS-1.0.0-beta.1.zip
```

### 2. Загрузить архив

```powershell
scp .\dist\BizArena-VPS-1.0.0-beta.1.zip root@SERVER-IP:/tmp/
```

### 3. Установить на сервер

На Ubuntu 22.04/24.04:

```bash
cd /tmp
unzip BizArena-VPS-1.0.0-beta.1.zip -d bizarena
cd bizarena
sudo bash deploy/vps/install-vps.sh http://SERVER-IP
```

Проверка:

```bash
systemctl status bizarena --no-pager
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://SERVER-IP/api/meta
```

После подключения домена установите HTTPS через nginx/Certbot, задайте `BIZ_ARENA_PUBLIC_URL=https://api.example.com` в `/etc/bizarena/bizarena.env` и перезапустите сервис.

### 4. Закрыть регистрацию преподавателей

После создания первого аккаунта:

```bash
sudo sed -i 's/^BIZ_ARENA_ALLOW_REGISTRATION=.*/BIZ_ARENA_ALLOW_REGISTRATION=false/' /etc/bizarena/bizarena.env
sudo systemctl restart bizarena
```

Страницы:

- преподаватель: `https://api.example.com/server`;
- ученик: `https://api.example.com/client`.

## Вариант B — backend на VPS, интерфейс на Vercel

Этот вариант имеет смысл, когда нужен отдельный публичный адрес интерфейса. Backend всё равно остаётся на VPS и должен иметь HTTPS.

### 1. Разрешить точный origin Vercel на backend

В `/etc/bizarena/bizarena.env`:

```bash
BIZ_ARENA_CORS_ORIGINS=https://YOUR-PROJECT.vercel.app
```

Для нескольких адресов:

```bash
BIZ_ARENA_CORS_ORIGINS=https://YOUR-PROJECT.vercel.app,https://play.example.com
```

Затем:

```bash
sudo systemctl restart bizarena
```

Разрешаются только явно перечисленные origin. Маска `*.vercel.app` намеренно не поддерживается.

### 2. Настроить Vercel

В настройках проекта Vercel добавьте переменную сборки:

```text
BIZ_ARENA_BACKEND_URL=https://api.example.com
```

URL обязан использовать HTTPS и указывать только origin, без `/api`, query и hash.

Репозиторий уже содержит:

- `vercel.json`;
- команду `npm run build:vercel`;
- output directory `dist/vercel-public`;
- маршруты `/server` и `/client`;
- runtime-настройку HTTP, QR и WebSocket на внешний backend.

Для preview-развёртывания через CLI:

```bash
vercel deploy -y
```

Страницы:

- преподаватель: `https://YOUR-PROJECT.vercel.app/server`;
- ученик: `https://YOUR-PROJECT.vercel.app/client`.

Если Vercel выдал новый preview-домен, добавьте его точный origin в `BIZ_ARENA_CORS_ORIGINS` и перезапустите backend.

## Проверка после развёртывания

```bash
curl -fsS https://api.example.com/api/health
curl -fsS https://api.example.com/api/meta
```

В браузере:

1. Откройте `/server` и войдите как преподаватель.
2. Создайте комнату.
3. Откройте `/client` на другом устройстве.
4. Выполните первый ход.
5. Обновите страницу ученика и проверьте reconnect.
6. Завершите тестовую сессию и проверьте экспорт.

## Что нельзя размещать только на Vercel

Не переносите в Vercel serverless:

- `server.js`;
- SQLite-файл;
- постоянный WebSocket-сервер;
- backup timer и восстановление хранилища.

Для них нужен VPS/VDS, выделенный сервер или другой хостинг с постоянным Node.js-процессом и файловым диском.
