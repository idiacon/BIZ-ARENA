# Biz Arena Architecture Map

Last updated: 2026-07-01.

## Current Shape

Biz Arena v0.9 beta is a working Node/Electron classroom simulator with two deployment paths:

- Local Classroom: teacher runs `BizArena Server`, students join over LAN or a private hotspot.
- Cloud Classroom pilot: Node server runs in `BIZ_ARENA_DEPLOYMENT=cloud`, teachers use account/session auth, students join as guests.

The main stack is:

- Node.js HTTP server in `server.js`;
- browser UI in `public/index.html`, shared runtime in `public/app.js`, and role modules under `public/ui/`;
- Electron wrapper in `desktop/main.js` and `desktop/preload.js`;
- extracted server modules under `server/`;
- release and smoke scripts under `scripts/`;
- regression tests under `test/` and `tests/`.

## Large Files And Pressure Points

| File | Approx. lines | Role | Risk |
| --- | ---: | --- | --- |
| `public/app.js` | 5803 | Shared state, transport, orchestration, and common game views | Still exposes shared lexical state to classic-script role modules; explicit interfaces are the next boundary. |
| `public/ui/teacher-ui.js` | 1242 | Teacher preflight, cockpit, lifecycle, and Crisis Cards | Large teacher surface, but role ownership is isolated and regression-tested. |
| `public/ui/server-admin-ui.js` | 1079 | Server home, Network Doctor, local/cloud administration | Local and cloud administration share one role module intentionally. |
| `public/ui/student-ui.js` | 552 | Student lobby, readiness, command guidance, and first turn | Must remain thin and free of teacher-only rendering. |
| `public/styles.css` | 6281 | Full visual system and responsive layout | Design changes remain high-blast-radius and need browser verification. |
| `server.js` | 6216 | Runtime state, storage wiring, auth, room lifecycle, game actions, summaries, WebSocket, HTTP assembly | Too many server subsystems still pass through one entry point. |
| `public/index.html` | 1578 | All screens in one static HTML shell | Server, client, lobby, game, teacher, and result screens still share one markup surface. |

## Server Runtime

Entry point: `server.js`.

Important responsibilities currently in the entry point:

- environment and mode setup: `BIZ_ARENA_DEPLOYMENT`, `BIZ_ARENA_APP_MODE`, `BIZ_ARENA_PUBLIC_URL`, `BIZ_ARENA_DATA_DIR`;
- JSON DB path and schema constants: `data/biz-arena-db.json`, backup and temp files;
- player session security, action replay protection and rate limiting;
- teacher accounts, password hashing, teacher sessions and teacher room ownership;
- active room persistence and restore;
- room creation, join, serialization and hydration;
- teacher-owned room quotas, explicit close/finish-and-close lifecycle, and stale lobby cleanup;
- factory scenario mechanics, supplier offers, workers, assembly, market hints;
- room summary, player summary, teacher/class dashboard read models;
- WebSocket invalidation and HTTP routing setup.

Extracted modules already exist:

- `server/http/routes.js` owns HTTP route dispatch for `/api/state`, `/api/teacher/*`, `/api/server/action`, `/api/action`, room create/join, QR and network checks.
- `server/room/actions.js` owns the room action dispatcher for host controls and delegates business actions.
- `server/game-rules.js` owns reusable rule helpers, scoring, strategy, forecasts and financial breakdowns.
- `server/factory/summary.js` owns factory read-model helpers.
- `server/scenarios/schema.js` owns scenario validation and scenario lab summaries.
- `server/experiments/runner.js` owns parameter sweep execution.

## API Surface

Current public API groups:

- Student/player:
  - `POST /api/rooms/create`;
  - `GET /api/rooms/directory` (safe opt-in lobby list without room codes or role data);
  - `POST /api/rooms/join`;
  - `GET /api/state`;
  - `POST /api/action`.
- Local teacher/server:
  - `GET /api/server/overview`;
  - `POST /api/server/action` with localhost-only guard.
