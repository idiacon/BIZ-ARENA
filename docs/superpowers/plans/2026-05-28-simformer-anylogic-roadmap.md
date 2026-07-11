# Simformer/AnyLogic Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Biz Arena from a defense-ready prototype into a clear educational business simulation platform for students and grades 10-11, with a Simformer-like classroom game core and an AnyLogic-lite scenario/experiment layer.

**Architecture:** Keep the current Node + vanilla HTML/CSS/JS + Electron stack until the product loop is stable. First clean localization and split monolith files into focused modules, then add course/session features, then convert scenarios to data-driven models, then add visual scenario editing and experiments.

**Tech Stack:** Node.js, vanilla HTML/CSS/JS, Electron, Cloudflare quick tunnel, `node:test`, browser screenshot QA, JSON scenario definitions, CSV/JSON export.

---

## Product North Star

Biz Arena should become:

- simple enough that a 10-11 grade student understands the first move in 3 minutes;
- deep enough that a university group can discuss strategy, supply chain, pricing and finance;
- useful for a teacher: create a class, launch a scenario, see who is stuck, pause everyone, export results;
- extensible like a light simulation lab: change scenario parameters, run experiments, compare outcomes.

## Current Progress Notes

- 2026-05-28: added student-facing unit economics for the factory game loop. `playerSummary.unitEconomics` now explains material cost from current supplier lots, overhead per unit, break-even price, safe price floor, margin per unit, expected profit and supplier shortage. Marketing UI shows these values directly in the sale desk so students can understand whether their price can actually earn money.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added student-facing purchase guidance. `playerSummary.purchaseHints` now points to the component that blocks the next batch, explains missing quantity, highlights the cheapest useful supplier lot, and updates after the lot is bought. The purchase tab now has a “Что купить сейчас” coach card, component urgency states, and a recommended supplier card.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added student-facing personnel guidance. `playerSummary.personnelHints` now explains staffing bottlenecks, recommended candidate, salary/sign-on cost, capacity gain and payback. The personnel tab now tells the student when to hire and when components, not people, are the real blocker.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added student-facing assembly guidance. `playerSummary.assemblyHints` now separates worker capacity from component capacity, names the bottleneck, recommends assemble/purchase/personnel next action, and lists how many units each component allows. The assembly UI now has a coach card and per-component bottleneck cards.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added unified student turn guide. `playerSummary.turnGuide` now combines purchase, personnel, assembly, market and finish into one five-step route with primary action, target tab/action and progress. The production screen uses this server-side route instead of reconstructing the main flow only from old checklist data.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added teacher-facing class route map. `roomSummary.classReadiness.stepMap` and `routeSummary` now aggregate where students are stuck across the same five-step turn route, with student names and progress for each step. The teacher panel shows this map above the detailed readiness queue.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added student-facing final debrief. `playerSummary.playerDebrief` now explains the student's personal result, last-turn profit, sales, revenue, expenses, margin, leader gap, main strength, limiting weakness, and next-match focus. The results screen puts this personal debrief directly after the final hero card, and JSON exports include it for defense review.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-05-28: added the first scenario-lab foundation. `server/scenarios/schema.js` validates scenario definitions and converts factory configs into normalized scenario definitions; `roomSummary.scenarioLab` and `lessonPlan.parameters/experimentAxes` expose demand, price range, recipe cost, upkeep, lesson length, and experiment questions. Create-room, lobby, and teacher views now show scenario parameters and experiment axes so scenarios feel closer to a controllable simulation lab.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `node --test tests\scenario-schema.test.js`, `npm test`, `npm run screenshots:defense`.
- 2026-06-01: added the first pure experiment runner. `server/experiments/runner.js` can run deterministic scenario simulations and parameter sweeps for price, demand, supply coverage, upkeep, starter cash, and salary multiplier without depending on browser state or live rooms. This gives the AnyLogic-lite layer a testable backend foundation for future teacher UI charts and JSON/CSV exports.
- Verification for this slice passed: `npm run check`, `node --test tests\experiment-runner.test.js`, `node --test tests\scenario-schema.test.js`.
- 2026-06-01: exposed the experiment runner in the teacher workflow. Hosts can run `run-experiment` from the teacher panel, compare parameter values, and see score, sales, net worth, risk, and the best variant without changing the live match. `roomSummary.scenarioExperiment` carries the latest result for UI rendering and later export.
- Verification for this slice passed: `npm run check`, `node test\stabilization.test.js`, `node --test tests\experiment-runner.test.js`, `npm test`, `npm run screenshots:defense`.

