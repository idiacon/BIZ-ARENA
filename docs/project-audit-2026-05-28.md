# Biz Arena Project Audit - 2026-05-28

## Current State

Biz Arena is a working `0.5.0-alpha.1` classroom business simulator with:

- browser and Electron desktop launch paths;
- Windows setup and portable artifacts in `dist/`;
- Cloudflare quick tunnel support through bundled `tools/cloudflared.exe`;
- LAN room flow, host controls, pause/resume, manual 30-minute turns, 30-turn finish;
- factory scenarios, suppliers, workers, assembly, order-book sales, events, decisions, reports and teacher readiness;
- automated checks, Node tests, screenshot capture and release readiness scripts.

Verification run on 2026-05-28:

```powershell
npm run check
npm test
npm audit --omit=dev
node scripts/start-internet-room.js --check
```

Result:

- syntax check passed;
- all automated tests passed;
- runtime dependency audit found `0 vulnerabilities`;
- `cloudflared` check passed.
- core localization source was normalized to readable UTF-8 and guarded by `tests/localization.test.js`.

## Product Position

The target should be split into two product layers:

1. Simformer-like layer: ready educational business games, classes, teams, scoring, teacher dashboard, reports and controlled sessions.
2. AnyLogic-like layer: scenario/model builder, reusable process blocks, experiments, parameter sweeps, visual analytics and export.

Biz Arena is currently much closer to the first layer. The second layer should not be attempted as a full AnyLogic clone immediately; it should start as an "AnyLogic-lite" scenario editor for business education.

## Strengths

- Core classroom loop already works: create room, join, make decisions, resolve turn, compare results.
- The game has enough mechanics for a real lesson: Р·Р°РєСѓРїРєР°, РїРµСЂСЃРѕРЅР°Р», РїСЂРѕРёР·РІРѕРґСЃС‚РІРѕ, РјР°СЂРєРµС‚РёРЅРі, С„РёРЅР°РЅСЃС‹, РѕС‚С‡РµС‚С‹.
- Teacher-side visibility exists through class readiness and help queue.
- Results screen and scoring already move beyond cash-only ranking.
- Packaging is repeatable: setup, portable, fallback ZIP and readiness report.
- The current vanilla stack is simple enough for fast local development and defense reliability.

## Main Risks

- Some older archived docs still contain mojibake from previous phases. The active UI localization source is now readable UTF-8, but historical docs should be either cleaned or moved to an archive folder.
- Large files slow development and increase regression risk:
  - `public/styles.css`: about 5120 lines;
  - `public/app.js`: about 4719 lines;
  - `server.js`: about 3681 lines.
- Root legacy files `index.html` and `translations.js` duplicate public assets and can confuse future packaging or manual edits.
- Several old `docs/v0.1-*` files are historical archive but still appear next to active planning docs.
- The project has a good game loop but not yet a full course-management layer: no classes, assignments, grading history, certificates or teacher scenario library.
- AnyLogic-like capabilities are mostly missing: no visual model builder, no experiment runner, no parameter sweep UI, no reusable model components.

## Recommendation

Do not jump straight into a universal simulation editor. The shortest path to the stated goal is:

1. Make `0.4.0 stable` clean and understandable for 10-11 graders.
2. Add a Simformer-like classroom/course layer.
3. Deepen the business economy and bots.
4. Add an AnyLogic-lite scenario editor for factory/business process models.
5. Add experiments and analytics after scenarios become data-driven.
