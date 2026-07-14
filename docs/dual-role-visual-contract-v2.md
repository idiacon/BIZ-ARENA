# Biz Arena Dual-Role Visual Contract v2

Дата фиксации: 2026-07-13.

Статус: обязательный контракт для desktop-first переработки teacher и student интерфейсов.

## Цель

Biz Arena использует один визуальный язык, но две разные рабочие поверхности:

- преподаватель: `Operations Center`, где главным объектом является состояние класса;
- ученик: `Premium Tycoon 2.5D`, где главным объектом является собственное предприятие;
- обе роли: постоянная навигация, classroom HUD, основная рабочая область и role action rail;
- вся информация поступает из текущего server-authoritative read model;
- декоративные mock-метрики запрещены.

Контракт не меняет экономику, API, правила ходов или student/teacher authority.

## Общий shell

Порядок постоянных зон:

1. `role-navigation` - левая навигация текущей роли.
2. `classroom-hud` - комната, соединение, ссылка/прогресс, таймер и профиль.
3. `primary-workspace` - Operations Center или 2.5D-фабрика.
4. `role-action-rail` - основное разрешенное действие текущей роли.

Главная action-зона остается семантически на одном месте во всех профилях. На минимальной ширине rail может стать компактным drawer, но название, данные, порядок фокуса и доступные действия не меняются.

## Общий classroom HUD

| Виджет | Роль | State path / вычисление | Единицы | 0 / missing / error | Проверка |
| --- | --- | --- | --- | --- | --- |
| Код комнаты | teacher, student | `state.room.code`, fallback `state.roomCode` | код | `ROOM----` | classroom screenshot flow создает комнату и проверяет topbar |
| Статус комнаты | teacher, student | `state.room.status` | `lobby/running/paused/finished` | `Не подключено` | state refresh меняет `data-status` и текст topbar |
| Транспорт | teacher, student | `state.realtimeConnected` | WebSocket / HTTP fallback | HTTP fallback | browser smoke без WS сохраняет рабочий UI |
| Подключились | teacher, student | `state.room.humanCount || state.room.playerCount` / `settings.maxPlayers` | игроки | `0` | join student обновляет topbar |
| Student link и QR | teacher only | `gameStudentClientUrl()` и `/api/qr?data=<url>` | URL / QR | QR скрыт, если URL пуст | teacher lobby screenshot содержит ссылку и QR |
| Прогресс команды | student only | `player.turnGuide.progress`, fallback `turnChecklist` | готовые шаги / всего | `0/5` | student route test меняет primary step |
| Таймер | teacher, student | `nextTickAt`, fallback `turnStartedAt + turnDurationMs` | `mm:ss` | `--:--`, если матч не running | screenshot flow проверяет timer node |
| Ход | teacher, student | `room.day / room.settings.dayLimit` | номер хода | `1 / 30` | next-turn API меняет HUD |
| Профиль | teacher, student | `player.userName`, fallback teacher account/profile | строка | `Biz Arena` | role screenshot проверяет имя и роль |

Student HUD не показывает QR и публичную ссылку. Teacher HUD не подменяет class state личной student-экономикой.

## Teacher Operations Center

Teacher UI использует teacher/full summary. Корневые источники:

- `state.room.teacherControls` - lifecycle, start gate и разрешенные teacher actions;
- `state.room.classReadiness` - готовность, блокеры, очередь помощи и маршрут класса;
- `state.room.classDashboard` - операции, финансы, заявки и leaderboard;
- `state.room.market`, `factoryScenario`, `factoryStats` - рынок;
- `state.room.activeEvent`, `teacherControls.eventCatalog` - события;
- `state.room.contractBoard` - заказы и итоговый экспорт.