## File Map

- `public/translations.js`: clean UTF-8 dictionary and glossary terms.
- `public/app.js`: student flow, teacher flow, scenario builder UI, experiment UI.
- `public/styles.css`: split into feature CSS files after build-free loading is agreed.
- `public/index.html`: stable screen structure and new scenario-builder containers.
- `server.js`: room lifecycle, state orchestration, persistence; should keep shrinking.
- `server/factory/summary.js`: student/teacher read models for factory gameplay.
- Create `server/factory/economy.js`: supplier, production, demand, sale clearing helpers.
- Create `server/scenarios/schema.js`: JSON schema and defaults for data-driven scenarios.
- Create `server/experiments/runner.js`: deterministic scenario runs and parameter sweeps.
- Create `tests/localization.test.js`: regression guard against mojibake.
- Create `tests/scenario-schema.test.js`: scenario validation and migration tests.
- Create `tests/experiment-runner.test.js`: deterministic experiment tests.
- Update `scripts/capture-defense-screenshots.js`: screenshots for classroom, builder and reports.
- Update `docs/project-audit-2026-05-28.md`: keep audit findings current.

### Task 1: Stabilize `0.4.0` As Classroom Foundation

**Files:**
- Modify: `public/translations.js`
- Modify: `README.md`
- Modify: `docs/teacher-demo-checklist.md`
- Create: `tests/localization.test.js`

- [x] **Step 1: Add localization regression test**

Create `tests/localization.test.js`:

```js
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('core Russian UI strings are readable UTF-8', () => {
  const source = fs.readFileSync('public/translations.js', 'utf8');
  assert.equal(/Рџ|РЎ|Рќ|Рґ|Р Р|СЃ|вЂ|в‚|Ð|Ñ/u.test(source), false);
  assert.equal(source.includes('Играть'), true);
  assert.equal(source.includes('Маркетинг'), true);
  assert.equal(source.includes('Обучение'), true);
});
```

- [x] **Step 2: Run the failing test before cleanup**

Run:

```powershell
node --test tests/localization.test.js
```

Result: the regression test now passes after cleanup.

- [x] **Step 3: Replace runtime-decoded strings with real UTF-8**

In `public/translations.js`, stored localization values were normalized to readable UTF-8. Compatibility helper names remain exported for the existing frontend.

- [ ] **Step 4: Update stale product copy**

Update `README.md` and `docs/teacher-demo-checklist.md` so all demo references say:

```text
30 ходов
30 минут на ход
Cloudflare-ссылка из desktop-приложения
```

- [ ] **Step 5: Verify stable foundation**

Run:

```powershell
npm run check
npm test
npm run screenshots:defense
npm audit --omit=dev
```

Expected: all pass; screenshots show readable Russian with no visible mojibake.

Current verification: `npm run check`, `npm test`, `npm run screenshots:defense`, and `npm audit --omit=dev` pass.

Additional progress: player summaries now expose `nextAction`, and the game HUD shows a clickable "Следующее действие" chip that routes a student to the required tab/department or to turn resolution when the core loop is ready.

Additional progress: `classReadiness` now includes a teacher `briefing` with class status, recommended next action, and discussion prompts. The teacher panel renders this as a "Брифинг занятия" card so the host can see what to do before advancing the room.

