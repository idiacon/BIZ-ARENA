# Biz Arena persistence schema migration plan

## Goal

Make persisted classroom data upgrade through an explicit, testable chain instead of silently rewriting every payload as the current schema. The migration module must preserve legacy rooms and accounts, reject unsupported future schemas, and let the storage recovery path fall back to the previous valid SQLite state.

## Evidence

- Current database and room snapshot schema: `3`.
- Git commit `151ba51` contains the retained schema `2` implementation.
- Database schema `2` contains `accounts` and `savedRooms`.
- Room snapshot schema `2` contains room identity, status, turn counters, settings, market state, events, contracts, save time, and players.
- No retained schema `1` artifact was found. For compatibility, an object without `schemaVersion` is the supported legacy schema `1` contract. This does not claim an exact historical layout that cannot be proven.

## Migration chain

### Database

1. `v1 -> v2`: preserve `accounts` and `savedRooms`; establish the versioned database shape.
2. `v2 -> v3`: add `teacherAccounts`, `teacherSessions`, and `activeRooms`.
3. Normalize every saved and active room through the room snapshot migration chain.

### Room snapshot

1. `v1 -> v2`: establish the retained schema `2` defaults for status, turn counters, settings, logs, market state, events, contracts, save time, and players.
2. `v2 -> v3`: add teacher ownership/state, room versioning, finish reason, admin snapshots, factory scenario state, and pause/turn timing fields.
3. Validate the canonical schema before hydration or persistence.

## Invariants

- Missing `schemaVersion` means legacy version `1`.
- Versions must be positive integers.
- Every migration advances exactly one version.
- A schema newer than the running application fails with `BIZ_ARENA_UNSUPPORTED_SCHEMA`.
- Invalid versions fail with `BIZ_ARENA_INVALID_SCHEMA`.
- Migration never mutates the caller's object.
- Broken active rooms may still be skipped individually, but an unsupported database root must never be silently downgraded.
- A rejected SQLite `main` payload may recover from a valid `previous` payload through the existing storage interface.

## Acceptance

- Legacy unversioned and schema `2` fixtures normalize to schema `3` without losing account, room, or player data.
- Future database and room schemas are rejected.
- SQLite recovers a future-version `main` payload from the previous supported state.
- Existing corrupt saved-room fallback remains valid.
- `npm run check`, `npm test`, cloud SQLite smoke, and VPS restart smoke pass.

## Implemented evidence

- Added `server/storage/schema-migrations.js` as the single migration interface.
- Added retained compatibility fixtures for unversioned `v1` and proven `v2` data.
- Added regression tests for sequential steps, immutability, malformed versions, future-version rejection, SQLite fallback, and module initialization with an existing database.
- `npm test`: 170 tests passed after the initialization regression was added.
- `npm run smoke:cloud:sqlite`: passed.
- `npm run smoke:vps`: passed two server starts and restored the room plus student session.
- `npm run rehearsal:classroom`: 3 runs x 30 students, 30 WebSockets per run, no failures.
