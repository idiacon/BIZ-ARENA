# Biz Arena Oracle VM Profile

This folder contains the durable Oracle VM deployment profile for Biz Arena Cloud Classroom.

Use this profile when the class needs a public URL, WebSocket support, and restart-safe rooms without relying on LAN.

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

## Health Checks

```bash
curl -fsS https://YOUR-DOMAIN.example/api/health
curl -fsS https://YOUR-DOMAIN.example/api/meta
```

`/api/meta` must report `deployment: "cloud"`, `storage.backend: "sqlite"`, and no storage warning.

## Fallback

If the public URL is down, run Local Classroom from the teacher PC and use `/server` to share the LAN `/client` link or QR.

## One-Command VM Install

After copying and extracting the Oracle package on the VM:

```bash
sudo bash deploy/oracle/install-oracle-vm.sh https://YOUR-DOMAIN.example
```

For an IP-only trial before a domain is connected:

```bash
sudo bash deploy/oracle/install-oracle-vm.sh http://YOUR-PUBLIC-IP
```

The script installs runtime packages, copies the app to `/opt/bizarena`, writes `/etc/bizarena/bizarena.env`, installs the systemd service, configures nginx, and opens the local VM firewall when `ufw` or `firewalld` is active. You still need to open TCP `80` and `443` in the Oracle Cloud Console subnet security list or NSG.
