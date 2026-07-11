# Biz Arena: передача сервера КАИ

Цель: развернуть Biz Arena v1.0 Beta как Cloud Classroom на внутреннем Linux-сервере КАИ или обычном VPS.

## Требования

- Ubuntu 22.04/24.04 или совместимый Linux;
- Node.js 20+;
- 1-2 vCPU, 2 GB RAM, 10 GB SSD;
- доступ по SSH;
- TCP 80/443 доступны из учебной сети;
- домен и HTTPS желательны для внешнего доступа.

## Установка

Используйте архив `BizArena-VPS-<version>.zip` из KAI Server package.

```bash
unzip BizArena-VPS-<version>.zip
cd BizArena-VPS-<version>
sudo bash deploy/vps/install-vps.sh https://YOUR-DOMAIN.example
```

Установщик создаёт пользователя `bizarena`, приложение `/opt/bizarena`, SQLite-хранилище `/var/lib/bizarena`, nginx, systemd service и ежедневный backup timer.

## Первичная проверка

```bash
systemctl status bizarena --no-pager
journalctl -u bizarena -n 80 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://YOUR-DOMAIN.example/api/health
curl -fsS https://YOUR-DOMAIN.example/api/meta
```

Ожидается:

- `ok: true` и `status: healthy`;
- `deployment: cloud`;
- `storage.backend: sqlite`;
- `diagnostics.storage.durable: true`;
- нет `diagnostics.storage.warning`;
- видны uptime, память, количество комнат, игроков и WebSocket-соединений.

## Закрытие регистрации

После создания первого аккаунта преподавателя обязательно выполните:

```bash
sudo sed -i 's/^BIZ_ARENA_ALLOW_REGISTRATION=.*/BIZ_ARENA_ALLOW_REGISTRATION=false/' /etc/bizarena/bizarena.env
sudo systemctl restart bizarena
curl -fsS http://127.0.0.1:3000/api/health
```

В health должно быть `teacherRegistrationOpen: false`.

## Резервные копии

Автоматический backup запускается ежедневно в 03:15, хранение 14 дней:

```bash
systemctl status bizarena-backup.timer --no-pager
sudo systemctl start bizarena-backup.service
journalctl -u bizarena-backup -n 20 --no-pager
ls -lh /var/lib/bizarena/backups
```

Проверить текущую базу или конкретную копию:

```bash
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js status
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js status /var/lib/bizarena/backups/BACKUP.sqlite
```

## Восстановление

При каждом сохранении Biz Arena держит внутри SQLite предыдущий валидный runtime payload. Если текущий payload поврежден, сервер автоматически восстанавливает его из `previous` и пишет событие `storage-recovered`.

Если обе runtime-копии не читаются, сервер не запускается с пустой базой и пишет `storage-load-failed`. В этом случае сначала остановите restart loop и проверьте журнал:

```bash
sudo systemctl stop bizarena
journalctl -u bizarena -n 80 --no-pager
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js status
```

Restore из ежедневного backup выполняется только при остановленном сервере. Скрипт проверяет SQLite integrity и сохраняет предыдущую базу рядом с рабочей.

```bash
sudo systemctl stop bizarena
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js restore /var/lib/bizarena/backups/BACKUP.sqlite --force
sudo systemctl start bizarena
curl -fsS http://127.0.0.1:3000/api/health
```

## Логи и диагностика

```bash
journalctl -u bizarena -f
journalctl -u bizarena --since "1 hour ago" --no-pager
journalctl -u bizarena -p warning --since today --no-pager
```

Сервер пишет JSON-события `server-started`, `server-stopping`, `request-error`, `slow-request`, `storage-recovered` и `storage-load-failed`. Токены и пароли в лог не записываются.

## Ссылки

- преподаватель: `https://YOUR-DOMAIN.example/server`;
- ученики: `https://YOUR-DOMAIN.example/client`;
- проверка: `https://YOUR-DOMAIN.example/api/health`.

## Fallback занятия

Если сервер недоступен, преподаватель запускает `BizArena Server.exe`, открывает `/server`, показывает LAN QR/ссылку `/client`. При блокировке LAN используется отдельный роутер или точка доступа.
