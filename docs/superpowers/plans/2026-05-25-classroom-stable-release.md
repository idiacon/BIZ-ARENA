# Biz Arena Classroom Stable Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Довести текущую `0.4.0-alpha.1` до стабильной classroom-сборки, которую ученик понимает с первого запуска, а преподаватель может уверенно провести через интернет-комнату.

**Architecture:** Сохраняем Node + vanilla HTML/CSS/JS + Electron и текущий HTTP API. Изменения идут узкими проходами: сначала качество текста и smoke-релиз, затем измеримое первое знакомство, баланс экономики/ботов, устойчивость подключения и только после этого стабильная упаковка.

**Tech Stack:** Node.js, vanilla HTML/CSS/JS, Electron, electron-builder, Cloudflare Quick Tunnel, `node:test`, Browser screenshot QA.

---

## File Map

- `public/translations.js`: единый корректный UTF-8 словарь без runtime-исправления битой кодировки.
- `public/app.js`, `public/index.html`, `public/styles.css`: первый запуск, учебный маршрут и состояние подключения.
- `server.js`, `server/factory/summary.js`: экономика поставщиков, поведение ботов, summary для ученика и преподавателя.
- `desktop/main.js`, `desktop/preload.js`, `scripts/start-internet-room.js`: состояние туннеля и диагностика desktop-запуска.
- `test/stabilization.test.js`, `tests/factory-summary.test.js`: серверные регрессии gameplay/classroom flow.
- `tests/localization.test.js`: запрет возврата mojibake в видимые тексты.
- `scripts/capture-defense-screenshots.js`, `scripts/pre-defense-readiness.js`: подтверждение релиза.
- `docs/teacher-defense-brief.md`, `docs/teacher-demo-checklist.md`, `docs/internet-room-cloudflare.md`: сценарий показа и аварийный запуск.

### Task 1: Зафиксировать демонстрационную сборку `0.4.0-alpha.1`

**Files:**
- Modify: `docs/teacher-defense-brief.md`
- Generated: `dist/Biz-Arena-0.4.0-alpha.1-Setup-x64.exe`
- Generated: `dist/Biz-Arena-0.4.0-alpha.1-Portable-x64.exe`

- [ ] **Step 1: Проверить, что правила показа соответствуют игре**

Run:

```powershell
node -e "const fs=require('fs'); const s=fs.readFileSync('docs/teacher-defense-brief.md','utf8'); if(!s.includes('30 ход') || !s.includes('30 минут') || s.includes('10 минут')) process.exit(1)"
```

Expected: exit code `0`.

- [ ] **Step 2: Проверить приложение перед упаковкой**

Run:

```powershell
npm run check
npm test
npm audit --omit=dev
node scripts/start-internet-room.js --check
```

Expected: syntax and tests pass; audit reports `0 vulnerabilities`; output includes `cloudflared is ready`.

- [ ] **Step 3: Собрать установщик и portable-приложение**

Run:

```powershell
npm run dist:win
```

Expected: both `Setup-x64.exe` and `Portable-x64.exe` are recreated in `dist/`, and `dist/win-unpacked/resources/tools/cloudflared.exe` exists.

- [ ] **Step 4: Зафиксировать артефакты в readiness-отчете**

Run:

```powershell
npm run release:zip-unpacked
npm run predefense:readiness
```

Expected: readiness status is `READY_FULL_EXE`.

### Task 2: Убрать технический долг кодировки

**Files:**
- Modify: `public/translations.js`
- Create: `tests/localization.test.js`
- Modify: `package.json`

- [ ] **Step 1: Написать тест, запрещающий битую кодировку в словаре**

Create `tests/localization.test.js`:

```js
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('visible translations are stored as UTF-8 Russian, not mojibake', () => {
  const source = fs.readFileSync('public/translations.js', 'utf8');
  assert.equal(/[Р][џЅЎРњРµС]/u.test(source), false);
  assert.equal(source.includes('Профиль'), true);
  assert.equal(source.includes('Маркетинг'), true);
});
```

- [ ] **Step 2: Подключить тест к общей команде**

Modify the `test` script in `package.json` so its last segment is:

```json
"test": "node test\\game-rules.test.js && node test\\server-refactor.test.js && node test\\stabilization.test.js && node --test tests/*.test.js"
```

The glob already includes the new test; no new runner is needed.

- [ ] **Step 3: Заменить mojibake-литералы нормальным UTF-8**

In `public/translations.js`, store Russian and Tatar strings directly as readable UTF-8 and remove `decodeMojibakeText`, `CP1251_EXTRA_BYTES`, and `normalizeTranslationEncoding` only after the test passes with rendered UI labels.

- [ ] **Step 4: Проверить видимые языки**

Run:

```powershell
npm test
npm run screenshots:defense
```

Expected: tests pass; меню, обучение, маркетинг и итоги на русском не содержат строк вида `Рџ...`.

### Task 3: Проверить понятность первого хода на ученике

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `scripts/capture-defense-screenshots.js`

- [ ] **Step 1: Ввести критерии прохождения без подсказки преподавателя**

Use this observation card during three пробных запусков:

