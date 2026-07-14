# SQLite Runtime Recovery Hardening Plan

Date: 2026-07-01

Status: completed and verified on 2026-07-01.

## Goal

Prevent a malformed runtime payload from silently starting Biz Arena with an empty database. SQLite must keep the previous valid runtime state, recover it automatically when the current payload is unreadable, and stop startup when neither copy is valid.

## Locked behavior

- The storage interface remains `load`, `persist`, and `info`; no caller learns SQLite details.
- Existing `runtime_state/main` databases remain readable without a manual migration command.
- JSON storage keeps its current `.bak` recovery behavior.
- Backups made by `scripts/admin-storage.js` remain valid SQLite files.
- No new runtime dependency or external database is introduced.

## Sequence

1. Add regression tests for `main -> previous -> repaired main` recovery.
2. Add a regression test proving an unrecoverable SQLite payload throws instead of returning empty state.
3. Persist the previous `main` row transactionally before replacing it.
4. Make server startup fail closed after storage recovery is exhausted.
5. Expose recovery status through the existing storage metadata and operational JSON log.
6. Update the KAI/VPS recovery runbook and run unit, smoke, restart, backup/restore, and rehearsal gates.

## Stop conditions

- A corrupt `main` payload recovers from `previous` and repairs `main`.
- A second load reads the repaired `main` without another recovery.
- A database with no valid runtime payload stops startup and preserves the file for operator recovery.
- Cloud SQLite restart smoke and admin backup/restore tests still pass.

## Verification evidence

- `npm run check`
- `npm test` (161 tests)
- `npm run smoke:cloud:sqlite`
- `npm run smoke:vps` (room and student session restored after restart)
- `npm run rehearsal:classroom` (3 runs, 30 students and 30 WebSocket clients per run)
- Worst measured `state p95`: 51 ms; worst measured `action p95`: 41 ms.
