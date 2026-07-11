# Biz Arena: feature pruning, performance, admin design plan

Дата: 2026-06-20

## Цель

Перед дальнейшей разработкой нужно стабилизировать продукт вокруг реального сценария:

```text
KAI/VPS Cloud Classroom + Local Classroom fallback
```

Не добавляем новые экономические механики, пока не разгрузим UI, не уберем legacy-контур и не доведем teacher/admin panel до понятного рабочего cockpit.

## Текущая картина

Крупные файлы:

```text
server.js              ~6113 строк
public/app.js          ~7058 строк
public/styles.css      ~8319 строк
public/index.html      ~1359 строк
public/translations.js ~2220 строк
```

Главный риск не в отсутствии функций, а в смешении ролей:

- student gameplay;
- in-game teacher panel;
- `/server` local admin center;
- cloud/VPS teacher overview;
- release/defense/demo leftovers;
- legacy tunnel/Oracle docs.

## Product scope

### Keep: нужно для v0.7 beta

| Area | Why |
| --- | --- |
| Local Classroom | fallback для аудиторий без сервера/интернета |
| VPS/KAI Cloud Classroom | основной путь вместо Oracle |
| Teacher accounts | защита cloud rooms |
| Guest students | низкий friction входа учеников |
| SQLite durable storage | простой restart-safe backend на VPS |
| WebSocket invalidation + polling fallback | real-time без полной переписи |
| `/server` network/admin center | стартовый экран преподавателя/админа |
| In-game teacher cockpit | управление занятием во время матча |
| Student first-turn route | снижает хаос первого хода |
| Crisis Cards | полезно для демонстрации и методики |
| LAN Network Doctor + QR | нужен для Local fallback |
| KAI server package | текущий delivery artifact |

### Cut or legacy: кандидаты на cleanup

| Candidate | Decision |
| --- | --- |
| Cloudflare quick tunnel UI/scripts | legacy/unsupported; убрать из видимых flow и release docs, затем удалить после проверки Electron fallback |
| `tools/cloudflared*` binaries/logs | не нужны для VPS/KAI path; удалить из beta/release, оставить только если старые тесты требуют |
| Oracle as primary path | demote to optional archive; VPS/KAI is primary |
| Old cloud/free-hosting wording | заменить на VPS-first wording |
| Duplicate teacher instructions with old version numbers | rewrite or remove from packages |
| Old docs that claim Cloudflare/Oracle primary | archive-only, not release-facing |

### Later: не делаем сейчас

| Feature | Reason |
| --- | --- |
| React rewrite | риск большой, не нужен для beta |
| PostgreSQL/Redis | VPS + SQLite достаточно для класса |
| P2P/WebRTC | не снимает hosting problem |
| New industries/economy | усложнит UI до cleanup |
| Custom scenario editor | после admin UX |
| Full Thin Client v2 | отдельно после render pipeline cleanup |

## Performance targets

### Problem 1: full rerender on every refresh

`public/app.js` still calls many render functions on state refresh/error:

```text
renderRoomOverview()
renderCompany()
renderFactoryOperations()
renderFactoryPurchases()
renderTickBreakdown()
renderIntel()
renderMarket()
renderPlayerList()
renderCompetitors()
renderLeaderboard()
renderLog()
renderGameHud()
renderTeacherPanel()
renderResultsOverview()
renderCareer()
renderAchievements()
```

Target:

- add a small `renderSection(key, signature, fn)` helper;
- start with low-risk sections: teacher panel, market, log, leaderboard, room overview;
- only update DOM when signature changed;
- preserve drafts/focused inputs.

### Problem 2: one huge `public/app.js`

Do not introduce a bundler yet. First split by responsibility only if it stays browser-native:

```text
public/admin-ui.js
public/student-ui.js
public/render-cache.js
```

This should happen after signature caching lands, not before.

### Problem 3: CSS is too large and mixed

Do not redesign everything at once. Add a dedicated admin design layer first:

```text
server-admin-*
teacher-cockpit-*
student-route-*
```

Then remove old duplicate styles after screenshots/browser QA.

## Admin panel UX direction

Use a dense operational dashboard, not a marketing page.

Design rules from `ui-ux-pro-max`:

- dark operational dashboard, high contrast;
- minimal animation, 150-300ms only;
- visible focus states;
- no decorative infinite animation;
- no mobile horizontal overflow;
- tables switch to stacked cards on narrow screens;
- no emoji icons as UI controls.

### `/server` screen

Purpose: стартовый центр и сетевой/серверный cockpit.

Top priority blocks:

1. Server status: health, mode, storage, public/client URLs.
2. Room launch gate: who joined, who ready, can start.
3. Student entry: QR, copy link, room code.
4. Admin controls: start, pause, resume, next turn, finish.
5. Help queue: stuck teams and why.
6. KAI/VPS deployment hints only when relevant.

### In-game teacher panel

Purpose: управление занятием внутри матча.

Top priority blocks:

1. What to do now.
2. Class route map: Buy -> Hire -> Assemble -> Sell -> Finish.
3. Help queue by blocker.
4. Command bar: pause/resume/next/finish.
5. Crisis Cards.
6. Metrics/debrief.

Lower priority:

- experiment runner;
- detailed snapshots;
- raw event dropdown;
- deep ranking tables.

## First implementation slice

### Slice A: cleanup release-facing legacy

1. Make VPS/KAI the primary cloud target in README and runbooks.
2. Keep Oracle docs as optional/archive, not primary.
3. Remove Cloudflare tunnel wording from release-facing docs.
4. Ensure `тест бета/KAI-Server-*` contains only current VPS/KAI server docs.

Verification:

```bash
npm run check
npm test
npm run smoke:vps
npm run release:kai-server-package
```

### Slice B: render cache foundation

1. Add `renderSignature()` and `renderCachedSection()`.
2. Apply to `renderTeacherPanel()` first.
3. Add test/DOM smoke marker that teacher panel still renders readiness and controls.
4. Verify unchanged state refresh does not rewrite teacher panel DOM.

### Slice C: admin panel redesign

1. Reorder `/server` admin overview into priority cockpit.
2. Collapse secondary analytics behind tabs/sections.
3. Make command bar sticky inside admin area.
4. Add clear empty states: no room, lobby waiting, running, paused, finished.
5. Browser QA desktop/tablet/mobile.

## Stop condition for this phase

This phase is done when:

- release-facing docs say VPS/KAI first;
- legacy Cloudflare is not presented as an option;
- teacher/admin panels are role-clear;
- repeated polling/WS unchanged state does not repaint the largest panels;
- `KAI-Server` package is rebuilt and copied to `тест бета`;
- checks/smokes pass.