Additional progress: room summaries now expose a scenario `lessonPlan` with objectives, first steps, success criteria, metrics, and discussion prompts. The create-room preview, lobby overview, and teacher panel render this plan so a teacher can launch a scenario as a prepared lesson rather than a raw game mode.

Additional progress: room summaries now expose `classDebrief`, a post-match/readiness analysis for the whole class with winner reasoning, class metrics, common mistakes, discussion prompts, and next lesson focus. The results screen and JSON exports include this debrief for teacher review after the match.

### Task 2: Split The Largest Product Surfaces

**Files:**
- Modify: `server.js`
- Create: `server/factory/economy.js`
- Create: `server/room/timers.js`
- Create: `server/persistence/store.js`
- Modify: `test/stabilization.test.js`
- Create: `tests/factory-economy.test.js`

- [ ] **Step 1: Extract factory economy helpers behind tests**

Create `tests/factory-economy.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { clearOrderBook } = require('../server/factory/economy');

test('clearOrderBook sells cheaper offers first', () => {
  const result = clearOrderBook({
    demand: 3,
    offers: [
      { playerId: 'expensive', price: 7000, quantity: 3, suitability: 80 },
      { playerId: 'cheap', price: 6100, quantity: 2, suitability: 60 },
    ],
  });
  assert.equal(result.book[0].playerId, 'cheap');
  assert.equal(result.book[0].sold, 2);
  assert.equal(result.book[1].sold, 1);
});
```

- [ ] **Step 2: Implement the extracted helper**

Create `server/factory/economy.js`:

```js
function clearOrderBook({ demand, offers }) {
  let remainingDemand = Math.max(0, Number(demand || 0));
  const book = [...offers]
    .filter(offer => Number(offer.quantity || 0) > 0)
    .sort((left, right) => Number(left.price || 0) - Number(right.price || 0)
      || Number(right.suitability || 0) - Number(left.suitability || 0))
    .map(offer => {
      const sold = Math.min(remainingDemand, Number(offer.quantity || 0));
      remainingDemand -= sold;
      return { ...offer, sold, remaining: Number(offer.quantity || 0) - sold };
    });

  return { book, remainingDemand };
}

module.exports = { clearOrderBook };
```

- [ ] **Step 3: Move matching logic from `advanceFactoryRoom`**

Replace the duplicated sorting/selling block in `server.js` with `clearOrderBook()`, keeping the existing revenue/payroll mutation in `advanceFactoryRoom`.

- [ ] **Step 4: Extract timers and persistence only after economy extraction passes**

Move `processRoomTimers`, `startRoomTicker`, `stopRoomTicker` to `server/room/timers.js`. Move DB read/write helpers to `server/persistence/store.js`. Keep public exports from `server.js` compatible with existing tests.

- [ ] **Step 5: Verify refactor safety**

Run:

```powershell
npm run check
npm test
```

Expected: no behavior change in room lifecycle, save/load, timer, factory sale clearing.

### Task 3: Build Simformer-Like Course Mode

**Files:**
- Modify: `server.js`
- Create: `server/classroom/courses.js`
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Create: `tests/course-mode.test.js`

- [ ] **Step 1: Define course/session model**

Create `server/classroom/courses.js`:

```js
function createCourse({ title, teacherName }) {
  return {
    id: `course_${Date.now().toString(36)}`,
    title: String(title || 'Учебный курс').slice(0, 80),
    teacherName: String(teacherName || 'Преподаватель').slice(0, 80),
    sessions: [],
    createdAt: Date.now(),
  };
}

function addCourseSession(course, { roomCode, scenarioKey, label }) {
  const session = {
    id: `session_${Date.now().toString(36)}_${course.sessions.length + 1}`,
    roomCode,
    scenarioKey,
    label: String(label || 'Занятие').slice(0, 80),
    startedAt: Date.now(),
  };
  course.sessions.push(session);
  return session;
}

module.exports = { createCourse, addCourseSession };
```

