# Biz Arena Game Upgrade Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current defense-ready build into a cleaner, more maintainable and more playable upgrade pack without breaking the packaged Windows release flow.

**Architecture:** Keep the current vanilla Node/Electron/browser stack. First remove generated legacy release clutter, then split risky monolith work into small extraction tasks, then improve one gameplay surface at a time with regression tests and screenshots.

**Tech Stack:** Node.js, vanilla HTML/CSS/JS, Electron, electron-builder, `node:test`, local Browser/IAB screenshot verification.

---

## Current Audit

- `server.js` is the main backend monolith: 3849 lines.
- `public/app.js` is the main frontend monolith: 4267 lines.
- `public/styles.css` is 5153 lines.
- `public/translations.js` is 1344 lines and has RU/EN/TT blocks.
- `dist/` contains current v0.3.0 release artifacts plus obsolete v0.1/v0.2 executables.
- Root contains obsolete `Biz-Arena-for-teacher-2026-04-14.zip`.
- `test/server-refactor.test.js` and `tests/server-refactor.test.js` are byte-identical duplicates.
- Git executable is not currently available in PATH, so commits cannot be created from this shell until Git is installed or PATH is fixed.

---

### Task 1: Release Artifact Cleanup

**Files:**
- Delete generated obsolete files only: old v0.1/v0.2 executables/blockmaps and root teacher ZIP.
- Preserve: current v0.3.0 setup, portable, unpacked ZIP, defense bundle, manifests, `dist/win-unpacked`.

- [ ] **Step 1: List obsolete artifacts**

Run:

```powershell
Get-ChildItem D:\projects\dist -File |
  Where-Object { $_.Name -match '0\.1\.0|0\.2\.0|Biz Arena Setup 0\.1\.0|Biz Arena 0\.1\.0' } |
  Select-Object FullName,Length,LastWriteTime
Get-Item D:\projects\Biz-Arena-for-teacher-2026-04-14.zip
```

Expected: only old release files appear.

- [ ] **Step 2: Delete only resolved files inside the workspace**

Run:

```powershell
$targets = @(
  'D:\projects\Biz-Arena-for-teacher-2026-04-14.zip',
  'D:\projects\dist\Biz Arena Setup 0.1.0.exe',
  'D:\projects\dist\Biz Arena Setup 0.1.0.exe.blockmap',
  'D:\projects\dist\Biz Arena 0.1.0.exe',
  'D:\projects\dist\Biz-Arena-0.1.0-x64.exe',
  'D:\projects\dist\Biz-Arena-0.1.0-x64.exe.blockmap',
  'D:\projects\dist\Biz-Arena-0.2.0-x64.exe',
  'D:\projects\dist\Biz-Arena-0.2.0-x64.exe.blockmap'
)
foreach ($target in $targets) {
  $resolved = Resolve-Path -LiteralPath $target -ErrorAction SilentlyContinue
  if ($resolved -and $resolved.Path.StartsWith('D:\projects\')) {
    Remove-Item -LiteralPath $resolved.Path -Force
  }
}
```

- [ ] **Step 3: Verify current release files remain**

Run:

```powershell
Get-Item D:\projects\dist\Biz-Arena-0.3.0-Setup-x64.exe,
         D:\projects\dist\Biz-Arena-0.3.0-Portable-x64.exe,
         D:\projects\dist\Biz-Arena-v0.3.0-defense-bundle.zip
```

Expected: all three files exist.

---

### Task 2: Test Layout Cleanup

**Files:**
- Delete: `D:\projects\tests\server-refactor.test.js`
- Modify: `D:\projects\package.json`

- [ ] **Step 1: Verify duplicate hash**

Run:

```powershell
Get-FileHash D:\projects\test\server-refactor.test.js, D:\projects\tests\server-refactor.test.js
```

Expected: both hashes match.

- [ ] **Step 2: Remove duplicate file**

Delete only `D:\projects\tests\server-refactor.test.js`.

- [ ] **Step 3: Keep `npm test` working**

Run:

```powershell
npm test
```

Expected: test suite still passes. `node --test tests/*.test.js` must still pick up `tests/game-rules.test.js`.

