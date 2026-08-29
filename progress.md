# Biz Arena factory map V3

## Original prompt

> уже лучше но все равно не очень еще

## Goal

Turn the student factory map into a cohesive premium isometric diorama without changing classroom behavior or student role boundaries.

## Visual contract

- Four clickable factory buildings remain: purchase, workforce, assembly, market.
- Persistent floating metric cards are removed from the map.
- Each building gets one compact integrated marker.
- The map shows one server-derived inspector for the active station.
- Full and Standard keep the isometric diorama; Lite keeps the flat accessible fallback.

## Progress

- [x] Reviewed the V2 screenshot and identified the main issue: disconnected buildings plus UI cards.
- [x] Confirmed the role and factory-hotspot contracts.
- [x] Add failing V3 contract checks.
- [x] Implement the V3 diorama.
- [x] Verify responsive, Lite, keyboard focus, and classroom flow.
- [x] Capture and review the V3 screenshot.

## Verification

- `npm run check` passed.
- `npm test` passed.
- `npm run e2e:classroom` passed with zero browser errors.
- Browser scene audit: four markers, one active inspector, zero persistent V2 labels, zero hotspot overlaps.
- Final screenshot: `tmp/student-factory-map-v3.png`.

## Iteration V4

User feedback:

> здания почему-то не по центру своих блоков, а за границей; сама карта пустая, добавь дороги, а не просто прямые линии

Planned correction:

- [x] Anchor each building footprint to the centroid of its colored zone.
- [x] Replace edge-based CSS positioning with map coordinates.
- [x] Add a six-part asphalt road network with shoulders, center markings, junctions, and building access roads.
- [x] Keep the cyan route as a subtle operational overlay, not the road itself.
- [x] Verify zone alignment and road presence in browser QA.

V4 verification:

- `npm run check` passed.
- `npm run e2e:classroom` passed, including responsive, Lite, reconnect, overflow, and zero browser errors.
- Zone-center errors: purchase 9 px, workforce 14 px, assembly 7 px, market 11 px.
- Six road segments are present: campus ring, four building access roads, and the main gate.
- Final screenshot: `tmp/student-factory-map-v4.png`.

## Iteration V5

User feedback:

> уже лучше но они у тебя не по порядку расположены

Target clockwise order:

- [x] `01 purchase` occupies the lower-left factory zone.
- [x] `02 workforce` occupies the upper-left factory zone.
- [x] `03 assembly` occupies the upper-right factory zone.
- [x] `04 market` occupies the lower-right factory zone.
- [x] Route follows the campus roads in the same `01 → 02 → 03 → 04` order without crossing the center.

V5 verification:

- Browser sequence audit passed for the four map anchors.
- Four interactive hitboxes are `133 × 110 px` at 1440 px and do not overlap.
- Six road segments and three ordered route segments are present.
- Classroom E2E passed with reconnect, first turn, Lite fallback, exports, and zero browser errors.
- Final screenshot: `tmp/student-factory-map-v5.png`.

## Iteration V6 — Living Campus

User request:

> давай тогда составь цель и иди к ней

Goal:

Create a visibly active industrial campus without changing the four-step classroom flow:

- [x] Four buildings expose observable operating states derived from the existing student route.
- [x] Only the current and next road segments receive strong route emphasis.
- [x] Add meaningful industrial environment details without covering buildings or roads.
- [x] Add no more than two subtle animations and disable them through the existing animation/Lite fallback.
- [x] Preserve the V5 order, centered anchors, non-overlapping hitboxes, student role boundary, and one primary next action.
- [x] Verify with `npm run check`, `npm test`, `npm run e2e:classroom`, browser audit, and a reviewed V6 screenshot.

V6 slice 1:

- [x] RED: classroom E2E rejected the old `v5-clockwise-flow` scene.
- [x] GREEN: every building now exposes `complete/current/attention/waiting` guidance.
- [x] GREEN: route segments expose `complete/current/next/future` focus states.
- [x] Guidance uses an icon plus color; it does not claim that the currently recommended step is already operating.
- [x] `npm run check` and `npm run e2e:classroom` passed with zero browser errors.

V6 slice 2:

- [x] RED: activity attributes were absent on all four buildings.
- [x] GREEN: warehouse cargo, office windows, assembly equipment, and the loading truck now react to real student factory data.
- [x] Activity copy is included in the building tooltip and accessible button label.

V6 slice 3:

- [x] RED: the browser found zero industrial environment groups.
- [x] GREEN: parking, utilities, safety markings, loading yard, and a service vehicle were added below the interactive layer.
- [x] The current route segment and one service vehicle are the only animated artifacts.
- [x] Lite and animation-off modes resolve both animation names to `none`.
- [x] Building shadows were tightened and hover lift was reduced without scaling.
- [x] The permanent screenshot audit now validates V6 scene version, guidance, activity, environment, motion count, route focus, anchors, and overlaps.

