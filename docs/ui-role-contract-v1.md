# Biz Arena v1.0 UI Role Contract

Дата: 2026-06-30

Цель этого контракта - зафиксировать, какие поверхности интерфейса видит каждая роль. Это нужно перед дальнейшей чисткой функций: удаляем и скрываем только то, что не входит в роль, а не то, что случайно выглядит лишним.

## Роли

### Server/Admin

Экран: `/server`.

Назначение: стартовый центр преподавателя и админа сервера.

Должно быть видно:

- создать игру;
- выйти;
- статус сервера, storage, mode, health;
- QR/LAN или публичная ссылка для учеников;
- список комнат и выбранная комната;
- who joined / who ready;
- можно ли запускать матч;
- pause, resume, next turn, finish;
- help queue: застрявшие команды и причина;
- Network Doctor только для Local Classroom;
- KAI/VPS hints только для cloud/server deployment.

Не должно быть основным путем:

- Cloudflare tunnel;
- P2P/WebRTC;
- React/Unity rewrite hints;
- настройки ученика и личный профиль.

### Teacher In-Game

Экран: `game-screen`, роль `teacher`.

Назначение: cockpit занятия во время матча.

Основная навигация: `Кабинет -> Комната -> Команды -> Рынок -> События -> Результаты -> Настройки`.

Runtime mapping: `teacher -> overview -> competitors -> market -> events -> statistics`, а `Настройки` открывают отдельный `settings-screen`. Преподаватель не получает ученические поверхности закупки и производства.

Должно быть видно:

- вкладка/панель преподавателя;
- что сделать сейчас;
- состояние класса;
- маршрут первого хода: buy, hire, assemble, sell, finish;
- stuck/no purchase/no workers/no production/no sale/bankruptcy risk;
- pause, resume, next turn, finish;
- Crisis Cards;
- classroom metrics, leaderboard, results/debrief.

Не должно смешиваться с учеником:

- teacher cockpit не обязан показывать личный пошаговый student primary action как главный блок;
- teacher-only controls не должны зависеть от `playerId` ученика;
- server admin actions остаются localhost-only в Local mode и teacher-token-only в Cloud mode.

### Student

Экран: `/client` или обычный browser join, роль `student`.

Назначение: быстрый вход и один понятный первый ход.

Основная навигация: `Обзор -> Закупка -> Производство -> Рынок -> Команда -> Отчёт`.

Runtime mapping: `overview -> purchase -> operations -> market -> competitors -> events`.

Должно быть видно:

- вход в комнату преподавателя;
- параметры занятия;
- преподаватель и другие ученики в лобби;
- кнопка готовности/принять участие;
- после старта: маршрут buy, hire, assemble, sell, finish;
- одна главная next-action подсказка;
- lite mode без тяжелых эффектов;
- только student summary, без teacher-only данных.

Не должно быть видно:

- teacher tab;
- Crisis Cards controls;
- server/admin controls;
- teacher event catalog;
- full class dashboard payload;
- local Network Doctor как основной путь.

## Проверяемые инварианты

- `GAME_TAB_ROLE_CONTRACT.student` не содержит `teacher`.
- `GAME_TAB_ROLE_CONTRACT.teacher` содержит `teacher`.
- Teacher и student sidebar разделены контейнерами `data-role-navigation="teacher|student"`; общей mixed-role группы нет.
- `body[data-screen="game-screen"][data-player-role="student"] .teacher-tab-button` скрыта.
- Основной game sidebar размечен `data-navigation-surface="game-sidebar"`.
- Единственная статическая игровая навигация размечена `data-navigation-surface="game-sidebar"`.
- Старый `legacy-tab-strip`, `advanced-tabs` wrapper и дублирующие `.tab-button` удалены из DOM.
- Browser QA проверяет видимые sidebar tabs отдельно для teacher и student.
- `/api/state?view=student` возвращает `summaryView: "student"` и не отдает teacher-only поля.

## Следующие cleanup-решения

