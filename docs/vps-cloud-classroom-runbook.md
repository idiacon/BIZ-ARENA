# Biz Arena VPS Cloud Classroom Runbook

Use this path when Oracle Cloud is unavailable. The VPS target keeps the same architecture as the Oracle profile: one long-running Node.js server, WebSocket updates, nginx reverse proxy, systemd restart, and SQLite persistence in `/var/lib/bizarena`.

## Recommended VPS

Minimum for a classroom beta:

```text
1 vCPU
1-2 GB RAM
10+ GB SSD/NVMe
Ubuntu 22.04/24.04
Public IPv4
Open TCP 22, 80, 443
```

The app can run on small VPS plans because the classroom workload is modest and SQLite is local.

## Deploy

Copy the `BizArena-VPS-<version>.zip` package to the server, extract it, then run:

```bash
sudo bash deploy/vps/install-vps.sh http://YOUR-PUBLIC-IP
```

After DNS is connected:

```bash
sudo bash deploy/vps/install-vps.sh https://YOUR-DOMAIN.example
```

## Teacher Registration Lock

Leave registration open only while creating the first teacher account:

```bash
sudo sed -i 's/^BIZ_ARENA_ALLOW_REGISTRATION=.*/BIZ_ARENA_ALLOW_REGISTRATION=false/' /etc/bizarena/bizarena.env
sudo systemctl restart bizarena
```

## Health Checks

```bash
systemctl status bizarena --no-pager
journalctl -u bizarena -n 80 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://YOUR-PUBLIC-IP/api/health
curl -fsS http://YOUR-PUBLIC-IP/api/meta
```

`/api/meta` must show:

```json
{
  "deployment": "cloud",
  "storage": {
    "backend": "sqlite"
  }
}
```

There should be no durable storage warning.

## Backup And Recovery

The VPS package installs `bizarena-backup.timer`. It creates one consistent SQLite backup per day and retains 14 days.

Biz Arena also keeps the previous valid runtime payload inside the active SQLite file. If `main` cannot be parsed, startup repairs it from `previous` and writes a `storage-recovered` JSON event to journald. This local fallback does not replace daily backups.

If neither runtime payload is valid, startup fails closed instead of creating an empty classroom database. Inspect and restore while the service is stopped:

```bash
sudo systemctl stop bizarena
journalctl -u bizarena -n 80 --no-pager
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js status
sudo -u bizarena node /opt/bizarena/scripts/admin-storage.js restore /var/lib/bizarena/backups/BACKUP.sqlite --force
sudo systemctl start bizarena
curl -fsS http://127.0.0.1:3000/api/health
```

## Provider Notes

- Use VPS/VDS, not shared hosting. Shared hosting commonly cannot run a long-lived Node.js service.
- Provider firewall panels must allow TCP `80` and `443`.
- If HTTPS is required, add a domain and install Certbot after the IP-only smoke passes.
- If this VPS path works, it becomes the practical production path; Oracle remains optional, not required.