V6 final verification:

- `npm run check` passed.
- `npm test` passed: 280 tests, zero failures.
- `npm run e2e:classroom` passed with reconnect, first turn, Lite fallback, results/export, and zero browser errors.
- Browser audit passed: four guidance states, four real activity states, five environment groups, exactly two motion artifacts, route focus `complete/current/next`, and zero hotspot overlaps.
- `graphify update .` rebuilt the project graph: 2470 nodes, 4218 edges, 161 communities.
- Final reviewed screenshot: `tmp/student-factory-map-v6.png`.

## Iteration V7 — Balanced Stage

Goal:

- [x] Keep all four isometric buildings fully inside the factory scene and clear of its header.
- [x] Preserve the clockwise `01 → 02 → 03 → 04` route, centered zones, roads, and industrial environment.
- [x] Balance the 1440×900 map against the student action rail without a clipped or artificially short workspace.
- [x] Make the five-step turn plan readable as a `2 + 2 + 1` grid.
- [x] Preserve Full, Standard, Lite, reconnect, first-turn, history/export, and student-only role boundaries.

V7 verification:

- `npm run check` passed after the final CSS and capture-runner changes.
- `node --test test/stabilization.test.js` passed: 124 tests, zero failures.
- `npm test` passed earlier in this iteration: 280 tests, zero failures.
- `npm run e2e:classroom` passed after the layout change with zero browser errors.
- The final screenshot audit completed cleanly: 20 screenshots, 40 viewport/layout audits, and zero browser errors.
- Browser geometry confirmed scene `v7-balanced-stage`, four hotspots/buildings, a 28 px minimum building-to-header gap, and zero building overflows.
- `graphify update .` refreshed the final graph: 2458 nodes, 4189 edges, and 159 communities.
- Final reviewed screenshot: `tmp/screenshots-v7-final-4/06a-student-factory-map-v7-1440x900.png`.

### V7 market rail copy pass

- [x] Replaced the mixed-language `Risk` label with the Russian `Статус` heading.
- [x] Replaced the ambiguous `0/0 ед.` metric with state-aware labels such as `Нет заявки` and `Нет товара`.
- [x] Added actionable copy for no offer, no stock, high price, demand limit, and competitive offer states.
- [x] Removed duplicate advice text and clarified demand, offer volume, player price, and market price labels.
- [x] Verified with `npm run check`, `npm test`, `npm run e2e:classroom`, the 125-test stabilization suite, and a clean 21-file screenshot audit.
- Reviewed screenshot: `tmp/screenshots-v7-copy-final/06a-student-factory-map-v7-1440x900.png`.

## Next stage — Intuitive first-turn tutorial

Goal:

- Create a short, skippable contextual tutorial that teaches the first turn through the real factory map and controls.
- Keep it to 3–5 steps and highlight the actual building or action required at each step.
- Never block teacher help, reconnect, paused-session recovery, or normal navigation.
- Reuse the existing `Купить → Нанять → Собрать → Продать → Завершить ход` route instead of creating a separate simulated flow.
- Success criterion: a new student completes the first turn without navigation prompts from the teacher.

### Checkpoint — Interactive tutorial implementation paused

Status: implementation is functionally complete, but the final three review fixes have been applied and have not yet been revalidated.

Implemented:

- Five server-driven stages: purchase, workforce, assembly, market, finish.
- Non-modal spotlight, SVG arrow, real target buttons, Back/Skip, and automatic start for students only.
- Per-room/player skipped/completed persistence and reconnect-safe recovery.
- Desktop and mobile layouts; on mobile, the target is scrolled above the bottom sheet.
- Dedicated tutorial QA screenshots/audits and updated classroom/defense runners.
- Keyboard focus moves to the real highlighted action for action/prepare modes.
- The final step no longer writes `completed` before the teacher/host resolves the turn.

Last verified before the final review fixes:

- `npm run check` passed.
- `npm test` passed: 18 + 26 + 126 + 112 = 282 tests, zero failures. The run required escalation because the sandbox returned `spawn EPERM`.
- `npm run e2e:classroom` passed with `studentInteractiveTutorial: true`, reconnect, exports, Lite mode, and zero browser errors.
- Screenshot QA passed with 22 tutorial/classroom screenshots; desktop and 390×844 tutorial audits had no target overlap or horizontal overflow.
- `graphify update .` completed.

Final review fixes applied but NOT revalidated because work was stopped:

1. The finish step waits for server/teacher resolution instead of completing locally.
2. Keyboard focus moves to the highlighted real action.
3. The screenshot runner dismisses the tutorial after the dedicated tutorial captures.