1. Выполнено 2026-06-30: старый `legacy-tab-strip` удален после повторных зеленых browser QA проходов.
2. Выполнено 2026-07-01: role rendering вынесен в `student-ui`, `teacher-ui`, `server-admin-ui`; общий runtime и orchestration остаются в `public/app.js`.
3. Убрать release-facing Cloudflare/Oracle-primary формулировки из всех пакетов, если они снова появятся.
4. Сократить student game nav только после измерения: если первый ход все еще перегружен, скрыть `overview/events` в guided mode за вторичным разделом.

## Frontend Module Ownership

Порядок загрузки является частью runtime-контракта:

1. `translations.js` и `ui/role-contracts.js`.
2. `app-runtime.js` и общий `app.js`.
3. `ui/server-admin-ui.js`, `ui/student-ui.js`, `ui/teacher-ui.js`.
4. `app-bootstrap.js` проверяет наличие role-модулей и запускает приложение.

Role-модули не должны повторно объявлять функции друг друга. Следующий этап архитектуры - заменить оставшиеся общие lexical globals на узкие явные интерфейсы, сохранив этот порядок и текущие role-контракты.

## Teacher Lobby Preflight Contract

The teacher lobby start gate is a visible, testable contract. The UI exposes five stable step keys through `data-preflight-step`:

- `session` - an active room/session exists;
- `student-link` - student link and QR are ready;
- `students` - at least one student team joined the local classroom room;
- `readiness` - all visible classroom participants have accepted readiness;
- `settings` - scenario, turn time, and season length are set.

The teacher start button uses `data-preflight-action="start-match"` and is enabled only when `data-preflight-ready="true"` and `data-preflight-next="ready"`. Student lobby must not expose any `[data-preflight-action]` control and must not show the teacher settings panel as an editable surface.

The teacher lobby also exposes the server start decision through `data-start-gate-reason` and `data-start-gate-can-start` on `.teacher-lobby-start-gate`. Teacher "what to do now", class readiness, and the primary host action must read the same `teacherControls.startGate` contract instead of recomputing launch permission from local counters only.

## Server Start Gate Contract

`roomStartGate(room)` is the server authority for launching a match:

- Local classroom rooms require two ready class players: the local host plus at least one student team.
- Cloud teacher rooms require one ready class player because the teacher host is not a player company.
- `practiceMode: "demo"` and `practiceMode: "tutorial"` may start with one ready class player.
- `canStartMatch(room)` and `teacherControls.actions.startGame` must both use `roomStartGate(room).canStart`.

## Student State Contract

`/api/state?view=student` returns `stateContract: "student-state-v2"`.

- `room.summaryContract` must be `student-v2`.
- `player.playerContract` must be `student-player-v2`.
- Student room summary must not include `teacherAccountId`, teacher event catalog, `classReadiness`, `classDashboard`, `classDebrief`, `scenarioLab`, `scenarioExperiment`, or admin snapshots.
- Student player summary keeps the current team's first-turn route, factory state, purchase/personnel/assembly/market hints, unit economics, turn review, decision round, and score data.
- Student player summary must not include teacher/admin payloads or heavy strategy-only branches such as `executionPlan`, `intel`, `focusPlan`, `pivotPreview`, `operatingPlanPreview`, and `researchEffects`.
- During active play, `playerDebrief` is withheld from `student-player-v2`; it is only needed for the finished-results screen.
- Personnel hints in `student-player-v2` expose only the top classroom-useful candidates. The full room candidate pool remains in `room.factoryScenario` when the UI needs the broader market.

## Public Lobby Directory Contract

`GET /api/rooms/directory` is a separate pre-authentication contract. It is not part of `student-state-v2` and must not reuse Server/Admin or Teacher overview payloads.