---

### Task 3: Backend Boundary Map

**Files:**
- Create: `D:\projects\docs\upgrade-backend-map.md`
- No code changes yet.

- [ ] **Step 1: Document server.js ownership**

Write sections for:

```markdown
# Backend Boundary Map

## Current Monolith Sections
- persistence and migrations
- room lifecycle
- factory scenario
- player summaries
- teacher controls
- room timers
- static server

## First Safe Extractions
- move factory events/checklist/review helpers into `server/factory/summary.js`
- move timer helpers into `server/room/timers.js`
- move static serving into `server/http/static.js`

## Do Not Extract Yet
- room mutation actions that rely on shared closure state
- persistence migration code until snapshot tests are expanded
```

- [ ] **Step 2: Run checks**

Run:

```powershell
npm run check
```

Expected: unchanged green check.

---

### Task 4: Upgrade Pack Feature 1 - Market Decision Quality

**Files:**
- Modify: `D:\projects\server.js`
- Modify: `D:\projects\public\app.js`
- Modify: `D:\projects\public\styles.css`
- Test: `D:\projects\test\stabilization.test.js`

- [ ] **Step 1: Add regression test for stronger market hints**

Add a test that creates a factory demo room, sets an offer above market, calls `playerSummary`, and asserts `marketHints` includes a warning with expected demand or sale risk.

- [ ] **Step 2: Implement stronger market hint payload**

Extend `buildMarketHints(room, player)` to expose:

```js
{
  bestPrice,
  currentPrice,
  expectedUnits,
  saleRisk: 'low' | 'medium' | 'high',
  reasonKey
}
```

- [ ] **Step 3: Render it in Marketing**

In `public/app.js`, render a compact "Биржевой совет" panel in the marketing tab with current price, best price, expected units, and risk.

- [ ] **Step 4: Style without adding a new palette**

In `public/styles.css`, reuse existing cyan/green/gold/red tokens and keep the panel density close to the current reference.

- [ ] **Step 5: Verify**

Run:

```powershell
npm run check
npm test
npm run screenshots:defense
```

Expected: all green; `05-market-terminal.png` shows the improved market decision panel.

---

### Task 5: Upgrade Pack Feature 2 - Teacher Class Control

**Files:**
- Modify: `D:\projects\server.js`
- Modify: `D:\projects\public\app.js`
- Test: `D:\projects\test\stabilization.test.js`

- [ ] **Step 1: Add host-facing readiness assertions**

Extend existing teacher/class readiness tests to assert:

```js
assert.ok(summary.classReadiness.players.some(player => player.readyState));
assert.ok(summary.classReadiness.riskBuckets);
```

- [ ] **Step 2: Add class risk buckets**

Expose counts for:

```js
{
  noSaleOffer,
  noProduction,
  debtRisk,
  readyToAdvance
}
```

- [ ] **Step 3: Render in teacher panel**

Show a compact status row for the host: ready, no production, no sale offer, debt risk.

- [ ] **Step 4: Verify**

Run:

```powershell
npm test
```

Expected: teacher controls tests pass.

---

### Task 6: Final Release Refresh

**Files:**
- Generated: `D:\projects\defense-assets\screenshots\*.png`
- Generated: `D:\projects\dist\*.exe`
- Generated: `D:\projects\dist\*.zip`

- [ ] **Step 1: Capture screenshots**

Run:

```powershell
npm run screenshots:defense
```

- [ ] **Step 2: Build release**

Run:

```powershell
npm run dist:win
npm run release:zip-unpacked
npm run predefense:readiness
npm run release:defense-bundle
npm run predefense:readiness
```

Expected final status: `READY_FULL_EXE`.

---

## Execution Order

1. Task 1 now: safe generated-artifact cleanup.
2. Task 2 next: remove duplicate test if test suite stays green.
3. Task 4 first gameplay upgrade: marketing decision quality.
4. Task 5 second gameplay upgrade: teacher class control.
5. Task 3 can run in parallel as docs, but should be kept short.
6. Task 6 only after feature changes stabilize.