| Блок | State path / формула | Единицы | 0 / missing / error | Regression evidence |
| --- | --- | --- | --- | --- |
| Готовность класса | `classReadiness.readyCount / total`, rows `readyForTurn` | команды | пустое состояние `Ученики еще не вошли` | create -> join -> ready screenshot |
| Застрявшие | `classReadiness.rows.filter(!readyForTurn)` | команды | `0`, success tone | action state меняет cockpit counters |
| Нет покупки | `rows.filter(noPurchase)` | команды | `0` | student purchase меняет server summary |
| Нет сотрудников | `rows.filter(noWorkers)` | команды | `0` | hire action меняет summary |
| Нет производства | `rows.filter(noProduction)` | команды | `0` | assembly action меняет summary |
| Нет продажи | `rows.filter(noSaleOffer)` | команды | `0` | sale offer action меняет summary |
| Риск банкротства | `rows.filter(debtRisk)` | команды | `0` | debt-risk fixture / state test |
| Очередь помощи | `classReadiness.helpQueue` и `room.helpRequests` | заявки | `Критических блокеров нет` | request/acknowledge/resolve API tests |
| Деньги класса | `sum(classDashboard.rows[].money)` | рубли | `0` | room action refresh changes dashboard |
| Запасы | `sum(rows[].finishedGoods)` | единицы | `0` | assembly changes aggregate |
| Сотрудники | `sum(rows[].workerCount)` | человек | `0` | hire changes aggregate |
| Заявки | `sum(rows[].saleQuantity)` | единицы | `0` | market action changes aggregate |
| Спрос | latest `room.market[].demand`; fallback class sale quantity / scenario max | единицы | scenario fallback | next turn updates market pulse |
| Продажи | latest `market.totalSales`; fallback sum dashboard sales | единицы | `0` | next turn changes market pulse |
| Средняя цена | latest `market.avgPrice`; fallback scenario max/base price | рубли | scenario fallback | next turn changes market pulse |
| Активное событие | `room.activeEvent` | событие | `Нет активного события` | force-event API/test |
| Управление ходом | `teacherControls.lifecycle` и `teacherControls.actions.*` | action permissions | disabled control с причиной | lifecycle transition tests |

Разрешенные teacher actions в этом визуальном блоке: `startGame`, `pause`, `resume`, `nextTurn`, `finish`, `forceEvent`, `forceDecisionRound`, `setPhaseLock`, `runExperiment`. UI не создает действие, которого нет в `teacherControls.actions`.

### Teacher visual priority

- на ширине от 1440 px минимум 70% main workspace занимает class data;
- первый viewport отвечает на вопросы: кто готов, кто застрял, где риск, что сделать сейчас;
- таблицы и сигналы важнее декоративной сцены;
- teacher action rail всегда доступен, но не перекрывает class data.

## Student Premium Tycoon

Student UI использует только `student-state-v2` и `student-v2` read models.

| Блок | State path / формула | Единицы | 0 / missing / error | Regression evidence |
| --- | --- | --- | --- | --- |
| Деньги | `state.player.money` | рубли | `0` | purchase/hire changes company KPI |
| Прибыль за ход | `player.lastTickBreakdown.profit || 0` | рубли / ход | `0` | next turn changes review/KPI |
| Долг | `state.player.debt` | рубли | `0` | finance action test |
| Стоимость | `state.player.netWorth` | рубли | `0` | state refresh changes company card |
| Компоненты | sum `player.factory.components[*].stock`, fallback `componentStock` | единицы | `0`, warehouse warning | purchase changes warehouse hotspot |
| Сотрудники | `player.factory.workers.length` | человек | `0`, workforce warning | hire changes workforce hotspot |
| Мощность | `player.factory.assemblyCapacity` | единицы / ход | `0`, assembly blocked | hire/automation changes capacity |
| Готовая продукция | `player.factory.finishedGoods` | единицы | `0` | assembly changes factory hotspot |
| Заявка | `factory.saleOffer.quantity * saleOffer.price` | единицы и рубли | `Нет активной заявки` | sale action changes market hotspot |
| Следующий шаг | `player.turnGuide.primaryKey`, fallback `nextGuidedFactoryStep()` | route key | первый незавершенный шаг | first-turn route test |
| Публичный рынок | latest `room.market`, `room.factoryStats`, `factoryScenario.marketBook` | спрос, цена, продажи | scenario fallback / empty state | market rail state test |
| Помощь | `room.helpRequest` только текущего viewer | request status | CTA `Позвать преподавателя` | request/cancel help tests |
| Запрос паузы | `room.pauseRequest` только текущего viewer | request status | CTA доступен по room state | pause request tests |