- [ ] **Step 2: Add course tests**

Create `tests/course-mode.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCourse, addCourseSession } = require('../server/classroom/courses');

test('course stores multiple classroom sessions', () => {
  const course = createCourse({ title: 'Экономика 10 класс', teacherName: 'Учитель' });
  addCourseSession(course, { roomCode: 'ABC123', scenarioKey: 'motorcycles', label: 'Производство' });
  assert.equal(course.sessions.length, 1);
  assert.equal(course.sessions[0].scenarioKey, 'motorcycles');
});
```

- [ ] **Step 3: Add teacher-facing course screen**

Add a lightweight `Класс` screen in `public/index.html` and render:

```text
Курс
Занятия
Команды
Экспорт результатов
```

Do not add accounts yet; store local course data in the existing JSON DB.

- [ ] **Step 4: Add result export per course**

Extend existing JSON export so it includes `courseId`, `sessionId`, `roomCode`, final leaderboard, student result and teacher notes.

- [ ] **Step 5: Verify classroom mode**

Run:

```powershell
npm test
npm run screenshots:defense
```

Expected: teacher can create a local course, launch a session, finish a match, export session results.

### Task 4: Deepen Business Economy And Bots

**Files:**
- Modify: `server/factory/economy.js`
- Modify: `server/factory/summary.js`
- Modify: `server.js`
- Modify: `public/app.js`
- Create: `tests/economy-balance.test.js`

- [ ] **Step 1: Add cost/profit regression tests**

Create `tests/economy-balance.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateUnitEconomics } = require('../server/factory/economy');

test('unit economics exposes margin and break-even price', () => {
  const result = calculateUnitEconomics({
    components: [
      { key: 'frame', unitCost: 900, recipe: 1 },
      { key: 'engine', unitCost: 1500, recipe: 1 },
    ],
    payrollPerTurn: 6000,
    plannedUnits: 3,
  });
  assert.equal(result.componentCost, 2400);
  assert.equal(result.breakEvenPrice, 4400);
});
```

- [ ] **Step 2: Add `calculateUnitEconomics`**

Add to `server/factory/economy.js`:

```js
function calculateUnitEconomics({ components, payrollPerTurn, plannedUnits }) {
  const units = Math.max(1, Number(plannedUnits || 1));
  const componentCost = components.reduce((sum, item) => sum + Number(item.unitCost || 0) * Number(item.recipe || 0), 0);
  const payrollPerUnit = Math.ceil(Number(payrollPerTurn || 0) / units);
  return {
    componentCost,
    payrollPerUnit,
    breakEvenPrice: componentCost + payrollPerUnit,
  };
}
```

- [ ] **Step 3: Show student-facing unit economics**

Render in marketing:

```text
Себестоимость
Безубыточная цена
Маржа при моей цене
Почему заявка может не продаться
```

- [ ] **Step 4: Upgrade bot decision quality**

Bots should:

1. buy the cheapest required scarce lot first;
2. hire only when expected assembly capacity increases;
3. price near recommended price, not random noise;
4. stop overproducing when storage is full or demand is weak.

- [ ] **Step 5: Verify balance**

Run 20 simulated rooms through a small script and assert:

```text
at least one bot sells by turn 3
no default easy room bankrupts before turn 5
leader changes in at least 25% of runs
```

### Task 5: Add AnyLogic-Lite Scenario Builder

**Files:**
- Create: `server/scenarios/schema.js`
- Create: `server/scenarios/defaults.js`
- Create: `tests/scenario-schema.test.js`
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`

- [ ] **Step 1: Define scenario JSON schema**

Create `server/scenarios/schema.js`:

```js
function validateScenarioDefinition(definition) {
  const errors = [];
  if (!definition || typeof definition !== 'object') errors.push('scenario must be an object');
  if (!definition.key) errors.push('key is required');
  if (!definition.productLabel) errors.push('productLabel is required');
  if (!Array.isArray(definition.components) || definition.components.length < 1) errors.push('at least one component is required');
  if (!definition.priceRange || Number(definition.priceRange.min) >= Number(definition.priceRange.max)) errors.push('priceRange must have min < max');
  return { ok: errors.length === 0, errors };
}