- Cloud teacher:
  - `POST /api/teacher/register`;
  - `POST /api/teacher/login`;
  - `GET /api/teacher/me`;
  - `GET /api/teacher/overview`;
  - `POST /api/teacher/action`.
- Diagnostics:
  - `GET /api/health`;
  - `GET /api/meta`;
  - `GET /api/qr`;
  - `GET /api/network/check` with host-only guard.
- Realtime:
  - `/ws` sends invalidation events; clients still fetch state over HTTP.

## Storage

Current storage backend:

- JSON file at `BIZ_ARENA_DATA_DIR/biz-arena-db.json`;
- atomic write through temp file and backup;
- normalized DB shape includes `accounts`, `teacherAccounts`, `teacherSessions`, `activeRooms`, `savedRooms`;
- active rooms are serialized through `serializeRoom(room)` and restored through `hydrateRoom(snapshot)`;
- mutations persist through debounce or immediate flush.
- room snapshots carry `createdAt` and `lastActivityAt`; cleanup removes only stale empty lobbies or finished live rooms and preserves archived completed sessions;
- create bursts are limited in the HTTP process, while owner quotas are derived from persisted active-room state and therefore survive restart.

v0.6 target:

- add storage adapter seam before changing the backend;
- keep JSON adapter as fallback;
- add SQLite adapter for cloud/server mode;
- migrate JSON snapshots to SQLite through a script, without deleting JSON automatically.

## UI Map

Browser shell:

- `public/index.html` contains the screen markup for main menu, `/server`, `/client`, lobby, game, teacher panel, results and settings.
- `public/app.js` owns shared state, transport, refresh orchestration and common game views.
- `public/ui/server-admin-ui.js`, `public/ui/student-ui.js` and `public/ui/teacher-ui.js` own role-specific rendering and actions.
- `public/ui/role-contracts.js` owns navigation and Crisis Card metadata shared across roles.
- `public/app-bootstrap.js` validates role-module availability and is the only startup entry point.
- `public/styles.css` contains all layout, visual states, game panels, teacher cockpit and responsive rules.

Shared UI flows in `public/app.js`:

- app mode detection and lite/client mode;
- WebSocket setup and HTTP state refresh;
- student join flow;
- factory purchases, personnel, assembly, market and reports;
- results screen and export.

Primary v1.0 UI risk:

- Role ownership is now visible in separate files, but classic scripts still communicate through shared lexical bindings. The next refactor must introduce explicit narrow interfaces without changing the proven classroom behavior or converting frameworks.

## Electron Shell

Files:

- `desktop/main.js`;
- `desktop/preload.js`;
- `scripts/build-desktop-mode.js`;
- `package.json` build config.

Current behavior:

- desktop mode is inferred from `BIZ_ARENA_DESKTOP_MODE`, `BIZ_ARENA_APP_MODE` or executable name;
- server mode starts local Node server and opens `/server`;
- client mode opens a target server URL and appends `/client`;
- legacy tunnel is disabled unless `BIZ_ARENA_ENABLE_LEGACY_TUNNEL=true`;
- Server and Client builds are produced through `dist:server`, `dist:client`, `dist:classroom`.

v0.6 pressure point:

- Client.exe should become the primary student entry. That means client mode needs stronger first-launch UX, better connection errors and cloud/local URL handling.

## Release Scripts

Important scripts:

- `npm run check`;
- `npm test`;
- `npm run smoke:classroom`;
- `npm run smoke:cloud`;
- `npm run dist:classroom`;
- `npm run release:classroom-package`;
- `npm run release:cloud-package`.

The classroom and cloud packages are already split. v0.6 should keep this split and add SQLite/Oracle validation before release.

## Tests

Coverage currently exists for:

- extracted HTTP router behavior;
- room action dispatcher behavior;
- session-token ownership;
- replay/rate-limit protections;
- teacher auth and teacher-owned cloud rooms;
- persistence and snapshot recovery;
- classroom and cloud smoke flows;
- factory scenario summaries and rule helpers;
- release hardening checks.

Test gap for v0.6:

- no SQLite adapter tests yet;
- no real Electron first-launch smoke outside packaging;
- limited browser visual QA in this environment;
- student thin summary is still mostly enforced through filtered summary behavior, not a separate read model.

## Skill Inventory For v0.6

Useful skills found in the current Codex installation:

| Skill | Use in this project |
| --- | --- |
| `writing-plans` | Create task-by-task implementation plans under `docs/superpowers/plans/` before invasive v0.6 changes. |
| `graphify` | Use for repo relationship lookup when `graphify-out/graph.json` is available; otherwise keep the manual architecture map current. |
| `analyze` and `improve-codebase-architecture` | Review coupling in `server.js`, `public/app.js` and `public/styles.css` before refactor passes. |
| `frontend-skill`, `ui-ux-pro-max`, `game-ui-frontend` | Guide Teacher Cockpit, Student First Turn and classroom HUD improvements. |
| `electron`, `agent-browser`, `browser-trace` | Validate local desktop modes, browser flows, console/network behavior and performance after UI changes. |
| `security-scan`, `threat-model`, `code-review` | Validate teacher auth, player session boundaries, localhost-only admin routes and cloud ownership. |
| `render-deploy` | Keep Render as demo packaging/deployment target only. |
| `documents`, `humanizer` | Produce teacher handoff, defense brief, demo script and fallback plan without over-technical wording. |

No dedicated SQLite/Electron packaging skill was found. Treat SQLite as a risk-managed spike: verify native module rebuild and packaged executable behavior before replacing JSON storage.

## Documentation State

Fresh release docs are clean:

- `README.md`;
- `docs/teacher-classroom-handoff.md`;
- `docs/teacher-cloud-classroom-handoff.md`;
- `docs/teacher-defense-brief.md`;
- `docs/cloud-hosting-runbook.md`;
- `docs/security-threat-model.md`.

Known documentation risks:

- older planning docs still contain mojibake;
- `docs/next-ux-upgrade-plan.md` is useful conceptually but currently encoded incorrectly;
- historical v0.1/v0.3/v0.4 docs are mixed with active docs;
- `docs/internet-room-cloudflare.md` is intentionally legacy/unsupported and should not re-enter release scripts.

## Recommended v0.6 Slices

### Slice 1: Plan And Map

Status: started.

Deliverables:

- `docs/v0.6-online-classroom-plan.md`;
- `docs/architecture-map.md`;
- updated verification commands.

### Slice 2: Server/Admin/Client Split

Goal:

- make server mode a teacher/admin cockpit;
- keep client mode a student-only experience.

Likely files:

- `public/index.html`;
- `public/app.js`;
- `public/styles.css`;
- `server/http/routes.js`;
- `test/stabilization.test.js`;
- `scripts/smoke-classroom-lan.js`;
- `scripts/smoke-cloud-classroom.js`.

### Slice 3: Thin Client v2

Goal:

- introduce a dedicated student read model instead of filtering the full room summary.

Likely files:

- `server.js`;
- `server/factory/summary.js`;
- `server/http/routes.js`;
- `public/app.js`;
- `test/stabilization.test.js`;
- `test/server-refactor.test.js`;
- `scripts/smoke-cloud-classroom.js`.

### Slice 4: Storage Adapter And SQLite

Goal:

- put JSON behind an adapter;
- add SQLite adapter and migration script;
- keep JSON fallback.

Likely files:

- new `server/storage/` modules;
- `server.js`;
- `package.json`;
- `scripts/`;
- storage-focused tests.

### Slice 5: Oracle Production Profile

Goal:

- make cloud deployment repeatable on Oracle Free VM.

Likely files:

- `docs/cloud-hosting-runbook.md`;
- `render.yaml`;
- new deployment examples under `docs/` or `scripts/`;
- release package script.

## Immediate Decision

The physical Server/Admin, Teacher and Student UI split is complete. The next architecture slice is to formalize narrow module interfaces and continue reducing `server.js`, while preserving the proven thin student summary, SQLite persistence, and classroom lifecycle contracts.