### Factory hotspots

2.5D-сцена содержит четыре постоянных интерактивных узла:

- `purchase` -> вкладка `purchase`;
- `workforce` -> `operations`, department `workforce`;
- `assembly` -> `operations`, department `assembly`;
- `market` -> вкладка `market`.

Hotspot использует кнопку, имеет видимый keyboard focus и текстовую подпись. Цвет отражает server state: neutral, warning, ready или blocked. Hotspot не выполняет экономическое действие напрямую: он открывает существующую рабочую поверхность.

На ширине от 1440 px factory scene занимает минимум 55% центральной student workspace. KPI и next action дополняют сцену, а не вытесняют ее.

## Запрещенные student surfaces

Student summary и DOM не должны содержать:

- `teacherControls` с разрешенными действиями;
- `classReadiness`, `classDashboard`, `classDebrief`;
- teacher event catalog и Crisis Card controls;
- `teacherAccountId`, auth/storage/admin state;
- чужие `factory`, `turnGuide`, внутренние затраты и будущие решения;
- фиктивную student-кнопку `next-turn` или `Завершить ход`, пока server authority не поддерживает student commit-turn.

Другие компании показываются только через публичный player shell и публичные market metrics.

## Performance profiles

| Профиль | Информация и controls | Student scene | Motion | Polling fallback |
| --- | --- | --- | --- | --- |
| Full | полные | high-detail 2.5D | rich, с reduced-motion fallback | 5000 ms |
| Standard | те же | medium-detail 2.5D | reduced | 8000 ms |
| Lite | те же | schematic/static | off | 12000 ms |

Все профили сохраняют навигацию, подписи, focus order и role action rail. Профиль меняет стоимость отрисовки, а не игровой контракт.

## Desktop matrix

| Viewport | Navigation rail | Action rail | Workspace behavior |
| --- | --- | --- | --- |
| 1000x760 | 76-84 px, compact labels | compact / accessible drawer | одна главная колонка, без horizontal page overflow |
| 1440x900 | 112-120 px | 248-272 px | целевая cockpit композиция |
| 1920x1080 | 112-120 px | 248-272 px | увеличивается workspace, не шрифт |
| 2560x1440 | 112-120 px | 248-272 px | ограниченные readable panel widths |
| 3440x1440 | 112-120 px | 248-272 px | центрирование и max-width внутренних таблиц, сцена остается главным фокусом |

Запрещено масштабировать font-size пропорционально viewport. Расширяется рабочая область, графики, таблицы и 2.5D-сцена.

## Baseline до переработки

Baseline сохранен локально в `tmp/dual-role-baseline-2026-07-13/` и не входит в Git:

- 12 PNG: lobby, teacher cockpit, student game, turn review и decision round;
- 24 layout audits на desktop matrix;
- 0 failed layout audits;
- `teacherGameVisible: true`;
- student capture подтвердил Lite mode;
- `audit.json` создан `2026-07-13T01:33:47.930Z`.

Baseline подтверждает корректность текущего overflow-контракта, но визуально фиксирует три проблемы: student scene не является центром композиции, teacher/student недостаточно различаются по структуре, а ultrawide растягивает content без сильного фокуса.

## Acceptance gates

1. Role/security tests проходят до и после визуальных правок.
2. Screenshot audit проходит на всех пяти desktop viewport без page overflow и browser errors.
3. Teacher/student используют только разрешенные state paths.
4. Full/Standard/Lite сохраняют одинаковые данные и controls.
5. Keyboard focus виден на navigation, hotspots, action rail и drawers.
6. `prefers-reduced-motion` отключает необязательное движение.
7. Browser и packaged Electron загружают локальные assets без внешней сети.
