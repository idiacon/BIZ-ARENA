# Biz Arena Security Threat Model

## Scope

Biz Arena is a Node/Electron classroom simulator with browser UI, local JSON persistence, Local Classroom LAN mode, Cloud Classroom hosting mode, and local export files. The main protected assets are room state, teacher accounts, player identity within a room, saved match snapshots, generated reports, and the host or cloud server machine.

## Trust Boundaries

- Browser clients are untrusted. Player names, company names, room codes, action payloads, sale prices, quantities, and export-triggered data can be attacker-controlled.
- The Node server is the authority for room state, timers, economy rules, and host-only actions.
- Electron preload is a privileged boundary. Renderer code must only call explicitly exposed desktop APIs.
- Cloud Classroom exposes the Node server to the public internet and must treat all clients as remote and untrusted.
- Teacher authentication crosses a privileged boundary. Teacher sessions can create and control owned cloud rooms.
- JSON and SQLite save/load cross a persistence boundary and must tolerate malformed or stale data without silently replacing it with empty state.

## Security Invariants

- Host-only actions stay host-only: pause, resume, next turn, settings, forced events, save/load, and teacher controls.
- Cloud teacher actions require a valid teacher session and room ownership.
- Player actions are scoped to the room/player session that owns the `sessionToken`; `playerId` is treated as a claimed identity and is rejected if it does not match the token.
- Client actions include `actionId`; the server rejects repeated action ids to reduce double-submit/replay risk.
- The server rate-limits bursts from a single player session.
- Teacher passwords are stored as `crypto.scrypt` hashes plus salt, never as plaintext.
- User-controlled text is escaped before entering `innerHTML`.
- Numeric inputs are normalized server-side before changing money, stock, workers, or sale offers.
- Export filenames are sanitized and exported content is JSON, not executable script.

## Main Risks

- Cross-site scripting through room, player, company, contract, or event text.
- Unauthorized host actions through forged `/api/action` payloads.
- Unauthorized teacher actions against rooms owned by another teacher.
- Open teacher registration on a public demo URL if `BIZ_ARENA_ALLOW_REGISTRATION=true` is left enabled after initial setup.
- Loss of active cloud rooms on demo hosting without durable `BIZ_ARENA_DATA_DIR`.
- Silent data replacement after a corrupt SQLite runtime payload.
- Denial of service through excessive quantities, prices, or malformed JSON.
- Desktop privilege leakage if renderer access grows beyond the preload API.

## Current Mitigations

- Player-facing names are sanitized and covered by tests.
- Most dynamic UI rendering uses `escapeHtml`.
- Server actions check host permissions and room state.
- `/api/action` resolves the player by `sessionToken`, not by trusting client-provided `playerId`.
- `/api/server/action` and `/api/network/check` are available only from the host computer.
- `/api/teacher/action` resolves the teacher from a session token and checks room ownership.
- Replayed `actionId` values and excessive action bursts are rejected and surfaced in the Server panel security summary.
- Server Panel includes Network Doctor with LAN/health links and guidance for NAT, VPN-like addresses, and client isolation.
- Cloud teacher screen warns when cloud mode uses non-durable local filesystem storage.
- Turn timer, pause, and 30-turn finish are server-side.
- Save/load uses an explicit `v1 -> v2 -> v3` migration chain; malformed and future schemas fail closed instead of being silently relabeled as current.
- SQLite preserves the previous valid runtime payload transactionally, repairs a corrupt `main` payload from it, and fails startup closed when recovery is exhausted.
- VPS/KAI deployment adds daily SQLite backups; local `previous` recovery is not treated as a substitute for off-process backup.

## Follow-Up Checks

- Keep replacing raw `innerHTML` with DOM construction or escaped templates when touching sensitive UI.
- Re-run `npm audit --omit=dev` before release packaging.
- For public cloud demos, create the teacher account first, then set `BIZ_ARENA_ALLOW_REGISTRATION=false`.
- For restart-safe cloud classrooms, set `BIZ_ARENA_DATA_DIR` to a durable directory and verify room restore after restart.
- Review desktop `preload.js` whenever a new desktop API is added.
