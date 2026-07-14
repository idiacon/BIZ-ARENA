# Biz Arena v0.7 Cloud Hosting Runbook

## VPS Durable Profile

Use a normal VPS as the practical durable Cloud Classroom target when Oracle Cloud is unavailable. This is now the easiest path for countries where Oracle registration or Always Free capacity is blocked.

Build the package locally:

```powershell
npm run smoke:vps
npm run release:vps-package
```

On the VPS, extract the package and run:

```bash
sudo bash deploy/vps/install-vps.sh http://YOUR-PUBLIC-IP
```

After DNS is connected:

```bash
sudo bash deploy/vps/install-vps.sh https://YOUR-DOMAIN.example
```

See `docs/vps-cloud-classroom-runbook.md` for the full VPS path.

## Oracle VM Optional Archive

Use Oracle VM only where Oracle Cloud is available. For the current KAI/VPS beta path, this section is archive/reference material: the same long-running Node.js server, WebSocket support, and SQLite persistence model apply, but the release-facing package is `release:vps-package` or `release:kai-server-package`.

Recommended environment:

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

Then restart the service. Students remain guests; unknown teachers cannot register on the public server.

Prepare directories:

```bash
sudo useradd --system --home /opt/bizarena --shell /usr/sbin/nologin bizarena
sudo mkdir -p /opt/bizarena /var/lib/bizarena
sudo chown -R bizarena:bizarena /opt/bizarena /var/lib/bizarena
```

Archived Oracle package install sketch:

```bash
sudo bash deploy/oracle/install-oracle-vm.sh https://YOUR-DOMAIN.example
```

For a first IP-only trial:

```bash
sudo bash deploy/oracle/install-oracle-vm.sh http://YOUR-PUBLIC-IP
```

The script writes `/etc/bizarena/bizarena.env`, copies the app to `/opt/bizarena`, installs npm production dependencies, enables `bizarena.service`, configures nginx, and opens the local VM firewall when `ufw` or `firewalld` is active. Oracle Cloud Console still needs subnet security list or NSG ingress for TCP `80` and `443`.

Systemd template:

```ini
[Unit]
Description=Biz Arena Cloud Classroom
After=network.target

[Service]
Type=simple
User=bizarena
WorkingDirectory=/opt/bizarena
EnvironmentFile=/etc/bizarena/bizarena.env
ExecStart=/usr/bin/node /opt/bizarena/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Nginx reverse proxy sketch:

```nginx
server {
  listen 80;
  server_name YOUR-DOMAIN.example;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Firewall checklist:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

Verification:

```bash
curl -fsS https://YOUR-DOMAIN.example/api/health
curl -fsS https://YOUR-DOMAIN.example/api/meta
```

The metadata response must show `deployment: "cloud"` and `storage.backend: "sqlite"`. It must not show a storage warning when `BIZ_ARENA_DATA_DIR` and `BIZ_ARENA_SQLITE_PATH` point to durable VM storage.

Current local preflight:

```powershell
npm run smoke:vps
npm run release:vps-package
npm run release:kai-server-package
```

Sources checked on 2026-06-15: [Oracle Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm), [Oracle Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

## Render Demo

Use Render only for the first public demo URL or QA. Do not promise restart-safe rooms on Render Free.

Required environment:

```bash
BIZ_ARENA_DEPLOYMENT=cloud
BIZ_ARENA_APP_MODE=server
BIZ_ARENA_ALLOW_REGISTRATION=true
BIZ_ARENA_PUBLIC_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

After the first teacher account is created, set:

```bash
BIZ_ARENA_ALLOW_REGISTRATION=false
```

Render blueprint:

```bash
render.yaml
```

Start command:

```bash
node server.js
```

Health check:

```text
/api/health
```

Operational notes:

- Free Render web services are suitable for demo and QA only.
- Render Free can spin down when idle and uses ephemeral local filesystem storage.
- Local SQLite/JSON files can be lost on redeploy, restart, or spin-down.
- Use a normal VPS/KAI server or paid durable disk profile for restart-safe classes.

Sources checked on 2026-06-15: [Render Free](https://render.com/docs/free), [Render Disks](https://render.com/docs/disks).

## P2P Decision

P2P/WebRTC is unsupported for v0.7. It still needs signaling and commonly needs STUN/TURN to work across NAT and firewalls, so it does not remove hosting work and is less predictable in university networks than one public Node server.

Sources checked on 2026-06-15: [MDN WebRTC protocols](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols), [WebRTC TURN server](https://webrtc.org/getting-started/turn-server).

## Fallback Plan

1. If the cloud URL is down, run Local Classroom on the teacher PC.
2. Open `/server`, copy the LAN `/client` link or show QR.
3. If LAN is blocked, use a separate router or phone hotspot for the classroom.
4. Check `http://TEACHER-IP:3000/api/health` from a student machine.
5. Legacy quick tunnel is not a working classroom plan for v0.7.
