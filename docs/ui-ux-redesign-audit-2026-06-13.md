# Biz Arena UI/UX Redesign Audit - 2026-06-13

## Goal

Make Biz Arena feel like a classroom cockpit, not a decorative game page:

- teacher sees class status in 10 seconds;
- student sees the next first-turn action without noise;
- weak PCs keep a stable Lite Mode UI;
- Server/Admin/Client roles stay visually and behaviorally separated.

## Design System

`ui-ux-pro-max` recommendation:

- style: Data-Dense Dashboard;
- product type: education/classroom operational dashboard;
- palette direction: dark neutral surfaces, green for ready/positive states, warning only for attention;
- avoid: landing-page hero structure, decorative gradients, card-in-card clutter, emoji icons, hover layout shift.

## Current Surfaces

- `/server`: Local Classroom start screen, Network Doctor, QR, server admin overview.
- Cloud `/server`: teacher login, cloud room creation, teacher-owned classroom overview.
- `/client`: student entry and lightweight classroom client.
- In-game teacher tab: host controls, class readiness, Crisis Cards, dashboard and snapshots.
- Lite Mode: performance-first rendering path for weak PCs.

## First Redesign Slice

Implemented as a safe UI layer without changing game economy or APIs:

- Server/Cloud teacher priority strip:
  - "what to do now";
  - launch readiness;
  - ready count;
  - stuck teams;
  - no-sale-offer count.
- Student first-turn route:
  - `Купить -> Нанять -> Собрать -> Продать -> Завершить ход`;
  - one primary next-action button;
  - stable compact route row.
- Lite Mode visual hardening:
  - no hover transform movement;
  - simplified backgrounds for route/cockpit panels;
  - no heavy shadows on the new operational surfaces.
- Accessibility:
  - visible `focus-visible` rings for buttons, links, summaries, and role buttons.

## Acceptance Checks

- `npm run check`
- `node test/stabilization.test.js`
- `npm run smoke:classroom`
- `npm run smoke:cloud`

Before marking the full redesign goal complete, browser/screenshot QA is still needed for:

- 1366x768 teacher cockpit;
- `/client?lite=1` first-turn flow;
- mobile width 375px;
- packaged Server/Client smoke after final visual pass.