```markdown
| Проверка | Успех |
| --- | --- |
| Ученик находит кнопку обучения за 10 секунд | да/нет |
| Покупает первый лот без устного указания | да/нет |
| Нанимает сотрудника и собирает товар | да/нет |
| Понимает рекомендацию цены | да/нет |
| Завершает первый ход за 3 минуты | да/нет |
```

- [ ] **Step 2: Добавить только те UI-подсказки, на которых ошиблись минимум два ученика**

Keep the existing route data shape in `public/app.js`:

```js
{
  tab: 'purchase',
  label: 'Купить комплектующие',
  outcome: 'После закупки станет доступна сборка товара.'
}
```

Do not add full-screen explanation pages; extend the current compact route card and tutorial target highlighting.

- [ ] **Step 3: Снять регрессионные экраны**

Run:

```powershell
npm run screenshots:defense
```

Expected: screenshots include start, tutorial, purchase, marketing and results without overlaps at the defense viewport.

### Task 4: Углубить конкуренцию закупки и ботов

**Files:**
- Modify: `server.js`
- Modify: `server/factory/summary.js`
- Modify: `public/app.js`
- Modify: `test/stabilization.test.js`
- Modify: `tests/factory-summary.test.js`

- [ ] **Step 1: Добавить тест дефицита дешевого лота**

Extend `test/stabilization.test.js` using its existing `createStartedFactoryRoom()` helper:

```js
test('supplier scarcity gives a purchased cheap lot to only one company', () => {
  const { room, host, guest } = createStartedFactoryRoom();
  const cheapest = [...room.factoryScenario.supplierOffers].sort((a, b) => a.unitPrice - b.unitPrice)[0];
  bizArena.handleBusinessAction(room, host, {
    action: 'buy-supplier-offer',
    value: { offerId: cheapest.id, quantity: cheapest.quantity },
  });
  assert.throws(
    () => bizArena.handleBusinessAction(room, guest, {
      action: 'buy-supplier-offer',
      value: { offerId: cheapest.id, quantity: 1 },
    }),
    error => error.status === 404
  );
});
```

- [ ] **Step 2: Добавить разницу поставщиков по компонентам**

Keep supplier lots in `room.factoryScenario.supplierOffers` and include `componentKey`, `quantity`, `unitPrice`, `quality`, and `restockTurn`. Generate at least three offers per required component with a limited low-price lot.

- [ ] **Step 3: Настроить выбор бота**

In the existing factory bot turn in `server.js`, sort affordable supplier offers by total expected unit cost and buy the cheap required component before hiring extra staff or raising a sale offer.

- [ ] **Step 4: Вывести причину решения на экран**

Extend `marketHints`/`learningHints` in `server/factory/summary.js` with a short explanation when a missing cheap lot raises себестоимость; render that text in the existing student hint block.

- [ ] **Step 5: Проверить игровой баланс**

Run:

```powershell
npm test
```

Expected: two teams cannot buy the same depleted lot; bots consume cheap lots; the first turn remains completable without debt trap.

### Task 5: Сделать интернет-комнату надежной для урока

**Files:**
- Modify: `desktop/main.js`
- Modify: `desktop/preload.js`
- Modify: `public/app.js`
- Modify: `docs/internet-room-cloudflare.md`
- Create: `tests/internet-room-status.test.js`

- [ ] **Step 1: Описать состояния подключения тестом**

Create test assertions around a pure status mapper:

```js
assert.deepEqual(toPublicTunnelStatus({ state: 'starting', url: '' }).canCopy, false);
assert.deepEqual(toPublicTunnelStatus({ state: 'running', url: 'https://room.trycloudflare.com' }).canCopy, true);
assert.equal(toPublicTunnelStatus({ state: 'error', error: 'process exited' }).canRetry, true);
```

- [ ] **Step 2: Показать игроку диагностику без терминала**

Render statuses `Запуск`, `Ссылка готова`, `Соединение завершено`, `Повторить запуск` in the existing internet-room panel. Display only sanitized process error text, never command lines or local filesystem paths.

- [ ] **Step 3: Проверить реальное подключение**

Run the packaged app, create a quick tunnel, open its URL from a phone, join a room, pause the match from the host screen, and confirm the phone receives the paused status.

### Task 6: Выпустить `0.4.0` после classroom feedback

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/teacher-demo-checklist.md`
- Modify: `docs/defense-qa.md`
- Generated: `dist/*`

- [ ] **Step 1: Поднять версию только после прохождения Tasks 2-5**

Change:

```json
"version": "0.4.0"
```

- [ ] **Step 2: Выполнить полный release gate**

Run:

```powershell
npm run release:full
```

Expected: `check`, tests, screenshots, setup, portable EXE, unpacked ZIP and defense bundle are fresh and readiness ends with `READY_FULL_EXE`.

- [ ] **Step 3: Сделать smoke на чистом компьютере**

Install Setup, start a demo, start an internet link, join with a second device, complete one turn and open results. Repeat the first-turn path from Portable without installation.

## Execution Order

1. Сегодня перед показом: выполнить только Task 1 и не добавлять новые механики.
2. После обратной связи преподавателя: Task 2 и Task 3.
3. Перед реальной игрой класса: Task 4 и Task 5.
4. Когда smoke на двух устройствах стабилен: Task 6 и релиз `0.4.0`.
