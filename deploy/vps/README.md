# Biz Arena Generic VPS Profile

This folder contains the generic VPS deployment profile for Biz Arena Cloud Classroom.

Use this profile when Oracle Cloud is unavailable. It targets a normal Ubuntu/Oracle Linux/RHEL-like VPS with root access, Node.js 20+, nginx, systemd, WebSocket support, and SQLite persistence in `/var/lib/bizarena`.

## Required Runtime

```bash
NODE_ENV=production
PORT=3000
BIZ_ARENA_DEPLOYMENT=cloud
BIZ_ARENA_APP_MODE=server
BIZ_ARENA_STORAGE=sqlite
BIZ_ARENA_DATA_DIR=/var/lib/bizarena
BIZ_ARENA_SQLITE_PATH=/var/lib/bizarena/biz-arena.sqlite
BIZ_ARENA_PUBLIC_URL=https://YOUR-DOMAIN.example
BIZ_ARENA_ALLOW_REGISTRATION=true
```

After the first teacher account is created, set:

```bash
BIZ_ARENA_ALLOW_REGISTRATION=false
```

## One-Command VPS Install

After copying and extracting the VPS package on the server:

```bash
sudo bash deploy/vps/install-vps.sh https://YOUR-DOMAIN.example
```

For an IP-only trial before DNS is connected:

```bash
sudo bash deploy/vps/install-vps.sh http://YOUR-PUBLIC-IP
```

The script installs runtime packages when possible, copies the app to `/opt/bizarena`, writes `/etc/bizarena/bizarena.env`, installs the systemd service, configures nginx, and opens the local firewall when `ufw` or `firewalld` is active.

## Health Checks

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS https://YOUR-DOMAIN.example/api/health
curl -fsS https://YOUR-DOMAIN.example/api/meta
```

`/api/meta` must report `deployment: "cloud"`, `storage.backend: "sqlite"`, and no storage warning.

`/api/health` also reports uptime, memory, room/player counts, WebSocket connections, durable-storage status, and whether teacher registration remains open.

## Backup and Restore

`bizarena-backup.timer` creates a consistent SQLite backup every day and retains 14 days.

The runtime database also keeps a `previous` state row. An unreadable `main` payload is repaired automatically and logged as `storage-recovered`. If both payloads are invalid, startup fails with `storage-load-failed` instead of replacing classroom data with an empty database.

```bash
sudo systemctl start bizarena-backup.service
sudo journalctl -u bizarena-backup -n 20 --no-pager
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js status
```

Restore only while Biz Arena is stopped:

```bash
sudo systemctl stop bizarena
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js restore /var/lib/bizarena/backups/BACKUP.sqlite --force
sudo systemctl start bizarena
curl -fsS http://127.0.0.1:3000/api/health
```
