# Frontend Role Module Split Plan

Date: 2026-06-30

Status: completed and verified on 2026-07-01.

## Goal

Reduce the `public/app.js` monolith without changing classroom behavior. Ownership must become visible in the filesystem: shared runtime stays in `app.js`, while Server/Admin, Teacher, and Student rendering lives in role-owned modules.

## Locked behavior

- `/server` keeps local/cloud administration, Network Doctor, room controls, and teacher authentication.
- Teacher lobby and cockpit keep the authoritative start gate and `teacher-lifecycle-v1` controls.
- Student lobby and first turn keep `student-state-v2` and `first-turn-v2` contracts without teacher controls.
- Pause, reconnect, resume, next turn, finish, teacher debrief, and student results remain unchanged.
- Existing classic-script loading remains supported by browser and Electron builds.

## Sequence

1. Add a shared role-contract module for navigation and Crisis Card metadata.
2. Move Server/Admin rendering and actions to `public/ui/server-admin-ui.js`.
3. Move Student lobby and first-turn rendering to `public/ui/student-ui.js`.
4. Move Teacher lobby and cockpit rendering to `public/ui/teacher-ui.js`.
5. Load role modules before a final `app-bootstrap.js` entry point.
6. Update static tests to inspect the complete frontend source set instead of assuming every function lives in `app.js`.
7. Run syntax, unit/API, browser E2E, classroom/cloud/VPS smoke, and load checks.

## Stop conditions

- No duplicated function declarations remain across frontend files.
- `app.js` contains shared state, transport, orchestration, and common game views only.
- All role contracts and end-to-end classroom flows pass unchanged.
- No new runtime dependency is introduced.

## Result

- `public/app.js` reduced from about 8,700 to 5,803 lines and now owns shared state, transport, orchestration, and common game views.
- `public/ui/server-admin-ui.js` owns `/server`, Network Doctor, local/cloud administration, and cloud teacher account screens.
- `public/ui/student-ui.js` owns student lobby, readiness, command guidance, and the first-turn route.
- `public/ui/teacher-ui.js` owns teacher preflight, cockpit, lifecycle controls, and Crisis Cards.
- `public/ui/role-contracts.js` owns shared role navigation and Crisis Card metadata.
- `public/app-bootstrap.js` is the only startup entry point and runs after every required module is loaded.
- Regression coverage rejects missing modules, incorrect load order, duplicate top-level declarations, and renewed growth of `app.js` above the agreed threshold.

## Verification evidence

- `npm run check`
- `npm test` (158 tests)
- `npm run e2e:classroom`
- `npm run smoke:classroom`
- `npm run smoke:cloud:sqlite`
- `npm run smoke:vps`
- `npm run load:classroom` (30 students and 30 WebSocket clients)
- `npm run rehearsal:classroom` (3 consecutive runs of 30 students)
- `npm audit --omit=dev` (0 vulnerabilities)
