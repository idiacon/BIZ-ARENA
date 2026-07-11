# Biz Arena Oracle Cloud Classroom Handoff

## What The Teacher Opens

1. Open the public Biz Arena URL.
2. Go to `/server`.
3. Register the first teacher account only while `BIZ_ARENA_ALLOW_REGISTRATION=true`.
4. Create a cloud room.
5. Share the student link or QR from the teacher screen.

Students do not need accounts. They join with room code, name, and company name.

## Admin Lock

After the first teacher account exists, set:

```bash
BIZ_ARENA_ALLOW_REGISTRATION=false
```

Restart the service. Existing teacher login keeps working, but unknown teachers cannot register.

## Health Checks

```text
https://YOUR-DOMAIN.example/api/health
https://YOUR-DOMAIN.example/api/meta
```

Expected:

- `/api/health` returns JSON with `"ok": true`.
- `/api/meta` shows `deployment: "cloud"`.
- `/api/meta` shows `storage.backend: "sqlite"`.
- `/api/meta` has no storage warning when `BIZ_ARENA_DATA_DIR` is durable.

## If Cloud Is Down

1. Run Local Classroom on the teacher PC.
2. Open `/server`.
3. Share the LAN `/client` link or QR.
4. If the university LAN blocks clients, use a separate router or phone hotspot.

## P2P Decision

P2P/WebRTC is unsupported for v0.7. It still needs signaling and often STUN/TURN, so it does not remove server work and is less predictable in university networks than one public Node server.