- The response contract is `public-room-directory-v1`.
- Only rooms explicitly marked `listed`, still in `lobby`, and with a free participant slot may appear.
- Every entry uses an opaque random `directoryId`; the five-character room code is never returned by the directory or rendered into a lobby card.
- Allowed public fields are the teacher-provided room title, scenario label, occupancy, capacity, `status: "open"`, and `requiresCode: true`.
- Teacher account identifiers, email, player or company names, readiness, session tokens, links, QR data, IP addresses, controls, lesson guidance, dashboards, events, results, and room codes are forbidden.
- Choosing a directory entry does not create a session. `POST /api/rooms/join` still requires the exact five-character code and, for directory entry, must verify that `directoryId` and code refer to the same room.
- New participants may join only while the room is in `lobby`. Existing authenticated participants may reconnect to an active or paused room through their established session.
- Manual code entry and existing QR links remain valid fallback paths.
- Anonymous `/api/state` responses must not expose a parallel room list or room codes.

## Student First Turn UI Contract

The first-turn route panel exposes stable selectors:

- `.student-route-panel[data-student-flow-contract="first-turn-v2"]`;
- `data-student-primary-step`;
- `data-student-route-ready`;
- `data-student-problems`;
- five `[data-student-route-step]` nodes for `Купить -> Нанять -> Собрать -> Продать -> Завершить ход`.

The student route must keep one visible `.student-primary-next-action` button and must not expose teacher-only controls.

## Teacher Match Lifecycle Contract

Teacher/full room summaries expose `teacherControls.lifecycle.contract: "teacher-lifecycle-v1"`.

Authoritative phases:

- `lobby` - only `start-game` may enter the match, and only when `startGate.canStart` is true;
- `running` - `pause-game`, `next-turn`, and `finish-room` may be available;
- `paused` - `resume-game` and `finish-room` may be available;
- `finished` - match mutations are closed and `canOpenDebrief` is true.

Room disposal is a separate teacher-only lifecycle:

- `close-room` is available only for `lobby|finished` and removes the live room, player indexes, and resumable snapshot;
- `finish-and-close-room` is available only for `running|paused`, archives the completed session first, then removes the live room;
- both actions require an explicit browser confirmation in the teacher console;
- local disposal remains localhost-only; cloud disposal requires the owning teacher session;
- closing never deletes an archived completed-session report.

The lifecycle object exposes:

- `phase`, `phaseLock`, `primaryAction`, and `nextExpectedPhase`;
- `canStart`, `canPause`, `canResume`, `canAdvance`, `canFinish`, and `canOpenDebrief`;
- `day`, `dayLimit`, `finishReason`, and a compact readiness summary when available.

Server authority must reject invalid transitions even if a client sends an action directly:

- `pause-game` outside `running`;
- `resume-game` outside `paused`;
- `next-turn` outside `running` or while manual phase lock is not `open`;
- `finish-room` outside `running|paused`.
- `close-room` while a match is `running|paused`;
- any cloud close request from a teacher who does not own the room.

Room creation and retention limits:

- anonymous local creation is accepted only from the server host computer;
- one local client address or authenticated cloud teacher identity may create at most five rooms per ten-minute process window;
- a cloud teacher may keep at most three non-finished rooms and two listed lobbies;
- empty cloud lobbies expire after two hours, empty local lobbies after 24 hours, and finished live rooms after 24 hours;
- `running|paused` rooms are never removed by TTL cleanup.

Teacher cockpit exposes stable selectors:

- `data-teacher-lifecycle-contract="teacher-lifecycle-v1"`;
- `data-teacher-phase`;
- `data-teacher-primary-action`;
- `data-teacher-next-phase`.

Paused matches remain viewable as active matches after teacher reconnect. Business actions remain disabled because only navigation uses `running|paused`; economic mutations still require `running`.

## Results And Debrief Role Contract

- Teacher results root exposes `data-results-contract="class-debrief-v1"` and `data-results-role="teacher"`.
- Teacher class debrief uses `data-teacher-debrief-contract="class-debrief-v1"`.
- Student results root exposes `data-results-contract="student-results-v1"` and `data-results-role="student"`.
- Students receive their personal `playerDebrief` only after finish.
- Students must not receive or render `classDebrief`, the classroom report pack, teacher discussion prompts, or teacher action plan.
- Student result exports must omit the `classDebrief` and `teacherReportPack` keys; teacher result exports include both payloads.