module.exports = { validateScenarioDefinition };
```

- [ ] **Step 2: Add schema tests**

Create `tests/scenario-schema.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateScenarioDefinition } = require('../server/scenarios/schema');

test('scenario definition requires components and valid price range', () => {
  const result = validateScenarioDefinition({ key: 'bad', productLabel: 'Товар', components: [], priceRange: { min: 10, max: 5 } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('at least one component is required'));
  assert.ok(result.errors.includes('priceRange must have min < max'));
});
```

- [ ] **Step 3: Build visual editor v1**

Add a `Конструктор` screen with form sections:

```text
Продукт
Компоненты
Поставщики
Работники
Спрос
Цена
События
```

Do not build free-form diagrams yet. Use structured forms first so students do not get lost.

- [ ] **Step 4: Save custom scenario locally**

Persist custom scenarios in the existing local DB and expose them in the create-room scenario dropdown after built-in scenarios.

- [ ] **Step 5: Verify custom scenario launch**

Run:

```powershell
npm test
npm run screenshots:defense
```

Expected: a teacher can create a simple custom product with two components, launch a room, assemble and sell one unit.

### Task 6: Add Experiment Runner And Reports

**Files:**
- Create: `server/experiments/runner.js`
- Create: `tests/experiment-runner.test.js`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `scripts/build-defense-bundle.js`

- [ ] **Step 1: Add deterministic experiment test**

Create `tests/experiment-runner.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { runParameterSweep } = require('../server/experiments/runner');

test('parameter sweep returns one result per parameter value', () => {
  const results = runParameterSweep({
    baseScenarioKey: 'motorcycles',
    parameter: 'basePrice',
    values: [6000, 6500, 7000],
    turns: 5,
    seed: 42,
  });
  assert.equal(results.length, 3);
  assert.deepEqual(results.map(item => item.value), [6000, 6500, 7000]);
});
```

- [ ] **Step 2: Implement experiment API as pure functions first**

`runParameterSweep()` should not depend on browser state. It should return:

```js
{
  value,
  finalScore,
  totalSales,
  avgPrice,
  bankruptcyCount,
  notes
}
```

- [ ] **Step 3: Add teacher experiment UI**

Add `Эксперименты` panel:

```text
Параметр
Значения
Количество ходов
Запустить сравнение
График результата
Экспорт CSV/JSON
```

- [ ] **Step 4: Add export**

Export experiment results as JSON first. CSV can be generated from the same result rows after JSON is stable.

- [ ] **Step 5: Verify with browser and tests**

Run:

```powershell
npm test
npm run screenshots:defense
```

Expected: teacher can compare at least three price values and see which one produced better score/sales.

### Task 7: Release `0.5.0` As Simulation Learning Platform

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/teacher-defense-brief.md`
- Modify: `docs/defense-qa.md`
- Generated: `dist/*`

- [ ] **Step 1: Set version after Tasks 1-6 pass**

Change:

```json
"version": "0.5.0"
```

- [ ] **Step 2: Run full release gate**

Run:

```powershell
npm run release:full
```

Expected: `READY_FULL_EXE`; setup, portable, unpacked ZIP, screenshots and defense bundle are fresh.

- [ ] **Step 3: Manual classroom smoke**

Checklist:

```text
student completes first turn without help
teacher sees help queue
custom scenario launches
experiment runner produces chart
Cloudflare link works from phone
results export opens as JSON
```

## Priority Order

1. Clean localization and docs.
2. Split the biggest files enough to work safely.
3. Add course/session layer.
4. Deepen economy and bot competition.
5. Add structured scenario builder.
6. Add experiment runner.
7. Release `0.5.0`.
