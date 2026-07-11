# Backend Boundary Map

## Current Monolith Sections

- Persistence and migrations: snapshot validation, db recovery, account storage.
- Room lifecycle: create, join, reset, start, finish, save/load.
- Factory scenario: components, workers, assembly, order book, market events.
- Player summaries: `playerSummary`, `roomSummary`, checklist, market hints, turn review.
- Teacher controls: phase lock, forced events, class snapshot/readiness.
- Room timers: global heartbeat, turn timer, pause on expiry.
- Static server: public asset serving and API routing.

## First Safe Extractions

- Move factory read-model helpers into `server/factory/summary.js`:
  - `buildTurnChecklist`
  - `buildMarketHints`
  - `buildTurnReview`
  - `buildComparisonToLeader`
- Move factory event helpers into `server/factory/events.js`:
  - event catalog
  - forced event generation
  - market event multiplier helpers
- Move timer helpers into `server/room/timers.js`:
  - `processRoomTimers`
  - `startRoomTicker`
  - `stopRoomTicker`
- Move static serving into `server/http/static.js`:
  - content type lookup
  - safe path resolution
  - static file response

## Do Not Extract Yet

- Business action mutation blocks that rely on shared closure state.
- Snapshot migration code until persistence tests are expanded.
- Bot turn logic until factory and legacy economy behavior are separated.
- Translation/UI state logic from `public/app.js` until UI smoke coverage is broader.

## Risk Notes

- `server.js` exports many helpers consumed by tests; extraction must preserve exports or update tests in the same task.
- Factory mode and legacy mode share action names, so helper extraction must keep `isFactoryScenario` checks explicit.
- Timer behavior is high risk because teacher pause and auto-pause on expiry depend on shared room status.