Resume from:

1. Run `node --check public/ui/tutorial-ui.js scripts/capture-classroom-flow-screenshots.js`.
2. Run `node test/stabilization.test.js`.
3. Run `npm run e2e:classroom`.
4. Rerun `node scripts/capture-classroom-flow-screenshots.js` and inspect the desktop/mobile tutorial images.
5. Run `graphify update .` and `git diff --check`.

Last tutorial evidence:

- Desktop: `tmp/tutorial-first-turn-qa-v3/06b-student-first-turn-tutorial-1440x900.png`.
- Mobile: `tmp/tutorial-first-turn-qa-v3/06c-student-first-turn-tutorial-390x844.png`.
- Geometry audit: `tmp/tutorial-first-turn-qa-v3/audit.json`.

### Checkpoint — tutorial revalidated

Status: the three final review fixes are now revalidated.

- `node --check public/ui/tutorial-ui.js` passed.
- `node --check scripts/capture-classroom-flow-screenshots.js` passed.
- `node test/stabilization.test.js` passed: 126 tests, zero failures.
- `npm run e2e:classroom` passed with `studentInteractiveTutorial: true`, reconnect, exports, Lite mode, and zero browser errors.
- Classroom screenshot QA passed: 23 files, no failed audit checks, and no browser errors.
- Desktop and 390×844 tutorial screenshots were reviewed.

Current tutorial evidence:

- Desktop: `tmp/screenshots-v18-desktop-pilot/06b-student-first-turn-tutorial-1440x900.png`.
- Mobile: `tmp/screenshots-v18-desktop-pilot/06c-student-first-turn-tutorial-390x844.png`.
- Geometry audit: `tmp/screenshots-v18-desktop-pilot/audit.json`.

## Deployment readiness — VPS/VDS and Vercel

Goal:

- [x] Keep the authoritative Node.js, WebSocket, and SQLite runtime on a VPS/VDS or dedicated server.
- [x] Preserve the existing single-server VPS deployment.
- [x] Allow an optional static Vercel frontend to use the VPS backend over HTTPS.
- [x] Route API calls, QR images, generated student links, and WebSocket connections correctly in both modes.
- [x] Restrict cross-origin browser access to an explicit allowlist.
- [x] Provide repeatable builds and a Russian deployment runbook.

Implemented:

- `BIZ_ARENA_CORS_ORIGINS` exact-origin allowlist for HTTP preflight and browser WebSocket upgrades.
- Same-origin local/VPS mode remains the default.
- `BIZ_ARENA_BACKEND_URL` injects an HTTPS backend origin into the static Vercel build.
- `npm run build:vercel` creates `dist/vercel-public`.
- `vercel.json` publishes only the static frontend and preserves `/server` and `/client`.
- `npm run release:vps-package` creates the installable VPS archive.
- VPS installer, example environment, package manifest, and runbook document the optional Vercel origin.

Deployment artifacts:

- VPS archive: `dist/BizArena-VPS-1.0.0-beta.1.zip`.
- VPS manifest: `dist/vps-release-manifest-1.0.0-beta.1.json`.
- Vercel frontend: `dist/vercel-public`.
- Runbook: `docs/deployment-runbook.md`.

Validation:

- Deployment unit tests passed: 10 tests, zero failures.
- `npm run check` passed.
- `npm run smoke:vps` passed with durable SQLite restart, restored room and student session, WebSocket invalidation, security headers, and `externalFrontendCors: true`.
- `npm run release:verify` passed completely:
  - all unit and integration suites passed;
  - LAN, cloud JSON, cloud SQLite, and VPS smoke passed;
  - classroom E2E passed with interactive tutorial, reconnect, exports, Lite mode, and zero browser errors;
  - `npm audit --omit=dev` found zero vulnerabilities.
- `graphify update .` rebuilt the graph: 2542 nodes, 4321 edges, 162 communities.
- `git diff --check` passed.

Deployment boundary:

- Recommended: deploy the complete package to one VPS/VDS.
- Optional: host only `dist/vercel-public` on Vercel and keep the backend on an HTTPS VPS/VDS.
- Vercel alone cannot host the current persistent WebSocket server, SQLite file, or backup timer.

Next external step:

1. Choose the public VPS address or domain.
2. Install `dist/BizArena-VPS-1.0.0-beta.1.zip` using `deploy/vps/install-vps.sh`.
3. If using Vercel, set the backend `BIZ_ARENA_CORS_ORIGINS` and the Vercel build variable `BIZ_ARENA_BACKEND_URL`.
4. Run the short two-device classroom smoke from `docs/deployment-runbook.md`.
