const translations = window.BIZ_ARENA_TRANSLATIONS;
const SUPPORTED_LANGUAGES = window.BIZ_ARENA_SUPPORTED_LANGUAGES;
const {
  normalizeLanguage,
  decodeMojibakeText,
  applyRussianFallbackCopy,
  normalizeTranslationEncoding,
  normalizeObjectEncoding,
  normalizeVisibleTextEncoding,
} = window.BIZ_ARENA_TRANSLATION_HELPERS;

Object.assign(translations.ru, {
  eyebrow: 'Университетский чемпионатный симулятор',
  hero_lead: 'Учебный бизнес-симулятор для университетов с чемпионатным режимом, пошаговыми решениями и объяснимым рейтингом.',
  hero_demo_title: 'Готовый учебный матч',
  hero_demo_body: 'Запустите русскоязычный чемпионатный матч для занятия: производство, контракты, события, рейтинг и teacher-control в одном потоке.',
  badge_progress: 'Учебные цели',
  badge_research: 'Разбор + советник',
  main_menu_hint: 'Выберите режим показа, войдите в комнату и проведите занятие или демонстрацию от старта до итогов.',
  play_menu_hint: 'Создайте аудиторию, запустите демо-матч или вернитесь в активное занятие.',
  join_room_screen: 'Войти в комнату преподавателя',
  join_room_btn: 'Войти и ждать старт',
  join_hint: 'Введите код с экрана преподавателя. После входа нажмите “Готов”, дальше игра покажет первый шаг.',
  room_code: 'Код комнаты',
  company_name: 'Название команды',
  about_project_body: 'Учебный бизнес-симулятор для университетов с локальным запуском, LAN-сессиями и чемпионатным сценарием.',
  about_delivery_body: 'Комплект включает desktop-сборку, браузерный LAN-режим, презентацию, пояснительную записку и сценарий показа.',
  menu_join_game: 'Войти в аудиторию',
  companies_room: 'Участники комнаты',
  by_networth: 'По simulation score и капиталу',
  game_control_center: 'Центр управления занятием',
  competitors_title: 'Персонал',
  competitors_hint: 'Штат линии, пригодность и кандидаты для найма.',
  stats_title: 'Статистика',
  stats_hint: 'Исследования, спрос, продажи, прибыль и последние ходы.',
  intel_title: 'Советник',
  intel_hint: 'AI-куратор смены, рыночные сигналы и очередь действий для быстрого запуска шагов.',
  forecast_title: 'Операционная панель',
  brief_title: 'План действий',
  tab_teacher: 'Преподаватель',
  teacher_panel_title: 'Панель преподавателя',
  teacher_panel_hint: 'Инструменты хоста, темп занятия, учебные события и снимок KPI всего класса.',
  teacher_panel_empty: 'Панель преподавателя появится здесь для хоста комнаты.',
  teacher_controls_title: 'Управление занятием',
  teacher_controls_hint: 'Преподаватель управляет темпом, событиями и фазой обсуждения без перехода по карточкам игроков.',
  teacher_phase_title: 'Фаза занятия',
  teacher_phase_open: 'Открыть решения',
  teacher_phase_review: 'Фаза разбора',
  teacher_force_event: 'Учебное событие',
  teacher_force_event_button: 'Запустить событие',
  teacher_force_event_hint: 'Мгновенно включает управляемое событие рынка для обсуждения эффекта на класс.',
  teacher_force_round_title: 'Стратегическая дилемма',
  teacher_force_round_button: 'Запустить дилемму',
  teacher_force_round_hint: 'Создаёт управленческую дилемму для выбранной компании прямо во время занятия.',
  teacher_target_company: 'Компания для дилеммы',
  teacher_snapshot_title: 'Снимок KPI класса',
  teacher_snapshot_hint: 'Один экран для сравнения ранга, очков, денег, долга, контрактов и последнего результата.',
  teacher_snapshot_rank: 'Место',
  teacher_snapshot_company: 'Компания',
  teacher_snapshot_score: 'Очки',
  teacher_snapshot_cash: 'Деньги',
  teacher_snapshot_networth: 'Капитал',
  teacher_snapshot_debt: 'Долг',
  teacher_snapshot_contracts: 'Контракты',
  teacher_snapshot_risk: 'Риск',
  teacher_snapshot_last_action: 'Последний результат',
  teacher_snapshot_empty: 'Снимок класса появится после входа в комнату.',
  teacher_host_only: 'Эта вкладка доступна только преподавателю или хосту комнаты.',
  teacher_phase_badge: 'Текущая фаза',
  teacher_event_factory_demand_surge: 'Рыночный всплеск',
  teacher_event_city_festival: 'Городской фестиваль',
  teacher_event_premium_wave: 'Премиальный спрос',
  teacher_event_port_strike: 'Сбой поставок',
  teacher_event_innovation_grant: 'Инновационный грант',
  student_focus_title: 'Что делать сейчас',
  student_focus_hint: 'Короткий учебный цикл: решение, пересчёт, объяснение результата.',
  student_delta_title: 'Что изменилось',
  student_delta_hint: 'Сравните прибыль, продажи и активный риск после последнего тика.',
  student_score_title: 'Почему вы в рейтинге',
  student_score_hint: 'Simulation score объясняет, какие управленческие решения подняли или опустили компанию.',
  decision_round_force: 'Запустить учебную дилемму',
  decision_round_force_hint: 'Хост мгновенно создаёт стратегическую дилемму для текущей компании.',
  decision_round_card_title: 'Стратегическая дилемма',
  decision_round_card_hint: 'Выберите одно управленческое решение до следующего хода. Если пропустить выбор, система применит безопасный вариант.',
  decision_round_resolved: 'Решение применено',
  decision_round_no_active: 'Сейчас активной стратегической дилеммы нет.',
  decision_round_last_resolution: 'Последнее решение',
  decision_round_no_history: 'Стратегических решений ещё не было.',
  dept_plant_command: 'Управление заводом',
  dept_command_deck: 'Пульт управления',
  dept_storage: 'Склад',
  dept_warehouse: 'Склад закупок',
  dept_people: 'Люди',
  dept_people_office: 'Отдел персонала',
  dept_production: 'Производство',
  dept_assembly_hall: 'Сборочный цех',
  dept_revenue: 'Выручка',
  dept_sales_office: 'Отдел продаж',
  factory_market: 'Рынок',
  factory_dynamic: 'Динамика',
  factory_scenario: 'Сценарий',
  factory_shared_crew: 'Базовая заводская команда',
  factory_day: 'День',
  factory_turn: 'Ход',
  factory_component_lanes_stock: 'линий компонентов на складе',
  factory_hire_first_crew: 'Наймите первую команду',
  factory_suitability: 'Пригодность',
  factory_finished_ready: 'готово на складе',
  factory_offer_at: 'Заявка по',
  factory_warehouse_desc: 'Закупайте партии компонентов до конца хода. Сборочный цех может использовать только то, что уже лежит на складе.',
  factory_total_parts: 'деталей всего',
  factory_recipe: 'Рецепт',
  factory_lot: 'Партия',
  factory_each: 'за штуку',
  factory_buy_lot: 'Купить партию',
  factory_people_desc: 'Пригодность работников повышает выпуск и помогает выигрывать ценовые ничьи в книге заявок. Усиливайте команду перед следующим ходом.',
  factory_active_workers: 'активных работников',
  factory_avg_suitability: 'Средняя пригодность',
  factory_avg_suitability_hint: 'Сильная команда даёт более стабильный выпуск.',
  factory_payroll: 'Фонд оплаты',
  factory_payroll_hint: 'Ожидаемые зарплаты на следующий ход.',
  factory_open_candidates: 'Кандидаты',
  factory_open_candidates_hint: 'Свежие сотрудники, доступные к найму.',
  factory_exp: 'лет опыта',
  factory_per_turn: 'за ход',
  factory_hire: 'Нанять',
  factory_no_candidates: 'Сейчас нет доступных кандидатов.',
  factory_assembly_desc: 'Сборочный цех превращает детали и людей в готовый продукт. Следите за мощностью линии и запасом компонентов.',
  factory_units_ready: 'единиц мощности',
  factory_capacity_turn: 'Мощность за ход',
  factory_capacity_hint: 'Сколько единиц можно собрать на текущем ходе.',
  factory_finished_stock: 'Готовый склад',
  factory_on_hand: 'на складе',
  factory_built_last_turn: 'Собрано за ход',
  factory_built_last_turn_hint: 'Выпуск за предыдущий расчётный ход.',
  factory_assemble_one: 'Собрать 1 единицу',
  factory_assemble_max: 'Собрать максимум',
  factory_need_per_unit: 'Нужно на единицу',
  factory_sales_desc: 'Маркетинговый терминал выставляет цену и объём предложения на текущий ход. Если не выставить заявку, рынок не увидит ваш товар.',
  factory_listed: 'выставлено',
  factory_offer_price: 'Цена заявки',
  factory_order_book_entry: 'Текущая запись в книге заявок',
  factory_offer_quantity: 'Объём заявки',
  factory_committed_sale: 'единиц отправлено на рынок',
  factory_sold_last_turn: 'Продано за ход',
  factory_matched_previous: 'Сколько рынок забрал на прошлом ходу.',
  factory_sell_order: 'Заявка на продажу',
  factory_units: 'ед.',
  factory_set_price_quantity: 'Укажите цену и объём, чтобы отправить товар в книгу заявок.',
  factory_price: 'Цена',
  factory_quantity: 'Количество',
  factory_submit_order: 'Отправить заявку',
  factory_hold_stock: 'Оставить на складе',
  factory_price_rule: 'Правило рынка',
  factory_order_book: 'Книга заявок',
  factory_price_rule_hint: 'Сначала продаются более дешёвые заявки. При равной цене выигрывает более пригодная команда.',
  factory_command_desc: 'Используйте карту предприятия как учебный цикл: детали, люди, сборка, маркетинг и затем расчёт следующего хода.',
  factory_manual_turn_mode: 'Ручной режим ходов',
  factory_timed_flow: 'Автоматический поток',
  factory_cash: 'Деньги',
  factory_cash_hint: 'Бюджет на текущий ход.',
  factory_waiting_inventory: 'ожидает на складе',
  factory_current_offer: 'Текущая заявка',
  factory_current_offer_hint: 'Предложение, которое пойдёт в рынок на следующем ходу.',
  factory_last_action: 'Последнее действие',
  factory_no_action_yet: 'Действий пока не было',
  factory_latest_resolved: 'Последний рассчитанный результат',
  factory_turn_checklist: 'Чеклист хода',
  factory_factory_brief: 'Сводка завода',
  factory_upkeep: 'Издержки',
  factory_roles: 'Роли',
  factory_latest_order_book: 'Последняя книга заявок',
  factory_no_sales_yet: 'Продаж ещё нет',
  factory_sold_at: 'продано по',
  factory_order_summary_pending: 'Когда команды отправят заявки, здесь появится сводка хода.',
  factory_map: 'Карта предприятия',
  factory_product: 'Продукт',
  factory_demand_band: 'Диапазон спроса',
  factory_demand_band_hint: 'Ожидаемый спрос комнаты за ход до ценового давления.',
  factory_price_band_hint: 'Базовое окно цены для книги заявок.',
  factory_line_profile: 'Профиль линии',
  factory_upkeep_turn: 'издержки за ход',
  factory_component_lanes: 'компонентных линий',
  factory_orders_day: 'заказов/день',
  factory_lead_demand: 'Спрос',
  factory_lead_price_band: 'Диапазон цены',
  factory_portfolio_line: 'учебная производственная линия',
  operations_guide: 'Подсказка по циклу',
  guided_open_warehouse: 'Откройте склад закупок',
  guided_missing_part_outcome: 'После закупки сборочный цех сможет собрать готовую продукцию.',
  guided_open_people: 'Откройте отдел персонала',
  guided_no_workers_outcome: 'После найма сборочный цех покажет, сколько единиц можно собрать.',
  guided_open_assembly: 'Откройте сборочный цех',
  guided_ready_to_assemble_outcome: 'После сборки маркетинг сможет выставить товар в книгу заявок.',
  guided_open_sales: 'Откройте маркетинг',
  guided_stock_no_offer_outcome: 'После отправки заявки завершите ход, чтобы рынок рассчитал спрос.',
  guided_press_next_turn: 'Нажмите "Завершить ход"',
  market_overview_demand: 'Спрос',
  market_overview_matched: 'Продано рынком',
  market_overview_avg_price: 'Средняя цена',
  market_overview_stock: 'Ваш запас',
  market_overview_no_turns: 'Ходов ещё не было',
  market_order_book_title: 'Книга заявок',
  market_order_book_hint: 'Более дешёвые заявки исполняются первыми. При равной цене приоритет получает лучшая команда.',
  market_current_offer_title: 'Текущая заявка',
  market_current_offer_hint: 'Поставьте количество 0, если хотите удержать готовый запас до следующего хода.',
  market_no_orders: 'Пока ни одна заявка не исполнилась. Соберите товар и отправьте его в рынок.',
  market_book_qty: 'заявлено',
  market_book_sold: 'продано',
  market_book_left: 'осталось',
  market_book_suitability: 'Пригодность команды',
});

Object.assign(translations.en, {
  join_room_screen: 'Join the teacher room',
  join_room_btn: 'Join and wait',
  join_hint: 'Enter the code from the teacher screen. After joining, press Ready; the game will show the first step.',
  room_code: 'Room code',
  company_name: 'Team name',
  tab_teacher: 'Teacher',
  teacher_panel_title: 'Teacher console',
  teacher_panel_hint: 'Host tools, pacing controls, guided events, and a class KPI snapshot.',
  teacher_panel_empty: 'Teacher tools appear here for the room host.',
  teacher_controls_title: 'Classroom controls',
  teacher_controls_hint: 'The teacher controls pacing, events, and the discussion phase without opening each player card.',
  teacher_phase_title: 'Lesson phase',
  teacher_phase_open: 'Open decisions',
  teacher_phase_review: 'Review phase',
  teacher_force_event: 'Teaching event',
  teacher_force_event_button: 'Run event',
  teacher_force_event_hint: 'Immediately starts a guided market event for discussion.',
  teacher_force_round_title: 'Strategic dilemma',
  teacher_force_round_button: 'Run dilemma',
  teacher_force_round_hint: 'Creates a management dilemma for the selected company.',
  teacher_target_company: 'Dilemma target',
  teacher_snapshot_title: 'Class KPI snapshot',
  teacher_snapshot_hint: 'One screen for rank, score, cash, debt, contracts, and latest result.',
  teacher_snapshot_rank: 'Rank',
  teacher_snapshot_company: 'Company',
  teacher_snapshot_score: 'Score',
  teacher_snapshot_cash: 'Cash',
  teacher_snapshot_networth: 'Net worth',
  teacher_snapshot_debt: 'Debt',
  teacher_snapshot_contracts: 'Contracts',
  teacher_snapshot_risk: 'Risk',
  teacher_snapshot_last_action: 'Latest result',
  teacher_snapshot_empty: 'The class snapshot appears after joining a room.',
  teacher_host_only: 'This tab is only available to the room host.',
  teacher_phase_badge: 'Current phase',
});

const BASELINE_THEME = {
  '--body-bg': '#050b13',
  '--panel': '#0b1423',
  '--panel-soft': '#111d2f',
  '--line': '#223048',
  '--text': '#f6f8fc',
  '--muted': '#9aa8bd',
  '--accent': '#6d75ff',
  '--accent-2': '#31d9d2',
  '--accent-3': '#f0a12f',
  '--danger': '#ff5c80',
  '--button-text': '#ffffff',
  '--field-bg': '#08111f',
  '--panel-shadow': 'none',
  '--hero-note': '#31d9d2',
  '--accent-soft': 'rgba(109, 117, 255, 0.14)',
  '--accent-soft-strong': 'rgba(109, 117, 255, 0.22)',
  '--danger-soft': 'rgba(255, 92, 128, 0.14)',
  '--success': '#37e083',
  '--success-soft': 'rgba(55, 224, 131, 0.14)',
  '--warn': '#ffbe3d',
  '--warn-soft': 'rgba(255, 190, 61, 0.14)',
  '--surface-raised': '#0d1829',
  '--surface-glass': 'rgba(255, 255, 255, 0.04)',
  '--map-header-bg': '#0b1423',
  '--factory-node-bg': '#0b1423',
  '--factory-detail-bg': '#0b1423',
  '--dock-bg': '#07101d',
  '--dock-shadow': 'none',
  '--tutorial-panel-bg': '#0b1423',
  '--tutorial-shadow': 'none',
  '--visual-card-radius': '8px',
  '--visual-node-radius': '8px',
  '--visual-card-shadow': 'none',
};

const BACKGROUND_THEMES = {
  navy: BASELINE_THEME,
  midnight: BASELINE_THEME,
  aurora: BASELINE_THEME,
  daylight: BASELINE_THEME,
  ivory: BASELINE_THEME,
  mint: BASELINE_THEME,
};

const VISUAL_PRESETS = {
  factory_board: BASELINE_THEME,
  friendly_tycoon: BASELINE_THEME,
  industrial_sim: BASELINE_THEME,
};
const CLIENT_DIFFICULTY_CONFIGS = {
  easy: {
    key: 'easy',
    labelKey: 'difficulty_easy',
    uiMode: 'guided',
    visibleTabs: ['operations', 'competitors', 'purchase', 'market', 'overview', 'events'],
    advancedTabs: [],
    previewKey: 'difficulty_easy_hint',
  },
  normal: {
    key: 'normal',
    labelKey: 'difficulty_normal',
    uiMode: 'standard',
    visibleTabs: ['operations', 'competitors', 'purchase', 'market', 'overview', 'events'],
    advancedTabs: ['competitors', 'intel'],
    previewKey: 'difficulty_normal_hint',
  },
  hard: {
    key: 'hard',
    labelKey: 'difficulty_hard',
    uiMode: 'advanced',
    visibleTabs: ['operations', 'competitors', 'purchase', 'market', 'overview', 'events'],
    advancedTabs: ['competitors', 'intel'],
    previewKey: 'difficulty_hard_hint',
  },
};

const REFRESH_INTERVAL_MS = 5000;
const CLOUD_REFRESH_INTERVAL_MS = 8000;
const CLIENT_LITE_REFRESH_INTERVAL_MS = 12000;
const HIDDEN_REFRESH_INTERVAL_MS = 20000;
const TUTORIAL_COMPLETED_KEY = 'bizArenaTutorialCompleted';
const ROOM_MANAGED_SCREENS = ['lobby-screen', 'game-screen', 'results-screen'];
const ROOM_AUTO_ENTRY_SCREENS = ['create-room-screen', 'join-room-screen', 'main-menu-screen'];
const PERFORMANCE_MODES = ['auto', 'full', 'standard', 'lite'];
const REFRESH_CADENCES = ['auto', 'fast', 'normal', 'slow'];
const ANIMATION_MODES = ['auto', 'on', 'off'];

function normalizePerformanceMode(value) {
  return PERFORMANCE_MODES.includes(value) ? value : 'auto';
}
function normalizeRefreshCadence(value) {
  return REFRESH_CADENCES.includes(value) ? value : 'auto';
}

function normalizeAnimationMode(value) {
  return ANIMATION_MODES.includes(value) ? value : 'auto';
}

function requestedAppMode() {
  const params = new URLSearchParams(window.location.search);
  const queryMode = params.get('mode');
  if (['server', 'client', 'unified'].includes(queryMode)) return queryMode;
  if (window.location.pathname === '/server') return 'server';
  if (window.location.pathname === '/client') return 'client';
  return 'unified';
}

const state = {
  playerId: localStorage.getItem('bizArenaPlayerId') || '',
  sessionToken: localStorage.getItem('bizArenaSessionToken') || '',
  roomCode: localStorage.getItem('bizArenaRoomCode') || '',
  room: null,
  player: null,
  account: null,
  appMode: requestedAppMode(),
  runtimeMeta: null,
  serverOverview: null,
  teacherSessionToken: localStorage.getItem('bizArenaTeacherSessionToken') || '',
  teacherAccount: null,
  teacherOverview: null,
  completedSessions: [],
  realtimeSocket: null,
  realtimeKey: '',
  realtimeConnectKey: '',
  realtimeConnected: false,
  lastRoomVersion: 0,
  lastPlayerVersion: 0,
  renderCache: {},
  serverAdminSelection: {
    roomCode: '',
    playerId: '',
    metric: 'capital',
    day: '',
  },
  networkChecks: {},
  currentScreen: 'main-menu-screen',
  screenHistory: [],
  roomAutoOpenDismissed: false,
  currentGameTab: localStorage.getItem('bizArenaGameTab') || 'overview',
  factoryDepartment: localStorage.getItem('bizArenaFactoryDepartment') || 'command',
  factoryPurchaseComponent: localStorage.getItem('bizArenaFactoryPurchaseComponent') || '',
  settings: {
    language: normalizeLanguage(localStorage.getItem('bizArenaLanguage') || 'ru'),
    fontSize: localStorage.getItem('bizArenaFontSize') || '16',
    background: localStorage.getItem('bizArenaBackground') || 'navy',
    visualPreset: localStorage.getItem('bizArenaVisualPreset') || 'factory_board',
    performanceMode: normalizePerformanceMode(localStorage.getItem('bizArenaPerformanceMode') || 'auto'),
    refreshCadence: normalizeRefreshCadence(localStorage.getItem('bizArenaRefreshCadence') || 'auto'),
    animationMode: normalizeAnimationMode(localStorage.getItem('bizArenaAnimationMode') || 'auto'),
  },
  profile: {
    userName: localStorage.getItem('bizArenaUserName') || 'BizPlayer',
    avatar: localStorage.getItem('bizArenaAvatar') || '',
  },
  intelFeedback: {
    type: '',
    message: '',
  },
  tutorial: {
    active: false,
    stepIndex: 0,
    steps: [],
    completed: localStorage.getItem(TUTORIAL_COMPLETED_KEY) === '1',
  },
  factorySaleDraft: null,
  supplierPurchaseDrafts: {},
  refreshInFlight: false,
  refreshPendingAfterFlight: false,
  refreshIntervalHandle: null,
  refreshDebounceHandle: null,
  serverClockOffsetMs: 0,
  turnTimerHandle: null,
  appliedTheme: '',
  clientLaunchParamsApplied: false,
};

function stableRenderSignature(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(Date.now());
  }
}

function hasRenderSignatureChanged(key, value) {
  state.renderCache = state.renderCache || {};
  const signature = typeof value === 'string' ? value : stableRenderSignature(value);
  if (state.renderCache[key] === signature) return false;
  state.renderCache[key] = signature;
  return true;
}

function resetRenderCache(keys = null) {
  state.renderCache = state.renderCache || {};
  if (!keys) {
    state.renderCache = {};
    return;
  }
  keys.forEach(key => delete state.renderCache[key]);
}

const elements = {
  screens: document.querySelectorAll('.screen'),
  screenButtons: document.querySelectorAll('[data-open-screen]'),
  homeLinks: document.querySelectorAll('[data-home-link]'),
  backButtons: document.querySelectorAll('[data-back]'),
  serverHomeScreen: document.querySelector('#server-home-screen'),
  serverLocalUrl: document.querySelector('#server-local-url'),
  serverLanUrl: document.querySelector('#server-lan-url'),
  serverClientUrl: document.querySelector('#server-client-url'),
  serverClientLinks: document.querySelector('#server-client-links'),
  serverAdminOverview: document.querySelector('#server-admin-overview'),
  serverCopyButtons: document.querySelectorAll('[data-server-copy]'),
  serverPort: document.querySelector('#server-port'),
  serverModeStatus: document.querySelector('#server-mode-status'),
  teacherResumeRoom: document.querySelector('#teacher-resume-room'),
  serverExitButton: document.querySelector('#server-exit-button'),
  serverExitButtons: document.querySelectorAll('[data-server-exit]'),
  createForm: document.querySelector('#create-form'),
  joinForm: document.querySelector('#join-form'),
  demoStartButton: document.querySelector('#demo-start-button'),
  studentDemoStartButton: document.querySelector('#student-demo-start-button'),
  studentTutorialButtons: document.querySelectorAll('[data-student-start-tutorial]'),
  tutorialStartButton: document.querySelector('#tutorial-start-button'),
  gameTutorialButton: document.querySelector('#game-tutorial-button'),
  roomName: document.querySelector('#room-name'),
  createCompanyName: document.querySelector('#create-company-name'),
  createScenarioSelect: document.querySelector('#create-scenario-select'),
  createMaxPlayersSelect: document.querySelector('#create-max-players-select'),
  createDayLimitSelect: document.querySelector('#create-day-limit-select'),
  createTurnDurationSelect: document.querySelector('#create-turn-duration-select'),
  createDifficultySelect: document.querySelector('#create-difficulty-select'),
  createDifficultyButtons: document.querySelectorAll('[data-create-difficulty]'),
  createScenarioPreview: document.querySelector('#create-scenario-preview'),
  createRoomLiveSummary: document.querySelector('#create-room-live-summary'),
  roomCodeInput: document.querySelector('#room-code'),
  joinUserName: document.querySelector('#join-user-name'),
  joinCompanyName: document.querySelector('#join-company-name'),
  joinFormStatus: document.querySelector('#join-form-status'),
  roomOverview: document.querySelector('#room-overview'),
  sessionStatus: document.querySelector('#session-status'),
  companyOverview: document.querySelector('#company-overview'),
  runtimeMeta: document.querySelector('#runtime-meta'),
  tickBreakdown: document.querySelector('#tick-breakdown'),
  careerOverview: document.querySelector('#career-overview'),
  achievementList: document.querySelector('#achievement-list'),
  dayCounter: document.querySelector('#day-counter'),
  gameRoundInline: document.querySelector('#game-round-inline'),
  gameTurnTimer: document.querySelector('#game-turn-timer'),
  gameTurnLimit: document.querySelector('#game-turn-limit'),
  gameRoomCodeTopbar: document.querySelector('#game-room-code-topbar'),
  gameRoomMetaTopbar: document.querySelector('#game-room-meta-topbar'),
  gameServerStatusTopbar: document.querySelector('#game-server-status-topbar'),
  gameServerMetaTopbar: document.querySelector('#game-server-meta-topbar'),
  gameStudentLinkChip: document.querySelector('#game-student-link-chip'),
  gameStudentLinkLabel: document.querySelector('#game-student-link-label'),
  gameStudentLinkTopbar: document.querySelector('#game-student-link-topbar'),
  gameStudentLinkMeta: document.querySelector('#game-student-link-meta'),
  gameStudentQr: document.querySelector('#game-student-qr'),
  gameCopyStudentLink: document.querySelector('#game-copy-student-link'),
  gameProfileAvatar: document.querySelector('#game-profile-avatar'),
  gameProfileName: document.querySelector('#game-profile-name'),
  gameProfileRole: document.querySelector('#game-profile-role'),
  gameNextActionChip: document.querySelector('#game-next-action-chip'),
  gameNextActionTitle: document.querySelector('#game-next-action-title'),
  gameNextActionBody: document.querySelector('#game-next-action-body'),
  marketOverview: document.querySelector('#market-overview'),
  marketEvent: document.querySelector('#market-event'),
  contractBoard: document.querySelector('#contract-board'),
  segmentsOverview: document.querySelector('#segments-overview'),
  gameMarketRail: document.querySelector('.game-market-rail'),
  statisticsOverview: document.querySelector('#statistics-overview'),
  statisticsTrend: document.querySelector('#statistics-trend'),
  turnReportSummary: document.querySelector('#turn-report-summary'),
  teacherPanel: document.querySelector('#teacher-panel'),
  playerList: document.querySelector('#player-list'),
  leaderboard: document.querySelector('#leaderboard'),
  leaderboardGame: document.querySelector('#leaderboard-game'),
  leaderboardResults: document.querySelector('#leaderboard-results'),
  competitorList: document.querySelector('#competitor-list'),
  eventLog: document.querySelector('#event-log'),
  eventLogGame: document.querySelector('#event-log-game'),
  eventLogResults: document.querySelector('#event-log-results'),
  intelOverview: document.querySelector('#intel-overview'),
  intelBrief: document.querySelector('#intel-brief'),
  focusProductSelect: document.querySelector('#focus-product-select'),
  saveFocusPlan: document.querySelector('#save-focus-plan'),
  playerCount: document.querySelector('#player-count'),
  roomCodeChip: document.querySelector('#room-code-chip'),
  buildBadge: document.querySelector('#build-badge'),
  resultsStatus: document.querySelector('#results-status'),
  resultsOverview: document.querySelector('#results-overview'),
  gameHud: document.querySelector('#game-hud'),
  gameTabs: document.querySelectorAll('[data-game-tab]'),
  gamePanels: document.querySelectorAll('[data-game-panel]'),
  factoryOperations: document.querySelector('#factory-operations'),
  factoryPurchases: document.querySelector('#factory-purchases'),
  legacyOperationsGrid: document.querySelector('#legacy-operations-grid'),
  factoryMarket: document.querySelector('#factory-market'),
  turnControlDock: document.querySelector('#turn-control-dock'),
  priceInput: document.querySelector('#price-input'),
  priceValue: document.querySelector('#price-value'),
  statCardTemplate: document.querySelector('#stat-card-template'),
  actionButtons: document.querySelectorAll('[data-action]'),
  productSelect: document.querySelector('#product-select'),
  citySelect: document.querySelector('#city-select'),
  specializationSelect: document.querySelector('#specialization-select'),
  boardPolicySelect: document.querySelector('#board-policy-select'),
  strategySelect: document.querySelector('#strategy-select'),
  researchSelect: document.querySelector('#research-select'),
  profileToggle: document.querySelector('#profile-toggle'),
  settingsToggle: document.querySelector('#settings-toggle'),
  profileUsername: document.querySelector('#profile-username'),
  profileAvatar: document.querySelector('#profile-avatar'),
  profileAvatarPreview: document.querySelector('#profile-avatar-preview'),
  profileAvatarFallback: document.querySelector('#profile-avatar-fallback'),
  saveProfile: document.querySelector('#save-profile'),
  clearAvatar: document.querySelector('#clear-avatar'),
  profileStatus: document.querySelector('#profile-status'),
  languageSelect: document.querySelector('#language-select'),
  fontSizeSelect: document.querySelector('#font-size-select'),
  backgroundSelect: document.querySelector('#background-select'),
  visualPresetSelect: document.querySelector('#visual-preset-select'),
  performanceModeSelect: document.querySelector('#performance-mode-select'),
  performanceModeSummary: document.querySelector('#performance-mode-summary'),
  refreshCadenceSelect: document.querySelector('#refresh-cadence-select'),
  animationModeSelect: document.querySelector('#animation-mode-select'),
  saveSettings: document.querySelector('#save-settings'),
  roomSettingsForm: document.querySelector('#room-settings-form'),
  maxPlayersSelect: document.querySelector('#max-players-select'),
  demandProfileSelect: document.querySelector('#demand-profile-select'),
  scenarioSelect: document.querySelector('#scenario-select'),
  difficultySelect: document.querySelector('#difficulty-select'),
  dayLimitSelect: document.querySelector('#day-limit-select'),
  turnDurationSelect: document.querySelector('#turn-duration-select'),
  toggleReady: document.querySelector('#toggle-ready'),
  saveRoomButton: document.querySelector('#save-room-button'),
  loadRoomButton: document.querySelector('#load-room-button'),
  saveRoomButtonGame: document.querySelector('#save-room-button-game'),
  loadRoomButtonGame: document.querySelector('#load-room-button-game'),
  leaveGameButton: document.querySelector('#leave-game-button'),
  saveSlotStatus: document.querySelector('#save-slot-status'),
  playAgain: document.querySelector('#play-again'),
  exportResults: document.querySelector('#export-results'),
  leaveAfterResults: document.querySelector('#leave-after-results'),
  tutorialOverlay: document.querySelector('#tutorial-overlay'),
  tutorialFocusRing: document.querySelector('#tutorial-focus-ring'),
  tutorialStepChip: document.querySelector('#tutorial-step-chip'),
  tutorialProgressBar: document.querySelector('#tutorial-progress-bar'),
  tutorialRoute: document.querySelector('#tutorial-route'),
  tutorialTitle: document.querySelector('#tutorial-title'),
  tutorialText: document.querySelector('#tutorial-text'),
  tutorialHint: document.querySelector('#tutorial-hint'),
  tutorialSkipButton: document.querySelector('#tutorial-skip-button'),
  tutorialNextButton: document.querySelector('#tutorial-next-button'),
  toastStack: document.querySelector('#toast-stack'),
};

function t(key) {
  const language = normalizeLanguage(state.settings.language);
  return translations[language][key] || translations.ru[key] || key;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function gameIcon(iconName, className = 'game-ui-icon') {
  const safeName = String(iconName || 'info').replace(/[^a-z0-9_-]/gi, '');
  const symbolId = safeName.startsWith('icon-') ? safeName : `icon-${safeName}`;
  return `<svg class="${escapeHtml(className)}" aria-hidden="true"><use href="/assets/game-icons.svg#${escapeHtml(symbolId)}"></use></svg>`;
}

function iconButtonLabel(iconName, label, className = 'teacher-button-icon') {
  return `<span class="${escapeHtml(className)}">${gameIcon(iconName)}</span><span>${escapeHtml(label)}</span>`;
}

function teacherHostActionIcon(action) {
  return ({
    'start-game': 'play',
    'pause-game': 'pause',
    'resume-game': 'play',
    'next-turn': 'next',
    'finish-room': 'finish',
    'save-room': 'reports',
    'load-room': 'join',
    'reset-room': 'alert',
  })[action] || 'settings';
}

function crisisCardIcon(eventKey) {
  return ({
    factory_demand_surge: 'overview',
    factory_supplier_delay: 'ship',
    factory_payroll_pressure: 'teams',
  })[eventKey] || 'crisis';
}

function rub(value) {
  return new Intl.NumberFormat(state.settings.language === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 0 }).format(value || 0);
}

function money(value) {
  return `${rub(value)} ${t('currency_symbol')}`;
}

function localizedLastAction(value) {
  const action = String(value || '').trim();
  if (!action || state.settings.language !== 'ru') return action;

  const exact = {
    'Company created.': 'Компания создана.',
    'Held inventory and waited for the next turn.': 'Товар оставлен на складе до следующего хода.',
    'Cleared sell order and held inventory.': 'Заявка снята, товар оставлен на складе.',
    'Requested a classroom pause.': 'Запрошена пауза занятия.',
    'Plant went bankrupt.': 'Предприятие обанкротилось.',
  };
  if (exact[action]) return exact[action];

  let match = action.match(/^Bought (\d+) (.+)\.$/);
  if (match) return `Куплено: ${match[1]} ${match[2]}.`;
  match = action.match(/^Hired (.+) \((.+)\)\.$/);
  if (match) return `Нанят сотрудник: ${match[1]} (${match[2]}).`;
  match = action.match(/^Assembled (\d+) (.+)\.$/);
  if (match) return `Собрано: ${match[1]} ${match[2]}.`;
  match = action.match(/^Placed sell order: (\d+) @ ([\d.]+)\.$/);
  if (match) return `Выставлена заявка: ${match[1]} ед. по ${rub(Number(match[2]))} ₽.`;
  match = action.match(/^Sold (\d+) (.+) at ([\d.]+)\.$/);
  if (match) return `Продано ${match[1]} ${match[2]} по ${rub(Number(match[3]))} ₽.`;
  match = action.match(/^Offer at ([\d.]+) found no buyers\.$/);
  if (match) return `Заявка по цене ${rub(Number(match[1]))} ₽ не получила спроса.`;
  match = action.match(/^Offer at ([\d.]+) was left unmatched\.$/);
  if (match) return `Заявка по цене ${rub(Number(match[1]))} ₽ осталась без исполнения.`;
  match = action.match(/^Strategic round ready: (.+)$/);
  if (match) return `Доступна стратегическая дилемма: «${localizedDecisionRoundLabel(match[1])}».`;
  match = action.match(/^Strategic round auto-safe: (.+)$/);
  if (match) return `Безопасный выбор применён автоматически: «${localizedDecisionOptionLabel(match[1])}».`;
  match = action.match(/^Strategic round resolved: (.+)$/);
  if (match) return `Стратегическое решение принято: «${localizedDecisionOptionLabel(match[1])}».`;
  return action;
}

function localizedScenarioLabel(room = state.room) {
  const key = room?.settings?.scenarioKey;
  const translatedKey = key ? `scenario_${key}_label` : '';
  const translated = translatedKey ? t(translatedKey) : '';
  return translated && translated !== translatedKey ? translated : (room?.scenarioLabel || '—');
}

function localizedDifficultyLabel(room = state.room) {
  const key = room?.difficulty || room?.settings?.difficulty;
  const translatedKey = key ? `difficulty_${key}` : '';
  const translated = translatedKey ? t(translatedKey) : '';
  return translated && translated !== translatedKey ? translated : (room?.difficultyLabel || currentDifficultyConfig().label || '—');
}

function tutorialUiCopy() {
  const copy = {
    ru: {
      activeHint: 'Нажмите подсвеченный элемент. Остальной интерфейс временно заблокирован, чтобы не сбить сценарий.',
      confirmHint: 'Подтвердите шаг кнопкой в карточке AI-куратора.',
      postTitle: 'Базовый цикл уже пройден',
      postBody: 'На этой карте вы повторяете тот же ритм: Склад -> Персонал -> Сборка -> Маркетинг -> Завершить ход.',
      postMeta: 'Если нужно, обучение можно запустить заново прямо из заводского экрана.',
      postReplay: 'Повторить обучение',
    },
    en: {
      activeHint: 'Click the highlighted element. The rest of the interface is temporarily locked so the route stays clear.',
      confirmHint: 'Confirm the step with the AI curator card button.',
      postTitle: 'The base cycle is already complete',
      postBody: 'Use the same rhythm on this map: Warehouse -> People -> Assembly -> Marketing -> Finish turn.',
      postMeta: 'If needed, you can launch the tutorial again directly from the plant screen.',
      postReplay: 'Replay tutorial',
    },
    tt: {
      activeHint: 'Яктыртылган элементка басыгыз. Калган интерфейс вакытлыча ябыла.',
      confirmHint: 'Адымны AI-куратор карточкасындагы төймә белән раслагыз.',
      postTitle: 'Төп цикл инде узылды',
      postBody: 'Бу картада шул ук тәртип кабатлана: Warehouse -> People -> Assembly -> Marketing -> Finish turn.',
      postMeta: 'Кирәк булса, tutorial-ны завод экраныннан яңадан башлап була.',
      postReplay: 'Tutorial-ны кабатлау',
    },
  };
  return copy[state.settings.language] || copy.ru;
}

function setTutorialCompleted(completed) {
  state.tutorial.completed = Boolean(completed);
  if (state.tutorial.completed) localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1');
  else localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
}

function safeFilePart(value, fallback = 'demo') {
  return String(value || fallback).replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || fallback;
}

function tutorialIsActive() {
  return Boolean(state.tutorial.active);
}

function tutorialShouldRender() {
  return tutorialIsActive() && state.currentScreen === 'game-screen';
}

function currentTutorialStep() {
  return tutorialIsActive() ? state.tutorial.steps[state.tutorial.stepIndex] || null : null;
}

function buildTutorialSteps() {
  const phaseByStep = ['warehouse', 'warehouse', 'warehouse', 'workers', 'workers', 'assembly', 'assembly', 'assembly', 'market', 'market', 'market', 'turn', 'done'];
  const tutorialLocalized = {
    ru: [
      ['Шаг 1 из 12', 'Открой склад', 'Нажми на зону "Склад закупок". Здесь видно, какие детали нужны производству.'],
      ['Шаг 2 из 12', 'Открой закупку', 'Перейди на вкладку "Закупка". Здесь лежат общие лоты поставщиков для всех команд.'],
      ['Шаг 3 из 12', 'Купи лот', 'Купи один лот у поставщика. После покупки этот завод исчезнет у всех игроков комнаты.'],
      ['Шаг 4 из 12', 'Открой персонал', 'Перейди на вкладку "Персонал". Здесь нанимается команда на линию.'],
      ['Шаг 5 из 12', 'Найми сотрудника', 'Нажми кнопку найма у кандидата. Рабочие поднимут мощность и производительность фабрики.'],
      ['Шаг 6 из 12', 'Вернись на завод', 'Теперь вернись на вкладку "Завод", чтобы собрать готовый товар.'],
      ['Шаг 7 из 12', 'Открой сборку', 'Перейди в сборочный цех. Здесь предприятие собирает товар из купленных деталей.'],
      ['Шаг 8 из 12', 'Собери товар', 'Нажми "Собрать 1 единицу". Так ты запустишь первый производственный цикл этого хода.'],
      ['Шаг 9 из 12', 'Открой маркетинг', 'Перейди на вкладку "Маркетинг". Там находится биржевой график и терминал продажи.'],
      ['Шаг 10 из 12', 'Проверь книгу заявок', 'Посмотри на правую панель "Продажа": здесь задаются цена, объем и видна очередь заявок.'],
      ['Шаг 11 из 12', 'Выстави продажу', 'Нажми "Выставить". В этом сценарии важно не только собрать товар, но и отправить его на рынок.'],
      ['Шаг 12 из 12', 'Заверши ход', 'Теперь нажми "Завершить ход" в терминале продажи. Ход будет пересчитан, и ты увидишь результат решений.'],
      ['Обучение завершено', 'Можно играть самому', 'Ты прошёл базовый цикл игры: закупка, найм, производство, заявка на продажу и завершение хода. Дальше можно экспериментировать самостоятельно.', 'Закрыть обучение'],
    ],
    en: [
      ['Step 1 of 12', 'Open the warehouse', 'Click Warehouse. This is where the plant checks the parts needed by production.'],
      ['Step 2 of 12', 'Open purchasing', 'Move to Purchasing. Supplier lots are shared by all teams in the room.'],
      ['Step 3 of 12', 'Buy a lot', 'Buy one supplier lot. After purchase, that supplier offer disappears for every player.'],
      ['Step 4 of 12', 'Open people', 'Move to People. This is where the line crew is hired.'],
      ['Step 5 of 12', 'Hire one worker', 'Press a candidate hire button. Workers increase factory capacity and throughput.'],
      ['Step 6 of 12', 'Return to plant', 'Go back to the Plant tab to assemble finished goods.'],
      ['Step 7 of 12', 'Open assembly', 'Move to Assembly. This is where the plant builds goods from purchased parts.'],
      ['Step 8 of 12', 'Assemble goods', 'Press Assemble 1. This starts the first production cycle for this turn.'],
      ['Step 9 of 12', 'Open marketing', 'Move to Marketing. The market chart and sale terminal live there.'],
      ['Step 10 of 12', 'Read the order book', 'Look at the Sale panel: price, volume, and the order queue are handled here.'],
      ['Step 11 of 12', 'Submit a sale', 'Press List sale. In this scenario you must not only build goods, but also send them to the market.'],
      ['Step 12 of 12', 'Finish the turn', 'Now press Finish turn inside the sale terminal. The game will resolve the turn and show your result.'],
      ['Tutorial complete', 'You can play solo now', 'You completed the basic loop: buy parts, hire, produce, list a sale, and finish the turn. Now you can experiment on your own.', 'Close tutorial'],
    ],
    tt: [
      ['1/12 адым', 'Складны ач', 'Warehouse зонасына бас. Монда җитештерүгә кирәкле детальләр күренә.'],
      ['2/12 адым', 'Закупканы ач', 'Purchasing вкладкасына күч. Поставщик лотлары бөтен команда өчен уртак.'],
      ['3/12 адым', 'Лот сатып ал', 'Бер поставщик лотын ал. Аннан соң ул тәкъдим бөтен уенчыларда юкка чыга.'],
      ['4/12 адым', 'People ач', 'Монда линия командасы яллана.'],
      ['5/12 адым', 'Эшче ялла', 'Кандидат янындагы яллау төймәсенә бас. Эшчеләр фабрика куәтен күтәрә.'],
      ['6/12 адым', 'Заводка кайт', 'Әзер товар җыю өчен Plant вкладкасына кире кайт.'],
      ['7/12 адым', 'Assembly ач', 'Монда предприятие алынган детальләрдән товар җыя.'],
      ['8/12 адым', 'Бер товар җый', 'Assemble 1 бас. Шулай беренче җитештерү циклы башлана.'],
      ['9/12 адым', 'Marketing ач', 'Монда базар графигы һәм сату терминалы урнашкан.'],
      ['10/12 адым', 'Заявкалар китабын кара', 'Sale панелендә бәя, күләм һәм заявкалар чираты күренә.'],
      ['11/12 адым', 'Сату куй', 'Сату төймәсенә бас. Товарны базарга чыгару да кирәк.'],
      ['12/12 адым', 'Йөрешне тәмамла', 'Сату терминалында Finish turn бас. Йөреш исәпләнә һәм нәтиҗә күренә.'],
      ['Өйрәтү тәмам', 'Үзең уйный аласың', 'Син төп циклны үттең: закупка, яллау, җитештерү, сату заявкасы һәм йөрешне тәмамлау.', 'Өйрәтүне ябу'],
    ],
  };
  const localized = tutorialLocalized[state.settings.language] || tutorialLocalized.ru;
  const selectors = [
    '[data-factory-node="warehouse"]',
    '[data-game-tab="purchase"]',
    '[data-supplier-offer]',
    '[data-game-tab="competitors"]',
    '[data-personnel-hire]',
    '[data-game-tab="operations"]',
    '[data-factory-node="assembly"]',
    '[data-factory-action="assemble-product"][data-assemble-value="1"]',
    '[data-game-tab="market"]',
    '.market-trade-desk',
    '[data-market-sale-action="submit"]',
    '[data-market-turn-action]',
  ];
  return localized.map((step, index) => ({
    chip: step[0],
    title: step[1],
    text: step[2],
    phase: phaseByStep[index] || 'done',
    ...(selectors[index] ? { selector: selectors[index] } : { actionLabel: step[3] }),
    ...(index === 9 ? {
      prepare: () => {
        const quantityInput = document.querySelector('#market-sale-quantity');
        if (!quantityInput) return;
        const max = Number(quantityInput.max || 0);
        if (max >= 1 && Number(quantityInput.value || 0) < 1) quantityInput.value = '1';
      },
    } : {}),
  }));
}

function renderTutorialRoute(activePhase) {
  if (!elements.tutorialRoute) return;
  const route = [
    ['warehouse', 'Склад'],
    ['workers', 'Работники'],
    ['assembly', 'Сборка'],
    ['market', 'Продажа'],
    ['turn', 'Ход'],
  ];
  const activeIndex = Math.max(0, route.findIndex(([key]) => key === activePhase));
  elements.tutorialRoute.innerHTML = route.map(([key, label], index) => {
    const stateClass = index < activeIndex ? 'done' : index === activeIndex ? 'active' : '';
    return `<span class="${stateClass}"><i>${index + 1}</i>${escapeHtml(label)}</span>`;
  }).join('');
}

function isTutorialTurnTarget(target) {
  return Boolean(target?.matches?.('[data-turn-action], [data-market-turn-action]'));
}

function clearTutorialTarget() {

  document.querySelectorAll('.tutorial-target').forEach(node => node.classList.remove('tutorial-target', 'tutorial-target-final'));
  document.querySelectorAll('.tutorial-target-dock').forEach(node => node.classList.remove('tutorial-target-dock'));
}

function setTutorialFocus(target) {
  clearTutorialTarget();
  if (!elements.tutorialFocusRing) return;
  if (!target) {
    elements.tutorialFocusRing.classList.add('hidden');
    elements.tutorialFocusRing.removeAttribute('style');
    return;
  }

  target.classList.add('tutorial-target');
  if (isTutorialTurnTarget(target)) {
    target.classList.add('tutorial-target-final');
    target.closest('.turn-control-dock, .market-trade-desk')?.classList.add('tutorial-target-dock');
  }
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const rect = target.getBoundingClientRect();
  const padding = isTutorialTurnTarget(target) ? 14 : 10;
  const left = Math.max(rect.left - padding, 8);
  const top = Math.max(rect.top - padding, 8);
  const right = Math.min(rect.right + padding, window.innerWidth - 8);
  const bottom = Math.min(rect.bottom + padding, window.innerHeight - 8);

  elements.tutorialFocusRing.classList.remove('hidden');
  elements.tutorialFocusRing.style.left = `${left}px`;
  elements.tutorialFocusRing.style.top = `${top}px`;
  elements.tutorialFocusRing.style.width = `${Math.max(right - left, 48)}px`;
  elements.tutorialFocusRing.style.height = `${Math.max(bottom - top, 48)}px`;
}

function getTutorialCardPlacement(target) {
  if (!target || window.innerWidth <= 720) return 'bottom-left';
  if (isTutorialTurnTarget(target)) return 'dock-top';
  const rect = target.getBoundingClientRect();
  const inBottomHalf = rect.top > window.innerHeight * 0.5;
  const inLeftHalf = rect.left < window.innerWidth * 0.5;
  if (inBottomHalf && inLeftHalf) return 'top-right';
  if (inBottomHalf) return 'top-left';
  if (inLeftHalf) return 'bottom-right';
  return 'bottom-left';
}

function renderTutorialOverlay() {
  if (!elements.tutorialOverlay) return;
  const tutorialCopy = tutorialUiCopy();
  if (!tutorialShouldRender()) {
    elements.tutorialOverlay.classList.add('hidden');
    delete elements.tutorialOverlay.dataset.cardPlacement;
    delete elements.tutorialOverlay.dataset.stepMode;
    setTutorialFocus(null);
    return;
  }

  const step = currentTutorialStep();
  if (!step) {
    stopTutorial({ completed: true });
    return;
  }

  elements.tutorialOverlay.classList.remove('hidden');
  if (elements.tutorialProgressBar) {
    const totalSteps = Math.max(state.tutorial.steps.length, 1);
    const progress = ((state.tutorial.stepIndex + 1) / totalSteps) * 100;
    elements.tutorialProgressBar.style.width = `${Math.max(8, Math.min(progress, 100))}%`;
  }
  elements.tutorialStepChip.textContent = step.chip || 'Обучение';
  elements.tutorialTitle.textContent = step.title || 'Обучение';
  elements.tutorialText.textContent = step.text || '';
  renderTutorialRoute(step.phase);
  if (elements.tutorialHint) {
    elements.tutorialHint.textContent = step.selector ? tutorialCopy.activeHint : tutorialCopy.confirmHint;
  }
  if (step.actionLabel) {
    elements.tutorialNextButton.textContent = step.actionLabel;
    elements.tutorialNextButton.classList.remove('hidden');
  } else {
    elements.tutorialNextButton.classList.add('hidden');
  }

  if (typeof step.prepare === 'function') step.prepare();
  const target = step.selector ? document.querySelector(step.selector) : null;
  elements.tutorialOverlay.dataset.cardPlacement = getTutorialCardPlacement(target);
  elements.tutorialOverlay.dataset.stepMode = isTutorialTurnTarget(target) ? 'turn-action' : step.selector ? 'target' : 'confirm';
  setTutorialFocus(target);
}

function startTutorial() {
  if (!isFactoryRoom()) {
    setStatus('Обучение доступно в учебном заводском матче.', false);
    return;
  }
  state.tutorial = {
    active: true,
    stepIndex: 0,
    steps: buildTutorialSteps(),
  };
  setGameTab('operations');
  renderTutorialOverlay();
}

function stopTutorial({ completed = false } = {}) {
  state.tutorial = {
    active: false,
    stepIndex: 0,
    steps: [],
  };
  if (completed) setTutorialCompleted(true);
  if (completed && state.room) {
    setIntelFeedback('success', 'Обучение завершено. Теперь можно играть самостоятельно.');
    renderIntel();
  }
  clearTutorialTarget();
  if (elements.tutorialOverlay) elements.tutorialOverlay.classList.add('hidden');
  if (elements.tutorialOverlay) {
    delete elements.tutorialOverlay.dataset.cardPlacement;
    delete elements.tutorialOverlay.dataset.stepMode;
  }
  setTutorialFocus(null);
}

function advanceTutorialStep() {
  if (!tutorialIsActive()) return;
  const nextIndex = state.tutorial.stepIndex + 1;
  if (nextIndex >= state.tutorial.steps.length) {
    stopTutorial({ completed: true });
    return;
  }
  state.tutorial.stepIndex = nextIndex;
  renderTutorialOverlay();
}

function handleTutorialClick(event) {
  if (!tutorialShouldRender()) return;

  const control = event.target.closest('[data-tutorial-control]');
  if (control) return;

  const step = currentTutorialStep();
  if (!step) return;
  if (!step.selector) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const target = document.querySelector(step.selector);
  const allowed = target && (target === event.target || target.contains(event.target));
  if (!allowed) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  window.setTimeout(() => {
    if (tutorialIsActive() && currentTutorialStep() === step) advanceTutorialStep();
  }, 0);
}

function queueSignature(queue = []) {
  return queue.map(item => [item.key, item.priority, item.mode, item.action, item.value, item.blockedReason].join(':')).join('|');
}

function setIntelFeedback(type = '', message = '') {
  state.intelFeedback = { type, message };
}

function setFactoryDepartment(department) {
  state.factoryDepartment = department;
  localStorage.setItem('bizArenaFactoryDepartment', department);
}

function applyBackgroundTheme() {
  const themeKey = state.settings.background in BACKGROUND_THEMES ? state.settings.background : 'navy';
  const presetKey = state.settings.visualPreset in VISUAL_PRESETS ? state.settings.visualPreset : 'factory_board';
  const appliedKey = `${themeKey}:${presetKey}`;
  if (state.appliedTheme === appliedKey) return;
  const theme = BACKGROUND_THEMES[themeKey];
  Object.entries(theme).forEach(([token, value]) => {
    document.documentElement.style.setProperty(token, value);
  });
  const preset = VISUAL_PRESETS[presetKey];
  Object.entries(preset).forEach(([token, value]) => {
    document.documentElement.style.setProperty(token, value);
  });
  document.documentElement.dataset.backgroundTheme = themeKey;
  document.documentElement.dataset.visualPreset = presetKey;
  state.appliedTheme = appliedKey;
}

function request(url, options = {}) {
  return window.BizArenaRuntime.request(url, options, {
    normalize: normalizeObjectEncoding,
    networkErrorMessage: t('network_failed'),
  });
}

function shouldInvalidatePlayerSession(error) {
  return [401, 403, 404, 410].includes(Number(error?.status || 0));
}

function shouldInvalidateTeacherSession(error) {
  return [401, 403].includes(Number(error?.status || 0));
}

const realtimeController = window.BizArenaRuntime.createRealtimeController({
  onConnectionChange: connected => { state.realtimeConnected = connected; },
  onRoomUpdated: () => scheduleRealtimeRefresh(),
  onTeacherOverviewUpdated: () => {
    if (isServerMode() && isCloudDeployment()) fetchRuntimeMeta();
  },
});

function closeRealtimeChannel() {
  realtimeController.close();
  state.realtimeSocket = null;
  state.realtimeKey = '';
  state.realtimeConnectKey = '';
  state.realtimeConnected = false;
}

async function setupRealtimeChannel() {
  if (!('WebSocket' in window)) return;
  let key = '';
  let ticketRequest = null;
  if (isServerMode() && isCloudDeployment() && state.teacherSessionToken) {
    key = JSON.stringify(['teacher', state.teacherAccount?.id || '', state.teacherSessionToken]);
    ticketRequest = {
      method: 'POST',
      headers: teacherAuthHeaders(),
      body: JSON.stringify({}),
    };
  } else if (state.playerId && state.sessionToken) {
    key = JSON.stringify(['player', state.playerId, state.sessionToken]);
    ticketRequest = {
      method: 'POST',
      headers: { 'X-Player-Session': state.sessionToken },
      body: JSON.stringify({ playerId: state.playerId }),
    };
  }
  if (!ticketRequest) {
    closeRealtimeChannel();
    return;
  }
  if (state.realtimeSocket && state.realtimeKey === key) return;
  if (state.realtimeConnectKey === key) return;
  state.realtimeConnectKey = key;
  try {
    const data = await request('/api/realtime/ticket', ticketRequest);
    if (state.realtimeConnectKey !== key) return;
    const socket = realtimeController.connect({ ticket: data.ticket });
    state.realtimeSocket = socket;
    state.realtimeKey = socket ? key : '';
  } catch (_error) {
    if (state.realtimeConnectKey === key) closeRealtimeChannel();
  } finally {
    if (state.realtimeConnectKey === key) state.realtimeConnectKey = '';
  }
}

function hydrateStateFromPayload(data) {
  if (data.unchanged) {
    state.lastRoomVersion = Number(data.roomVersion || state.lastRoomVersion || 0);
    state.lastPlayerVersion = Number(data.playerVersion || state.lastPlayerVersion || 0);
    updateTurnTimer();
    return;
  }
  const previousRoomCode = state.room?.code || '';
  const previousPlayerId = state.player?.id || '';
  state.room = data.room || null;
  state.player = data.player || null;
  state.serverClockOffsetMs = Number(state.room?.serverNow || Date.now()) - Date.now();
  if (
    state.factorySaleDraft
    && (state.factorySaleDraft.roomCode !== (state.room?.code || '')
      || state.factorySaleDraft.playerId !== (state.player?.id || '')
      || previousRoomCode !== (state.room?.code || '')
      || previousPlayerId !== (state.player?.id || ''))
  ) {
    clearFactorySaleDraft();
  }
  if (previousRoomCode !== (state.room?.code || '') || previousPlayerId !== (state.player?.id || '')) {
    clearSupplierPurchaseDrafts();
  }
  state.account = data.account || state.account;
  state.lastRoomVersion = Number(data.roomVersion || state.room?.version || 0);
  state.lastPlayerVersion = Number(data.playerVersion || state.player?.version || 0);
  elements.dayCounter.textContent = `${t('day')} ${data.room?.day || 1}`;
  if (elements.gameRoundInline) {
    const dayLimit = Number(data.room?.settings?.dayLimit || 30);
    const currentRound = Math.min(Number(data.room?.day || 1), dayLimit);
    elements.gameRoundInline.textContent = `${currentRound} / ${dayLimit}`;
  }
  elements.playerCount.textContent = `${data.room?.playerCount || 0}`;
  elements.roomCodeChip.textContent = `${t('room_code_label')}: ${data.room?.code || '—'}`;
  setStatus(data.room ? `${t('connected_room')} ${data.room.code}` : t('not_connected'), Boolean(data.room));
  if (data.player) {
    elements.priceInput.value = data.player.price;
    elements.priceValue.textContent = data.player.price;
  }
  renderRoomState();
  updateTurnTimer();
  syncScreenWithRoom();
  renderTutorialOverlay();
}

function scheduleRealtimeRefresh() {
  if (state.refreshDebounceHandle) return;
  state.refreshDebounceHandle = window.setTimeout(() => {
    state.refreshDebounceHandle = null;
    refreshState();
  }, performanceRuntimeProfile().realtimeDebounceMs);
}

function roomStateRenderSignature() {
  return {
    screen: state.currentScreen,
    gameTab: state.currentGameTab,
    factoryDepartment: state.factoryDepartment,
    roomCode: state.room?.code || '',
    roomVersion: state.room?.version || state.lastRoomVersion || 0,
    playerId: state.player?.id || '',
    playerVersion: state.player?.version || state.lastPlayerVersion || 0,
    accountUser: state.account?.userName || '',
    language: state.settings.language,
    background: state.settings.background,
    visualPreset: state.settings.visualPreset,
    performanceMode: resolvedPerformanceMode(),
    animationMode: animationsDisabled() ? 'off' : 'on',
  };
}

function renderRoomState() {
  if (!hasRenderSignatureChanged('roomStateRoot', roomStateRenderSignature())) {
    syncControls();
    syncLobbyControls();
    return;
  }
  syncBodyContext();
  populateSelectors();
  syncGameTabVisibility();
  renderRoomOverview();
  renderCompany();
  renderFactoryOperations();
  renderFactoryPurchases();
  renderTickBreakdown();
  renderIntel();
  renderCareer();
  renderAchievements();
  renderMarket();
  renderGameMarketRail();
  renderStatistics();
  renderPlayerList();
  renderCompetitors();
  renderLeaderboard();
  renderLog();
  renderTurnReportSummary();
  renderGameHud();
  renderGameNextAction();
  renderTeacherPanel();
  renderResultsOverview();
  renderServerHome();
  syncControls();
  syncLobbyControls();
  normalizeVisibleTextEncoding();
}

function renderDisconnectedState() {
  renderRoomState();
  elements.dayCounter.textContent = `${t('day')} 1`;
  if (elements.gameRoundInline) elements.gameRoundInline.textContent = '1 / 30';
  elements.roomCodeChip.textContent = `${t('room_code_label')}: —`;
  elements.playerCount.textContent = '0';
  elements.resultsStatus.textContent = t('results_finished');
}

function isConnected() { return Boolean(state.playerId && state.roomCode && state.player && state.room); }
function gameIsRunning() { return state.room?.status === 'running'; }
function gameIsActive() { return ['running', 'paused'].includes(state.room?.status); }
function gameIsFinished() { return state.room?.status === 'finished'; }
function canUseBusinessActions() { return isConnected() && gameIsRunning() && !state.player?.bankrupt; }
function isFactoryRoom() { return Boolean(state.room?.factoryScenario && state.player?.factory); }
function isManualTurnRoom() { return Boolean(state.room?.tickMode === 'manual'); }
function currentDifficultyConfig() {
  const key = state.room?.difficulty || state.room?.settings?.difficulty || elements.createDifficultySelect?.value || 'normal';
  const serverConfig = (state.room?.difficultyCatalog || []).find(item => item.key === key);
  const config = { ...(CLIENT_DIFFICULTY_CONFIGS[key] || CLIENT_DIFFICULTY_CONFIGS.normal), ...(serverConfig || {}) };
  return {
    ...config,
    label: t(config.labelKey || `difficulty_${config.key}`),
    preview: t(config.previewKey || `difficulty_${config.key}_hint`),
  };
}
function isAdvancedUiVisible() { return currentDifficultyConfig().uiMode !== 'guided'; }
function isTeacherViewer() {
  return Boolean(state.player?.isTeacherHost && !isClientMode());
}
function roleGameTabsForCurrentViewer() {
  return isTeacherViewer()
    ? GAME_TAB_ROLE_CONTRACT.teacher
    : GAME_TAB_ROLE_CONTRACT.student;
}

function visibleGameTabs() {
  if (state.currentScreen === 'game-screen') {
    return new Set(roleGameTabsForCurrentViewer());
  }
  const config = currentDifficultyConfig();
  const tabs = new Set([...(config.visibleTabs || CLIENT_DIFFICULTY_CONFIGS.normal.visibleTabs), ...(isAdvancedUiVisible() ? (config.advancedTabs || []) : [])]);
  if (isTeacherViewer()) tabs.add('teacher');
  return tabs;
}

function clearFactorySaleDraft() {
  state.factorySaleDraft = null;
}

function clearSupplierPurchaseDrafts() {
  state.supplierPurchaseDrafts = {};
}

function setFactoryPurchaseComponent(componentKey) {
  state.factoryPurchaseComponent = componentKey || '';
  localStorage.setItem('bizArenaFactoryPurchaseComponent', state.factoryPurchaseComponent);
}

function activeGamePanel() {
  return document.querySelector('[data-game-panel]:not(.hidden)');
}

function captureFactorySaleDraftFromDom() {
  if (!isFactoryRoom()) return;
  const activePanel = activeGamePanel();
  const activeElementPanel = document.activeElement?.closest?.('[data-game-panel]');
  const source = activeElementPanel && !activeElementPanel.classList.contains('hidden')
    ? activeElementPanel
    : activePanel || document;
  const priceInput = source.querySelector('#market-sale-price') || source.querySelector('#factory-sale-price');
  const quantityInput = source.querySelector('#market-sale-quantity') || source.querySelector('#factory-sale-quantity');
  if (!priceInput || !quantityInput) return;
  state.factorySaleDraft = {
    roomCode: state.room?.code || '',
    playerId: state.player?.id || '',
    price: String(priceInput.value ?? ''),
    quantity: String(quantityInput.value ?? ''),
  };
}

function saveSupplierPurchaseDraft(offerId, value) {
  if (!offerId) return;
  state.supplierPurchaseDrafts[offerId] = {
    roomCode: state.room?.code || '',
    playerId: state.player?.id || '',
    value: String(value ?? ''),
  };
}

function clearSupplierPurchaseDraft(offerId) {
  if (!offerId) return;
  delete state.supplierPurchaseDrafts[offerId];
}

function captureSupplierPurchaseDraftsFromDom() {
  if (!isFactoryRoom()) return;
  document.querySelectorAll('[data-supplier-quantity]').forEach(input => {
    saveSupplierPurchaseDraft(input.dataset.supplierQuantity, input.value);
  });
}

function getSupplierPurchaseDraft(offerId, fallbackValue) {
  const draft = state.supplierPurchaseDrafts[offerId];
  if (!draft) return String(fallbackValue);
  if (draft.roomCode !== (state.room?.code || '') || draft.playerId !== (state.player?.id || '')) {
    clearSupplierPurchaseDraft(offerId);
    return String(fallbackValue);
  }
  return String(draft.value ?? '');
}

function readFactorySaleInputs(root = document) {
  const priceInput = root.querySelector('#market-sale-price') || root.querySelector('#factory-sale-price');
  const quantityInput = root.querySelector('#market-sale-quantity') || root.querySelector('#factory-sale-quantity');
  return {
    price: Number(priceInput?.value || state.player?.factory?.saleOffer?.price || 0),
    quantity: Number(quantityInput?.value || 0),
  };
}

function readFactorySaleInputStrings(root = document) {
  const priceInput = root.querySelector('#market-sale-price') || root.querySelector('#factory-sale-price');
  const quantityInput = root.querySelector('#market-sale-quantity') || root.querySelector('#factory-sale-quantity');
  return {
    price: String(priceInput?.value ?? ''),
    quantity: String(quantityInput?.value ?? ''),
  };
}

function captureFocusedTradeInput() {
  const active = document.activeElement;
  if (!active || !['market-sale-price', 'market-sale-quantity', 'factory-sale-price', 'factory-sale-quantity'].includes(active.id)) {
    return null;
  }
  return {
    id: active.id,
    value: String(active.value ?? ''),
  };
}

function restoreFocusedTradeInput(snapshot) {
  if (!snapshot?.id) return;
  const input = document.getElementById(snapshot.id);
  if (!input) return;
  input.value = snapshot.value;
  input.focus({ preventScroll: true });
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function profileInitials(value) {
  const parts = String(value || 'Biz Arena')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0] || ''}${parts[1][0] || ''}`
    : String(parts[0] || 'BA').slice(0, 2);
  return initials.toUpperCase();
}

function gameStudentClientUrl() {
  const quickLinks = serverAdminQuickLinks(state.runtimeMeta || {});
  const fallback = `${window.location.origin.replace(/\/+$/, '')}/client`;
  const base = quickLinks.clientUrl || fallback;
  const roomCode = state.room?.code || state.roomCode || '';
  try {
    const url = new URL(base, window.location.origin);
    if (roomCode) url.searchParams.set('roomCode', roomCode);
    return url.toString();
  } catch {
    const separator = String(base).includes('?') ? '&' : '?';
    return roomCode ? `${base}${separator}roomCode=${encodeURIComponent(roomCode)}` : base;
  }
}

function renderGameTopbar() {
  const room = state.room;
  const player = state.player;
  const roomCode = room?.code || state.roomCode || '';
  const displayCode = roomCode ? (String(roomCode).startsWith('ROOM-') ? roomCode : `ROOM-${roomCode}`) : 'ROOM----';
  const maxPlayers = room?.settings?.maxPlayers || room?.maxPlayers || 0;
  const joined = room?.humanCount || room?.playerCount || 0;
  const dayLimit = Number(room?.settings?.dayLimit || 30);
  const currentRound = Math.min(Number(room?.day || 1), dayLimit);
  const statusLabel = !room
    ? 'Не подключено'
    : room.status === 'running'
      ? 'Все системы в норме'
      : room.status === 'paused'
        ? 'Матч на паузе'
        : room.status === 'finished'
          ? 'Игра завершена'
          : 'Ожидание старта';
  const statusTone = !room
    ? 'offline'
    : room.status === 'running'
      ? 'online'
      : room.status === 'paused'
        ? 'paused'
        : room.status === 'finished'
          ? 'finished'
          : 'waiting';
  const statusMeta = room
    ? `${joined}${maxPlayers ? ` / ${maxPlayers}` : ''} вошли`
    : 'Ожидание комнаты';
  const studentUrl = gameStudentClientUrl();
  const profileName = player?.userName || state.teacherAccount?.name || state.profile.userName || 'Biz Arena';
  const isTeacher = isTeacherViewer();
  const guide = player?.turnGuide || null;
  const checklist = player?.turnChecklist || [];
  const readySteps = guide?.progress?.ready ?? checklist.filter(item => item.status === 'ready').length;
  const totalSteps = guide?.progress?.total ?? (checklist.length || 5);
  const primaryStep = guide?.steps?.find(step => step.key === guide.primaryKey) || guide?.steps?.find(step => step.status !== 'ready') || null;
  const studentTopbarLabel = primaryStep ? studentRouteDisplayLabel(primaryStep) : 'Следующий шаг';

  if (elements.gameRoomCodeTopbar) elements.gameRoomCodeTopbar.textContent = displayCode;
  if (elements.gameRoomMetaTopbar) elements.gameRoomMetaTopbar.textContent = room?.name || localizedScenarioLabel() || 'Комната не выбрана';
  if (elements.gameServerStatusTopbar) elements.gameServerStatusTopbar.textContent = statusLabel;
  elements.gameServerStatusTopbar?.closest('.game-server-chip')?.setAttribute('data-status', statusTone);
  elements.gameRoomCodeTopbar?.closest('.game-room-chip')?.setAttribute('data-status', room ? 'online' : 'offline');
  if (elements.gameServerMetaTopbar) {
    const realtime = state.realtimeConnected ? 'WebSocket' : 'HTTP fallback';
    elements.gameServerMetaTopbar.textContent = `${statusMeta} • ${realtime}`;
  }
  if (elements.gameStudentLinkChip) elements.gameStudentLinkChip.dataset.viewerRole = isTeacher ? 'teacher' : 'student';
  if (elements.gameStudentLinkLabel) elements.gameStudentLinkLabel.textContent = isTeacher ? 'Ссылка для студентов' : 'Прогресс команды';
  if (elements.gameStudentLinkTopbar) {
    elements.gameStudentLinkTopbar.textContent = isTeacher
      ? studentUrl.replace(/^https?:\/\//, '')
      : `${readySteps}/${Math.max(1, totalSteps)} · ${studentTopbarLabel}`;
  }
  if (elements.gameStudentLinkMeta) {
    elements.gameStudentLinkMeta.textContent = isTeacher
      ? 'QR для входа в комнату'
      : `Деньги ${money(player?.money || 0)} · ${room?.status === 'running' ? 'ход открыт' : 'ожидание старта'}`;
  }
  if (elements.gameStudentQr) {
    elements.gameStudentQr.src = `/api/qr?data=${encodeURIComponent(studentUrl)}`;
    elements.gameStudentQr.hidden = !studentUrl || !isTeacher;
  }
  if (elements.gameCopyStudentLink) {
    elements.gameCopyStudentLink.dataset.copyUrl = studentUrl;
    elements.gameCopyStudentLink.hidden = !isTeacher;
  }
  if (elements.gameRoundInline) elements.gameRoundInline.textContent = `${currentRound} / ${dayLimit}`;
  if (elements.gameProfileName) elements.gameProfileName.textContent = profileName;
  if (elements.gameProfileRole) elements.gameProfileRole.textContent = isTeacher ? 'Преподаватель' : 'Ученик';
  if (elements.gameProfileAvatar) elements.gameProfileAvatar.textContent = profileInitials(profileName);
}

function updateTurnTimer() {
  if (!elements.gameTurnTimer) return;
  const room = state.room;
  if (!room || room.status !== 'running') {
    elements.gameTurnTimer.textContent = '--:--';
    if (elements.gameTurnLimit) elements.gameTurnLimit.textContent = 'Время на ход: --';
    return;
  }

  const duration = Number(room.turnDurationMs || 30 * 60 * 1000);
  const serverNow = Date.now() + state.serverClockOffsetMs;
  const deadline = room.nextTickAt
    ? Number(room.nextTickAt)
    : Number(room.turnStartedAt || serverNow) + duration;
  const remaining = deadline - serverNow;
  elements.gameTurnTimer.textContent = formatClock(remaining);
  elements.gameTurnTimer.classList.toggle('warning', remaining <= 60 * 1000);
  if (elements.gameTurnLimit) elements.gameTurnLimit.textContent = `Время на ход: ${Math.max(1, Math.round(duration / 60000))} мин`;
}

function renderGameNextAction() {
  renderGameTopbar();
  if (!elements.gameNextActionChip) return;
  const isTeacherView = isTeacherViewer();
  const readiness = state.room?.classReadiness || { rows: [] };
  const helpQueue = readiness.helpQueue || [];
  const teacherTarget = isTeacherView && state.room ? {
    title: 'Кабинет преподавателя',
    body: teacherNextAction(state.room, readiness, helpQueue),
    actionLabel: 'Открыть',
    action: '',
    value: '',
    tab: 'teacher',
    department: '',
    tone: helpQueue.length || readiness.blocked ? 'warn' : 'neutral',
    progress: null,
  } : null;
  const action = state.player?.nextAction || null;
  const guide = state.player?.turnGuide || null;
  const guideTarget = guide?.target || null;
  const primaryStep = guide?.steps?.find(step => step.key === guide.primaryKey) || null;
  const target = teacherTarget || action || (guideTarget ? {
    title: guide.title || primaryStep?.title,
    body: guide.summary || primaryStep?.summary,
    actionLabel: guide.buttonLabel || primaryStep?.buttonLabel || 'Открыть',
    action: guideTarget.action || '',
    value: guideTarget.value || '',
    tab: guideTarget.tab || '',
    department: guideTarget.department || '',
    tone: primaryStep?.status === 'blocked' ? 'danger' : primaryStep?.status === 'attention' ? 'warn' : 'neutral',
    progress: guide.progress || null,
  } : null);
  const connected = Boolean(state.room && state.player);
  elements.gameNextActionChip.classList.toggle('disabled', !connected || !target);
  elements.gameNextActionChip.dataset.tone = target?.tone || 'neutral';
  elements.gameNextActionChip.dataset.action = target?.action || '';
  elements.gameNextActionChip.dataset.value = target?.value || '';
  elements.gameNextActionChip.dataset.tab = target?.tab || '';
  elements.gameNextActionChip.dataset.department = target?.department || '';
  if (elements.gameNextActionTitle) {
    elements.gameNextActionTitle.textContent = target?.title || (connected ? 'Откройте завод' : 'Откройте игру');
  }
  if (elements.gameNextActionBody) {
    const progress = target?.progress?.total
      ? ` • ${target.progress.ready}/${target.progress.total} шагов`
      : '';
    elements.gameNextActionBody.textContent = target?.body
      ? `${target.actionLabel || 'Открыть'}${progress}: ${target.body}`
      : 'Подсказка появится после старта матча';
  }
}

function activateGameNextAction() {
  const renderedTarget = elements.gameNextActionChip?.dataset || {};
  const renderedAction = renderedTarget.action || renderedTarget.tab || renderedTarget.department
    ? {
        action: renderedTarget.action || '',
        value: renderedTarget.value || '',
        tab: renderedTarget.tab || '',
        department: renderedTarget.department || '',
      }
    : null;
  const guideTarget = state.player?.turnGuide?.target || null;
  const action = renderedAction || state.player?.nextAction || (guideTarget ? {
    action: guideTarget.action || '',
    value: guideTarget.value || '',
    tab: guideTarget.tab || '',
    department: guideTarget.department || '',
  } : null);
  if (!action) return;
  if (action.action) {
    sendAction(action.action, action.value || undefined);
    return;
  }
  if (action.department) setFactoryDepartment(action.department);
  if (action.tab) setGameTab(action.tab);
  renderRoomState();
}

function getFactorySaleDraft(factory) {
  const fallback = {
    price: String(factory.saleOffer.price),
    quantity: String(Math.min(factory.saleOffer.quantity, factory.finishedGoods)),
  };
  const draft = state.factorySaleDraft;
  if (!draft) return fallback;
  if (draft.roomCode !== state.room?.code || draft.playerId !== state.player?.id) return fallback;
  return {
    price: draft.price ?? fallback.price,
    quantity: draft.quantity ?? fallback.quantity,
  };
}

function syncGameTabVisibility() {
  const visibleTabs = visibleGameTabs();
  elements.gameTabs.forEach(button => {
    const visible = visibleTabs.has(button.dataset.gameTab);
    button.classList.toggle('hidden-by-difficulty', !visible);
    button.disabled = !visible;
  });
  if (!visibleTabs.has(state.currentGameTab)) setGameTab(visibleTabs.has('operations') ? 'operations' : [...visibleTabs][0] || 'overview');
}

function persistSession(playerId, roomCode, sessionToken = '') {
  state.playerId = playerId;
  state.sessionToken = sessionToken || state.sessionToken;
  state.roomCode = roomCode;
  state.lastRoomVersion = 0;
  state.lastPlayerVersion = 0;
  resetRenderCache();
  state.roomAutoOpenDismissed = false;
  localStorage.setItem('bizArenaPlayerId', playerId);
  if (state.sessionToken) localStorage.setItem('bizArenaSessionToken', state.sessionToken);
  localStorage.setItem('bizArenaRoomCode', roomCode);
}

function clearSession() {
  state.playerId = '';
  state.sessionToken = '';
  state.roomCode = '';
  state.lastRoomVersion = 0;
  state.lastPlayerVersion = 0;
  resetRenderCache();
  if (!(isServerMode() && isCloudDeployment() && state.teacherSessionToken)) closeRealtimeChannel();
  state.player = null;
  state.room = null;
  state.roomAutoOpenDismissed = false;
  clearFactorySaleDraft();
  clearSupplierPurchaseDrafts();
  stopTutorial();
  localStorage.removeItem('bizArenaPlayerId');
  localStorage.removeItem('bizArenaSessionToken');
  localStorage.removeItem('bizArenaRoomCode');
}

function setStatus(text, ok) {
  elements.sessionStatus.textContent = text;
  elements.sessionStatus.classList.toggle('off', !ok);
}

function isServerMode() { return state.appMode === 'server'; }
function isClientMode() { return state.appMode === 'client'; }
function isCloudDeployment() { return state.runtimeMeta?.deployment === 'cloud'; }
function teacherAuthHeaders() {
  return state.teacherSessionToken ? { Authorization: `Bearer ${state.teacherSessionToken}` } : {};
}
function persistTeacherSession(token = '') {
  state.teacherSessionToken = token;
  resetRenderCache(['cloudTeacherOverview', 'serverAdminOverview']);
  if (token) localStorage.setItem('bizArenaTeacherSessionToken', token);
  else localStorage.removeItem('bizArenaTeacherSessionToken');
}
function cloudPublicBase() {
  const meta = state.runtimeMeta || {};
  return String(meta.publicUrl || meta.localUrls?.[0] || window.location.origin).replace(/\/+$/, '');
}
function cloudStudentUrl(roomCode = '') {
  return `${cloudPublicBase()}/client${roomCode ? `?roomCode=${encodeURIComponent(roomCode)}` : ''}`;
}

function activePerformancePreference() {
  return normalizePerformanceMode(state.settings.performanceMode);
}

function requestedPerformanceMode() {
  const params = new URLSearchParams(window.location.search);
  const quality = params.get('quality');
  if (['full', 'standard', 'lite'].includes(quality)) return quality;
  if (params.get('lite') === '1') return 'lite';
  return '';
}

function detectAutomaticPerformanceMode() {
  if (!isClientMode()) return 'full';
  const memoryGb = Number(navigator.deviceMemory || 0);
  const logicalCores = Number(navigator.hardwareConcurrency || 0);
  if ((memoryGb > 0 && memoryGb <= 4) || (logicalCores > 0 && logicalCores <= 4)) return 'lite';
  if (memoryGb >= 8 && logicalCores >= 12) return 'full';
  return 'standard';
}

function resolvedPerformanceMode(preference = activePerformancePreference()) {
  const requestedMode = requestedPerformanceMode();
  if (requestedMode) return requestedMode;
  preference = normalizePerformanceMode(preference);
  if (preference !== 'auto') return preference;
  return detectAutomaticPerformanceMode();
}

function performanceRuntimeProfile(mode = resolvedPerformanceMode()) {
  const fallbackProfiles = {
    full: { label: 'Full', description: 'Все визуальные слои.', recommendedHardware: '16 ГБ ОЗУ', fallbackPollingMs: REFRESH_INTERVAL_MS, realtimeDebounceMs: 180 },
    standard: { label: 'Standard', description: 'Сниженная стоимость эффектов.', recommendedHardware: '8 ГБ ОЗУ', fallbackPollingMs: CLOUD_REFRESH_INTERVAL_MS, realtimeDebounceMs: 280 },
    lite: { label: 'Lite', description: 'Минимальная стоимость визуализации.', recommendedHardware: '6 ГБ ОЗУ', fallbackPollingMs: CLIENT_LITE_REFRESH_INTERVAL_MS, realtimeDebounceMs: 450 },
  };
  return window.BizArenaUiContracts?.visualQuality?.[mode] || fallbackProfiles[mode] || fallbackProfiles.standard;
}

function isLiteClientMode() {
  return resolvedPerformanceMode() === 'lite';
}

function currentRefreshIntervalMs() {
  if (document.hidden) return HIDDEN_REFRESH_INTERVAL_MS;
  const cadence = normalizeRefreshCadence(state.settings.refreshCadence);
  const profile = performanceRuntimeProfile();
  const fallbackPollingMs = Number(profile.fallbackPollingMs || REFRESH_INTERVAL_MS);
  if (cadence === 'fast') return Math.max(REFRESH_INTERVAL_MS, fallbackPollingMs - 2000);
  if (cadence === 'slow') return Math.max(10000, fallbackPollingMs + 3000);
  if (isCloudDeployment()) return Math.max(CLOUD_REFRESH_INTERVAL_MS, fallbackPollingMs);
  return fallbackPollingMs;
}

function animationsDisabled() {
  if (isLiteClientMode()) return true;
  const preference = normalizeAnimationMode(state.settings.animationMode);
  if (preference === 'off') return true;
  if (preference === 'on') return false;
  return false;
}

function renderPerformanceModeSummary() {
  if (!elements.performanceModeSummary) return;
  const preference = normalizePerformanceMode(elements.performanceModeSelect?.value || state.settings.performanceMode);
  const resolvedMode = resolvedPerformanceMode(preference);
  const profile = performanceRuntimeProfile(resolvedMode);
  const prefix = preference === 'auto' ? `Авто выбрал ${profile.label}.` : `${profile.label}.`;
  elements.performanceModeSummary.dataset.performanceResolved = resolvedMode;
  elements.performanceModeSummary.textContent = `${prefix} ${profile.description} Рекомендация: ${profile.recommendedHardware}. Fallback-обновление: ${Math.round(profile.fallbackPollingMs / 1000)} с.`;
}

function scheduleRefreshLoop() {
  if (state.refreshIntervalHandle) clearInterval(state.refreshIntervalHandle);
  state.refreshIntervalHandle = setInterval(refreshState, currentRefreshIntervalMs());
}

function applyAppMode() {
  document.body.dataset.appMode = state.appMode;
  document.documentElement.dataset.appMode = state.appMode;
  document.documentElement.dataset.performanceMode = resolvedPerformanceMode();
  document.body.dataset.performanceMode = resolvedPerformanceMode();
  document.documentElement.dataset.refreshCadence = normalizeRefreshCadence(state.settings.refreshCadence);
  document.body.dataset.refreshCadence = normalizeRefreshCadence(state.settings.refreshCadence);
  document.documentElement.dataset.animationMode = animationsDisabled() ? 'off' : 'on';
  document.body.dataset.animationMode = animationsDisabled() ? 'off' : 'on';
  renderPerformanceModeSummary();
  syncBodyContext();
  if (isClientMode()) {
    document.title = 'BizArena Client';
    if ((!localStorage.getItem('bizArenaUserName') || state.profile.userName === 'BizPlayer') && !state.playerId) {
      if (elements.joinUserName) elements.joinUserName.value = '';
    }
  } else if (isServerMode()) {
    document.title = 'BizArena Server';
  } else {
    document.title = 'Biz Arena';
  }
  renderServerHome();
  renderNavigationState();
  if (isClientMode() && ['main-menu-screen', 'play-menu-screen', 'create-room-screen', 'server-home-screen'].includes(state.currentScreen)) {
    showScreen('join-room-screen', { addToHistory: false });
  } else if (isServerMode() && ['main-menu-screen', 'play-menu-screen', 'join-room-screen'].includes(state.currentScreen)) {
    showScreen('server-home-screen', { addToHistory: false });
  }
}

function currentPlayerRole() {
  if (isTeacherViewer()) return 'teacher';
  if (state.player || isClientMode()) return 'student';
  if (isServerMode()) return 'teacher';
  return 'guest';
}

function syncBodyContext() {
  const role = currentPlayerRole();
  document.body.dataset.playerRole = role;
  document.documentElement.dataset.playerRole = role;
}

function clientLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomCode: (params.get('roomCode') || '').trim().toUpperCase(),
    userName: (params.get('userName') || '').trim(),
    companyName: (params.get('companyName') || '').trim(),
    autojoin: params.get('autojoin') === '1',
  };
}

function applyClientLaunchParams() {
  if (!isClientMode() || state.clientLaunchParamsApplied) return;
  const launch = clientLaunchParams();
  if (!launch.roomCode && !launch.userName && !launch.companyName) {
    state.clientLaunchParamsApplied = true;
    return;
  }
  if (launch.userName) {
    state.profile.userName = launch.userName;
    localStorage.setItem('bizArenaUserName', launch.userName);
    if (elements.joinUserName) elements.joinUserName.value = launch.userName;
  }
  if (launch.roomCode && elements.roomCodeInput) elements.roomCodeInput.value = launch.roomCode;
  if (launch.companyName && elements.joinCompanyName) elements.joinCompanyName.value = launch.companyName;
  state.clientLaunchParamsApplied = true;
}

function friendlyConnectionError(message) {
  const text = String(message || '');
  if (/already in this room|уже .*комнат|уже .*игр/i.test(text)) {
    return 'Измените имя ученика или используйте то же название компании для повторного входа.';
  }
  return text || 'Не удалось подключиться к комнате.';
}

function setJoinFormStatus(message = '', tone = '') {
  if (!elements.joinFormStatus) return;
  elements.joinFormStatus.textContent = message;
  elements.joinFormStatus.dataset.tone = tone;
}

function maybeAutoJoinFromClientLaunch() {
  if (!isClientMode()) return;
  const launch = clientLaunchParams();
  if (!launch.autojoin || !launch.roomCode || !launch.companyName || state.playerId) return;
  window.setTimeout(async () => {
    try {
      await joinRoom();
    } catch (error) {
      showToast(friendlyConnectionError(error.message), 'error');
    }
  }, 100);
}

function uiPercent(value, total = 100) {
  const safeTotal = Math.max(1, Number(total) || 1);
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / safeTotal * 100)));
}

function renderMetricSparkline(values = [], tone = '') {
  const points = values.map(value => Number(value) || 0).slice(-8);
  const safe = points.length ? points : [0, 0, 0, 0];
  const max = Math.max(1, ...safe.map(value => Math.abs(value)));
  const width = 100;
  const height = 28;
  const step = safe.length > 1 ? width / (safe.length - 1) : width;
  const polyline = safe.map((value, index) => {
    const x = Math.round(index * step);
    const y = Math.round(height - (Math.max(0, value) / max) * (height - 4) - 2);
    return `${x},${Math.max(2, Math.min(height - 2, y))}`;
  }).join(' ');
  return `
    <svg class="live-sparkline ${escapeHtml(tone)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Динамика показателя" preserveAspectRatio="none">
      <polyline points="${escapeHtml(polyline)}"></polyline>
    </svg>`;
}

function renderLiveMetricCard({ label, value, hint, percent = 0, tone = '', spark = [], icon = '' }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return `
    <article class="live-metric-card ${escapeHtml(tone)}" data-live-value="${escapeHtml(value)}">
      <div class="live-metric-copy">
        ${icon ? `<span class="live-metric-icon">${gameIcon(icon)}</span>` : ''}
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(hint || '')}</small>
        </div>
      </div>
      ${renderMetricSparkline(spark.length ? spark : [safePercent * 0.55, safePercent * 0.72, safePercent], tone)}
      <i class="live-meter" style="--live-meter:${safePercent}%"></i>
    </article>`;
}

function renderReadinessGauge(percent, label, value, tone = '') {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return `
    <article class="live-readiness-gauge ${escapeHtml(tone)}" style="--gauge:${safePercent}%">
      <div>
        <strong>${escapeHtml(String(value))}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
      <small>${safePercent}%</small>
    </article>`;
}

async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) throw new Error('Нет адреса для копирования.');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function showToast(message, tone = 'info') {
  const text = String(message || '').trim();
  if (!text) return;
  setStatus(text, tone !== 'error');
  if (!elements.toastStack) return;
  const node = document.createElement('div');
  node.className = `toast toast-${tone}`;
  node.innerHTML = `
    <strong>${tone === 'error' ? 'Нужно проверить' : tone === 'success' ? 'Готово' : 'Сообщение'}</strong>
    <span>${escapeHtml(text)}</span>
  `;
  elements.toastStack.appendChild(node);
  window.setTimeout(() => {
    node.classList.add('toast-hide');
    window.setTimeout(() => node.remove(), 260);
  }, tone === 'error' ? 5200 : 3200);
}

function applyTranslations() {
  document.documentElement.lang = state.settings.language;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.documentElement.style.fontSize = `${state.settings.fontSize}px`;
  normalizeVisibleTextEncoding();
}

function applyProfileUI() {
  elements.profileUsername.value = state.profile.userName;
  if (elements.joinUserName) elements.joinUserName.value = state.profile.userName;
  const fallback = (state.profile.userName || 'BA').slice(0, 2).toUpperCase();
  elements.profileAvatarFallback.textContent = fallback;
  if (state.profile.avatar) {
    elements.profileAvatarPreview.src = state.profile.avatar;
    elements.profileAvatarPreview.style.display = 'block';
    elements.profileAvatarFallback.style.display = 'none';
  } else {
    elements.profileAvatarPreview.removeAttribute('src');
    elements.profileAvatarPreview.style.display = 'none';
    elements.profileAvatarFallback.style.display = 'grid';
  }
}

function renderNavigationState() {
  elements.screenButtons.forEach(button => {
    const requiresConnection = button.dataset.requiresConnection === 'true';
    const requiresRunningGame = button.dataset.requiresRunningGame === 'true';
    const opens = button.dataset.openScreen;
    const hiddenInClient = isClientMode() && ['create-room-screen', 'profile-screen', 'settings-screen', 'about-screen'].includes(opens);
    const hiddenInServer = isServerMode() && ['join-room-screen', 'profile-screen'].includes(opens);
    button.hidden = hiddenInClient || hiddenInServer;
    button.disabled = (requiresConnection && !isConnected()) || (requiresRunningGame && !gameIsActive());
  });
}

function revealActiveGameTab(button) {
  const navigation = button?.closest?.('.app-sidebar-nav');
  if (!navigation) return;
  requestAnimationFrame(() => {
    if (navigation.scrollWidth <= navigation.clientWidth + 1) return;
    const navigationRect = navigation.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const edgePadding = 6;
    if (buttonRect.right > navigationRect.right) {
      navigation.scrollLeft += buttonRect.right - navigationRect.right + edgePadding;
    } else if (buttonRect.left < navigationRect.left) {
      navigation.scrollLeft -= navigationRect.left - buttonRect.left + edgePadding;
    }
  });
}

function setGameTab(tabId) {
  const visibleTabs = visibleGameTabs();
  const nextTabId = visibleTabs.has(tabId) ? tabId : (visibleTabs.has('operations') ? 'operations' : [...visibleTabs][0] || 'overview');
  state.currentGameTab = nextTabId;
  document.body.dataset.gameTab = nextTabId;
  document.documentElement.dataset.gameTab = nextTabId;
  localStorage.setItem('bizArenaGameTab', nextTabId);
  let activeNavigationButton = null;
  elements.gameTabs.forEach(button => {
    const active = button.dataset.gameTab === nextTabId;
    button.classList.toggle('active', active);
    if (active && button.closest?.('.app-sidebar-nav')) activeNavigationButton = button;
  });
  elements.gamePanels.forEach(panel => panel.classList.toggle('hidden', panel.dataset.gamePanel !== nextTabId));
  revealActiveGameTab(activeNavigationButton);
  renderTutorialOverlay();
}

function defaultGameTabForViewer() {
  return isTeacherViewer() ? 'teacher' : 'operations';
}

function showScreen(screenId, { addToHistory = true } = {}) {
  const wasGameScreen = state.currentScreen === 'game-screen';
  if (screenId === 'play-menu-screen') screenId = 'main-menu-screen';
  if (isClientMode() && ['main-menu-screen', 'play-menu-screen', 'create-room-screen', 'profile-screen', 'settings-screen', 'about-screen', 'server-home-screen'].includes(screenId)) {
    screenId = 'join-room-screen';
  }
  if (isServerMode() && ['main-menu-screen', 'play-menu-screen', 'join-room-screen', 'profile-screen'].includes(screenId)) {
    screenId = 'server-home-screen';
  }
  const disconnectedHome = isClientMode() ? 'join-room-screen' : isServerMode() ? 'server-home-screen' : 'main-menu-screen';
  if (screenId === 'lobby-screen' && !isConnected()) screenId = disconnectedHome;
  if (screenId === 'game-screen' && !gameIsActive()) screenId = isConnected() ? 'lobby-screen' : disconnectedHome;
  if (screenId === 'results-screen' && !gameIsFinished()) screenId = isConnected() ? (gameIsActive() ? 'game-screen' : 'lobby-screen') : disconnectedHome;
  if (addToHistory && state.currentScreen !== screenId) state.screenHistory.push(state.currentScreen);
  state.currentScreen = screenId;
  document.body.dataset.screen = screenId;
  syncBodyContext();
  elements.screens.forEach(screen => {
    const active = screen.id === screenId;
    screen.classList.toggle('active', active);
    screen.classList.toggle('hidden', !active);
  });
  syncGameTabVisibility();
  if (screenId === 'game-screen' && !wasGameScreen) setGameTab(defaultGameTabForViewer());
  renderNavigationState();
  renderTurnControlDock();
  renderTutorialOverlay();
}

function goBack() {
  const currentScreen = state.currentScreen;
  const fallback = isClientMode() ? 'join-room-screen' : isServerMode() ? 'server-home-screen' : 'main-menu-screen';
  const previousScreen = state.screenHistory.pop() || fallback;
  if (ROOM_MANAGED_SCREENS.includes(currentScreen)) state.roomAutoOpenDismissed = true;
  showScreen(previousScreen, { addToHistory: false });
}

function syncScreenWithRoom() {
  if (!isConnected()) {
    if (tutorialIsActive()) stopTutorial();
    if (['lobby-screen', 'game-screen', 'results-screen'].includes(state.currentScreen)) {
      state.screenHistory = [];
      showScreen(isClientMode() ? 'join-room-screen' : isServerMode() ? 'server-home-screen' : 'main-menu-screen', { addToHistory: false });
    }
    renderNavigationState();
    return;
  }

  const targetScreen = gameIsFinished() ? 'results-screen' : gameIsActive() ? 'game-screen' : 'lobby-screen';
  if (!state.roomAutoOpenDismissed && state.currentScreen !== targetScreen && ROOM_AUTO_ENTRY_SCREENS.includes(state.currentScreen)) {
    showScreen(targetScreen);
  }
  if (!state.roomAutoOpenDismissed && state.currentScreen === 'lobby-screen' && gameIsActive()) showScreen('game-screen');
  if (state.currentScreen === 'game-screen' && gameIsFinished()) showScreen('results-screen');
  if (state.currentScreen === 'results-screen' && !gameIsFinished()) showScreen(targetScreen);
  renderNavigationState();
  renderTurnControlDock();
}

function createOptionMarkup(items, selectedValue) {
  return items.map(item => `<option value="${item.key}" ${item.key === selectedValue ? 'selected' : ''}>${item.label}</option>`).join('');
}

function factoryScenarioCatalog() {
  return [
    { key: 'motorcycles', label: t('scenario_motorcycles_label'), product: t('scenario_motorcycles_product'), demand: '7-14', price: '4 800-9 000 RUB', complexity: t('profile_balanced'), note: t('scenario_motorcycles_note'), lesson: ['Закупка полного комплекта', 'Сборка и заявка', 'Цена против конкурентов'] },
    { key: 'drones', label: t('scenario_drones_label'), product: t('scenario_drones_product'), demand: '10-18', price: '2 400-5 200 RUB', complexity: t('profile_component_dense'), note: t('scenario_drones_note'), lesson: ['Много компонентов', 'Дефицит батарей', 'Качество и цена'] },
    { key: 'smartphones', label: t('scenario_smartphones_label'), product: t('scenario_smartphones_product'), demand: '14-24', price: '1 600-3 600 RUB', complexity: t('profile_fast_market'), note: t('scenario_smartphones_note'), lesson: ['Быстрый рынок', 'Малые партии', 'Частые продажи'] },
    { key: 'ev_scooters', label: t('scenario_ev_scooters_label'), product: t('scenario_ev_scooters_product'), demand: '9-16', price: '2 600-5 600 RUB', complexity: t('profile_battery_risk'), note: t('scenario_ev_scooters_note'), lesson: ['Риск батарей', 'Себестоимость', 'Запас компонентов'] },
    { key: 'appliances', label: t('scenario_appliances_label'), product: t('scenario_appliances_product'), demand: '12-20', price: '1 400-3 000 RUB', complexity: t('profile_steady_margin'), note: t('scenario_appliances_note'), lesson: ['Спокойный рынок', 'Низкая маржа', 'Контроль расходов'] },
  ];
}

function localDifficultyConfig(key) {
  const config = CLIENT_DIFFICULTY_CONFIGS[key] || CLIENT_DIFFICULTY_CONFIGS.easy;
  return {
    ...config,
    label: t(config.labelKey || `difficulty_${config.key}`),
    preview: t(config.previewKey || `difficulty_${config.key}_hint`),
  };
}

function selectedCreateDifficulty() {
  const key = elements.createDifficultySelect?.value || 'easy';
  return localDifficultyConfig(key);
}

function setCreateDifficulty(key) {
  const nextKey = CLIENT_DIFFICULTY_CONFIGS[key] ? key : 'easy';
  if (elements.createDifficultySelect) elements.createDifficultySelect.value = nextKey;
  elements.createDifficultyButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.createDifficulty === nextKey);
  });
  renderDifficultyPreview();
}

function renderDifficultyPreview() {
  renderCreateScenarioPreview();
}

function renderCreateScenarioPreview() {
  if (!elements.createScenarioPreview || !elements.createScenarioSelect) return;
  const scenario = factoryScenarioCatalog().find(item => item.key === elements.createScenarioSelect.value) || factoryScenarioCatalog()[0];
  const difficulty = selectedCreateDifficulty();
  const labParameters = [
    { label: 'Спрос', value: `${scenario.demand} за ход` },
    { label: 'Цена', value: scenario.price },
    { label: 'Сложность', value: difficulty.label },
  ];
  const experimentAxes = ['Цена против спроса', 'Дефицит поставщиков', 'Найм и зарплаты'];
  elements.createScenarioPreview.innerHTML = `
    <div>
      <span class="factory-node-label">${t('preview_factory_portfolio')}</span>
      <strong>${scenario.label}</strong>
      <p>${scenario.note}</p>
      <p><strong>${difficulty.label}</strong> - ${difficulty.preview}</p>
    </div>
    <div class="create-room-mini-chart" aria-label="Market demand preview">
      <svg viewBox="0 0 520 150" fill="none" aria-hidden="true">
        <path d="M0 108 C62 92 96 48 154 58 C222 70 244 122 310 94 C374 68 408 24 520 34" stroke="currentColor" stroke-width="4" style="color: var(--accent-2);"/>
        <path d="M0 122 C74 116 126 92 190 102 C268 116 314 128 382 94 C430 70 462 66 520 78" stroke="currentColor" stroke-width="2" style="color: var(--muted);"/>
      </svg>
    </div>
    <div class="scenario-preview-grid">
      <span><b>${scenario.product}</b><small>${t('preview_product')}</small></span>
      <span><b>${scenario.demand}</b><small>${t('preview_demand')}</small></span>
      <span><b>${scenario.price}</b><small>${t('preview_price_band')}</small></span>
      <span><b>${t(`ui_mode_${difficulty.uiMode}`)}</b><small>${t('preview_ui_mode')}</small></span>
    </div>
    <div class="lesson-preview">
      <strong>Что изучают</strong>
      ${scenario.lesson.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
    <div class="scenario-lab-preview">
      <strong>Параметры будущей лаборатории</strong>
      <div>
        ${labParameters.map(item => `<span><b>${escapeHtml(item.value)}</b><small>${escapeHtml(item.label)}</small></span>`).join('')}
      </div>
      <p>Оси эксперимента: ${experimentAxes.map(item => escapeHtml(item)).join(' • ')}</p>
    </div>
  `;
  renderCreateRoomLiveSummary();
}

function createTurnDurationLabel(value) {
  const minutes = Math.max(1, Math.round(Number(value || 0) / 60000));
  return `${minutes} мин.`;
}

function renderCreateRoomLiveSummary() {
  if (!elements.createRoomLiveSummary) return;
  const scenario = factoryScenarioCatalog().find(item => item.key === elements.createScenarioSelect?.value) || factoryScenarioCatalog()[0];
  const difficulty = selectedCreateDifficulty();
  const roomName = elements.roomName?.value.trim() || 'Classroom';
  const companyName = elements.createCompanyName?.value.trim() || 'Команда преподавателя';
  const maxPlayers = Number(elements.createMaxPlayersSelect?.value || 30);
  const dayLimit = Number(elements.createDayLimitSelect?.value || 30);
  const turnDuration = createTurnDurationLabel(elements.createTurnDurationSelect?.value || 1800000);
  const cards = [
    { label: 'Комната', value: roomName, hint: `Хост: ${companyName}` },
    { label: 'Команды', value: `${maxPlayers}`, hint: 'лимит участников в лобби' },
    { label: 'Формат', value: `${dayLimit} ходов`, hint: `${turnDuration} на ход` },
    { label: 'Сценарий', value: scenario.label, hint: `${difficulty.label} • ${scenario.product}` },
  ];
  elements.createRoomLiveSummary.innerHTML = cards.map(card => `
    <article>
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(String(card.value))}</strong>
      <small>${escapeHtml(String(card.hint))}</small>
    </article>
  `).join('');
}

function operatingPlanPreviewText(preview) {
  if (!preview?.actionLabelKey) return t('operating_plan_waiting');
  if (preview.action === 'set-price' && preview.value) return `${t(preview.actionLabelKey)} ${preview.value} ${t('currency_symbol')}`;
  const label = t(preview.actionLabelKey);
  return label !== preview.actionLabelKey ? label : preview.action;
}

function populateSelectors() {
  if (!state.room) return;
  const productCatalog = state.room.productCatalog || [];
  const cityCatalog = state.room.cityCatalog || [];
  const scenarioCatalog = state.room.scenarioCatalog || [];
  const specializationCatalog = state.room.specializationCatalog || [];
  const boardPolicyCatalog = state.room.boardPolicyCatalog || [];
  const strategyCatalog = state.room.strategyCatalog || [];
  const researchCatalog = state.room.researchCatalog || [];
  if (!hasRenderSignatureChanged('roomSelectors', {
    roomCode: state.room.code,
    scenarioKey: state.room.settings?.scenarioKey,
    productKey: state.player?.productKey,
    cityKey: state.player?.cityKey,
    specializationKey: state.player?.specializationKey,
    boardPolicyKey: state.player?.boardPolicyKey,
    strategyKey: state.player?.strategyKey,
    focusProductKey: state.player?.focusProductKey,
    completedResearch: state.player?.research?.completed || [],
    catalogs: [productCatalog, cityCatalog, scenarioCatalog, specializationCatalog, boardPolicyCatalog, strategyCatalog, researchCatalog],
  })) return;
  elements.productSelect.innerHTML = createOptionMarkup(productCatalog, state.player?.productKey || 'food');
  elements.citySelect.innerHTML = createOptionMarkup(cityCatalog, state.player?.cityKey || 'regional');
  elements.scenarioSelect.innerHTML = createOptionMarkup(scenarioCatalog, state.room.settings.scenarioKey);
  elements.specializationSelect.innerHTML = createOptionMarkup(specializationCatalog, state.player?.specializationKey || 'balanced');
  elements.boardPolicySelect.innerHTML = createOptionMarkup(boardPolicyCatalog, state.player?.boardPolicyKey || 'balanced');
  elements.strategySelect.innerHTML = createOptionMarkup(strategyCatalog, state.player?.strategyKey || 'balanced');
  if (elements.focusProductSelect) elements.focusProductSelect.innerHTML = createOptionMarkup(productCatalog, state.player?.focusProductKey || state.player?.productKey || 'food');
  const researchOptions = researchCatalog.filter(item => !state.player?.research?.completed?.includes(item.key));
  elements.researchSelect.innerHTML = researchOptions.length ? researchOptions.map(item => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)} ? ${item.cost}</option>`).join('') : '<option value="">—</option>';
}

function syncLobbyControls() {
  const room = state.room;
  const player = state.player;
  if (!room || !player) {
    elements.maxPlayersSelect.value = '30';
    elements.demandProfileSelect.value = 'standard';
    elements.scenarioSelect.innerHTML = createOptionMarkup(factoryScenarioCatalog(), 'motorcycles');
    elements.difficultySelect.value = 'easy';
    elements.dayLimitSelect.value = '30';
    if (elements.turnDurationSelect) elements.turnDurationSelect.value = '1800000';
    elements.toggleReady.disabled = true;
    elements.roomSettingsForm.querySelectorAll('select, button[type="submit"]').forEach(node => { node.disabled = true; });
    elements.saveRoomButton.disabled = true;
    elements.loadRoomButton.disabled = true;
    elements.saveRoomButtonGame.disabled = true;
    elements.loadRoomButtonGame.disabled = true;
    if (elements.leaveGameButton) elements.leaveGameButton.disabled = true;
    return;
  }
  elements.maxPlayersSelect.value = String(room.settings.maxPlayers);
  elements.demandProfileSelect.value = room.settings.demandProfile;
  elements.difficultySelect.value = room.settings.difficulty || room.difficulty || 'normal';
  elements.dayLimitSelect.value = String(room.settings.dayLimit || 30);
  if (elements.turnDurationSelect) elements.turnDurationSelect.value = String(room.settings.turnDurationMs || room.turnDurationMs || 1800000);
  elements.toggleReady.disabled = room.status !== 'lobby' || player.isBot;
  elements.toggleReady.textContent = player.ready ? 'Принято' : 'Принять участие';
  const hostCanEdit = room.status === 'lobby' && player.isHost && !isClientMode();
  elements.roomSettingsForm.querySelectorAll('select, button[type="submit"]').forEach(node => { node.disabled = !hostCanEdit; });
  elements.saveRoomButton.disabled = !player.isHost || isClientMode();
  elements.loadRoomButton.disabled = !(player.isHost && !isClientMode() && ['lobby', 'paused', 'finished'].includes(room.status) && room.saveMeta);
  elements.saveRoomButtonGame.disabled = !player.isHost || isClientMode();
  elements.loadRoomButtonGame.disabled = !(player.isHost && !isClientMode() && ['paused', 'finished'].includes(room.status) && room.saveMeta);
  if (elements.leaveGameButton) elements.leaveGameButton.disabled = !isConnected();
  if (room.saveMeta) {
    elements.saveSlotStatus.textContent = `${t('save_slot_prefix')}: ${room.saveMeta.savedAt} ? ${t('day')} ${room.saveMeta.day} ? ${room.saveMeta.scenarioLabel}`;
  } else {
    elements.saveSlotStatus.textContent = t('save_slot_empty');
  }
}

function renderRoomOverview() {
  elements.roomOverview.innerHTML = '';
  elements.roomOverview.classList.remove('placeholder');
  if (!state.room || !state.player) {
    elements.roomOverview.classList.add('placeholder');
    elements.roomOverview.innerHTML = `<div>${t('room_placeholder')}</div>`;
    return;
  }
  const canHostControl = state.player.isHost && !isClientMode();
  const isTeacherView = isTeacherViewer();
  const statusKey = state.room.status === 'lobby' ? 'room_status_lobby' : state.room.status === 'running' ? 'room_status_running' : state.room.status === 'finished' ? 'room_status_finished' : 'room_status_paused';
  const readySummary = `${t('ready_count')}: ${state.room.readyCount}/${state.room.humanCount}`;
  const hostPlayer = state.room.players.find(player => player.isHost) || null;
  const studentLink = gameStudentClientUrl();
  const studentQrSrc = studentLink ? `/api/qr?data=${encodeURIComponent(studentLink)}` : '';
  const turnMinutes = Math.round(Number(state.room.settings?.turnDurationMs || state.room.turnDurationMs || 1800000) / 60000);
  const scenarioKey = state.room.settings?.scenarioKey || state.room.scenarioKey || '';
  const difficultyLabel = state.room.difficultyLabel || currentDifficultyConfig().label;
  const lobbyStatusTone = state.room.allReady && state.room.humanCount > 0 ? 'ok' : 'warn';
  const speedControls = canHostControl && state.room.status !== 'finished' && state.room.tickMode !== 'manual'
    ? `<div class="button-pair host-controls speed-controls">
         <button data-speed-action="slow" class="${state.room.tickSpeedPreset === 'slow' ? 'ghost' : ''}">${t('speed_slow')}</button>
         <button data-speed-action="normal" class="${state.room.tickSpeedPreset === 'normal' ? 'ghost' : ''}">${t('speed_normal')}</button>
         <button data-speed-action="fast" class="${state.room.tickSpeedPreset === 'fast' ? 'ghost' : ''}">${t('speed_fast')}</button>
       </div>`
    : '';
  const hostControls = canHostControl ? (
    state.room.status === 'lobby'
      ? `<div class="button-pair host-controls lobby-secondary-controls" aria-label="Дополнительные действия с комнатой">
          <button data-host-action="add-bot">${t('add_bot')}</button>
          <button data-host-action="save-room">${t('save_room_action')}</button>
          <button data-host-action="load-room" class="ghost" ${state.room.saveMeta ? '' : 'disabled'}>${t('load_room_action')}</button>
          <button data-host-action="reset-room" class="ghost">${t('reset_room')}</button>
        </div>`
      : state.room.status === 'running'
        ? `<div class="button-pair host-controls">
            <button data-host-action="next-turn">${t('next_turn')}</button>
            <button data-host-action="pause-game" class="ghost">${t('pause_game')}</button>
            <button data-host-action="save-room">${t('save_room_action')}</button>
            <button data-host-action="reset-room" class="ghost">${t('reset_room')}</button>
          </div>`
        : state.room.status === 'paused'
          ? `<div class="button-pair host-controls">
              <button data-host-action="resume-game">${state.room.tickMode === 'manual' ? t('continue_planning') : t('resume_game')}</button>
              <button data-host-action="save-room">${t('save_room_action')}</button>
              <button data-host-action="load-room">${t('load_room_action')}</button>
              <button data-host-action="reset-room" class="ghost">${t('reset_room')}</button>
            </div>`
          : `<div class="button-pair host-controls">
              <button data-host-action="load-room">${t('load_room_action')}</button>
              <button data-host-action="reset-room">${t('play_again')}</button>
            </div>`
  ) : '';
  const lessonPlan = state.room.lessonPlan || null;
  const lessonParameters = (lessonPlan?.parameters || []).slice(0, 3);
  const studentLobbyMarkup = state.room.status === 'lobby' && !isTeacherView
    ? renderStudentLobbyCard(hostPlayer, turnMinutes, difficultyLabel)
    : '';
  const teacherLobbyCommandMarkup = state.room.status === 'lobby' && isTeacherView
    ? renderTeacherLobbyCommandCard(studentLink, studentQrSrc, turnMinutes, difficultyLabel)
    : '';
  const lessonMarkup = lessonPlan ? `
    <section class="lesson-plan-card">
      <div>
        <span class="factory-node-label">План занятия</span>
        <strong>${escapeHtml(lessonPlan.title || state.room.scenarioLabel)}</strong>
        <p>${escapeHtml(lessonPlan.objectives?.[0] || '')}</p>
      </div>
      <div class="lesson-plan-grid">
        ${(lessonPlan.firstSteps || []).slice(0, 3).map((step, index) => `<span><b>${index + 1}</b>${escapeHtml(step)}</span>`).join('')}
      </div>
      ${lessonParameters.length ? `
        <div class="scenario-lab-preview compact">
          <strong>Параметры сценария</strong>
          <div>
            ${lessonParameters.map(item => `<span><b>${escapeHtml(item.value || '')}</b><small>${escapeHtml(item.label || '')}</small></span>`).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  ` : '';
  const roomMetaMarkup = `
    <div class="room-meta-grid">
      <div class="market-item"><strong>${t('players_label')}</strong><div class="value">${state.room.playerCount}</div><small>${t('companies_room')}</small></div>
      <div class="market-item"><strong>${t('scenario_label')}</strong><div class="value">${escapeHtml(state.room.scenarioLabel)}</div><small>${escapeHtml(scenarioKey)} • ${t('market_profile')}: ${escapeHtml(state.room.settings.demandProfile)} / ${escapeHtml(difficultyLabel)}</small></div>
      <div class="market-item"><strong>${t('ticks_label')}</strong><div class="value">${state.room.tick}</div><small>${t('day_limit_title')}: ${state.room.settings.dayLimit} - ${t('room_mode')}: ${state.room.tickMode === 'manual' ? t('room_mode_turn_based') : t(`speed_${state.room.tickSpeedPreset}`)}</small></div>
    </div>`;
  const roomSupportMarkup = isTeacherView && state.room.status === 'lobby'
    ? `<details class="teacher-lobby-secondary" data-lobby-secondary-details>
        <summary>Дополнительные параметры и действия</summary>
        <div class="teacher-lobby-secondary-content">
          ${roomMetaMarkup}
          ${lessonMarkup}
          ${speedControls}
          ${hostControls}
        </div>
      </details>`
    : state.room.status === 'lobby' && !isTeacherView
      ? ''
      : `${roomMetaMarkup}${lessonMarkup}${speedControls}${hostControls}`;

  elements.roomOverview.innerHTML = `
    <div class="room-topline">
      <div>
        <strong>${escapeHtml(state.room.name)}</strong>
        <p class="muted small">${t('room_code_label')}: <strong>${state.room.code}</strong> · ${t('host')}: ${escapeHtml(hostPlayer?.userName || '—')} · ${readySummary}</p>
      </div>
      <span class="status">${t(statusKey)}</span>
    </div>
    ${studentLobbyMarkup}
    ${teacherLobbyCommandMarkup}
    ${state.room.status !== 'lobby' ? `<section class="lobby-classroom-hero" aria-label="Матч запущен">
      <div class="lobby-classroom-copy">
        <span class="factory-node-label">Комната преподавателя</span>
        <h3>Матч уже запущен</h3>
        <p>Комната активна. Можно перейти к игровому дашборду.</p>
        <div class="lobby-join-link">
          <span>
            <small>Ссылка для учеников</small>
            <strong>${escapeHtml(studentLink)}</strong>
          </span>
          <button type="button" class="ghost" data-copy-student-link="${escapeHtml(studentLink)}">Скопировать ссылку</button>
        </div>
      </div>
      <div class="lobby-classroom-status lobby-share-card">
        ${studentQrSrc ? `<img src="${escapeHtml(studentQrSrc)}" alt="QR для входа учеников" loading="lazy" />` : '<div class="qr-placeholder">QR</div>'}
        <span class="${lobbyStatusTone}"><b>${state.room.readyCount}/${state.room.humanCount}</b><small>готовность класса</small><i class="live-meter" style="--live-meter:${uiPercent(state.room.readyCount, state.room.humanCount || 1)}%"></i></span>
        <span><b>${escapeHtml(String(state.room.settings.dayLimit || 30))}</b><small>ходов в занятии</small></span>
        <span><b>${turnMinutes} мин</b><small>на один ход</small></span>
        <button type="button" class="command-action-primary" data-open-game>Перейти в игру</button>
      </div>
    </section>` : ''}
    ${roomSupportMarkup}`;

  elements.roomOverview.querySelectorAll('[data-host-action]').forEach(button => button.addEventListener('click', () => sendAction(button.dataset.hostAction)));
  elements.roomOverview.querySelectorAll('[data-speed-action]').forEach(button => button.addEventListener('click', () => sendAction('set-speed', button.dataset.speedAction)));
  elements.roomOverview.querySelectorAll('[data-lobby-ready]').forEach(button => button.addEventListener('click', () => submitLobbyReadiness(button)));
  elements.roomOverview.querySelectorAll('[data-open-game]').forEach(button => button.addEventListener('click', () => showScreen('game-screen')));
  elements.roomOverview.querySelectorAll('[data-copy-student-link]').forEach(button => button.addEventListener('click', async () => {
    try {
      await copyTextToClipboard(button.dataset.copyStudentLink || studentLink);
      showToast(`Скопировано: ${button.dataset.copyStudentLink || studentLink}`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }));
}
function appendStatCard(container, label, value, hint) {
  const node = elements.statCardTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector('.label').textContent = label;
  node.querySelector('.value').textContent = value;
  node.querySelector('.hint').textContent = hint;
  container.appendChild(node);
}

function renderCompany() {
  elements.companyOverview.innerHTML = '';
  elements.companyOverview.classList.remove('placeholder');
  elements.companyOverview.classList.remove('finance-terminal-grid');
  if (!state.player) {
    elements.companyOverview.classList.add('placeholder');
    elements.companyOverview.innerHTML = `<div>${t('company_placeholder')}</div>`;
    return;
  }
  if (isFactoryRoom()) {
    const factory = state.player.factory;
    elements.companyOverview.classList.add('finance-terminal-grid');
    const payroll = (factory.workers || []).reduce((sum, worker) => sum + Number(worker.expectedSalary || 0), 0);
    const offerValue = Number(factory.saleOffer.quantity || 0) * Number(factory.saleOffer.price || 0);
    const componentStock = (factory.components || []).reduce((sum, component) => sum + Number(component.quantity || 0), 0);
    const cards = [
      [t('factory_cash'), money(state.player.money), 'Операционный бюджет', 'cash'],
      [t('networth'), money(state.player.netWorth), localizedScenarioLabel(), 'capital'],
      ['Заявка в рынок', money(offerValue), `${factory.saleOffer.quantity} ед. @ ${money(factory.saleOffer.price)}`, 'offer'],
      ['Фонд оплаты', money(payroll), `${factory.workerCount} сотрудников • пригодность ${factory.avgSuitability || 0}/100`, 'payroll'],
      ['Мощность линии', `${factory.assemblyCapacity} ед.`, `${factory.productLabel} за текущий ход`, 'capacity'],
      ['Готовый склад', `${factory.finishedGoods} ${factory.productUnit}`, 'Можно выставить в книгу заявок', 'stock'],
      ['Компоненты', `${componentStock} ед.`, `${factory.components.map(component => `${component.label}: ${component.quantity}`).join(' • ')}`, 'parts'],
      ['Последний ход', `${state.player.soldLastTick || 0} продано`, localizedLastAction(state.player.lastAction) || 'Действий пока не было', 'last'],
    ];
    elements.companyOverview.innerHTML = cards.map(([label, value, hint, kind]) => `
      <article class="stat-card finance-card ${kind}">
        <span class="label">${escapeHtml(label)}</span>
        <strong class="value">${escapeHtml(value)}</strong>
        <small class="hint">${escapeHtml(hint)}</small>
      </article>
    `).join('');
    return;
  }
  const researchStatus = state.player.research.activeLabel ? `${state.player.research.activeLabel} ${state.player.research.progress}/${state.player.research.target}` : t('research_completed');
  const cards = [
    [t('balance'), money(state.player.money), t('live_cash')],
    [t('networth'), money(state.player.netWorth), t('business_value')],
    [t('debt'), money(state.player.debt), t('debt_hint')],
    [t('reputation'), `${state.player.reputation}/100`, t('reputation_hint')],
    [t('team'), `${state.player.staff}`, `${t('team_hint')} • ${money(state.player.salary)}`],
    [t('factories'), `${state.player.factories}`, `${t('factories_hint')}: ${state.player.producedLastTick}`],
    [t('stores'), `${state.player.stores}`, `${t('stores_hint')}: ${state.player.soldLastTick}`],
    [t('stock'), `${state.player.productStock} pcs`, t('stock_hint')],
    [t('raw_stock'), `${state.player.rawStock} pcs`, t('raw_stock_hint')],
    [t('product'), state.player.productLabel, t('product_hint')],
    [t('city'), state.player.cityLabel, t('city_hint')],
    [t('supply_level'), `${state.player.supplyLevel}`, `${t('supply_hint')} • ${money(state.player.price)}`],
    [t('specialization_title'), state.player.specializationLabel, t('specialization_hint_card')],
    [t('board_policy_title'), state.player.boardPolicyLabel, t('board_policy_hint_card')],
    [t('operating_plan_title'), state.player.strategyLabel, `${state.player.strategyDescription || t('operating_plan_hint_card')} • ${t('operating_plan_next_step')}: ${operatingPlanPreviewText(state.player.operatingPlanPreview)}`],
    [t('innovation'), `${state.player.innovation}`, `${t('research_points')}: ${state.player.researchPoints}`],
    [t('research_status'), researchStatus, `${state.player.research.completed.length} ${t('research_done').toLowerCase()}`],
    [t('season_goal'), state.player.seasonGoal ? state.player.seasonGoal.label : '—', state.player.seasonGoal ? `${state.player.seasonGoal.progress}/${state.player.seasonGoal.target} • ${money(state.player.seasonGoal.reward)}` : '—'],
    [t('advisors'), (state.player.advisorAlerts || []).length ? state.player.advisorAlerts.map(key => t(`advisor_${key}`)).join(' • ') : '—', t('status_hint')],
    [t('active_contract'), state.player.activeContract ? state.player.activeContract.title : '—', state.player.activeContract ? `${t('contract_progress')}: ${state.player.activeContract.progress}/${state.player.activeContract.targetSales}` : t('contract_title')],
    [t('company_status'), state.player.bankrupt ? t('bankrupt') : localizedLastAction(state.player.lastAction), `${t('status_hint')} • ${money(state.player.incomeLastTick)} / ${money(state.player.expensesLastTick)}`],
  ];
  cards.forEach(card => appendStatCard(elements.companyOverview, ...card));
}

function decisionText(key, fallback = '') {
  if (!key) return fallback;
  const translated = t(key);
  return translated === key ? (fallback || key) : translated;
}

function readableInternalKey(value) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function localizedDecisionRoundLabel(roundKey) {
  const key = String(roundKey || '').trim();
  return decisionText(DECISION_ROUND_TITLE_KEYS[key], readableInternalKey(key));
}
function localizedDecisionOptionLabel(optionKey) {
  const key = String(optionKey || '').trim();
  return decisionText(DECISION_OPTION_LABEL_KEYS[key], readableInternalKey(key));
}
function localizedParticipantName(value) {
  const name = String(value || '').trim();
  if (state.settings.language === 'ru' && name === 'AI Manager') return 'ИИ-менеджер';
  return name;
}
function supportsStrategicDecisionRounds() {
  if (!isFactoryRoom()) return false;
  const scenarioKey = state.room?.settings?.scenarioKey;
  return scenarioKey === 'motorcycles' || scenarioKey === 'drones';
}

function renderDecisionRoundCard() {
  if (!supportsStrategicDecisionRounds()) return '';

  const round = state.player?.decisionRound;
  const history = state.player?.decisionHistory || [];
  const latest = history[0] || null;
  const canResolve = canUseBusinessActions();
  const canForceRound = canUseBusinessActions() && isTeacherViewer() && (!round || round.status !== 'pending');

  if (!round && !latest && !canForceRound) return '';

  if (round && round.status === 'pending') {
    const options = (round.options || []).map((option, index) => {
      const optionLabel = decisionText(option.labelKey, option.key);
      const effectSummary = decisionText(option.effectSummaryKey, '');
      return `
      <article class="decision-option-item" data-default-option="${option.isDefault ? 'true' : 'false'}">
        <div class="decision-option-copy">
          <div class="decision-option-title-row">
            <span class="decision-option-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            <strong>${escapeHtml(optionLabel)}</strong>
          </div>
          <small class="decision-option-effect">${escapeHtml(effectSummary)}</small>
          ${option.isDefault ? `<span class="mini-badge decision-option-safe">${t('decision_round_default_safe')}</span>` : ''}
        </div>
        <button
          type="button"
          class="ghost decision-option-action"
          data-decision-option="1"
          data-decision-option-index="${index}"
          data-round-id="${escapeHtml(round.id)}"
          data-option-key="${escapeHtml(option.key)}"
          aria-label="${escapeHtml(`${t('decision_round_choose')}: ${optionLabel}`)}"
          ${canResolve ? '' : 'disabled'}
        >${t('decision_round_choose')}</button>
      </article>
    `;
    }).join('');

    return `
      <section class="decision-round-card is-pending" data-decision-round-contract="decision-round-v2" data-decision-round-status="pending" aria-labelledby="decision-round-heading">
        <div class="decision-round-head">
          <div class="decision-round-heading-group">
            <span class="decision-round-symbol">${gameIcon('crisis')}</span>
            <div>
              <span class="factory-node-label">${t('decision_round_card_title')}</span>
              <h3 id="decision-round-heading">${escapeHtml(decisionText(round.titleKey, t('decision_round_pending')))}</h3>
            </div>
          </div>
          <span class="mini-badge decision-round-status">${t('decision_round_pending')}</span>
        </div>
        <p class="decision-round-description">${escapeHtml(decisionText(round.descriptionKey, t('decision_round_card_hint')))}</p>
        <div class="decision-round-meta">
          <span>${t('decision_round_expires')} <strong>${escapeHtml(round.expiresDay)}</strong></span>
          <span>${t('decision_round_card_hint')}</span>
        </div>
        <div class="decision-option-grid">${options}</div>
      </section>
    `;
  }

  const resolutionText = latest
    ? `${decisionText(latest.selectedOptionLabelKey, latest.selectedOptionKey)} (${t(latest.resolution === 'auto_safe' ? 'decision_round_resolution_auto_safe' : 'decision_round_resolution_manual')})`
    : t('decision_round_no_history');

  return `
    <section class="decision-round-card is-resolved" data-decision-round-contract="decision-round-v2" data-decision-round-status="resolved" aria-labelledby="decision-round-heading">
      <div class="decision-round-head">
        <div class="decision-round-heading-group">
          <span class="decision-round-symbol">${gameIcon('check')}</span>
          <div>
            <span class="factory-node-label">${t('decision_round_card_title')}</span>
            <h3 id="decision-round-heading">${t('decision_round_no_active')}</h3>
          </div>
        </div>
        <span class="mini-badge decision-round-status">${t('decision_round_resolved')}</span>
      </div>
      <p class="decision-round-description">${t('decision_round_card_hint')}</p>
      <div class="decision-round-meta"><span>${t('decision_round_last_resolution')}: <strong>${escapeHtml(resolutionText)}</strong></span></div>
      ${latest?.resolution === 'auto_safe' ? `<div class="top-gap muted small">${t('decision_round_auto_safe_notice')}</div>` : ''}
      ${canForceRound ? `
        <div class="top-gap">
          <button type="button" class="ghost" data-force-decision-round="1">${t('decision_round_force')}</button>
          <div class="muted small top-gap">${t('decision_round_force_hint')}</div>
        </div>
      ` : ''}
    </section>
  `;
}

function checklistStatusLabel(status) {
  if (status === 'ready') return 'готово';
  if (status === 'blocked') return 'заблокировано';
  return 'требует внимания';
}

function checklistStatusClass(status) {
  if (status === 'ready') return 'ok';
  if (status === 'blocked') return 'danger';
  return 'warn';
}

function renderTurnChecklist(checklist = [], options = {}) {
  if (!checklist.length) return '';
  const compact = options.compact ? ' compact' : '';
  return `
    <section class="turn-checklist${compact}">
      <div class="turn-checklist-head">
        <div>
          <span class="factory-node-label">Центр хода</span>
          <h3>Что сделать до завершения</h3>
        </div>
        <span class="mini-badge">${checklist.filter(item => item.status === 'ready').length}/${checklist.length}</span>
      </div>
      <div class="turn-checklist-grid">
        ${checklist.map(item => `
          <button type="button" class="turn-check-item ${checklistStatusClass(item.status)}" data-checklist-tab="${escapeHtml(item.tab || '')}" data-checklist-department="${escapeHtml(item.department || '')}">
            <span class="turn-check-status">${checklistStatusLabel(item.status)}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.summary || '')}</small>
            <b>${escapeHtml(item.action || 'Открыть')}</b>
          </button>
        `).join('')}
      </div>
    </section>`;
}

function bindTurnChecklist(root) {
  root.querySelectorAll('[data-checklist-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const department = button.dataset.checklistDepartment;
      const tab = button.dataset.checklistTab;
      if (department) setFactoryDepartment(department);
      if (tab) setGameTab(tab);
      renderRoomState();
    });
  });
}

function renderTurnReviewCard(review) {
  if (!review) return '';
  const outcomes = (review.outcomes?.length ? review.outcomes : review.highlights || []).slice(0, 4);
  const sections = [
    { key: 'outcomes', label: 'Что произошло', items: outcomes },
    { key: 'reasons', label: 'Почему', items: (review.reasons || []).slice(0, 3) },
    { key: 'checks', label: 'Что проверить', items: (review.checks || []).slice(0, 3) },
  ].filter(section => section.items.length);
  return `
    <section class="turn-review-card" data-turn-review-contract="cause-effect-v1">
      <div class="turn-review-head">
        <span class="factory-node-label">Разбор хода</span>
        <h3>${escapeHtml(review.title || 'Разбор')}</h3>
        <p>${escapeHtml(review.summary || '')}</p>
      </div>
      <div class="turn-review-sections">
        ${sections.map(section => `
          <div class="turn-review-section" data-turn-review-section="${section.key}">
            <strong>${section.label}</strong>
            <ul>${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
        `).join('')}
      </div>
      <div class="turn-review-next">
        <span>Следующий фокус</span>
        <strong>${escapeHtml(review.nextBestAction || '')}</strong>
      </div>
    </section>`;
}

async function submitLobbyReadiness(button) {
  if (!button || button.disabled) return;
  const previousText = button.textContent;
  button.disabled = true;
  button.dataset.lobbyReadyState = 'sending';
  button.textContent = 'Отправляем...';
  try {
    await sendAction('toggle-ready', undefined, { throwOnError: true });
  } catch {
    if (!button.isConnected) return;
    button.disabled = false;
    button.dataset.lobbyReadyState = 'idle';
    button.textContent = previousText;
  }
}

function marketHintIcon(hint = {}) {
  if (hint.kind === 'decision') return 'goal';
  if (hint.saleRisk === 'high' || hint.tone === 'danger') return 'alert';
  if (hint.tone === 'ok' || hint.saleRisk === 'low') return 'check';
  return 'market';
}

function renderMarketReplayMetric({ icon, value, label, tone = '' }) {
  return `
    <article class="market-replay-metric ${escapeHtml(tone)}">
      <span class="market-replay-metric-icon">${gameIcon(icon)}</span>
      <div>
        <b>${escapeHtml(String(value))}</b>
        <small>${escapeHtml(label)}</small>
      </div>
    </article>`;
}

function renderStudentMarketStat({ icon, label, value }) {
  return `
    <article class="student-market-stat">
      <span class="student-market-stat-icon">${gameIcon(icon)}</span>
      <div>
        <small>${escapeHtml(label)}</small>
        <b>${escapeHtml(String(value))}</b>
      </div>
    </article>`;
}

function renderMarketHints(hints = [], options = {}) {
  if (!hints.length) return '';
  const compact = options.compact ? ' compact' : '';
  const riskLabels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
  return `
    <section class="market-hints${compact}">
      <div class="depth-head market-hints-head">
        <span class="market-hints-head-icon">${gameIcon('market')}</span>
        <div>
          <span>Подсказки рынка</span>
          <small>Что поменять в цене, заявке или запасе</small>
        </div>
        <strong>Risk</strong>
      </div>
      ${hints.map(hint => {
        if (hint.kind === 'decision') {
          return `
            <article class="market-hint decision ${hint.tone || 'warn'}">
              <span class="market-hint-icon">${gameIcon(marketHintIcon(hint))}</span>
              <div class="market-hint-copy">
                <strong>${escapeHtml(hint.title || '')}</strong>
                <small>${escapeHtml(hint.message || '')}</small>
                ${hint.studentText ? `<p>${escapeHtml(hint.studentText)}</p>` : ''}
                <div class="market-decision-grid">
                  <span><b>${money(hint.bestPrice || 0)}</b><small>лучшая цена</small></span>
                  <span><b>${money(hint.currentPrice || 0)}</b><small>моя цена</small></span>
                  <span><b>${money(hint.recommendedPrice || hint.bestPrice || 0)}</b><small>рекомендованная цена</small></span>
                  <span><b>${Number(hint.expectedUnits || 0)}</b><small>ожидаемые продажи</small></span>
                  <span><b>${escapeHtml(riskLabels[hint.saleRisk] || hint.saleRisk || '—')}</b><small>риск не продать</small></span>
                </div>
              </div>
              <span class="market-hint-badge">${escapeHtml(hint.metric || '')}</span>
            </article>`;
        }
        return `
          <article class="market-hint ${hint.tone || 'warn'}">
            <span class="market-hint-icon">${gameIcon(marketHintIcon(hint))}</span>
            <div class="market-hint-copy">
              <strong>${escapeHtml(hint.title || '')}</strong>
              <small>${escapeHtml(hint.message || '')}</small>
              ${hint.studentText ? `<p>${escapeHtml(hint.studentText)}</p>` : ''}
            </div>
            <span class="market-hint-badge">${escapeHtml(hint.metric || '')}</span>
          </article>`;
      }).join('')}
    </section>`;
}

function buildMarketReplaySummary() {
  const room = state.room || {};
  const player = state.player || {};
  const factory = player.factory || {};
  const latest = (room.market || []).at(-1) || null;
  const marketHints = player.marketHints || [];
  const turnReview = player.turnReview || null;
  const scenario = room.factoryScenario || {};
  const offer = factory.saleOffer || {};
  const book = scenario.marketBook || [];
  return {
    latest,
    marketHints,
    turnReview,
    offer: {
      quantity: Number(offer.quantity || 0),
      price: Number(offer.price || 0),
      value: Number(offer.quantity || 0) * Number(offer.price || 0),
    },
    stock: Number(factory.finishedGoods || 0),
    productUnit: factory.productUnit || scenario.productUnit || 'ед.',
    lastProfit: Number(player.lastTickBreakdown?.profit || 0),
    marketBook: book.slice(0, 8).map(entry => ({
      playerName: entry.playerName,
      price: entry.price,
      quantity: entry.quantity,
      sold: entry.sold,
      remaining: entry.remaining,
      suitability: entry.suitability,
    })),
  };
}

function renderMarketReplayPanel() {
  const replay = buildMarketReplaySummary();
  const latest = replay.latest;
  const review = replay.turnReview;
  const offerText = `${replay.offer.quantity} @ ${money(replay.offer.price || 0)}`;
  const soldText = latest ? `${latest.totalSales || 0} ${t('factory_units')}` : '0';
  const demandText = latest ? `${latest.demand || 0}` : t('market_overview_no_turns');
  const avgPriceText = latest ? money(latest.avgPrice || 0) : '—';
  return `
    <section class="market-replay-panel">
      <div class="market-replay-head">
        <div>
          <span class="factory-node-label">Разбор рынка</span>
          <strong>${escapeHtml(review?.title || 'Почему рынок сработал именно так')}</strong>
          <small>${escapeHtml(review?.summary || 'После каждого хода здесь будет видно: спрос, исполнение заявок, средняя цена и следующий фокус команды.')}</small>
        </div>
        <button type="button" class="ghost" data-market-replay-export>${iconButtonLabel('reports', 'Сохранить разбор', 'market-action-icon')}</button>
      </div>
      <div class="market-replay-metrics">
        ${renderMarketReplayMetric({ icon: 'market', value: demandText, label: 'спрос' })}
        ${renderMarketReplayMetric({ icon: 'ship', value: soldText, label: 'продано рынком' })}
        ${renderMarketReplayMetric({ icon: 'cash', value: avgPriceText, label: 'средняя цена' })}
        ${renderMarketReplayMetric({ icon: 'goal', value: offerText, label: 'моя заявка' })}
        ${renderMarketReplayMetric({ icon: 'warehouse', value: `${replay.stock} ${replay.productUnit}`, label: 'готовый склад' })}
        ${renderMarketReplayMetric({ icon: replay.lastProfit >= 0 ? 'check' : 'alert', value: money(replay.lastProfit), label: 'прибыль хода', tone: replay.lastProfit >= 0 ? 'ok' : 'danger' })}
      </div>
      ${review ? renderTurnReviewCard(review) : ''}
      ${renderMarketHints(replay.marketHints, { compact: true })}
    </section>`;
}

function exportMarketReplayReport() {
  if (!state.room || !state.player) {
    showToast(t('not_connected'), 'error');
    return;
  }
  const replay = buildMarketReplaySummary();
  const payload = {
    project: 'Biz Arena',
    type: 'market-replay',
    exportedAt: new Date().toISOString(),
    room: {
      code: state.room.code,
      name: state.room.name,
      day: state.room.day,
      tick: state.room.tick,
      scenario: state.room.scenarioLabel,
      status: state.room.status,
    },
    player: {
      id: state.player.id,
      userName: state.player.userName,
      company: state.player.name,
      money: state.player.money,
      netWorth: state.player.netWorth,
      debt: state.player.debt,
      lastAction: state.player.lastAction,
    },
    replay,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `biz-arena-market-replay-${safeFilePart(state.room.code, 'room')}-day-${state.room.day || 0}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function studentFactoryOperationsRenderSignature() {
  const room = state.room;
  const normalizedDepartment = ['command', 'warehouse', 'workforce', 'assembly', 'sales'].includes(state.factoryDepartment)
    ? state.factoryDepartment
    : 'command';
  return {
    factoryRoom: isFactoryRoom(),
    room: {
      code: room?.code || '',
      status: room?.status || '',
      day: room?.day || 0,
      tick: room?.tick || 0,
      tickMode: room?.tickMode || '',
      settings: room?.settings || null,
      factoryScenario: room?.factoryScenario || null,
      factoryStats: room?.factoryStats || null,
      market: room?.market || null,
      activeEvent: room?.activeEvent || null,
      helpRequest: room?.helpRequest || null,
    },
    player: state.player,
    factoryDepartment: normalizedDepartment,
    tutorial: state.tutorial,
    language: state.settings.language,
    performanceMode: resolvedPerformanceMode(),
  };
}

function renderFactoryOperations() {
  if (!elements.factoryOperations || !elements.legacyOperationsGrid) return;
  if (!hasRenderSignatureChanged('studentFactoryOperations', studentFactoryOperationsRenderSignature())) return;
  if (!isFactoryRoom()) {
    elements.factoryOperations.classList.add('hidden');
    elements.factoryOperations.innerHTML = '';
    elements.legacyOperationsGrid.classList.remove('hidden');
    return;
  }

  const enabled = canUseBusinessActions();
  const scenario = state.room.factoryScenario;
  const factory = state.player.factory;
  const workers = factory.workers || [];
  const components = factory.components || [];
  const totalComponents = components.reduce((sum, component) => sum + component.quantity, 0);
  const totalPayroll = workers.reduce((sum, worker) => sum + worker.expectedSalary, 0);
  const activeCandidates = (scenario.candidates || []).slice(0, 4);
  const personnelHints = state.player?.personnelHints || {};
  const personnelCandidateHints = personnelHints.candidates || [];
  const personnelHintById = new Map(personnelCandidateHints.map(item => [item.id, item]));
  const assemblyHints = state.player?.assemblyHints || null;
  const tutorialCopy = tutorialUiCopy();
  const showPostTutorialHint = state.tutorial.completed && !tutorialIsActive();
  const scenarioBrief = factoryScenarioLead(scenario);
  const demandBandText = Number.isFinite(scenario.baseDemandMin) && Number.isFinite(scenario.baseDemandMax)
    ? `${scenario.baseDemandMin}-${scenario.baseDemandMax}`
    : t('factory_market');
  const priceBandText = scenario.priceRange
    ? `${rub(scenario.priceRange.min)}-${rub(scenario.priceRange.max)} RUB`
    : t('factory_dynamic');
  const upkeepText = Number.isFinite(scenario.upkeep) ? `${rub(scenario.upkeep)} RUB` : t('factory_scenario');
  const rolesText = (scenario.roles || []).length ? scenario.roles.join(' - ') : t('factory_shared_crew');
  const selectedDepartment = ['command', 'warehouse', 'workforce', 'assembly', 'sales'].includes(state.factoryDepartment)
    ? state.factoryDepartment
    : 'command';

  if (selectedDepartment !== state.factoryDepartment) setFactoryDepartment(selectedDepartment);

  const departments = [
    {
      key: 'warehouse',
      label: '1. Склад материалов',
      title: t('dept_warehouse'),
      value: `${totalComponents} / 1 600 ед.`,
      note: 'Поставки вовремя',
      progress: Math.min(92, Math.max(24, Math.round((totalComponents / 1600) * 100))),
      footer: '92%',
      icon: 'warehouse',
    },
    {
      key: 'assembly',
      label: '2. Производство',
      title: 'Производство',
      value: `План: ${Math.max(1240, factory.assemblyCapacity * 100)} шт.`,
      note: `Произведено ${state.player.producedLastTick || factory.finishedGoods} шт.`,
      progress: Math.min(96, Math.max(38, factory.assemblyCapacity ? 72 + workers.length * 4 : 54)),
      footer: `${Math.max(0, state.player.producedLastTick || 0)} шт.`,
      icon: 'production',
    },
    {
      key: 'assembly',
      label: '3. Сборка',
      title: t('dept_assembly_hall'),
      value: `План: ${Math.max(1240, factory.assemblyCapacity * 100)} шт.`,
      note: `Собрано ${factory.finishedGoods || 0} шт.`,
      progress: Math.min(97, Math.max(42, factory.assemblyCapacity ? 68 + workers.length * 5 : 58)),
      footer: `${Math.max(0, 97.3 - Math.max(0, 4 - workers.length) * 1.4).toFixed(1)}%`,
      icon: 'assembly',
    },
    {
      key: 'command',
      label: '4. Контроль качества',
      title: 'Контроль качества',
      value: `Проверено ${factory.finishedGoods || 0} шт.`,
      note: 'Брак',
      progress: Math.min(88, Math.max(44, 64 + Math.min(18, workers.length * 3))),
      footer: workers.length ? '1.9%' : '0%',
      danger: true,
      icon: 'quality',
    },
    {
      key: 'sales',
      label: '5. Упаковка',
      title: 'Упаковка',
      value: `Упаковано ${Math.max(0, factory.saleOffer.quantity || factory.finishedGoods)} шт.`,
      note: 'Возвраты',
      progress: Math.min(82, Math.max(36, 56 + Math.min(22, factory.saleOffer.quantity))),
      footer: '0.6%',
      danger: true,
      icon: 'package',
    },
    {
      key: 'sales',
      label: '6. Отгрузка',
      title: t('dept_sales_office'),
      value: `Отгружено ${state.player.soldLastTick || 0} шт.`,
      note: 'Выполнено вовремя',
      progress: Math.min(91, Math.max(38, 53 + Math.min(38, state.player.soldLastTick || 0))),
      footer: '91%',
      icon: 'ship',
    },
  ];

  const renderMetric = (title, value, hint) => `
    <article class="factory-metric">
      <strong>${title}</strong>
      <div class="value">${value}</div>
      <small>${hint}</small>
    </article>
  `;

  const buildFactoryDepartmentDetail = department => {
    let detailTitle = '';
    let detailDescription = '';
    let detailBadge = '';
    let detailMetrics = '';
    let detailBody = '';

  if (department === 'warehouse') {
    detailTitle = t('dept_warehouse');
    detailDescription = t('factory_warehouse_desc');
    detailBadge = `${totalComponents} ${t('factory_total_parts')}`;
    detailMetrics = components.map(component => renderMetric(
      component.label,
      `${component.quantity}`,
      `${t('factory_recipe')} ${component.recipe} - ${t('factory_lot')} ${component.lotSize}`
    )).join('');
    detailBody = `
      <div class="factory-toolbar">
        ${components.map(component => `
          <article class="market-item">
            <strong>${component.label}</strong>
            <div class="value">${component.quantity}</div>
            <small>${t('factory_recipe')} ${component.recipe} - поставщики открыты во вкладке закупки</small>
            <div class="top-gap">
              <button type="button" class="ghost" data-purchase-shortcut="${component.key}">Открыть закупку</button>
            </div>
          </article>
        `).join('')}
      </div>`;
  } else if (department === 'workforce') {
    detailTitle = t('dept_people_office');
    detailDescription = t('factory_people_desc');
    detailBadge = `${workers.length} ${t('factory_active_workers')}`;
    detailMetrics = [
      renderMetric(t('factory_avg_suitability'), `${factory.avgSuitability || 0}/100`, t('factory_avg_suitability_hint')),
      renderMetric(t('factory_payroll'), `${rub(totalPayroll)} RUB`, t('factory_payroll_hint')),
      renderMetric(t('factory_open_candidates'), `${activeCandidates.length}`, t('factory_open_candidates_hint')),
    ].join('');
    detailBody = `
      <div class="factory-candidate-list">
        ${activeCandidates.map(candidate => `
          ${(() => {
            const hint = personnelHintById.get(candidate.id);
            return `<article class="leader person-card ${hint?.id === personnelHints.summary?.recommendedCandidateId ? 'recommended' : ''}">
            <div>
              <strong>${candidate.name}</strong>
              <small>${candidate.role} - ${candidate.experienceYears} ${t('factory_exp')} - ${t('factory_suitability')} ${candidate.suitability}/100</small>
              <div class="badge-inline-row">
                <span class="mini-badge">${rub(candidate.expectedSalary)} RUB / ${t('factory_per_turn')}</span>
                <span class="mini-badge">${hint?.capacityGain ? `+${hint.capacityGain} мощн.` : candidate.hint}</span>
                ${hint?.paybackTurns ? `<span class="mini-badge">окуп. ${hint.paybackTurns} х.</span>` : ''}
              </div>
              ${hint?.reason ? `<small>${escapeHtml(hint.reason)}</small>` : ''}
            </div>
            <button data-factory-action="hire-worker" data-candidate-id="${candidate.id}" ${enabled ? '' : 'disabled'}>${hint?.id === personnelHints.summary?.recommendedCandidateId ? 'Нанять рекомендованного' : t('factory_hire')}</button>
          </article>`;
          })()}
        `).join('') || `<div class="market-item">${t('factory_no_candidates')}</div>`}
      </div>`;
  } else if (department === 'assembly') {
    detailTitle = t('dept_assembly_hall');
    detailDescription = t('factory_assembly_desc');
    detailBadge = `${factory.assemblyCapacity} ${t('factory_units_ready')}`;
    detailMetrics = [
      renderMetric(t('factory_capacity_turn'), `${factory.assemblyCapacity}`, t('factory_capacity_hint')),
      renderMetric(t('factory_finished_stock'), `${factory.finishedGoods}`, `${factory.productUnit} ${t('factory_on_hand')}`),
      renderMetric(t('factory_built_last_turn'), `${state.player.producedLastTick || 0}`, t('factory_built_last_turn_hint')),
    ].join('');
    const assemblyRows = assemblyHints?.componentRows?.length ? assemblyHints.componentRows : components.map(component => ({
      key: component.key,
      label: component.label,
      stock: component.quantity,
      recipe: component.recipe,
      canAssemble: Math.floor(Number(component.quantity || 0) / Math.max(1, Number(component.recipe || 1))),
      missingForOne: Math.max(0, Number(component.recipe || 1) - Number(component.quantity || 0)),
      status: 'ready',
    }));
    detailBody = `
      ${assemblyHints ? `
        <article class="assembly-coach ${escapeHtml(assemblyHints.bottleneck || '')}">
          <div>
            <span class="factory-node-label">Совет по сборке</span>
            <strong>${escapeHtml(assemblyHints.title || '')}</strong>
            <small>${escapeHtml(assemblyHints.studentText || '')}</small>
          </div>
          <div class="assembly-coach-stats">
            <span><b>${assemblyHints.workerCapacity || 0}</b><small>люди</small></span>
            <span><b>${assemblyHints.inventoryCapacity || 0}</b><small>склад</small></span>
            <span><b>${assemblyHints.maxAssembly || 0}</b><small>собрать</small></span>
          </div>
        </article>
      ` : ''}
      <div class="button-pair two-cols">
        <button data-factory-action="assemble-product" data-assemble-value="1" ${enabled && factory.assemblyCapacity > 0 ? '' : 'disabled'}>${t('factory_assemble_one')}</button>
        <button data-factory-action="assemble-product" data-assemble-value="max" ${enabled && factory.assemblyCapacity > 0 ? '' : 'disabled'}>${t('factory_assemble_max')}</button>
      </div>
      <div class="assembly-bottleneck-grid">
        ${assemblyRows.map(component => `
          <article class="market-item assembly-component ${escapeHtml(component.status || '')} ${component.key === assemblyHints?.blockingComponentKey ? 'blocking' : ''}">
            <strong>${escapeHtml(component.label)}</strong>
            <div class="value">${component.canAssemble}</div>
            <small>можно собрать • склад ${component.stock} • нужно ${component.recipe} на ед.</small>
            ${component.missingForOne > 0 ? `<small class="negative">Не хватает ${component.missingForOne} для следующей единицы</small>` : ''}
            <div class="top-gap">
              <button type="button" class="ghost" data-purchase-shortcut="${escapeHtml(component.key)}">Закупить</button>
            </div>
          </article>
        `).join('')}
      </div>`;
  } else if (department === 'sales') {
    const saleDraft = getFactorySaleDraft(factory);
    detailTitle = t('dept_sales_office');
    detailDescription = t('factory_sales_desc');
    detailBadge = `${factory.saleOffer.quantity} ${t('factory_listed')}`;
    detailMetrics = [
      renderMetric(t('factory_offer_price'), money(factory.saleOffer.price), t('factory_order_book_entry')),
      renderMetric(t('factory_offer_quantity'), `${factory.saleOffer.quantity}`, `${factory.productUnit} ${t('factory_committed_sale')}`),
      renderMetric(t('factory_sold_last_turn'), `${state.player.soldLastTick || 0}`, t('factory_matched_previous')),
    ].join('');
    detailBody = `
      <div class="factory-toolbar">
        <article class="market-item">
          <strong>${t('factory_sell_order')}</strong>
          <div class="value">${factory.saleOffer.quantity} ${t('factory_units')}</div>
          <small>${t('factory_set_price_quantity')}</small>
          <label class="top-gap">
            <span>${t('factory_price')}</span>
            <input id="factory-sale-price" type="number" min="${scenario.priceRange.min}" max="${scenario.priceRange.max}" value="${saleDraft.price}" />
          </label>
          <label>
            <span>${t('factory_quantity')}</span>
            <input id="factory-sale-quantity" type="number" min="0" max="${factory.finishedGoods}" value="${saleDraft.quantity}" />
          </label>
          <div class="button-pair top-gap">
            <button data-factory-action="set-sale-offer" ${enabled ? '' : 'disabled'}>${t('factory_submit_order')}</button>
            <button data-factory-action="clear-sale-offer" class="ghost" ${enabled ? '' : 'disabled'}>${t('factory_hold_stock')}</button>
          </div>
        </article>
        <article class="market-item">
          <strong>${t('factory_price_rule')}</strong>
          <div class="value">${t('factory_order_book')}</div>
          <small>${t('factory_price_rule_hint')}</small>
        </article>
      </div>`;
  } else {
    const recentEntries = (scenario.marketBook || []).slice(0, 3);
    detailTitle = t('dept_command_deck');
    detailDescription = t('factory_command_desc');
    detailBadge = isManualTurnRoom() ? t('factory_manual_turn_mode') : t('factory_timed_flow');
    detailMetrics = [
      renderMetric(t('factory_cash'), `${rub(state.player.money)} RUB`, t('factory_cash_hint')),
      renderMetric(t('factory_finished_stock'), `${factory.finishedGoods}`, `${factory.productUnit} ${t('factory_waiting_inventory')}`),
      renderMetric(t('factory_current_offer'), `${factory.saleOffer.quantity} @ ${rub(factory.saleOffer.price)} RUB`, t('factory_current_offer_hint')),
      renderMetric(t('factory_last_action'), localizedLastAction(state.player.lastAction) || t('factory_no_action_yet'), t('factory_latest_resolved')),
    ].join('');
    detailBody = `
      <div class="factory-toolbar">
        <article class="market-item">
          <strong>${t('factory_turn_checklist')}</strong>
          <div class="value">1 > 2 > 3 > 4</div>
          <small>${factoryScenarioChecklist(scenario)}</small>
        </article>
        <article class="market-item">
          <strong>${t('factory_factory_brief')}</strong>
          <div class="value">${scenario.productLabel}</div>
          <small>${scenarioBrief} ${t('factory_upkeep')}: ${upkeepText} - ${t('factory_roles')}: ${rolesText}</small>
        </article>
        <article class="market-item">
          <strong>${t('factory_latest_order_book')}</strong>
          <div class="value">${recentEntries.length ? recentEntries[0].playerName : t('factory_no_sales_yet')}</div>
          <small>${recentEntries.length ? recentEntries.map(entry => `${entry.playerName}: ${entry.sold} ${t('factory_sold_at')} ${rub(entry.price)} RUB`).join(' - ') : t('factory_order_summary_pending')}</small>
        </article>
      </div>`;
  }

    return { detailTitle, detailDescription, detailBadge, detailMetrics, detailBody };
  };

  const factoryDepartmentDetailMarkup = ({ detailTitle, detailDescription, detailBadge, detailMetrics, detailBody }) => `
    <section class="factory-detail" data-factory-department-detail="${escapeHtml(state.factoryDepartment)}">
      <div class="factory-detail-head">
        <div>
          <h3>${detailTitle}</h3>
          <p class="muted">${detailDescription}</p>
        </div>
        <div class="factory-detail-badge">${detailBadge}</div>
      </div>
      <div class="factory-metrics">${detailMetrics}</div>
      ${detailBody}
    </section>`;
  const selectedDepartmentDetail = buildFactoryDepartmentDetail(selectedDepartment);

  elements.factoryOperations.classList.remove('hidden');
  elements.legacyOperationsGrid.classList.add('hidden');
  elements.factoryOperations.innerHTML = `
    <div class="factory-map-shell">
      ${renderStudentRoutePanel()}
      <div class="factory-map-header">
        <div>
          <div class="factory-node-label">${t('factory_map')}</div>
          <h3>${scenario.label}</h3>
          <p class="muted">${scenarioBrief}</p>
        </div>
        <div class="factory-mode-chip">${isManualTurnRoom() ? t('factory_manual_turn_mode') : t('factory_timed_flow')}</div>
      </div>
      <section class="factory-brief-grid">
        <article class="factory-brief-card">
          <span class="factory-node-label">${t('factory_product')}</span>
          <strong>${scenario.productLabel}</strong>
          <small>${scenario.productUnit} - ${components.length} ${t('factory_component_lanes')}</small>
        </article>
        <article class="factory-brief-card">
          <span class="factory-node-label">${t('factory_demand_band')}</span>
          <strong>${demandBandText}</strong>
          <small>${t('factory_demand_band_hint')}</small>
        </article>
        <article class="factory-brief-card">
          <span class="factory-node-label">${t('preview_price_band')}</span>
          <strong>${priceBandText}</strong>
          <small>${t('factory_price_band_hint')}</small>
        </article>
        <article class="factory-brief-card">
          <span class="factory-node-label">${t('factory_line_profile')}</span>
          <strong>${upkeepText}</strong>
          <small>${t('factory_upkeep_turn')} - ${rolesText}</small>
        </article>
      </section>
      ${renderGuidedAction()}
      ${renderDecisionRoundCard()}
      ${showPostTutorialHint ? `
        <section class="factory-post-tutorial">
          <div>
            <div class="factory-node-label">${t('operations_guide')}</div>
            <strong>${tutorialCopy.postTitle}</strong>
            <p>${tutorialCopy.postBody}</p>
            <small>${tutorialCopy.postMeta}</small>
          </div>
          <button type="button" class="ghost" data-factory-action="restart-tutorial">${tutorialCopy.postReplay}</button>
        </section>
      ` : ''}
      <div class="factory-campus">
        ${departments.map(department => `
          <button type="button" class="factory-node ${department.wide ? 'wide' : ''} ${department.key === selectedDepartment ? 'active' : ''}" data-factory-node="${department.key}">
            <span class="factory-node-icon">${gameIcon(department.icon || 'assembly')}</span>
            <span class="factory-node-label">${department.label}</span>
            <span class="factory-node-title">${department.title}</span>
            <span class="factory-node-value">${department.value}</span>
            <span class="factory-node-progress"><i style="width: ${department.progress || 60}%"></i></span>
            <small>${department.note}<b class="${department.danger ? 'negative' : 'positive'}">${department.footer || ''}</b></small>
          </button>
        `).join('')}
      </div>
      <section class="factory-team-strip">
        <div class="factory-team-title">
          <span>${gameIcon('capital')}</span>
          <strong>${escapeHtml(state.player.name || 'Команда Альфа')} (вы)</strong>
        </div>
        <article>
          <span>Баланс</span>
          <strong>${money(state.player.money)}</strong>
          <small class="${Number(state.player.lastTickBreakdown?.profit || 0) >= 0 ? 'positive' : 'negative'}">${money(Number(state.player.lastTickBreakdown?.profit || 0))} за ход</small>
        </article>
        <article>
          <span>Дневной поток</span>
          <strong>${money(Number(state.player.lastTickBreakdown?.profit || 0))}</strong>
          <small>за раунд</small>
        </article>
        <article>
          <span>Капитал</span>
          <strong>${money(state.player.netWorth)}</strong>
        </article>
        <div class="factory-turn-callout">
          <div>
            <strong>Ваш ход</strong>
            <small>${(state.player.turnChecklist || []).filter(item => item.status !== 'ready').length ? 'Есть пункты, требующие внимания' : 'Контур готов к завершению хода'}</small>
          </div>
          <button type="button" data-guided-action="${state.room.status === 'paused' ? 'resume-game' : 'next-turn'}" ${state.player.isHost && isManualTurnRoom() ? '' : 'disabled'}>Принять решения →</button>
        </div>
      </section>
      ${renderTurnChecklist(state.player.turnChecklist || [])}
      ${renderTurnReviewCard(state.player.turnReview)}
      ${factoryDepartmentDetailMarkup(selectedDepartmentDetail)}
    </div>`;

  const patchFactoryDepartment = department => {
    const nextDepartment = ['command', 'warehouse', 'workforce', 'assembly', 'sales'].includes(department)
      ? department
      : 'command';
    setFactoryDepartment(nextDepartment);
    hasRenderSignatureChanged('studentFactoryOperations', studentFactoryOperationsRenderSignature());
    elements.factoryOperations.querySelectorAll('[data-factory-node]').forEach(node => {
      node.classList.toggle('active', node.dataset.factoryNode === nextDepartment);
      node.setAttribute('aria-pressed', node.dataset.factoryNode === nextDepartment ? 'true' : 'false');
    });
    elements.factoryOperations.querySelectorAll('[data-scene-station]').forEach(node => {
      const selected = node.dataset.sceneStation === nextDepartment
        || (node.dataset.sceneStation === 'purchase' && nextDepartment === 'warehouse')
        || (node.dataset.sceneStation === 'market' && nextDepartment === 'sales');
      node.toggleAttribute('data-selected-station', selected);
    });
    const currentDetail = elements.factoryOperations.querySelector('[data-factory-department-detail]');
    if (!currentDetail) return;
    currentDetail.outerHTML = factoryDepartmentDetailMarkup(buildFactoryDepartmentDetail(nextDepartment));
    bindFactoryDepartmentDetail(elements.factoryOperations.querySelector('[data-factory-department-detail]'));
  };

  elements.factoryOperations.querySelectorAll('[data-factory-node]').forEach(button => {
    button.addEventListener('click', () => {
      patchFactoryDepartment(button.dataset.factoryNode);
    });
  });
  bindTurnChecklist(elements.factoryOperations);
  elements.factoryOperations.querySelectorAll('[data-guided-factory-node]').forEach(button => {
    button.addEventListener('click', () => {
      patchFactoryDepartment(button.dataset.guidedFactoryNode);
    });
  });
  elements.factoryOperations.querySelectorAll('[data-guided-game-tab]').forEach(button => {
    button.addEventListener('click', () => setGameTab(button.dataset.guidedGameTab));
  });
  elements.factoryOperations.querySelectorAll('[data-guided-action]').forEach(button => {
    button.addEventListener('click', () => sendAction(button.dataset.guidedAction));
  });
  elements.factoryOperations.querySelectorAll('[data-student-route-action]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.studentRouteValue || '';
      sendAction(button.dataset.studentRouteAction, value || undefined);
    });
  });
  elements.factoryOperations.querySelectorAll('[data-student-route-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const department = button.dataset.studentRouteDepartment;
      const component = button.dataset.studentRouteComponent;
      if (component) setFactoryPurchaseComponent(component);
      const nextTab = button.dataset.studentRouteTab || 'operations';
      if (department && nextTab === 'operations') patchFactoryDepartment(department);
      setGameTab(nextTab);
      if (component) renderFactoryPurchases();
    });
  });
  elements.factoryOperations.querySelector('[data-request-teacher-help]')?.addEventListener('click', () => {
    const category = elements.factoryOperations.querySelector('[data-help-category]')?.value || 'other';
    const message = elements.factoryOperations.querySelector('[data-help-message]')?.value.trim() || '';
    sendAction('request-teacher-help', { category, message });
  });
  elements.factoryOperations.querySelector('[data-cancel-teacher-help]')?.addEventListener('click', () => {
    sendAction('cancel-teacher-help');
  });
  elements.factoryOperations.querySelector('[data-factory-action="restart-tutorial"]')?.addEventListener('click', () => {
    startTutorial();
  });

  function bindFactoryDepartmentDetail(root) {
    if (!root) return;
    root.querySelectorAll('[data-factory-action="hire-worker"]').forEach(button => {
      button.addEventListener('click', () => sendAction('hire-worker', button.dataset.candidateId));
    });
    root.querySelectorAll('[data-factory-action="buy-component"]').forEach(button => {
      button.addEventListener('click', () => sendAction('buy-component', {
        componentKey: button.dataset.componentKey,
        quantity: Number(button.dataset.componentQuantity),
      }));
    });
    root.querySelectorAll('[data-purchase-shortcut]').forEach(button => {
      button.addEventListener('click', () => {
        setFactoryPurchaseComponent(button.dataset.purchaseShortcut);
        setGameTab('purchase');
        renderFactoryPurchases();
      });
    });
    root.querySelectorAll('[data-factory-action="assemble-product"]').forEach(button => {
      const value = button.dataset.assembleValue === 'max' ? 'max' : Number(button.dataset.assembleValue);
      button.addEventListener('click', () => sendAction('assemble-product', value));
    });
    const salePriceInput = root.querySelector('#factory-sale-price');
    const saleQuantityInput = root.querySelector('#factory-sale-quantity');
    if (salePriceInput && saleQuantityInput) {
      const saveDraft = () => {
        state.factorySaleDraft = {
          roomCode: state.room?.code || '',
          playerId: state.player?.id || '',
          price: String(salePriceInput.value ?? ''),
          quantity: String(saleQuantityInput.value ?? ''),
        };
      };
      salePriceInput.addEventListener('input', saveDraft);
      saleQuantityInput.addEventListener('input', saveDraft);
    }
    root.querySelector('[data-factory-action="set-sale-offer"]')?.addEventListener('click', () => {
      sendAction('set-sale-offer', {
        price: Number(root.querySelector('#factory-sale-price')?.value || factory.saleOffer.price),
        quantity: Number(root.querySelector('#factory-sale-quantity')?.value || 0),
      });
    });
    root.querySelector('[data-factory-action="clear-sale-offer"]')?.addEventListener('click', () => {
      sendAction('set-sale-offer', {
        price: Number(root.querySelector('#factory-sale-price')?.value || factory.saleOffer.price),
        quantity: 0,
      });
    });
  }
  bindFactoryDepartmentDetail(elements.factoryOperations.querySelector('[data-factory-department-detail]'));
  elements.factoryOperations.querySelectorAll('[data-decision-option]').forEach(button => {
    button.addEventListener('click', () => {
      sendAction('resolve-decision-round', {
        roundId: button.dataset.roundId,
        optionKey: button.dataset.optionKey,
      });
    });
  });
  elements.factoryOperations.querySelector('[data-force-decision-round]')?.addEventListener('click', () => {
    sendAction('force-decision-round');
  });
  renderTutorialOverlay();
}

function renderFactoryPurchases() {
  if (!elements.factoryPurchases) return;
  elements.factoryPurchases.innerHTML = '';
  elements.factoryPurchases.classList.toggle('hidden', !isFactoryRoom());
  if (!isFactoryRoom()) return;

  const enabled = canUseBusinessActions();
  const scenario = state.room.factoryScenario || {};
  const factory = state.player.factory || {};
  const components = factory.components || [];
  const offers = scenario.supplierOffers || [];
  const purchaseHints = state.player?.purchaseHints || [];
  const firstComponentKey = components[0]?.key || '';
  const selectedKey = components.some(component => component.key === state.factoryPurchaseComponent)
    ? state.factoryPurchaseComponent
    : firstComponentKey;
  if (selectedKey !== state.factoryPurchaseComponent) setFactoryPurchaseComponent(selectedKey);

  const selectedComponent = components.find(component => component.key === selectedKey) || components[0];
  const selectedHint = purchaseHints.find(hint => hint.key === selectedKey) || null;
  const topHint = purchaseHints[0] || null;
  const selectedOffers = offers
    .filter(offer => offer.componentKey === selectedKey)
    .sort((left, right) => Number(left.unitPrice || 0) - Number(right.unitPrice || 0) || Number(right.quantity || 0) - Number(left.quantity || 0));
  const bestPrice = selectedOffers.length ? Math.min(...selectedOffers.map(offer => Number(offer.unitPrice || 0))) : 0;
  const ownedQuantity = selectedComponent ? Number(selectedComponent.quantity || 0) : 0;
  const totalAvailable = selectedOffers.reduce((sum, offer) => sum + Number(offer.quantity || 0), 0);
  const neededForOne = Number(selectedComponent?.recipe || 0);
  const shortageLevel = selectedOffers.length <= 1 ? 'Острый дефицит' : selectedOffers.length <= 3 ? 'Средний дефицит' : 'Рынок насыщен';

  elements.factoryPurchases.innerHTML = `
    <section class="purchase-workspace">
      ${topHint ? `
        <article class="purchase-coach ${escapeHtml(topHint.status || 'ready')}">
          <div>
            <span class="factory-node-label">Что купить сейчас</span>
            <strong>${escapeHtml(topHint.label)}: ${escapeHtml(topHint.reason || '')}</strong>
            <small>${escapeHtml(topHint.studentText || '')}</small>
          </div>
          <button type="button" class="ghost" data-purchase-shortcut="${escapeHtml(topHint.key)}">Открыть</button>
        </article>
      ` : ''}
      <div class="purchase-tabs" role="tablist" aria-label="Комплектующие">
        ${components.map(component => {
          const count = offers.filter(offer => offer.componentKey === component.key).length;
          const hint = purchaseHints.find(item => item.key === component.key);
          return `
            <button type="button" class="${component.key === selectedKey ? 'active' : ''} ${escapeHtml(hint?.status || '')}" data-purchase-component="${escapeHtml(component.key)}">
              <strong>${escapeHtml(component.label)}</strong>
              <small>${component.quantity} на складе • ${count} лота${hint?.missingForBatch ? ` • нужно ${hint.missingForBatch}` : ''}</small>
            </button>`;
        }).join('')}
      </div>
      <div class="purchase-summary">
        <article class="market-item">
          <strong>${selectedComponent ? escapeHtml(selectedComponent.label) : 'Комплектующие'}</strong>
          <div class="value">${ownedQuantity}</div>
          <small>Ваш склад сейчас</small>
        </article>
        <article class="market-item">
          <strong>Лучшая цена</strong>
          <div class="value">${bestPrice ? money(bestPrice) : '—'}</div>
          <small>Цена за единицу среди доступных заводов</small>
        </article>
        <article class="market-item">
          <strong>Доступно на рынке</strong>
          <div class="value">${totalAvailable}</div>
          <small>${shortageLevel} • нужно ${neededForOne || '—'} на изделие</small>
        </article>
        <article class="market-item purchase-recommendation">
          <strong>Рекомендация</strong>
          <div class="value">${selectedHint?.recommendedQuantity ? `${selectedHint.recommendedQuantity} шт.` : selectedHint?.status === 'ready' ? 'хватает' : '—'}</div>
          <small>${escapeHtml(selectedHint?.studentText || 'Выберите компонент, чтобы увидеть подсказку.')}</small>
        </article>
      </div>
      <div class="supplier-board">
        ${selectedOffers.length ? selectedOffers.map(offer => {
          const maxQuantity = Number(offer.quantity || 0);
          const totalCost = maxQuantity * Number(offer.unitPrice || 0);
          const isBest = Number(offer.unitPrice || 0) === bestPrice;
          const isRecommended = selectedHint?.recommendedOfferId === offer.id;
          const quantityDraft = getSupplierPurchaseDraft(offer.id, maxQuantity);
          const priceDelta = Number(offer.priceDeltaPct || 0);
          const priceTone = priceDelta <= -8 ? 'positive' : priceDelta >= 12 ? 'negative' : '';
          const scarcityLabel = offer.scarcity === 'high' ? 'дефицит' : offer.scarcity === 'low' ? 'стабильно' : 'ограничено';
          return `
            <article class="supplier-card ${isBest ? 'best' : ''} ${isRecommended ? 'recommended' : ''}">
              <div>
                <span class="factory-node-label">${isRecommended ? 'Купить первым' : isBest ? 'Лучший лот' : escapeHtml(offer.tierLabel || 'Поставщик')}</span>
                <strong>${escapeHtml(offer.supplierName || 'Завод')}</strong>
                <small>${escapeHtml(offer.componentLabel || selectedComponent?.label || '')} • ${scarcityLabel} • надежность ${offer.reliability || 0}%</small>
              </div>
              <div class="supplier-stats">
                <span><b>${maxQuantity}</b><small>количество</small></span>
                <span><b>${money(offer.unitPrice || 0)}</b><small>за ед.</small></span>
                <span><b class="${priceTone}">${priceDelta > 0 ? '+' : ''}${priceDelta}%</b><small>к базе</small></span>
                <span><b>${offer.quality || 0}</b><small>качество</small></span>
              </div>
              <div class="supplier-footnote">
                <span>Полный лот: ${money(totalCost)}</span>
                <span>Оценка: ${offer.score || 0}/100</span>
              </div>
              <label>
                <span>Купить количество</span>
                <input type="number" min="1" max="${maxQuantity}" value="${escapeHtml(quantityDraft)}" data-supplier-quantity="${escapeHtml(offer.id)}" />
              </label>
              <button type="button" data-supplier-offer="${escapeHtml(offer.id)}" ${enabled && maxQuantity > 0 ? '' : 'disabled'}>${isRecommended ? 'Купить рекомендованный лот' : 'Купить у этого завода'}</button>
            </article>`;
        }).join('') : `
          <article class="market-item trade-empty">
            <strong>Лоты выкуплены</strong>
            <div class="value">—</div>
            <small>Если другой игрок или бот забрал завод раньше, он исчезает до следующего хода.</small>
          </article>`}
      </div>
    </section>`;

  elements.factoryPurchases.querySelectorAll('[data-purchase-component]').forEach(button => {
    button.addEventListener('click', () => {
      setFactoryPurchaseComponent(button.dataset.purchaseComponent);
      renderFactoryPurchases();
    });
  });
  elements.factoryPurchases.querySelectorAll('[data-purchase-shortcut]').forEach(button => {
    button.addEventListener('click', () => {
      setFactoryPurchaseComponent(button.dataset.purchaseShortcut);
      renderFactoryPurchases();
    });
  });
  elements.factoryPurchases.querySelectorAll('[data-supplier-quantity]').forEach(input => {
    input.addEventListener('input', () => saveSupplierPurchaseDraft(input.dataset.supplierQuantity, input.value));
  });
  elements.factoryPurchases.querySelectorAll('[data-supplier-offer]').forEach(button => {
    button.addEventListener('click', () => {
      const quantityInput = elements.factoryPurchases.querySelector(`[data-supplier-quantity="${button.dataset.supplierOffer}"]`);
      clearSupplierPurchaseDraft(button.dataset.supplierOffer);
      sendAction('buy-supplier-offer', {
        offerId: button.dataset.supplierOffer,
        quantity: Number(quantityInput?.value || 0),
      });
    });
  });
}

function renderTeacherEventSummary() {
  if (!elements.turnReportSummary) return;
  const room = state.room || {};
  const dashboard = room.classDashboard || {};
  const rows = dashboard.rows || [];
  const activeHelp = (room.helpRequests || []).filter(request => !['resolved', 'cancelled'].includes(request.status));
  const activeEvent = room.activeEvent || null;
  const pendingPause = room.pauseRequest?.status === 'pending' ? room.pauseRequest : null;
  const pausedForReview = room.status === 'paused';
  const readyTeams = rows.filter(row => row.readyForTurn).length;
  const dayLimit = Number(room.settings?.dayLimit || 0);
  const focusTitle = activeEvent
    ? activeEvent.title || activeEvent.label || 'Активное событие'
    : pendingPause
      ? 'Запрос паузы ожидает решения'
      : pausedForReview
        ? 'Матч на паузе: проведите короткий разбор'
        : 'Класс работает по базовому сценарию';
  const focusHint = activeEvent
    ? activeEvent.description || `Эффект действует до хода ${activeEvent.expiresDay || room.day || 1}.`
    : pendingPause
      ? 'У преподавателя есть 30 секунд, чтобы принять запрос. Иначе матч продолжится автоматически.'
      : pausedForReview
        ? 'Сравните решения команд, ответьте на вопросы и продолжите матч из кабинета.'
        : 'Следите за очередью помощи и готовностью команд к пересчету.';
  const metrics = [
    ['Ход', `${room.day || 1}${dayLimit ? ` / ${dayLimit}` : ''}`, room.status === 'paused' ? 'Матч на паузе' : 'Общий ход класса', 'reports'],
    ['Готовность', `${readyTeams}/${rows.length}`, 'команд завершили решения', 'check'],
    ['Запросы помощи', String(activeHelp.length), activeHelp.length ? 'нужна реакция преподавателя' : 'активных запросов нет', 'alert'],
    ['Кризис', activeEvent ? 'Активен' : 'Нет', activeEvent ? (activeEvent.title || activeEvent.label || 'Учебное событие') : 'базовые условия рынка', 'crisis'],
  ];
  elements.turnReportSummary.innerHTML = `
    <section class="teacher-event-brief" data-teacher-events="summary">
      <div class="teacher-event-focus ${activeEvent || pendingPause || pausedForReview ? 'attention' : ''}">
        <div>
          <span class="factory-node-label">Что обсуждать сейчас</span>
          <h3>${escapeHtml(focusTitle)}</h3>
          <p>${escapeHtml(focusHint)}</p>
        </div>
        <button type="button" class="ghost" data-open-teacher-cockpit>${iconButtonLabel('cabinet', 'Открыть кабинет')}</button>
      </div>
      <div class="teacher-event-metrics">
        ${metrics.map(([label, value, hint, icon]) => `
          <article>
            <svg class="game-ui-icon" aria-hidden="true"><use href="/assets/game-icons.svg#icon-${icon}"></use></svg>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(hint)}</small>
          </article>`).join('')}
      </div>
    </section>`;
  elements.turnReportSummary.querySelector('[data-open-teacher-cockpit]')?.addEventListener('click', () => setGameTab('teacher'));
}

function renderTurnReportSummary() {
  if (!elements.turnReportSummary) return;
  if (state.player?.isTeacherHost) {
    renderTeacherEventSummary();
    return;
  }
  elements.turnReportSummary.innerHTML = '';
  const breakdown = state.player?.lastTickBreakdown || null;
  const profit = Number(breakdown?.profit || 0);
  const revenue = Number(breakdown?.revenue || 0);
  const expenses = Number(breakdown?.expenses || 0);
  const sold = Number(breakdown?.sold || state.player?.soldLastTick || 0);
  const noData = !state.room || !state.player || !breakdown;
  const cards = noData
    ? [
        ['Заработано за ход', '—', 'Появится после первого пересчета', ''],
        ['Выручка', '—', 'Продажи за ход', ''],
        ['Расходы', '—', 'Зарплата, содержание, проценты', ''],
      ]
    : [
        ['Заработано за ход', money(profit), `${profit >= 0 ? 'Прибыль' : 'Убыток'} после всех расходов`, profit >= 0 ? 'positive' : 'danger'],
        ['Выручка', money(revenue), `${sold} ед. продано`, 'positive'],
        ['Расходы', money(expenses), `${money(Number(breakdown.salary || 0))} зарплата/содержание`, expenses ? 'warning' : ''],
      ];
  elements.turnReportSummary.innerHTML = cards.map(([title, value, hint, tone]) => `
    <article class="statistics-kpi-card ${tone || ''}">
      <strong>${escapeHtml(title)}</strong>
      <div class="value">${escapeHtml(value)}</div>
      <small>${escapeHtml(hint)}</small>
    </article>
  `).join('');
}

function renderTickBreakdown() {
  elements.tickBreakdown.innerHTML = '';
  elements.tickBreakdown.classList.remove('placeholder');
  elements.tickBreakdown.classList.add('finance-ledger');
  const breakdown = state.player?.lastTickBreakdown;
  if (!breakdown) {
    if (isFactoryRoom() && state.player?.factory) {
      const factory = state.player.factory;
      const projectedRevenue = Number(factory.saleOffer?.quantity || 0) * Number(factory.saleOffer?.price || 0);
      const payroll = (factory.workers || []).reduce((sum, worker) => sum + Number(worker.expectedSalary || 0), 0);
      const inventoryValue = Number(factory.finishedGoods || 0) * Number(factory.saleOffer?.price || 0);
      [
        ['Потенциал выручки', money(projectedRevenue), `${factory.saleOffer?.quantity || 0} ед. @ ${money(factory.saleOffer?.price || 0)}`, 'positive'],
        ['Фонд оплаты', money(payroll), `${(factory.workers || []).length} сотрудников на линии`, payroll ? 'warning' : ''],
        ['Стоимость склада', money(inventoryValue), `${factory.finishedGoods || 0} ${factory.productUnit}`, ''],
      ].forEach(([title, value, hint, tone]) => {
        const node = document.createElement('article');
        node.className = `market-item ledger-row ${tone || ''}`;
        node.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="value">${escapeHtml(value)}</div><small>${escapeHtml(hint)}</small>`;
        elements.tickBreakdown.appendChild(node);
      });
      return;
    }
    elements.tickBreakdown.classList.add('placeholder');
    elements.tickBreakdown.classList.remove('finance-ledger');
    elements.tickBreakdown.innerHTML = `<div>${t('tick_breakdown_empty')}</div>`;
    return;
  }

  const items = [
    [t('tick_revenue'), money(breakdown.revenue), `${[breakdown.productLabel, breakdown.cityLabel].filter(Boolean).join(' • ')} • ${breakdown.sold} pcs`, 'positive'],
    [t('tick_expenses'), money(breakdown.expenses), `${t('tick_salary')}: ${money(breakdown.salary)} • ${t('tick_upkeep')}: ${money(breakdown.upkeep)}`, 'warning'],
    [t('tick_profit'), money(breakdown.profit), `${t('tick_debt')}: ${money(breakdown.debt)} • ${t('tick_technology')}: ${money(breakdown.technology)}`, breakdown.profit >= 0 ? 'positive' : 'danger'],
  ];

  items.forEach(([title, value, hint, tone]) => {
    const node = document.createElement('article');
    node.className = `market-item ledger-row ${tone || ''}`;
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="value">${escapeHtml(value)}</div><small>${escapeHtml(hint)}</small>`;
    elements.tickBreakdown.appendChild(node);
  });
}

function executionLabel(key) {
  const recommendationKey = `rec_${key}`;
  const stepKey = `step_${key}`;
  if (t(recommendationKey) !== recommendationKey) return t(recommendationKey);
  if (t(stepKey) !== stepKey) return t(stepKey);
  return key;
}

function executionBlockedLabel(item) {
  if (!item?.blockedReason) return '';
  const blockedKey = `queue_blocked_${item.blockedReason}`;
  const label = t(blockedKey);
  if (label !== blockedKey) return label;
  return item.blockedReason;
}

function renderExecutionFeedback() {
  if (!state.intelFeedback.message) return '';
  const typeClass = state.intelFeedback.type ? ` intel-feedback-${state.intelFeedback.type}` : '';
  return `<div class="intel-feedback${typeClass}">${escapeHtml(state.intelFeedback.message)}</div>`;
}

function renderExecutionQueue(queue) {
  if (!queue.length) return `<div class="top-gap muted small">${t('rec_hold_course')}</div>`;

  return `${renderExecutionFeedback()}<div class="queue-list top-gap">${queue.map((item, index) => `
    <div class="queue-item">
      <div>
        <div class="queue-line"><strong>${t(`queue_priority_${item.priority}`)}</strong> • ${executionLabel(item.key)}</div>
        <div class="muted small">${t(`queue_reason_${item.reasonKey}`)}${item.blockedReason ? ` • ${executionBlockedLabel(item)}` : ''}${item.requiredMoney ? ` • ${t('queue_need_cash')}: ${money(item.requiredMoney)}` : ''}</div>
        <div class="muted small top-gap"><strong>${t('queue_why_now')}:</strong> ${t(`queue_explain_${item.whyNowKey || 'generic'}`)}</div>
        <div class="muted small"><strong>${t('queue_expected_outcome')}:</strong> ${t(`queue_outcome_${item.outcomeKey || 'generic'}`)}</div>
      </div>
      ${item.actionable
        ? `<button class="ghost queue-action-button" data-execution-index="${index}">${t('queue_apply_action')}</button>`
        : item.mode === 'blocked'
          ? `<button class="ghost queue-action-button" disabled>${t('queue_blocked_action')}</button>`
          : `<span class="mini-badge">${t('queue_manual_step')}</span>`}
    </div>
  `).join('')}</div>`;
}

function factoryAdvisorSummary(intel, focusPlan, factory) {
  const primarySignal = intel.primarySignalKey ? t(`signal_${intel.primarySignalKey}`) : 'Система стабильна';
  const primaryRecommendation = intel.primaryRecommendationKey ? t(`rec_${intel.primaryRecommendationKey}`) : 'Продолжайте текущий цикл';
  if ((factory.finishedGoods || 0) > 0 && !(factory.saleOffer?.quantity || 0)) {
    return 'Готовая продукция лежит на складе. Выставьте продажу в маркетинге, чтобы следующий ход дал выручку.';
  }
  if ((factory.components || []).some(component => component.quantity < component.recipe)) {
    return 'Склад сырья ограничивает сборку. Пополните материалы перед следующим производственным действием.';
  }
  if (!(factory.workers || []).length) {
    return 'Линия работает без команды. Наймите сотрудника, чтобы поднять мощность и качество выпуска.';
  }
  if ((focusPlan.readinessScore || 0) < 55) {
    return `Главный риск: ${primarySignal}. Следующий приоритет: ${primaryRecommendation}.`;
  }
  return `Контур готов к ходу. Следите за ценой, запасом и книгой заявок: ${primaryRecommendation}.`;
}

function renderFactoryAdvisor(intel, focusPlan, queue) {
  const factory = state.player.factory || {};
  const scenario = state.room.factoryScenario || {};
  const workers = factory.workers || [];
  const components = factory.components || [];
  const stock = factory.finishedGoods || 0;
  const saleOffer = factory.saleOffer || {};
  const market = state.room.market || [];
  const latest = market.at(-1) || {};
  const riskLevel = intel.riskLevel || 'low';
  const readiness = Math.max(0, Math.min(100, Number(focusPlan.readinessScore || 0)));
  const bestForecast = (state.room.forecastSegments || [])
    .filter(segment => !segment.productKey || segment.productKey === state.player.productKey || segment.productKey === state.player.focusProductKey)
    .sort((a, b) => (b.forecastDemand || 0) - (a.forecastDemand || 0))[0] || {};
  const avgComponentStock = components.length
    ? Math.round(components.reduce((sum, component) => sum + Number(component.quantity || 0), 0) / components.length)
    : 0;
  const assistantSummary = factoryAdvisorSummary(intel, focusPlan, factory);
  const riskClass = riskLevel === 'high' ? 'danger' : riskLevel === 'medium' ? 'warn' : 'ok';
  const signalList = (intel.signals || []).slice(0, 4);
  const recommendationList = (intel.recommendations || []).slice(0, 4);
  const checklistIssues = (state.player.turnChecklist || []).filter(item => item.status !== 'ready').slice(0, 3);
  const primaryIssue = checklistIssues[0] || (state.player.turnChecklist || [])[0] || null;
  const marketHints = state.player.marketHints || [];

  elements.intelOverview.classList.add('advisor-console');
  elements.intelBrief.classList.add('advisor-plan');
  elements.intelOverview.innerHTML = `
    <section class="advisor-hero">
      <div class="advisor-orb" aria-hidden="true">
        <span></span>
      </div>
      <div class="advisor-hero-copy">
        <span class="factory-node-label">AI-куратор смены</span>
        <h3>Операционный советник</h3>
        <p>${escapeHtml(assistantSummary)}</p>
        <div class="advisor-chip-row">
          <span class="mini-badge ${riskClass === 'ok' ? 'ok' : riskClass}">Риск: ${escapeHtml(t(`risk_${riskLevel}`))}</span>
          <span class="mini-badge">Готовность ${readiness}/100</span>
          <span class="mini-badge">${escapeHtml(scenario.productLabel || state.player.productLabel || 'Продукт')}</span>
        </div>
      </div>
      <div class="advisor-gauge" style="--advisor-score: ${readiness}%">
        <strong>${readiness}</strong>
        <span>готовность</span>
      </div>
    </section>
    <section class="advisor-metric-grid">
      <article>
        <span>Склад</span>
        <strong>${stock} шт.</strong>
        <small>Готовая продукция</small>
      </article>
      <article>
        <span>Материалы</span>
        <strong>${avgComponentStock}</strong>
        <small>Средний запас по линиям</small>
      </article>
      <article>
        <span>Команда</span>
        <strong>${workers.length}</strong>
        <small>Активных сотрудников</small>
      </article>
      <article>
        <span>Заявка</span>
        <strong>${saleOffer.quantity || 0} @ ${money(saleOffer.price || state.player.price || 0)}</strong>
        <small>Текущая продажа</small>
      </article>
    </section>
    ${renderMarketHints(marketHints, { compact: true })}
    <section class="advisor-market-strip">
      <article>
        <span>Спрос</span>
        <strong>${latest.demand || bestForecast.forecastDemand || scenario.baseDemandMax || 0} ед.</strong>
        ${miniChart(marketChartHistory({ demand: latest.demand || bestForecast.forecastDemand || scenario.baseDemandMax || 0 }).map(point => point.demand), 'success')}
      </article>
      <article>
        <span>Цена рынка</span>
        <strong>${money(latest.avgPrice || scenario.priceRange?.max || 0)}</strong>
        ${miniChart(marketChartHistory({ avgPrice: latest.avgPrice || scenario.priceRange?.max || 0 }).map(point => point.avgPrice), 'warn')}
      </article>
      <article>
        <span>Продажи</span>
        <strong>${latest.totalSales || 0} ед.</strong>
        ${miniChart(marketChartHistory({ totalSales: latest.totalSales || 0 }).map(point => point.totalSales), '')}
      </article>
    </section>
  `;

  elements.intelBrief.innerHTML = `
    <article class="advisor-action-card ${primaryIssue ? checklistStatusClass(primaryIssue.status) : 'ok'}">
      <span class="factory-node-label">Проблема → причина → действие</span>
      <strong>${escapeHtml(primaryIssue?.label || 'Контур стабилен')}</strong>
      <p>${escapeHtml(primaryIssue?.summary || 'Критических блокеров сейчас нет.')}</p>
      <button type="button" class="ghost" data-advisor-tab="${escapeHtml(primaryIssue?.tab || 'operations')}" data-advisor-department="${escapeHtml(primaryIssue?.department || 'command')}">${escapeHtml(primaryIssue?.action || 'Открыть')}</button>
    </article>
    <article class="advisor-plan-card advisor-plan-primary">
      <span class="factory-node-label">Следующий лучший шаг</span>
      <strong>${escapeHtml(intel.primaryRecommendationKey ? t(`rec_${intel.primaryRecommendationKey}`) : t('rec_hold_course'))}</strong>
      <p>${escapeHtml(intel.primarySignalKey ? t(`signal_${intel.primarySignalKey}`) : 'Критических сигналов нет. Можно продолжать производственный цикл.')}</p>
      ${renderExecutionQueue(queue)}
    </article>
    <article class="advisor-plan-card">
      <span class="factory-node-label">Сигналы</span>
      <div class="advisor-tag-list">
        ${signalList.length ? signalList.map(key => `<span>${escapeHtml(t(`signal_${key}`))}</span>`).join('') : '<span>Стабильный режим</span>'}
      </div>
    </article>
    <article class="advisor-plan-card">
      <span class="factory-node-label">Рекомендации</span>
      <div class="advisor-tag-list">
        ${recommendationList.length ? recommendationList.map(key => `<span>${escapeHtml(t(`rec_${key}`))}</span>`).join('') : `<span>${escapeHtml(t('rec_hold_course'))}</span>`}
      </div>
    </article>
    ${renderTurnChecklist(state.player.turnChecklist || [], { compact: true })}
  `;
}

function renderIntel() {
  elements.intelOverview.innerHTML = '';
  elements.intelBrief.innerHTML = '';
  elements.intelOverview.classList.remove('placeholder');
  elements.intelBrief.classList.remove('placeholder');
  elements.intelOverview.classList.remove('advisor-console');
  elements.intelBrief.classList.remove('advisor-plan');

  if (!state.room || !state.player) {
    elements.intelOverview.classList.add('placeholder');
    elements.intelBrief.classList.add('placeholder');
    elements.intelOverview.innerHTML = `<div>${t('intel_empty')}</div>`;
    elements.intelBrief.innerHTML = `<div>${t('intel_empty')}</div>`;
    return;
  }

  const intel = state.player.intel || { riskLevel: 'low', signals: [], recommendations: [] };
  const focusPlan = state.player.focusPlan || { readinessLevel: 'low', readinessScore: 0, missingSteps: [] };
  const queue = state.player.executionPlan || [];

  if (isFactoryRoom()) {
    renderFactoryAdvisor(intel, focusPlan, queue);
    elements.intelBrief.querySelectorAll('[data-advisor-tab]').forEach(button => button.addEventListener('click', () => {
      const department = button.dataset.advisorDepartment;
      if (department) setFactoryDepartment(department);
      setGameTab(button.dataset.advisorTab || 'operations');
      renderRoomState();
    }));
    bindTurnChecklist(elements.intelBrief);
    elements.intelBrief.querySelectorAll('[data-execution-index]').forEach(button => button.addEventListener('click', () => {
      const item = queue[Number(button.dataset.executionIndex)];
      if (item?.actionable && item.action) sendAction(item.action, item.value, { queueItem: item });
    }));
    return;
  }

  const forecast = state.room.forecastSegments || [];
  if (!forecast.length) {
    elements.intelOverview.classList.add('placeholder');
    elements.intelOverview.innerHTML = `<div>${t('intel_empty')}</div>`;
  } else {
    forecast.forEach(segment => {
      const node = document.createElement('article');
      node.className = 'market-item';
      const segmentLabel = isFactoryRoom()
        ? escapeHtml(segment.productLabel || state.room?.factoryScenario?.productLabel || '')
        : `${escapeHtml(segment.cityLabel)} • ${escapeHtml(segment.productLabel)}`;
      node.innerHTML = `<strong>${segmentLabel}</strong><div class="value">${segment.forecastDemand}</div><small>${t('demand')}: ${segment.forecastDemand} • ${t('price_pressure')}: ${segment.pricePressure} • ${t('competition_score')}: ${segment.competitionScore}</small>`;
      elements.intelOverview.appendChild(node);
    });
  }

  const briefNode = document.createElement('article');
  briefNode.className = 'market-item';
  briefNode.innerHTML = `
    <strong>${t('brief_title')}</strong>
    <div class="value">${t(`risk_${intel.riskLevel || 'low'}`)}</div>
    <small>${t('risk_level')}: ${intel.riskScore || 0}</small>
    <div class="top-gap muted small"><strong>${t('intel_focus_now')}:</strong> ${intel.primaryRecommendationKey ? t(`rec_${intel.primaryRecommendationKey}`) : t('rec_hold_course')}</div>
    <div class="muted small"><strong>${t('intel_main_signal')}:</strong> ${intel.primarySignalKey ? t(`signal_${intel.primarySignalKey}`) : '—'}</div>
    <div class="top-gap muted small">${t('intel_signals')}: ${(intel.signals || []).length ? intel.signals.map(key => t(`signal_${key}`)).join(' • ') : '—'}</div>
    <div class="top-gap muted small">${t('intel_recommendations')}: ${(intel.recommendations || []).length ? intel.recommendations.map(key => t(`rec_${key}`)).join(' • ') : t('rec_hold_course')}</div>`;
  elements.intelBrief.appendChild(briefNode);

  const focusNode = document.createElement('article');
  focusNode.className = 'market-item';
  focusNode.innerHTML = `
    <strong>${t('focus_plan_title')}</strong>
    <div class="value">${state.player.focusProductLabel}</div>
    <small>${t('focus_readiness')}: ${t(`readiness_${focusPlan.readinessLevel || 'low'}`)} ? ${focusPlan.readinessScore || 0}/100 ? ${t('demand')}: ${focusPlan.forecastDemand || 0}</small>
    <div class="top-gap muted small">${t('focus_missing')}: ${(focusPlan.missingSteps || []).length ? focusPlan.missingSteps.map(key => t(`step_${key}`)).join(' • ') : t('rec_hold_course')}</div>`;
  elements.intelBrief.appendChild(focusNode);

  const pivot = state.player.pivotPreview || { timing: 'hold', reasons: [] };
  const pivotNode = document.createElement('article');
  pivotNode.className = 'market-item';
  pivotNode.innerHTML = `
    <strong>${t('pivot_preview_title')}</strong>
    <div class="value">${t(`pivot_${pivot.timing || 'hold'}`)}</div>
    <small>${t('pivot_current')}: ${pivot.currentDemand || 0} ? ${t('pivot_target')}: ${pivot.targetDemand || 0} ? ${t('pivot_delta')}: ${pivot.demandDelta || 0}</small>
    <div class="top-gap muted small">${t('pivot_timing')}: ${(pivot.reasons || []).length ? pivot.reasons.map(key => t(`pivot_reason_${key}`)).join(' • ') : '—'}</div>`;
  elements.intelBrief.appendChild(pivotNode);

  const queueNode = document.createElement('article');
  queueNode.className = 'market-item';
  queueNode.innerHTML = `
    <strong>${t('execution_queue_title')}</strong>
    ${renderExecutionQueue(queue)}`;
  elements.intelBrief.appendChild(queueNode);
  queueNode.querySelectorAll('[data-execution-index]').forEach(button => button.addEventListener('click', () => {
    const item = queue[Number(button.dataset.executionIndex)];
    if (item?.actionable && item.action) sendAction(item.action, item.value, { queueItem: item });
  }));
}

function renderCareer() {
  if (!hasRenderSignatureChanged('careerOverview', state.account || null)) return;
  elements.careerOverview.innerHTML = '';
  elements.careerOverview.classList.remove('placeholder');
  if (!state.account) {
    elements.careerOverview.classList.add('placeholder');
    elements.careerOverview.innerHTML = `<div>${t('career_placeholder')}</div>`;
    return;
  }
  const cards = [
    [t('games_played'), `${state.account.gamesPlayed}`, state.account.userName],
    [t('wins'), `${state.account.wins}`, `${t('favorite_scenario')}: ${state.account.favoriteScenario}`],
    [t('total_revenue'), money(state.account.totalRevenue), t('career_hint')],
    [t('best_networth'), money(state.account.bestNetWorth), t('business_value')],
    [t('last_company'), state.account.lastCompany, t('profile_title')],
    [t('research_done'), `${state.account.completedResearchCount}`, t('research_title')],
    [t('completed_contracts'), `${state.account.completedContracts || 0}`, t('contract_title')],
    [t('goals_completed'), `${state.account.goalsCompleted || 0}`, t('season_goal')],
  ];
  cards.forEach(card => appendStatCard(elements.careerOverview, ...card));
}

function renderAchievements() {
  if (!hasRenderSignatureChanged('achievementList', {
    userName: state.account?.userName || '',
    achievements: state.account?.achievements || [],
  })) return;
  elements.achievementList.innerHTML = '';
  elements.achievementList.classList.remove('placeholder');
  const achievements = state.account?.achievements || [];
  if (!achievements.length) {
    elements.achievementList.classList.add('placeholder');
    elements.achievementList.innerHTML = `<div>${t('achievement_empty')}</div>`;
    return;
  }
  achievements.forEach(key => {
    const node = document.createElement('article');
    node.className = 'market-item';
    node.innerHTML = `<strong>${t(`achievement_${key}`)}</strong><small>${escapeHtml(state.account.userName)}</small>`;
    elements.achievementList.appendChild(node);
  });
}

function renderStatistics() {
  if (!elements.statisticsOverview || !elements.statisticsTrend) return;
  const overview = elements.statisticsOverview;
  const trend = elements.statisticsTrend;
  overview.innerHTML = '';
  trend.innerHTML = '';
  overview.classList.remove('placeholder');
  trend.classList.remove('placeholder');

  const renderKpi = (title, value, hint, tone = '') => `
    <article class="statistics-kpi-card ${tone}">
      <strong>${title}</strong>
      <div class="value">${value}</div>
      <small>${hint}</small>
    </article>
  `;
  const renderEmpty = () => {
    overview.classList.add('placeholder');
    trend.classList.add('placeholder');
    overview.innerHTML = `<div>${t('stats_empty')}</div>`;
    trend.innerHTML = `<div>${t('stats_empty')}</div>`;
  };

  if (!state.room || !state.player) {
    renderEmpty();
    return;
  }

  if (isFactoryRoom()) {
    const stats = state.room.factoryStats;
    const research = state.player.research || {};
    const completedResearch = Array.isArray(research.completed)
      ? research.completed
      : research.completed && typeof research.completed === 'object'
        ? Object.keys(research.completed)
        : [];
    const availableResearch = (state.room.researchCatalog || []).filter(item => !completedResearch.includes(item.key));
    const researchOptions = availableResearch.length
      ? availableResearch.map(item => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)} • ${item.cost} RP</option>`).join('')
      : '<option value="">Нет доступных проектов</option>';
    if (!stats?.hasData || !stats.latest) {
      overview.innerHTML = `
        <article class="statistics-kpi-card r-and-d-card">
          <strong>R&D лаборатория</strong>
          <div class="value">${research.activeLabel || 'Проект не выбран'}</div>
          <small>${research.activeLabel ? `Прогресс ${research.progress}/${research.target}` : `Очки исследований: ${state.player.researchPoints}`}</small>
          <label class="top-gap">
            <span>Новый проект</span>
            <select id="r-and-d-select" ${research.activeLabel ? 'disabled' : ''}>${researchOptions}</select>
          </label>
          <button type="button" data-rd-start ${canUseBusinessActions() && !research.activeLabel && availableResearch.length ? '' : 'disabled'}>Запустить исследование</button>
        </article>
        <article class="statistics-kpi-card">
          <strong>Завершено</strong>
          <div class="value">${completedResearch.length}</div>
          <small>Постоянные бонусы текущего матча</small>
        </article>
        <article class="statistics-kpi-card">
          <strong>Очки R&D</strong>
          <div class="value">${state.player.researchPoints}</div>
          <small>Нужны для запуска проектов</small>
        </article>`;
      trend.classList.add('placeholder');
      trend.innerHTML = `<div>${t('stats_empty')}</div>`;
      overview.querySelector('[data-rd-start]')?.addEventListener('click', () => {
        const select = document.querySelector('#r-and-d-select');
        if (select?.value) sendAction('start-research', select.value);
      });
      return;
    }

    const latest = stats.latest;
    const demandTone = stats.demandDelta > 0 ? 'positive' : stats.demandDelta < 0 ? 'warning' : '';
    const profitTone = stats.playerProfit >= 0 ? 'positive' : 'danger';
    const topSeller = stats.topSeller
      ? `${stats.topSeller.playerName}: ${stats.topSeller.sold} sold`
      : t('stats_no_top_seller');
    const activeSurge = state.room.activeEvent?.scope === 'factory' ? state.room.activeEvent : null;

    overview.innerHTML = [
      `<article class="statistics-kpi-card r-and-d-card">
        <strong>R&D лаборатория</strong>
        <div class="value">${research.activeLabel || 'Проект не выбран'}</div>
        <small>${research.activeLabel ? `Прогресс ${research.progress}/${research.target}` : `Очки исследований: ${state.player.researchPoints}`}</small>
        <label class="top-gap">
          <span>Новый проект</span>
          <select id="r-and-d-select" ${research.activeLabel ? 'disabled' : ''}>${researchOptions}</select>
        </label>
        <button type="button" data-rd-start ${canUseBusinessActions() && !research.activeLabel && availableResearch.length ? '' : 'disabled'}>Запустить исследование</button>
      </article>`,
      renderKpi('Demand', `${latest.demand} units`, `Base ${latest.baseDemand} ? x${latest.demandMultiplier.toFixed(2)} ? delta ${stats.demandDelta >= 0 ? '+' : ''}${stats.demandDelta}`, demandTone),
      renderKpi('Matched sales', `${stats.totalSales} units`, `Sell-through ${stats.sellThroughPct}% ? unmatched ${stats.unmatchedDemand}`, stats.sellThroughPct >= 75 ? 'positive' : 'warning'),
      renderKpi('Average price', `${rub(stats.avgPrice)} RUB`, `${state.room.factoryScenario.productLabel} order book`),
      renderKpi('Your P/L', `${rub(stats.playerProfit)} RUB`, `Revenue ${rub(stats.playerRevenue)} ? costs ${rub(stats.playerExpenses)}`, profitTone),
      renderKpi('Finished stock', `${state.player.factory.finishedGoods} ${state.player.factory.productUnit}`, `Offer ${state.player.factory.saleOffer.quantity} @ ${rub(state.player.factory.saleOffer.price)} RUB`),
      renderKpi('Top seller', topSeller, stats.topSeller ? `${rub(stats.topSeller.revenue)} RUB revenue` : state.room.factoryScenario.label),
    ].join('');

    trend.innerHTML = `
      <article class="market-item score-breakdown-card">
        <strong>${t('score_breakdown_title')}</strong>
        <small>${t('score_breakdown_hint')}</small>
        <ul class="results-list score-breakdown-list">${renderSimulationScoreBreakdownItems(state.player)}</ul>
      </article>
      ${activeSurge ? `
        <article class="statistics-surge-card">
          <div>
            <strong>${activeSurge.title || t('stats_surge_label')}</strong>
            <small>${activeSurge.description || t('stats_surge_hint')} ? expires day ${activeSurge.expiresDay}</small>
          </div>
          <span class="mini-badge">x${Number(activeSurge.demandMultiplier || 1).toFixed(2)} demand</span>
        </article>
      ` : ''}
      ${stats.recentHistory.map(entry => `
        <article class="market-item statistics-trend-row">
          <strong>Day ${entry.day}</strong>
          <span><b>${entry.demand}</b><small>Demand</small></span>
          <span><b>${entry.totalSales}</b><small>Sales</small></span>
          <span><b>${entry.sellThroughPct}%</b><small>Sell-through</small></span>
          <span><b>${rub(entry.avgPrice)} RUB</b><small>Avg price</small></span>
        </article>
      `).join('')}
    `;
    overview.querySelector('[data-rd-start]')?.addEventListener('click', () => {
      const select = document.querySelector('#r-and-d-select');
      if (select?.value) sendAction('start-research', select.value);
    });
    return;
  }

  const history = state.room.market || [];
  const latest = history[history.length - 1] || null;
  const previous = history[history.length - 2] || null;
  if (!latest) {
    renderEmpty();
    return;
  }

  const demandDelta = Math.round(latest.demand || 0) - Math.round(previous?.demand || 0);
  const sellThroughPct = latest.demand ? Math.round(((latest.totalSales || 0) / latest.demand) * 100) : 0;
  const breakdown = state.player.lastTickBreakdown || {};
  overview.innerHTML = [
    renderKpi(t('demand'), `${latest.demand} pcs`, `Delta ${demandDelta >= 0 ? '+' : ''}${demandDelta}`, demandDelta > 0 ? 'positive' : demandDelta < 0 ? 'warning' : ''),
    renderKpi(t('sales'), `${latest.totalSales} pcs`, `Sell-through ${sellThroughPct}%`),
    renderKpi(t('avg_price'), `${rub(latest.avgPrice)} RUB`, state.room.scenarioLabel),
    renderKpi(t('tick_profit'), `${rub(breakdown.profit || 0)} RUB`, `${t('tick_revenue')}: ${rub(breakdown.revenue || 0)} ? ${t('tick_expenses')}: ${rub(breakdown.expenses || 0)}`, (breakdown.profit || 0) >= 0 ? 'positive' : 'danger'),
    renderKpi(t('stock'), `${state.player.productStock} pcs`, state.player.productLabel),
  ].join('');

  trend.innerHTML = `
    <article class="market-item score-breakdown-card">
      <strong>${t('score_breakdown_title')}</strong>
      <small>${t('score_breakdown_hint')}</small>
      <ul class="results-list score-breakdown-list">${renderSimulationScoreBreakdownItems(state.player)}</ul>
    </article>
    ${history.slice(-6).map(entry => {
      const entrySellThrough = entry.demand ? Math.round(((entry.totalSales || 0) / entry.demand) * 100) : 0;
      return `
        <article class="market-item statistics-trend-row">
          <strong>Day ${entry.day}</strong>
          <span><b>${entry.demand}</b><small>${t('demand')}</small></span>
          <span><b>${entry.totalSales}</b><small>${t('sales')}</small></span>
          <span><b>${entrySellThrough}%</b><small>Sell-through</small></span>
          <span><b>${rub(entry.avgPrice)} RUB</b><small>${t('avg_price')}</small></span>
        </article>
      `;
    }).join('')}
  `;
}

function marketChartHistory(fallback = {}) {
  const source = (state.room?.market || []).filter(Boolean).slice(-10);
  if (source.length) {
    return source.map((entry, index) => ({
      day: Number(entry.day ?? index + 1),
      demand: Number(entry.demand || 0),
      totalSales: Number(entry.totalSales || 0),
      avgPrice: Number(entry.avgPrice || fallback.avgPrice || 0),
    }));
  }

  const pattern = [0.86, 0.93, 0.9, 1.02, 0.98, 1.08, 1.04, 1.16, 1.11, 1.22];
  const baseDemand = Number(fallback.demand || state.room?.factoryScenario?.baseDemandMax || 1200);
  const basePrice = Number(fallback.avgPrice || state.player?.factory?.saleOffer?.price || state.player?.price || state.room?.factoryScenario?.priceRange?.max || 18000);
  const baseSales = Number(fallback.totalSales || Math.round(baseDemand * 0.68));
  return pattern.map((multiplier, index) => ({
    day: index + 1,
    demand: Math.max(0, Math.round(baseDemand * multiplier)),
    totalSales: Math.max(0, Math.round(baseSales * (0.82 + index * 0.035))),
    avgPrice: Math.max(0, Math.round(basePrice * (0.9 + multiplier * 0.12))),
  }));
}

function chartBounds(values) {
  const filtered = values.map(Number).filter(Number.isFinite);
  if (!filtered.length) return { min: 0, max: 1 };
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  if (min === max) return { min: min * 0.92, max: max * 1.08 + 1 };
  const padding = (max - min) * 0.14;
  return { min: min - padding, max: max + padding };
}

function chartY(value, bounds, height, pad) {
  const range = bounds.max - bounds.min || 1;
  return height - pad - ((Number(value) - bounds.min) / range) * (height - pad * 2);
}

function chartPolyline(values, width = 640, height = 230, pad = 24) {
  const bounds = chartBounds(values);
  const denominator = Math.max(values.length - 1, 1);
  return values.map((value, index) => {
    const x = pad + (index / denominator) * (width - pad * 2);
    const y = chartY(value, bounds, height, pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function miniChart(values, tone = '') {
  return `<svg class="exchange-mini-chart ${tone}" viewBox="0 0 180 62" aria-hidden="true">
    <polyline points="${chartPolyline(values, 180, 62, 8)}" />
  </svg>`;
}

function barHeight(value, max, height = 46) {
  const safeMax = Math.max(Number(max || 0), 1);
  return Math.max(4, Math.round((Number(value || 0) / safeMax) * height));
}

function compactMarketNumber(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (Math.abs(number) >= 1000) return `${Math.round(number / 100) / 10}K`;
  return rub(number);
}

function productMarketLine(player) {
  if (isFactoryRoom()) return state.room?.factoryScenario?.productLabel || player?.productLabel || '';
  return [player?.productLabel, player?.cityLabel].filter(Boolean).join(' • ');
}

function syntheticBuyerBook(scenario, history = []) {
  const latest = history[history.length - 1] || {};
  const demand = Number(latest.demand || scenario?.baseDemandMax || 1200);
  const basePrice = Number(latest.avgPrice || scenario?.priceRange?.max || 18000);
  const buyers = [
    ['Сеть «ТехМаркет»', 1.02, 0.34],
    ['Интернет-магазин «БестТех»', 0.98, 0.26],
    ['Региональный дилер', 0.94, 0.22],
    ['Оптовый склад', 0.9, 0.18],
  ];
  return buyers.map(([name, priceMultiplier, quantityMultiplier]) => ({
    name,
    price: Math.round(basePrice * priceMultiplier),
    quantity: Math.max(1, Math.round(demand * quantityMultiplier)),
  }));
}

function renderOrderDepth(scenario, book, history) {
  const sellers = book.slice(0, 4);
  const buyers = syntheticBuyerBook(scenario, history).slice(0, 3);
  const bestAsk = sellers.length ? Math.min(...sellers.map(entry => Number(entry.price || Infinity))) : null;
  const bestBid = buyers.length ? Math.max(...buyers.map(entry => Number(entry.price || 0))) : null;
  const maxVolume = Math.max(
    1,
    ...sellers.map(entry => Number(entry.remaining ?? entry.quantity ?? 0)),
    ...buyers.map(entry => Number(entry.quantity || 0)),
  );
  const buyerRows = buyers.map(entry => {
    const fill = Math.max(6, Math.round((entry.quantity / maxVolume) * 100));
    return `<div class="depth-row buy ${entry.price === bestBid ? 'best' : ''}">
      <span>${escapeHtml(entry.name)}</span>
      <strong>${money(entry.price)}</strong>
      <b>${entry.quantity} ед.</b>
      <i style="width:${fill}%"></i>
    </div>`;
  }).join('');
  const sellerRows = sellers.length
    ? sellers.map(entry => {
      const quantity = Number(entry.remaining ?? entry.quantity ?? 0);
      const fill = Math.max(6, Math.round((quantity / maxVolume) * 100));
      const own = entry.playerId === state.player?.id;
      return `<div class="depth-row sell ${own ? 'own' : ''} ${entry.price === bestAsk ? 'best' : ''}">
        <span>${escapeHtml(entry.playerName)}</span>
        <strong>${money(entry.price)}</strong>
        <b>${quantity} ед.</b>
        <i style="width:${fill}%"></i>
      </div>`;
    }).join('')
    : `<div class="depth-empty">Заявок на продажу пока нет.</div>`;
  return `<div class="order-depth-grid">
    <section class="depth-side">
      <div class="depth-head"><span>Покупатели</span><strong>Bid</strong></div>
      ${buyerRows}
    </section>
    <section class="depth-side">
      <div class="depth-head"><span>Продажа</span><strong>Ask</strong></div>
      ${sellerRows}
    </section>
  </div>`;
}

function renderDealTape(history, book) {
  const latest = history[history.length - 1] || null;
  const filled = book.filter(entry => Number(entry.sold || 0) > 0).slice(0, 4);
  const rows = filled.length
    ? filled.map(entry => `<div class="deal-row">
      <span>${escapeHtml(entry.playerName)}</span>
      <strong>${entry.sold} ед.</strong>
      <b>${money(entry.price)}</b>
    </div>`).join('')
    : `<div class="deal-row muted-row">
      <span>Сделок ещё не было</span>
      <strong>${latest ? `${latest.totalSales || 0} ед.` : '0 ед.'}</strong>
      <b>${latest?.avgPrice ? money(latest.avgPrice) : '—'}</b>
    </div>`;
  return `<div class="deal-tape">
    <div class="depth-head"><span>Лента сделок</span><strong>${latest ? `${t('day')} ${latest.day}` : 'Live'}</strong></div>
    ${rows}
  </div>`;
}

function renderFactoryTradeDesk(scenario, factory, book, enabled) {
  const saleDraft = getFactorySaleDraft(factory);
  const maxQuantity = Math.max(0, Number(factory.finishedGoods || 0));
  const economics = state.player?.unitEconomics || null;
  const ownOffer = book.find(entry => entry.playerId === state.player?.id) || null;
  const canAdvanceTurn = Boolean(
    state.player?.isHost
    && isManualTurnRoom()
    && state.room
    && ['running', 'paused'].includes(state.room.status)
    && !gameIsFinished(),
  );
  const turnAction = state.room?.status === 'paused' ? 'resume-game' : 'next-turn';
  const turnLabel = state.room?.status === 'paused' ? t('continue_planning') : 'Завершить ход';
  const hints = state.player?.marketHints || [];
  const decisionHint = hints.find(hint => hint.kind === 'decision') || null;
  const recommendedPrice = decisionHint?.recommendedPrice || decisionHint?.bestPrice || scenario.basePrice || factory.saleOffer.price;
  const riskLabels = { low: 'низкий риск', medium: 'средний риск', high: 'высокий риск' };
  const economicsStatusLabels = {
    loss: 'цена ниже себестоимости',
    thin: 'тонкая маржа',
    ok: 'рабочая маржа',
    strong: 'высокая маржа',
  };
  const shortageComponents = (economics?.componentBreakdown || [])
    .filter(item => !item.enoughSupply)
    .map(item => item.label)
    .slice(0, 2);
  const history = marketChartHistory({
    demand: scenario.baseDemandMax || 1180,
    totalSales: 0,
    avgPrice: factory.saleOffer.price || scenario.priceRange?.max || 18450,
  });

  return `
    <aside class="market-trade-desk">
      <div class="trade-head">
        <div>
          <span class="factory-node-label">Книга заявок</span>
          <h3>Продажа</h3>
        </div>
        <span class="mini-badge ${ownOffer ? 'ok' : 'warn'}">${ownOffer ? 'В книге' : 'Нет заявки'}</span>
      </div>
      <div class="trade-position">
        <article>
          <span>Готовый склад</span>
          <strong>${maxQuantity} ${factory.productUnit}</strong>
        </article>
        <article>
          <span>Текущая заявка</span>
          <strong>${factory.saleOffer.quantity} @ ${money(factory.saleOffer.price)}</strong>
        </article>
        <article>
          <span>Ожидаемые продажи</span>
          <strong>${Number(decisionHint?.expectedUnits || 0)} ед.</strong>
          <small>${escapeHtml(riskLabels[decisionHint?.saleRisk] || 'нет данных')}</small>
        </article>
        ${economics ? `
          <article class="unit-economics-card ${escapeHtml(economics.status || 'ok')}">
            <span>Безубыточность</span>
            <strong>${money(economics.breakEvenPrice)}</strong>
            <small>на партию ${economics.capacityBasis || 1} ед.: материалы ${money(economics.materialUnitCost)} + расходы ${money(economics.overheadPerUnit)}</small>
          </article>
          <article class="unit-economics-card ${escapeHtml(economics.status || 'ok')}">
            <span>Маржа с единицы</span>
            <strong>${money(economics.marginPerUnit)} (${economics.marginPct}%)</strong>
            <small>${escapeHtml(economicsStatusLabels[economics.status] || economics.explanation || '')}</small>
          </article>
          <article class="unit-economics-card ${economics.hasSupplierShortage ? 'thin' : 'strong'}">
            <span>Комплектующие</span>
            <strong>${economics.supplyCoverage || 0}% доступно</strong>
            <small>${economics.hasSupplierShortage ? `Дефицит: ${escapeHtml(shortageComponents.join(', ') || 'часть деталей')}` : 'На рынке есть полный набор для сборки'}</small>
          </article>
          <article class="unit-economics-card ${Number(economics.salePrice || 0) >= Number(economics.recommendedFloorPrice || 0) ? 'strong' : 'thin'}">
            <span>Безопасная цена</span>
            <strong>${money(economics.recommendedFloorPrice || economics.breakEvenPrice)}</strong>
            <small>минимум с запасом к расходам</small>
          </article>
        ` : ''}
      </div>
      <div class="trade-form">
        <label>
          <span>Цена продажи</span>
          <input id="market-sale-price" type="number" min="${scenario.priceRange.min}" max="${scenario.priceRange.max}" value="${saleDraft.price}" />
        </label>
        <label>
          <span>Объем</span>
          <input id="market-sale-quantity" type="number" min="0" max="${maxQuantity}" value="${saleDraft.quantity}" />
        </label>
        <div class="trade-actions">
          <button type="button" data-market-sale-action="submit" ${enabled ? '' : 'disabled'}>Выставить</button>
          <button type="button" class="ghost" data-market-sale-action="clear" ${enabled ? '' : 'disabled'}>Удержать</button>
          <button type="button" class="ghost" data-market-sale-action="recommend" data-recommended-price="${Math.round(recommendedPrice)}" ${enabled ? '' : 'disabled'}>Рекомендованная цена</button>
          <button type="button" class="ghost" data-market-sale-action="sell-all" ${enabled ? '' : 'disabled'}>Продать все</button>
        </div>
      </div>
      ${renderMarketHints(hints, { compact: true })}
      ${renderOrderDepth(scenario, book, history)}
      ${renderDealTape(history, book)}
      <button type="button" class="trade-turn-button" data-market-turn-action="${turnAction}" ${canAdvanceTurn ? '' : 'disabled'}>
        ${turnLabel}
        <span>→</span>
      </button>
    </aside>`;
}

function bindFactoryMarketSaleControls() {
  const desk = elements.marketOverview.querySelector('.market-trade-desk')
    || elements.contractBoard.querySelector('.market-trade-desk');
  if (!desk) return;
  const saveDraft = () => {
    const values = readFactorySaleInputStrings(desk);
    state.factorySaleDraft = {
      roomCode: state.room?.code || '',
      playerId: state.player?.id || '',
      price: values.price,
      quantity: values.quantity,
    };
  };
  desk.querySelectorAll('input').forEach(input => input.addEventListener('input', saveDraft));
  desk.querySelector('[data-market-sale-action="submit"]')?.addEventListener('click', () => {
    const values = readFactorySaleInputs(desk);
    sendAction('set-sale-offer', values);
  });
  desk.querySelector('[data-market-sale-action="clear"]')?.addEventListener('click', () => {
    const values = readFactorySaleInputs(desk);
    sendAction('set-sale-offer', { price: values.price, quantity: 0 });
  });
  desk.querySelector('[data-market-sale-action="recommend"]')?.addEventListener('click', event => {
    const priceInput = desk.querySelector('#market-sale-price');
    const quantityInput = desk.querySelector('#market-sale-quantity');
    const recommendedPrice = Number(event.currentTarget.dataset.recommendedPrice || 0);
    if (priceInput && recommendedPrice > 0) priceInput.value = String(recommendedPrice);
    if (quantityInput && Number(quantityInput.value || 0) <= 0) quantityInput.value = String(Number(quantityInput.max || 0));
    saveDraft();
  });
  desk.querySelector('[data-market-sale-action="sell-all"]')?.addEventListener('click', () => {
    const priceInput = desk.querySelector('#market-sale-price');
    const quantityInput = desk.querySelector('#market-sale-quantity');
    const recommendedButton = desk.querySelector('[data-market-sale-action="recommend"]');
    const recommendedPrice = Number(recommendedButton?.dataset.recommendedPrice || 0);
    if (priceInput && recommendedPrice > 0) priceInput.value = String(recommendedPrice);
    if (quantityInput) quantityInput.value = String(Number(quantityInput.max || 0));
    saveDraft();
  });
  desk.querySelector('[data-market-turn-action]')?.addEventListener('click', event => {
    sendAction(event.currentTarget.dataset.marketTurnAction);
  });
}

function renderExchangeDashboard(history, options = {}) {
  const priceValues = history.map(entry => Number(entry.avgPrice || 0));
  const demandValues = history.map(entry => Number(entry.demand || 0));
  const salesValues = history.map(entry => Number(entry.totalSales || 0));
  const latest = history[history.length - 1] || { avgPrice: 0, demand: 0, totalSales: 0 };
  const previous = history[history.length - 2] || latest;
  const priceDelta = Number(latest.avgPrice || 0) - Number(previous.avgPrice || 0);
  const demandDelta = Number(latest.demand || 0) - Number(previous.demand || 0);
  const salesDelta = Number(latest.totalSales || 0) - Number(previous.totalSales || 0);
  const chartWidth = 640;
  const chartHeight = 230;
  const pad = 24;
  const priceBounds = chartBounds(priceValues);
  const maxSales = Math.max(...salesValues, 1);
  const volumeBars = history.map((entry, index) => {
    const width = Math.max(8, (chartWidth - pad * 2) / Math.max(history.length, 1) * 0.44);
    const x = pad + ((index + 0.5) / Math.max(history.length, 1)) * (chartWidth - pad * 2) - width / 2;
    const height = barHeight(entry.totalSales, maxSales, 46);
    const y = chartHeight - pad - height;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height}" rx="2" />`;
  }).join('');
  const candleStep = (chartWidth - pad * 2) / Math.max(history.length, 1);
  const candleWidth = Math.max(7, Math.min(18, candleStep * 0.42));
  const candles = history.map((entry, index) => {
    const close = Number(entry.avgPrice || 0);
    const open = Number(history[index - 1]?.avgPrice || close * 0.97);
    const volatility = Math.max(Math.abs(close - open), close * 0.035, 1);
    const high = Math.max(open, close) + volatility * 0.55;
    const low = Math.max(0, Math.min(open, close) - volatility * 0.55);
    const x = pad + ((index + 0.5) / Math.max(history.length, 1)) * (chartWidth - pad * 2);
    const yHigh = chartY(high, priceBounds, chartHeight, pad);
    const yLow = chartY(low, priceBounds, chartHeight, pad);
    const yOpen = chartY(open, priceBounds, chartHeight, pad);
    const yClose = chartY(close, priceBounds, chartHeight, pad);
    const bodyY = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(Math.abs(yClose - yOpen), 4);
    const tone = close >= open ? 'positive' : 'negative';
    return `<g class="exchange-candle ${tone}">
      <line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" />
      <rect x="${(x - candleWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyHeight.toFixed(1)}" rx="2" />
    </g>`;
  }).join('');
  const demandLine = chartPolyline(demandValues, chartWidth, chartHeight, pad);
  const salesLine = chartPolyline(salesValues, chartWidth, chartHeight, pad);

  return `
    <section class="exchange-dashboard">
      <div class="exchange-head">
        <div>
          <span class="factory-node-label">Рыночный терминал</span>
          <h3>${escapeHtml(options.title || 'Индекс спроса и цены')}</h3>
        </div>
        <div class="exchange-live"><span class="team-dot green"></span> LIVE</div>
      </div>
      <div class="exchange-main-chart">
        <svg class="exchange-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" aria-label="График цены, спроса и продаж">
          <g class="exchange-grid">
            <line x1="24" y1="46" x2="616" y2="46" />
            <line x1="24" y1="92" x2="616" y2="92" />
            <line x1="24" y1="138" x2="616" y2="138" />
            <line x1="24" y1="184" x2="616" y2="184" />
          </g>
          <g class="exchange-volume">${volumeBars}</g>
          <g class="exchange-candles">${candles}</g>
          <polyline class="exchange-line demand" points="${demandLine}" />
          <polyline class="exchange-line sales" points="${salesLine}" />
        </svg>
        <div class="exchange-axis">
          <span>${t('day')} ${history[0]?.day || 1}</span>
          <span>${t('day')} ${latest.day || history.length}</span>
        </div>
      </div>
      <div class="exchange-legend">
        <span><i class="legend-candle"></i>Цена</span>
        <span><i class="legend-demand"></i>Спрос</span>
        <span><i class="legend-sales"></i>Продажи</span>
      </div>
      <div class="exchange-mini-grid">
        <article>
          <span>Цена рынка</span>
          <strong>${money(latest.avgPrice)}</strong>
          <small class="${priceDelta >= 0 ? 'positive' : 'negative'}">${priceDelta >= 0 ? '+' : ''}${money(priceDelta)}</small>
          ${miniChart(priceValues, priceDelta >= 0 ? 'positive' : 'negative')}
        </article>
        <article>
          <span>Спрос</span>
          <strong>${compactMarketNumber(latest.demand)} ед.</strong>
          <small class="${demandDelta >= 0 ? 'positive' : 'negative'}">${demandDelta >= 0 ? '+' : ''}${compactMarketNumber(demandDelta)}</small>
          ${miniChart(demandValues, demandDelta >= 0 ? 'positive' : 'negative')}
        </article>
        <article>
          <span>Объем продаж</span>
          <strong>${compactMarketNumber(latest.totalSales)} ед.</strong>
          <small class="${salesDelta >= 0 ? 'positive' : 'negative'}">${salesDelta >= 0 ? '+' : ''}${compactMarketNumber(salesDelta)}</small>
          ${miniChart(salesValues, salesDelta >= 0 ? 'positive' : 'negative')}
        </article>
      </div>
    </section>`;
}

function teacherMarketRowStatus(row) {
  if (row.bankrupt) return { tone: 'danger', label: 'Банкротство', hint: 'Нужен разбор финансов' };
  if (row.readyForTurn) return { tone: 'ok', label: 'Ход готов', hint: 'Решения зафиксированы' };
  if (row.issue) return { tone: 'warn', label: row.issue, hint: row.nextAction || 'Нужна проверка команды' };
  return { tone: 'neutral', label: 'В работе', hint: row.nextAction || localizedLastAction(row.lastAction) || 'Команда принимает решения' };
}

function renderTeacherMarketOverview() {
  const room = state.room || {};
  const dashboard = room.classDashboard || {};
  const rows = dashboard.rows || [];
  const marketHistory = room.market || [];
  const latest = marketHistory.at(-1) || null;
  const previous = marketHistory.at(-2) || null;
  const totalOffers = rows.reduce((sum, row) => sum + Number(row.saleQuantity || 0), 0);
  const totalStock = rows.reduce((sum, row) => sum + Number(row.finishedGoods || 0), 0);
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.lastRevenue || 0), 0);
  const totalSold = Number(latest?.totalSales ?? rows.reduce((sum, row) => sum + Number(row.soldLastTick || 0), 0));
  const demand = Number(latest?.demand || 0);
  const marketCoverage = latest && demand > 0 ? Math.round((totalSold / demand) * 100) : null;
  const priceDelta = latest && previous ? Number(latest.avgPrice || 0) - Number(previous.avgPrice || 0) : null;
  const productUnit = room.factoryScenario?.productUnit || 'ед.';
  const metricMarkup = [
    ['Спрос', latest ? `${compactMarketNumber(demand)} ${productUnit}` : '—', latest ? `Ход ${latest.day || room.day || 1}` : 'Появится после первого пересчета', 'market'],
    ['Продано', latest ? `${compactMarketNumber(totalSold)} ${productUnit}` : '—', marketCoverage === null ? 'Нет рыночного результата' : `${marketCoverage}% спроса закрыто`, 'ship'],
    ['Средняя цена', latest ? money(latest.avgPrice || 0) : '—', priceDelta === null ? 'Нет предыдущего хода' : `${priceDelta >= 0 ? '+' : ''}${money(priceDelta)} к прошлому ходу`, 'cash'],
    ['Заявки класса', `${compactMarketNumber(totalOffers)} ${productUnit}`, `${rows.filter(row => Number(row.saleQuantity || 0) > 0).length} из ${rows.length} команд`, 'goal'],
    ['Готовый склад', `${compactMarketNumber(totalStock)} ${productUnit}`, `${money(totalRevenue)} выручки за ход`, 'warehouse'],
  ].map(([label, value, hint, icon]) => `
    <article class="teacher-market-kpi">
      <svg class="game-ui-icon" aria-hidden="true"><use href="/assets/game-icons.svg#icon-${icon}"></use></svg>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>`).join('');
  const marketVisual = marketHistory.length
    ? renderExchangeDashboard(marketHistory, { title: `${room.scenarioLabel || 'Рынок класса'}: цена, спрос, продажи` })
    : `
      <section class="teacher-market-empty" data-market-state="waiting">
        <svg class="game-ui-icon" aria-hidden="true"><use href="/assets/game-icons.svg#icon-market"></use></svg>
        <div>
          <span class="factory-node-label">Рынок еще не пересчитан</span>
          <strong>Дайте командам пройти первый цикл</strong>
          <p>После завершения хода здесь появятся реальный спрос, средняя цена и объем продаж. До этого график намеренно не строится.</p>
        </div>
      </section>`;
  const teamRows = rows.length
    ? rows.map(row => {
      const status = teacherMarketRowStatus(row);
      return `
        <tr>
          <th scope="row"><strong>${escapeHtml(row.companyName || row.userName || 'Команда')}</strong><small>${escapeHtml(row.userName || '')}</small></th>
          <td>${compactMarketNumber(row.saleQuantity || 0)} ${escapeHtml(productUnit)}</td>
          <td>${compactMarketNumber(row.finishedGoods || 0)} ${escapeHtml(productUnit)}</td>
          <td>${compactMarketNumber(row.soldLastTick || 0)} ${escapeHtml(productUnit)}</td>
          <td>${money(row.lastRevenue || 0)}</td>
          <td><span class="teacher-market-status ${status.tone}">${escapeHtml(status.label)}</span><small>${escapeHtml(status.hint)}</small></td>
        </tr>`;
    }).join('')
    : '<tr><td colspan="6" class="muted">Команды появятся после входа учеников.</td></tr>';

  elements.marketOverview.innerHTML = `
    <section class="teacher-market-command" data-teacher-market="classroom">
      <div class="teacher-market-command-head">
        <div>
          <span class="factory-node-label">Рынок аудитории</span>
          <h3>Спрос, заявки и результат команд</h3>
          <p>Все значения получены из состояния комнаты. Преподаватель наблюдает рынок, но не принимает бизнес-решения за учеников.</p>
        </div>
        <span class="mini-badge ${room.status === 'running' ? 'ok' : 'warn'}">Ход ${room.day || 1}</span>
      </div>
      <div class="teacher-market-kpis">${metricMarkup}</div>
      <div class="teacher-market-analysis">
        ${marketVisual}
        <section class="teacher-market-class-board">
          <div class="teacher-market-section-head">
            <div><span class="factory-node-label">Команды</span><h3>Позиции на рынке</h3></div>
            <span>${rows.length} команд</span>
          </div>
          <div class="teacher-market-table-scroll">
            <table class="teacher-market-team-table">
              <thead><tr><th>Команда</th><th>Заявка</th><th>Склад</th><th>Продано</th><th>Выручка</th><th>Состояние</th></tr></thead>
              <tbody>${teamRows}</tbody>
            </table>
          </div>
        </section>
      </div>
    </section>`;

  const activeEvent = room.activeEvent || null;
  elements.marketEvent.innerHTML = '<div class="teacher-market-support-head"><span>Событие рынка</span></div>' + (activeEvent
    ? `<article class="teacher-market-support active"><span class="mini-badge warn">Активно</span><strong>${escapeHtml(activeEvent.title || activeEvent.label || 'Событие рынка')}</strong><p>${escapeHtml(activeEvent.description || 'Эффект действует на текущий рынок.')}</p><small>До хода ${activeEvent.expiresDay || room.day || 1}</small><button type="button" class="ghost" data-open-crisis-cards>${iconButtonLabel('crisis', 'Открыть карточки кризисов')}</button></article>`
    : `<article class="teacher-market-support"><span class="mini-badge">Нет события</span><strong>Рынок работает по базовым правилам</strong><p>Запустите учебный кризис, когда команды освоят основной производственный цикл.</p><button type="button" class="ghost" data-open-crisis-cards>${iconButtonLabel('crisis', 'Открыть карточки кризисов')}</button></article>`);

  const contracts = room.contractBoard || [];
  elements.contractBoard.innerHTML = '<div class="teacher-market-support-head"><span>Контракты</span></div>' + (contracts.length
    ? contracts.map(contract => {
      const target = Number(contract.targetSales || contract.quantity || 0);
      const progress = Number(contract.progress || 0);
      const status = contract.completed ? 'Выполнен' : contract.assignedPlayerName ? contract.assignedPlayerName : 'Свободен';
      return `<article class="teacher-market-support"><span class="mini-badge ${contract.completed ? 'ok' : contract.assignedPlayerName ? 'warn' : ''}">${escapeHtml(status)}</span><strong>${escapeHtml(contract.title || 'Контракт')}</strong><p>${progress}/${target} ${escapeHtml(productUnit)} · награда ${money(contract.reward || 0)}</p><small>Срок: ход ${contract.expiresDay || '—'}</small></article>`;
    }).join('')
    : '<article class="teacher-market-support"><strong>Контрактов нет</strong><p>Новые предложения появятся по правилам сценария.</p></article>');

  const segments = room.segments || [];
  elements.segmentsOverview.innerHTML = '<div class="teacher-market-support-head"><span>Горячие сегменты</span></div>' + (segments.length
    ? segments.map(segment => {
      const sold = Number(segment.totalSales || 0);
      const segmentDemand = Number(segment.demand || 0);
      const fill = segmentDemand > 0 ? Math.max(0, Math.min(100, Math.round((sold / segmentDemand) * 100))) : 0;
      return `<article class="teacher-market-support"><strong>${escapeHtml([segment.cityLabel, segment.productLabel].filter(Boolean).join(' · ') || 'Сегмент')}</strong><p>${sold}/${segmentDemand} ${escapeHtml(productUnit)} закрыто</p><span class="live-meter" style="--live-meter: ${fill}%"></span><small>Средняя цена: ${money(segment.avgPrice || 0)}</small></article>`;
    }).join('')
    : '<article class="teacher-market-support"><strong>Сегменты еще не рассчитаны</strong><p>Данные появятся после завершения первого общего хода.</p></article>');

  document.querySelectorAll('[data-open-crisis-cards]').forEach(button => {
    button.addEventListener('click', () => setGameTab('teacher'));
  });
}

function renderMarket() {
  const marketPanel = document.querySelector('[data-game-panel="market"]');
  marketPanel?.classList.toggle('market-terminal-panel', isFactoryRoom());
  marketPanel?.classList.toggle('teacher-market-panel', Boolean(state.player?.isTeacherHost));
  if (elements.factoryMarket) {
    elements.factoryMarket.innerHTML = '';
    elements.factoryMarket.classList.toggle('hidden', !isFactoryRoom());
  }
  elements.marketOverview.innerHTML = '';
  elements.marketEvent.innerHTML = '';
  elements.contractBoard.innerHTML = '';
  if (state.player?.isTeacherHost) {
    renderTeacherMarketOverview();
    return;
  }
  if (isFactoryRoom()) {
    const scenario = state.room.factoryScenario;
    const latest = state.room?.market?.[state.room.market.length - 1];
    const chartHistory = marketChartHistory({
      demand: latest?.demand || scenario.baseDemandMax || 1180,
      totalSales: latest?.totalSales || 0,
      avgPrice: latest?.avgPrice || state.player.factory.saleOffer.price || scenario.priceRange?.max || 18450,
    });
    const overviewItems = latest
      ? [
          [t('market_overview_demand'), `${latest.demand} ${t('factory_units')}`],
          [t('market_overview_matched'), `${latest.totalSales} ${t('factory_units')}`],
          [t('market_overview_avg_price'), money(latest.avgPrice)],
          [t('market_overview_stock'), `${state.player.factory.finishedGoods} ${state.player.factory.productUnit}`],
        ]
      : [
          [t('market_overview_demand'), t('market_overview_no_turns')],
          [t('market_overview_matched'), `0 ${t('factory_units')}`],
          [t('market_overview_avg_price'), '—'],
          [t('market_overview_stock'), `${state.player.factory.finishedGoods} ${state.player.factory.productUnit}`],
        ];
    const kpiMarkup = overviewItems.map(([title, value]) => `
      <article class="market-terminal-kpi">
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `).join('');
    const book = scenario.marketBook || [];
    elements.marketOverview.innerHTML = `
      ${renderMarketReplayPanel()}
      <div class="market-chart-column">
          ${renderExchangeDashboard(chartHistory, { title: `${scenario.label}: цена, спрос, объем` })}
          <div class="market-terminal-kpis">${kpiMarkup}</div>
      </div>`;
    elements.marketOverview.querySelector('[data-market-replay-export]')?.addEventListener('click', exportMarketReplayReport);

    const activeSurge = state.room?.activeEvent?.scope === 'factory' ? state.room.activeEvent : null;
    elements.marketEvent.innerHTML = `
      ${activeSurge
        ? `<article class="market-item statistics-surge-card"><div><strong>${escapeHtml(activeSurge.title)}</strong><div class="value">x${Number(activeSurge.demandMultiplier || 1).toFixed(2)} ${t('market_overview_demand').toLowerCase()}</div><small>${escapeHtml(activeSurge.description)} - ${t('expires_day')} ${activeSurge.expiresDay}</small></div></article>`
        : `<article class="market-item"><strong>${t('market_order_book_title')}</strong><div class="value">${escapeHtml(scenario.label)}</div><small>${t('market_order_book_hint')}</small></article>`}`;
    elements.contractBoard.innerHTML = `
      ${renderFactoryTradeDesk(scenario, state.player.factory, book, canUseBusinessActions())}
      <article class="market-item"><strong>${t('market_current_offer_title')}</strong><div class="value">${state.player.factory.saleOffer.quantity} @ ${money(state.player.factory.saleOffer.price)}</div><small>${t('market_current_offer_hint')}</small></article>`;
    bindFactoryMarketSaleControls();
    elements.segmentsOverview.innerHTML = '';
    if (!book.length) {
      elements.segmentsOverview.innerHTML = `<div class="market-item">${t('market_no_orders')}</div>`;
    } else {
      book.forEach(entry => {
        const node = document.createElement('article');
        const fill = Math.max(3, Math.min(100, Math.round(((entry.sold || 0) / Math.max(entry.quantity || 1, 1)) * 100)));
        node.className = 'market-item market-depth-row';
        node.innerHTML = `<div class="factory-book-row"><strong>${escapeHtml(entry.playerName)}</strong><span>${money(entry.price)}</span><span>${entry.quantity} ${t('market_book_qty')}</span><span>${entry.sold} ${t('market_book_sold')}</span><span>${entry.remaining} ${t('market_book_left')}</span></div><span class="market-depth-bar"><i style="width: ${fill}%"></i></span><small>${t('market_book_suitability')} ${entry.suitability}/100</small>`;
        elements.segmentsOverview.appendChild(node);
      });
    }
    return;
  }
  const latest = state.room?.market?.[state.room.market.length - 1];
  if (!latest) {
    elements.marketOverview.innerHTML = renderExchangeDashboard(marketChartHistory(), {
      title: 'Индекс рынка: цена, спрос, продажи',
    });
    elements.marketOverview.insertAdjacentHTML('beforeend', `<div class="market-item">${t('no_market_data')}</div>`);
  } else {
    elements.marketOverview.innerHTML = renderExchangeDashboard(marketChartHistory({
      demand: latest.demand,
      totalSales: latest.totalSales,
      avgPrice: latest.avgPrice,
    }), {
      title: `${localizedScenarioLabel()}: цена, спрос, продажи`,
    });
    [[t('demand'), `${latest.demand} pcs`], [t('avg_price'), money(latest.avgPrice)], [t('sales'), `${latest.totalSales} pcs`], [t('scenario_label'), localizedScenarioLabel()], [t('day_limit_title'), `${state.room.settings.dayLimit}`]].forEach(([title, value]) => {
      const node = document.createElement('article');
      node.className = 'market-item';
      node.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="value">${escapeHtml(value)}</div>`;
      elements.marketOverview.appendChild(node);
    });
  }

  if (state.room?.activeEvent) {
    const event = state.room.activeEvent;
    elements.marketEvent.innerHTML = `<article class="market-item"><strong>${escapeHtml(event.label)}</strong><div class="value">${escapeHtml(event.title)}</div><small>${escapeHtml(event.description)} • ${t('contract_expires')}: ${event.expiresDay}</small></article>`;
  } else {
    elements.marketEvent.innerHTML = `<div class="market-item">${t('no_active_event')}</div>`;
  }

  const contracts = state.room?.contractBoard || [];
  if (!contracts.length) {
    elements.contractBoard.innerHTML = `<div class="market-item">${t('no_contracts')}</div>`;
  } else {
    contracts.forEach(contract => {
      const isAssignedToViewer = contract.assignedPlayerId && contract.assignedPlayerId === state.player?.id;
      const disabled = contract.assignedPlayerId || !canUseBusinessActions() || state.player?.activeContract;
      const node = document.createElement('article');
      node.className = 'market-item';
      const contractSegment = isFactoryRoom()
        ? escapeHtml(contract.productLabel || state.room?.factoryScenario?.productLabel || '')
        : `${escapeHtml(contract.productLabel)} • ${escapeHtml(contract.cityLabel)}`;
      node.innerHTML = `<strong>${escapeHtml(contract.title)}</strong><div class="value">${contractSegment}</div><small>${t('contract_progress')}: ${contract.progress}/${contract.targetSales} • ${t('contract_reward')}: ${rub(contract.reward)} • ${t('contract_expires')}: ${contract.expiresDay}${contract.assignedPlayerName ? ` • ${t('assigned_to')}: ${escapeHtml(contract.assignedPlayerName)}` : ''}</small>${!contract.completed && !contract.assignedPlayerId ? `<div class="top-gap"><button data-contract-id="${escapeHtml(contract.id)}" ${disabled ? 'disabled' : ''}>${t('accept_contract')}</button></div>` : isAssignedToViewer ? `<div class="badge-inline-row top-gap"><span class="mini-badge ok">${t('active_contract')}</span></div>` : ''}`;
      elements.contractBoard.appendChild(node);
    });
    elements.contractBoard.querySelectorAll('[data-contract-id]').forEach(button => button.addEventListener('click', () => sendAction('accept-contract', button.dataset.contractId)));
  }

  elements.segmentsOverview.innerHTML = '';
  const segments = state.room?.segments || [];
  if (!segments.length) {
    elements.segmentsOverview.innerHTML = `<div class="market-item">${t('segment_empty')}</div>`;
    return;
  }
  segments.forEach(segment => {
    const node = document.createElement('article');
    const fill = Math.max(3, Math.min(100, Math.round(((segment.totalSales || 0) / Math.max(segment.demand || 1, 1)) * 100)));
    const segmentLabel = isFactoryRoom()
      ? escapeHtml(segment.productLabel || state.room?.factoryScenario?.productLabel || '')
      : `${escapeHtml(segment.cityLabel)} • ${escapeHtml(segment.productLabel)}`;
    node.className = 'market-item market-depth-row';
    node.innerHTML = `<strong>${segmentLabel}</strong><div class="value">${segment.totalSales} / ${segment.demand}</div><span class="market-depth-bar"><i style="width: ${fill}%"></i></span><small>${t('avg_price')}: ${segment.avgPrice}</small>`;
    elements.segmentsOverview.appendChild(node);
  });
}

function avatarMarkup(player) {
  if (player.avatar) return `<img class="roster-avatar" src="${player.avatar}" alt="avatar" />`;
  return `<div class="roster-avatar-fallback">${escapeHtml((localizedParticipantName(player.userName) || player.name).slice(0, 2).toUpperCase())}</div>`;
}

function renderPlayerList() {
  elements.playerList.innerHTML = '';
  const players = state.room?.players || [];
  if (!players.length) {
    elements.playerList.innerHTML = `<div class="leader">${t('no_players')}</div>`;
    return;
  }
  players.forEach(player => {
    const role = player.isHost ? t('host') : player.isBot ? t('bot') : t('player');
    const readiness = player.bankrupt ? t('bankrupt') : player.ready ? t('ready_yes') : t('ready_no');
    const node = document.createElement('article');
    node.className = 'leader';
    node.innerHTML = `<div class="player-line">${avatarMarkup(player)}<div><strong>${escapeHtml(localizedParticipantName(player.userName))}</strong><small>${escapeHtml(player.name)}</small><div class="badge-inline-row"><span class="mini-badge">${role}</span><span class="mini-badge ${player.ready ? 'ok' : 'warn'}">${readiness}</span></div></div></div><strong>${money(player.money)}</strong>`;
    elements.playerList.appendChild(node);
  });
}

function renderCompetitors() {
  elements.competitorList.innerHTML = '';
  elements.competitorList.classList.remove('personnel-terminal');
  delete elements.competitorList.dataset.personnelContract;
  const players = state.room?.players || [];
  if (!players.length) {
    elements.competitorList.innerHTML = `<div class="leader">${t('no_players')}</div>`;
    return;
  }
  if (isFactoryRoom()) {
    const factory = state.player?.factory || {};
    const workers = factory.workers || [];
    const candidates = (state.room?.factoryScenario?.candidates || []).slice(0, 6);
    const personnelHints = state.player?.personnelHints || {};
    const personnelSummary = personnelHints.summary || {};
    const candidateHints = personnelHints.candidates || [];
    const candidateHintById = new Map(candidateHints.map(item => [item.id, item]));
    const payroll = workers.reduce((sum, worker) => sum + Number(worker.expectedSalary || 0), 0);
    elements.competitorList.classList.add('personnel-terminal');
    elements.competitorList.dataset.personnelContract = 'personnel-terminal-v2';
    elements.competitorList.innerHTML = `
      ${personnelSummary ? `
        <section class="personnel-coach ${escapeHtml(personnelSummary.bottleneck || 'people')}">
          <div>
            <span class="factory-node-label">Совет по персоналу</span>
            <strong>${escapeHtml(personnelSummary.title || 'Кандидатов пока нет')}</strong>
            <small>${escapeHtml(personnelSummary.studentText || '')}</small>
          </div>
          <div class="personnel-coach-stats">
            <span><b>${personnelSummary.currentAssemblyCapacity || 0}</b><small>мощность</small></span>
            <span><b>${personnelSummary.inventoryCapacity || 0}</b><small>склад</small></span>
            <span><b>${personnelSummary.targetWorkers || 0}</b><small>цель людей</small></span>
          </div>
        </section>
      ` : ''}
      <section class="personnel-summary">
        <article class="market-item">
          <strong>Линия</strong>
          <div class="value">${workers.length} / ${Math.max(workers.length, 4)}</div>
          <small>Активные сотрудники на производстве</small>
        </article>
        <article class="market-item">
          <strong>Пригодность</strong>
          <div class="value">${factory.avgSuitability || 0}/100</div>
          <small>Влияет на выпуск и спорные сделки</small>
        </article>
        <article class="market-item">
          <strong>Фонд оплаты</strong>
          <div class="value">${money(payroll)}</div>
          <small>Списывается каждый ход</small>
        </article>
      </section>
      <section class="personnel-board">
        <div class="personnel-section personnel-current-team">
          <div class="factory-node-label">Текущая команда</div>
          <div class="personnel-list">
            ${workers.length ? workers.map(worker => `
              <article class="person-card active">
                <div class="personnel-card-head">
                  <div><span class="factory-node-label">В команде</span><strong>${escapeHtml(worker.name)}</strong></div>
                  <span class="personnel-score"><b>${worker.suitability || 0}</b><small>/100</small></span>
                </div>
                <small class="personnel-card-meta">${escapeHtml(worker.role)} • ${worker.experienceYears} лет • ${money(worker.expectedSalary)} за ход</small>
                <span class="market-depth-bar"><i style="width:${Math.max(8, worker.suitability || 0)}%"></i></span>
              </article>
            `).join('') : `<div class="trade-empty">Команда ещё не нанята.</div>`}
          </div>
        </div>
        <div>
          <div class="factory-node-label">Кандидаты</div>
          <div class="personnel-list">
            ${candidates.map(candidate => {
              const hint = candidateHintById.get(candidate.id);
              const isRecommended = hint?.id === personnelSummary.recommendedCandidateId;
              return `
              <article class="person-card ${isRecommended ? 'recommended' : ''} ${escapeHtml(hint?.status || '')}">
                <div class="personnel-card-head">
                  <div><span class="factory-node-label">${isRecommended ? 'Лучший выбор' : escapeHtml(candidate.role || 'Кандидат')}</span><strong>${escapeHtml(candidate.name)}</strong></div>
                  <span class="personnel-score"><b>${candidate.suitability || 0}</b><small>/100</small></span>
                </div>
                <small class="personnel-card-meta">${escapeHtml(candidate.role)} • ${candidate.experienceYears} лет опыта</small>
                <span class="market-depth-bar"><i style="width:${Math.max(8, candidate.suitability || 0)}%"></i></span>
                <div class="personnel-candidate-metrics">
                  <span><b>${money(candidate.expectedSalary)}</b><small>за ход</small></span>
                  <span><b>${hint?.capacityGain ? `+${hint.capacityGain}` : '0'}</b><small>мощность</small></span>
                  <span><b>${hint?.paybackTurns ? `${hint.paybackTurns} х.` : '—'}</b><small>окупаемость</small></span>
                </div>
                <small class="personnel-reason">${escapeHtml(hint?.reason || candidate.hint || '')}</small>
                <button type="button" data-personnel-hire="${escapeHtml(candidate.id)}" ${canUseBusinessActions() && hint?.affordable !== false ? '' : 'disabled'}>${isRecommended ? 'Нанять рекомендованного' : 'Нанять'}</button>
              </article>`;
            }).join('') || `<div class="trade-empty">Кандидатов пока нет.</div>`}
          </div>
        </div>
      </section>`;
    elements.competitorList.querySelectorAll('[data-personnel-hire]').forEach(button => {
      button.addEventListener('click', () => sendAction('hire-worker', button.dataset.personnelHire));
    });
    return;
  }
  players.forEach(player => {
    const node = document.createElement('article');
    node.className = 'leader';
    node.innerHTML = `<div class="player-line">${avatarMarkup(player)}<div><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml([localizedParticipantName(player.userName), productMarketLine(player)].filter(Boolean).join(' • '))}</small><div class="badge-inline-row"><span class="mini-badge">${escapeHtml(player.specializationLabel)}</span><span class="mini-badge">${player.totalSalesSeason || 0} продано</span></div></div></div><strong>${money(player.price)}</strong>`;
    elements.competitorList.appendChild(node);
  });
}

function renderLeaderboardList(container) {
  container.innerHTML = '';
  const players = state.room?.leaderboard || [];
  if (!players.length) {
    container.innerHTML = `<div class="leader">${t('empty_leaderboard')}</div>`;
    return;
  }
  players.forEach((player, index) => {
    const score = Number(player?.simulationScore?.total || 0);
    const node = document.createElement('article');
    node.className = 'leader leaderboard-row';
    node.innerHTML = `
      <div class="player-line leaderboard-player">
        ${avatarMarkup(player)}
        <div class="personnel-section personnel-candidates">
          <strong>#${index + 1} ${escapeHtml(player.name)}</strong>
          <small>${escapeHtml([localizedParticipantName(player.userName), productMarketLine(player)].filter(Boolean).join(' • '))}</small>
        </div>
      </div>
      <div class="leaderboard-metrics">
        <span class="leaderboard-metric">
          <small>${escapeHtml(t('score_label') || 'Очки')}</small>
          <strong>${escapeHtml(score)}</strong>
        </span>
        <span class="leaderboard-metric">
          <small>${escapeHtml(t('networth') || 'Капитал')}</small>
          <strong>${escapeHtml(money(player.netWorth))}</strong>
        </span>
      </div>`;
    container.appendChild(node);
  });
}

function renderLeaderboard() {
  renderLeaderboardList(elements.leaderboard);
  renderLeaderboardList(elements.leaderboardGame);
  renderLeaderboardList(elements.leaderboardResults);
}

function formatRoomLogEntry(entry) {
  const raw = String(entry || '').trim();
  const dayMatch = raw.match(/^\[Day\s+(\d+)\]\s*/i);
  const day = Number(dayMatch?.[1] || state.room?.day || 1);
  let message = raw.replace(/^\[Day\s+\d+\]\s*/i, '').trim();
  const translations = [
    [/^Room created\. Invite players and start the match when everyone is ready\.$/i, () => 'Комната создана. Пригласите учеников, дождитесь готовности и запустите матч.'],
    [/^(.+?) joined the room with company (.+)\.$/i, match => `${match[1]}: вход в комнату, команда «${match[2]}».`],
    [/^(.+?) created room (.+?) for company (.+)\.$/i, match => `${match[1]}: создана комната «${match[2]}» для команды «${match[3]}».`],
    [/^(.+?) готов к матчу\.$/i, match => `${match[1]}: готовность к матчу подтверждена.`],
    [/^(.+?) снял готовность\.$/i, match => `${match[1]}: готовность к матчу отменена.`],
    [/^(.+?) reconnected to the room\.$/i, match => `${match[1]} восстановил подключение.`],
    [/^(.+?) left the room\.$/i, match => `${match[1]} вышел из комнаты.`],
    [/^(.+?) is now the host\.$/i, match => `${match[1]} теперь управляет комнатой.`],
    [/^(.+?) auto-resolved strategic round (.+?) with (.+)\.$/i, match => `${match[1]}: безопасный выбор в дилемме «${localizedDecisionRoundLabel(match[2])}» — «${localizedDecisionOptionLabel(match[3])}».`],
    [/^(.+?) resolved strategic round (.+?) with (.+)\.$/i, match => `${match[1]} принял решение в дилемме «${localizedDecisionRoundLabel(match[2])}» — «${localizedDecisionOptionLabel(match[3])}».`],
    [/^(.+?) forced a strategic round for demo: (.+)\.$/i, match => `${match[1]} запустил учебную дилемму «${localizedDecisionRoundLabel(match[2])}».`],
    [/^(.+?) forced strategic round (.+?) for (.+)\.$/i, match => `${match[1]} запустил для ${match[3]} дилемму «${localizedDecisionRoundLabel(match[2])}».`],
    [/^(.+?) received strategic round (.+)\.$/i, match => `${match[1]} получил дилемму «${localizedDecisionRoundLabel(match[2])}».`],
    [/^(.+?) started research (.+)\.$/i, match => `${match[1]} начал исследование «${match[2]}».`],
    [/^(.+?) bought (\d+) (.+?) for (.+)\.$/i, match => `${match[1]} закупил ${match[2]} ${match[3]} за ${match[4]}.`],
    [/^(.+?) hired (.+?) as (.+)\.$/i, match => `${match[1]} нанял ${match[2]} на роль «${match[3]}».`],
    [/^(.+?) assembled (\d+) (.+)\.$/i, match => `${match[1]} собрал ${match[2]} ${String(match[3]).replace(/\.+$/, '')}.`],
    [/^(.+?) listed (\d+) (.+?) at (.+)\.$/i, match => `${match[1]} выставил заявку: ${match[2]} ${match[3]} по цене ${match[4]}.`],
    [/^(.+?) cleared the sell order and held inventory\.$/i, match => `${match[1]} снял заявку и оставил товар на складе.`],
    [/^(.+?) improved product quality\.$/i, match => `${match[1]} повысил качество продукта.`],
    [/^(.+?) introduced automation\.$/i, match => `${match[1]} внедрил автоматизацию.`],
    [/^(.+?) boosted marketing\.$/i, match => `${match[1]} усилил маркетинг.`],
    [/^(.+?) joined as an AI competitor\.$/i, match => `${match[1]} присоединился как ИИ-конкурент.`],
    [/^Market event started: (.+)\.$/i, match => `Запущено рыночное событие: ${match[1]}.`],
    [/^Factory market event started: (.+)\.$/i, match => `Запущена карточка кризиса: ${match[1]}.`],
    [/^(.+?) accepted contract (.+)\.$/i, match => `${match[1]} принял контракт «${match[2]}».`],
    [/^(.+?) completed contract (.+?) and earned (.+)\.$/i, match => `${match[1]} выполнил контракт «${match[2]}» и получил ${match[3]}.`],
    [/^(.+?) lost contract (.+)\.$/i, match => `${match[1]} не выполнил контракт «${match[2]}».`],
    [/^(.+?) completed research (.+)\.$/i, match => `${match[1]} завершил исследование «${match[2]}».`],
    [/^(.+?) completed the season goal (.+)\.$/i, match => `${match[1]} выполнил сезонную цель «${match[2]}».`],
    [/^(.+?) went bankrupt and left the order book\.$/i, match => `${match[1]} обанкротился и выбыл из книги заявок.`],
    [/^(.+?) left the match due to bankruptcy\.$/i, match => `${match[1]} выбыл из матча из-за банкротства.`],
    [/^Match reset\. Update your strategy and start again\.$/i, () => 'Матч сброшен. Обновите стратегию и запустите его снова.'],
    [/^(.+?) изменил скорость матча на (slow|normal|fast)\.$/i, match => `${match[1]} изменил скорость матча: ${t(`speed_${match[2]}`)}.`],
    [/^Pause request from (.+?) expired\. The match resumed automatically\.$/i, match => `Запрос паузы от ${match[1]} истек. Матч продолжен автоматически.`],
    [/^(.+?) requested a pause\. The teacher has 30 seconds to accept it\.$/i, match => `${match[1]} запросил паузу. У преподавателя есть 30 секунд на решение.`],
    [/^(.+?) accepted the pause request from (.+)\.$/i, match => `${match[1]} принял запрос паузы от ${match[2]}.`],
  ];
  for (const [pattern, translate] of translations) {
    const match = message.match(pattern);
    if (match) {
      message = translate(match);
      break;
    }
  }
  const probe = `${raw} ${message}`.toLowerCase();
  const category = /event|событ|кризис/.test(probe)
    ? 'crisis'
    : /strategic|стратег|дилемм|решени/.test(probe)
      ? 'strategy'
      : /pause|пауз/.test(probe)
        ? 'pause'
        : /помощ|help/.test(probe)
          ? 'support'
          : /bought|закуп|hired|нанял|assembled|собрал|listed|sell order|заявк|contract|контракт|research|исследован|продал|выруч/.test(probe)
            ? 'economy'
            : 'room';
  const tone = /банкрот|bankrupt|lost contract|не выполнил|ошиб|истек/.test(probe)
    ? 'danger'
    : /готов|запуст|создал|joined|вошел|completed|resolved|выполнил|выиграл|решение прин/.test(probe)
      ? 'positive'
      : /pause|пауз|request|запрос|event|событ|кризис/.test(probe)
        ? 'warning'
        : '';
  const categoryLabel = { crisis: 'Кризис', strategy: 'Решение', pause: 'Пауза', support: 'Помощь', economy: 'Экономика', room: 'Комната' }[category];
  return { day, message: message || 'Событие без описания', category, categoryLabel, tone };
}

function renderLog() {
  elements.eventLog.innerHTML = '';
  elements.eventLogGame.innerHTML = '';
  elements.eventLogResults.innerHTML = '';
  const entries = state.room?.log || [];
  if (!entries.length) {
    const empty = document.createElement('article');
    empty.className = 'log-item report-event-row';
    empty.innerHTML = `<strong>Журнал пуст</strong><small>События появятся после старта матча.</small>`;
    elements.eventLog.appendChild(empty);
    elements.eventLogGame.appendChild(empty.cloneNode(true));
    elements.eventLogResults.appendChild(empty.cloneNode(true));
    return;
  }
  entries.forEach((entry, index) => {
    const formatted = formatRoomLogEntry(entry);
    const node = document.createElement('article');
    node.className = `log-item report-event-row ${formatted.tone}`;
    node.dataset.eventCategory = formatted.category;
    node.innerHTML = `<span class="event-log-index">${entries.length - index}</span><div class="event-log-copy"><strong>${escapeHtml(formatted.message)}</strong><small><span class="event-log-kind">${escapeHtml(formatted.categoryLabel)}</span>${t('day')} ${formatted.day} • ${t('factory_turn')} ${state.room?.tick || 0}</small></div>`;
    elements.eventLog.appendChild(node);
    elements.eventLogGame.appendChild(node.cloneNode(true));
    elements.eventLogResults.appendChild(node.cloneNode(true));
  });
}

function renderGameHud() {
  elements.gameHud.innerHTML = '';
  if (!state.room || !state.player) {
    elements.gameHud.innerHTML = `<div class="market-item">${t('company_placeholder')}</div>`;
    return;
  }
  const statusKey = state.room.status === 'running' ? 'room_status_running' : state.room.status === 'paused' ? 'room_status_paused' : state.room.status === 'finished' ? 'room_status_finished' : 'room_status_lobby';
  [
    [t('connected_room'), state.room.name, `${t('room_code_label')}: ${state.room.code}`],
    [t('day'), `${state.room.day}`, `${t(statusKey)} • ${localizedScenarioLabel()}`],
    [t('turn_mode_title') || 'Turn mode', isManualTurnRoom() ? (t('turn_mode_manual') || 'Manual turns') : state.room.tickSpeedPreset, isManualTurnRoom() ? (t('turn_mode_manual_hint') || 'Host resolves one turn at a time.') : (t('turn_mode_auto_hint') || 'Match advances automatically.')],
    [t('balance'), money(state.player.money), t('live_cash')],
    [t('networth'), money(state.player.netWorth), productMarketLine(state.player)],
    [t('specialization_title'), state.player.specializationLabel, `${t('research_points')}: ${state.player.researchPoints}`],
    [t('research_status'), state.player.research.activeLabel || t('research_completed'), state.player.research.activeLabel ? `${state.player.research.progress}/${state.player.research.target}` : `${state.player.research.completed.length}`],
    [t('event_title'), state.room.activeEvent ? state.room.activeEvent.label : t('no_active_event'), state.room.activeEvent ? `${t('contract_expires')}: ${state.room.activeEvent.expiresDay}` : localizedScenarioLabel()],
    [t('season_goal'), state.player.seasonGoal ? state.player.seasonGoal.label : '—', state.player.seasonGoal ? `${state.player.seasonGoal.progress}/${state.player.seasonGoal.target}` : '—'],
  ].forEach(([title, value, hint]) => {
    const node = document.createElement('article');
    node.className = 'market-item';
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="value">${escapeHtml(value)}</div><small>${escapeHtml(hint)}</small>`;
    elements.gameHud.appendChild(node);
  });
}

function renderTurnControlDock() {
  if (!elements.turnControlDock) return;

  const visible = state.currentScreen === 'game-screen'
    && isConnected()
    && state.player?.isHost
    && isManualTurnRoom()
    && !gameIsFinished();

  if (!visible) {
    elements.turnControlDock.classList.add('hidden');
    elements.turnControlDock.innerHTML = '';
    renderTutorialOverlay();
    return;
  }

  const primaryAction = state.room.status === 'paused' ? 'resume-game' : 'next-turn';
  const primaryLabel = state.room.status === 'paused' ? t('continue_planning') : t('next_turn');
  const detail = isFactoryRoom()
    ? `${t('stock')} ${state.player.factory.finishedGoods} • ${t('factory_current_offer')}: ${state.player.factory.saleOffer.quantity} @ ${money(state.player.factory.saleOffer.price)}`
    : `${productMarketLine(state.player)} • ${t('factory_cash')}: ${money(state.player.money)}`;

  elements.turnControlDock.classList.remove('hidden');
  elements.turnControlDock.innerHTML = `
    <div class="turn-control-meta">
      <div>
        <strong>${t('turn_control_title') || 'Turn control'}</strong>
        <p>${t('turn_control_hint') || 'Manual resolution mode. Queue actions in the active departments, then advance exactly one turn.'}</p>
      </div>
      <span class="mini-badge">${t('day')} ${state.room.day} • ${t('ticks_label')} ${state.room.tick}</span>
    </div>
    <p>${detail}</p>
    ${renderTurnChecklist(state.player.turnChecklist || [], { compact: true })}
    <div class="button-pair">
      <button type="button" data-turn-action="${primaryAction}">${primaryLabel}</button>
      ${state.room.status === 'running' ? `<button type="button" class="ghost" data-turn-action="pause-game">${t('pause_game')}</button>` : ''}
    </div>`;

  bindTurnChecklist(elements.turnControlDock);
  elements.turnControlDock.querySelectorAll('[data-turn-action]').forEach(button => button.addEventListener('click', event => {
    sendAction(event.currentTarget.dataset.turnAction);
  }));
  renderTutorialOverlay();
}

function resultResearchCount(player) {
  const completed = player?.research?.completed;
  if (Array.isArray(completed)) return completed.length;
  if (completed && typeof completed === 'object') return Object.keys(completed).length;
  return 0;
}

function resultNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function buildSimulationScoreBreakdown(player) {
  const components = player?.simulationScore?.components || {};
  const rows = [
    { key: 'financial', value: resultNumber(components.financial) },
    { key: 'liquidity', value: resultNumber(components.liquidity) },
    { key: 'contracts', value: resultNumber(components.contracts) },
    { key: 'innovation', value: resultNumber(components.innovation) },
    { key: 'execution', value: resultNumber(components.execution) },
    { key: 'discipline', value: resultNumber(components.discipline) },
    { key: 'debtPenalty', value: -Math.abs(resultNumber(components.debtPenalty)) },
  ];
  return {
    rows,
    total: resultNumber(player?.simulationScore?.total),
  };
}

function formatSignedScore(value) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function renderSimulationScoreBreakdownItems(player) {
  const breakdown = buildSimulationScoreBreakdown(player);
  const items = breakdown.rows.map(row => {
    const tone = row.value > 0 ? 'positive' : row.value < 0 ? 'negative' : '';
    return `<li><span>${t(`score_component_${row.key}`)}</span><strong class="${tone}">${formatSignedScore(row.value)}</strong></li>`;
  });
  items.push(`<li class="score-total-row"><span>${t('score_component_total')}</span><strong>${breakdown.total}</strong></li>`);
  return items.join('');
}

function resultDebtRisk(player) {
  const debt = resultNumber(player?.debt);
  if (debt <= 0) return 'low';
  const netWorth = Math.max(Math.abs(resultNumber(player?.netWorth)), 1);
  const cash = Math.max(Math.abs(resultNumber(player?.money)), 1);
  const pressureBase = Math.max(netWorth, cash);
  if (debt >= 50000 || debt / pressureBase >= 0.35) return 'high';
  if (debt >= 10000 || debt / pressureBase >= 0.12) return 'medium';
  return 'low';
}

function resultLearningKey({ completedContracts, completedResearch, riskLevel, viewer }) {
  if (completedContracts > 0) return 'results_learning_contracts';
  if (completedResearch > 0) return 'results_learning_research';
  if (riskLevel === 'high') return 'results_learning_debt';
  if (viewer?.factory) return 'results_learning_factory';
  return 'results_learning_balance';
}

function buildDefenseConclusion({ viewer, summary }) {
  if (!viewer) return 'Игрок не выбран. Для защиты запустите демо-матч и завершите сезон.';
  const sold = resultNumber(viewer.totalSalesSeason);
  const profit = resultNumber(viewer.lastTickBreakdown?.profit);
  if (summary.viewerRank === 1) return 'Главный вывод: команда победила за счет стабильного производственного цикла и дисциплины в цене.';
  if (sold <= 0) return 'Главный вывод: без заявки и продаж производство не превращается в прибыль. Следующий фокус - маркетинг и книга заявок.';
  if (profit < 0) return 'Главный вывод: продажи были, но расходы съели выручку. Нужно контролировать закупку, зарплаты и цену.';
  if (summary.riskLevel === 'high') return 'Главный вывод: результат упирается в долговую нагрузку. Рост надо ограничивать ликвидностью.';
  return 'Главный вывод: команда заработала, но до лидера нужно чаще закрывать полный цикл: закупка, сборка, продажа, разбор.';
}

function buildResultsSummary() {
  const room = state.room;
  const players = room?.players || [];
  const leaderboard = room?.leaderboard || [];
  const winner = players.find(player => player.id === room?.winnerPlayerId) || leaderboard[0] || null;
  const viewer = state.player
    || players.find(player => player.id === state.player?.id)
    || leaderboard.find(player => player.id === state.player?.id)
    || null;
  const viewerRankIndex = viewer ? leaderboard.findIndex(player => player.id === viewer.id) : -1;
  const completedContracts = resultNumber(viewer?.completedContracts);
  const completedResearch = resultResearchCount(viewer);
  const riskLevel = resultDebtRisk(viewer);
  const learningKey = resultLearningKey({ completedContracts, completedResearch, riskLevel, viewer });
  const totalSalesSeason = resultNumber(viewer?.totalSalesSeason);
  const lastProfit = resultNumber(viewer?.lastTickBreakdown?.profit);

  const summary = {
    room,
    players,
    leaderboard,
    topThree: leaderboard.slice(0, 3),
    winner,
    viewer,
    viewerRank: viewerRankIndex >= 0 ? viewerRankIndex + 1 : 0,
    completedContracts,
    completedResearch,
    riskLevel,
    riskLabel: t(`results_risk_${riskLevel}`),
    learningKey,
    learningText: t(learningKey),
    totalSalesSeason,
    lastProfit,
    cash: resultNumber(viewer?.money),
    debt: resultNumber(viewer?.debt),
    netWorth: resultNumber(viewer?.netWorth),
    simulationScore: resultNumber(viewer?.simulationScore?.total),
    comparisonToLeader: viewer?.comparisonToLeader || null,
    turnReview: viewer?.turnReview || null,
    playerDebrief: viewer?.playerDebrief || null,
    classDebrief: room?.classDebrief || null,
    marketReplay: buildMarketReplaySummary(),
  };
  summary.defenseConclusion = buildDefenseConclusion({ viewer, summary });
  return summary;
}

function finishReasonLabel(reason) {
  const labels = {
    turn_limit: 'Игра завершилась логически: сыграны все 30 ходов.',
    last_company_standing: 'Игра завершилась досрочно: осталась одна активная компания.',
    no_active_players: 'Игра завершилась: активных компаний не осталось.',
    teacher_stopped: 'Матч завершён преподавателем: итоги зафиксированы для разбора.',
    completed: 'Матч завершён преподавателем или системой.',
  };
  return labels[reason] || 'Матч завершён.';
}

function renderPlayerDebriefCard(playerDebrief) {
  if (!playerDebrief) return '';
  return `
    <article class="market-item results-wide player-debrief-card ${escapeHtml(playerDebrief.outcome || '')}" data-student-debrief-contract="student-debrief-v2">
      <div class="player-debrief-head">
        <div>
          <span class="factory-node-label">Итоги команды</span>
          <strong>${escapeHtml(playerDebrief.title || 'Личный разбор')}</strong>
        </div>
        <span class="mini-badge">Разбор решения</span>
      </div>
      <p class="player-debrief-summary">${escapeHtml(playerDebrief.summary || '')}</p>
      <div class="debrief-metrics">
        ${(playerDebrief.metrics || []).slice(0, 5).map(item => `
          <span class="${escapeHtml(item.tone || '')}">
            <b>${escapeHtml(String(item.displayValue ?? item.value ?? ''))}</b>
            <small>${escapeHtml(item.label || '')}</small>
          </span>
        `).join('')}
      </div>
      <ul class="results-list">
        <li><span>Сильная сторона</span><strong>${escapeHtml(playerDebrief.mainStrength || '')}</strong></li>
        <li><span>Что ограничило результат</span><strong>${escapeHtml(playerDebrief.mainWeakness || '')}</strong></li>
        ${(playerDebrief.actionItems || []).slice(0, 3).map(item => `<li><span>${escapeHtml(item.label || '')}</span><strong>${escapeHtml(item.text || '')}</strong></li>`).join('')}
      </ul>
      <div class="player-debrief-focus">
        <span>Фокус следующего матча</span>
        <strong>${escapeHtml(playerDebrief.nextMatchFocus || '')}</strong>
      </div>
    </article>
  `;
}

function renderResultsMarketReplayCard(replay) {
  if (!replay) return '';
  const latest = replay.latest || null;
  const hints = replay.marketHints || [];
  return `
    <article class="market-item results-wide results-market-replay-card">
      <div class="market-replay-head">
        <div>
          <span class="factory-node-label">Replay рынка</span>
          <strong>${escapeHtml(replay.turnReview?.title || 'Разбор последнего рыночного хода')}</strong>
          <small>${escapeHtml(replay.turnReview?.nextBestAction || replay.turnReview?.summary || 'Короткая основа для отчета: что выставили, что купил рынок и что менять дальше.')}</small>
        </div>
      </div>
      <div class="market-replay-metrics">
        ${renderMarketReplayMetric({ icon: 'market', value: latest ? latest.demand || 0 : 0, label: 'спрос' })}
        ${renderMarketReplayMetric({ icon: 'ship', value: latest ? latest.totalSales || 0 : 0, label: 'продано рынком' })}
        ${renderMarketReplayMetric({ icon: 'cash', value: latest ? money(latest.avgPrice || 0) : '—', label: 'средняя цена' })}
        ${renderMarketReplayMetric({ icon: 'goal', value: `${replay.offer?.quantity || 0} @ ${money(replay.offer?.price || 0)}`, label: 'моя заявка' })}
        ${renderMarketReplayMetric({ icon: 'warehouse', value: `${replay.stock || 0} ${replay.productUnit || 'ед.'}`, label: 'готовый склад' })}
        ${renderMarketReplayMetric({ icon: Number(replay.lastProfit || 0) >= 0 ? 'check' : 'alert', value: money(replay.lastProfit || 0), label: 'прибыль хода', tone: Number(replay.lastProfit || 0) >= 0 ? 'ok' : 'danger' })}
      </div>
      ${hints.length ? renderMarketHints(hints.slice(0, 2), { compact: true }) : ''}
    </article>`;
}

function classroomResultsPlayers(summary) {
  const rankedPlayers = (summary?.leaderboard || []).filter(player => !player.isTeacherHost);
  if (rankedPlayers.length) return rankedPlayers;
  return (summary?.players || []).filter(player => !player.isTeacherHost);
}

function teacherResultStatus(player) {
  if (player?.bankrupt) return { label: 'Банкротство', tone: 'danger' };
  const profit = resultNumber(player?.lastTickBreakdown?.profit);
  const sales = resultNumber(player?.totalSalesSeason);
  if (sales <= 0) return { label: 'Без продаж', tone: 'warning' };
  if (profit < 0) return { label: 'Минусовой ход', tone: 'warning' };
  return { label: 'Устойчиво', tone: 'positive' };
}

function renderTeacherResultsMarketReplayCard(summary) {
  const replay = summary?.marketReplay || {};
  const latest = replay.latest || null;
  const demand = resultNumber(latest?.demand);
  const totalSales = resultNumber(latest?.totalSales);
  const unmatchedDemand = Math.max(0, resultNumber(latest?.unmatchedDemand ?? demand - totalSales));
  const sellThrough = demand > 0 ? Math.round((totalSales / demand) * 100) : 0;
  const marketBook = replay.marketBook || [];
  const topSeller = [...marketBook]
    .filter(entry => resultNumber(entry.sold) > 0)
    .sort((left, right) => resultNumber(right.sold) - resultNumber(left.sold))[0] || null;

  return `
    <article class="market-item results-wide teacher-results-market">
      <div class="teacher-results-section-head">
        <div>
          <span class="factory-node-label">Replay рынка</span>
          <strong>Как рынок закрыл последний ход</strong>
          <small>${latest ? `Спрос, исполнение заявок и остаток спроса за ход ${state.room?.day || '-'}.` : 'Рыночные данные появятся после первого завершённого хода.'}</small>
        </div>
        ${topSeller ? `<span class="teacher-results-highlight">Лидер продаж: ${escapeHtml(topSeller.playerName || 'Команда')} • ${resultNumber(topSeller.sold)} ед.</span>` : ''}
      </div>
      <div class="teacher-results-kpis compact">
        <article><span>Спрос</span><strong>${demand || '—'}</strong><small>единиц на рынке</small></article>
        <article><span>Продано</span><strong>${totalSales}</strong><small>${sellThrough}% спроса</small></article>
        <article><span>Средняя цена</span><strong>${latest ? money(latest.avgPrice || 0) : '—'}</strong><small>по исполненным заявкам</small></article>
        <article><span>Не закрыто</span><strong>${unmatchedDemand}</strong><small>единиц спроса</small></article>
      </div>
      ${marketBook.length ? `
        <div class="teacher-results-table-wrap">
          <table class="teacher-results-table teacher-results-market-table">
            <thead><tr><th>Команда</th><th>Цена</th><th>Заявка</th><th>Продано</th><th>Остаток</th></tr></thead>
            <tbody>
              ${marketBook.map(entry => `
                <tr>
                  <td data-label="Команда"><strong>${escapeHtml(entry.playerName || 'Команда')}</strong></td>
                  <td data-label="Цена">${money(entry.price || 0)}</td>
                  <td data-label="Заявка">${resultNumber(entry.quantity)}</td>
                  <td data-label="Продано" class="positive">${resultNumber(entry.sold)}</td>
                  <td data-label="Остаток">${resultNumber(entry.remaining)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<div class="teacher-results-empty">Команды не выставили заявки в последнем ходе.</div>'}
    </article>`;
}

function renderTeacherResultsOverview(summary, classroomReportPack) {
  const teams = classroomResultsPlayers(summary);
  const winner = summary.winner;
  const averageScore = teams.length
    ? Math.round(teams.reduce((sum, player) => sum + resultNumber(player.simulationScore?.total), 0) / teams.length)
    : 0;
  const totalSales = teams.reduce((sum, player) => sum + resultNumber(player.totalSalesSeason), 0);
  const profitableTeams = teams.filter(player => resultNumber(player.lastTickBreakdown?.profit) >= 0).length;
  const riskTeams = teams.filter(player => player.bankrupt || resultDebtRisk(player) === 'high').length;

  return `
    <article class="market-item results-wide teacher-results-hero" data-teacher-results-contract="classroom-results-v2" data-teacher-debrief-contract="class-debrief-v1">
      <div>
        <span class="factory-node-label">Итоги занятия</span>
        <strong>${escapeHtml(state.room?.name || 'Завершённый матч')}</strong>
        <small>${escapeHtml(finishReasonLabel(state.room?.finishReason))}</small>
      </div>
      <div class="teacher-results-winner">
        <span>Победитель</span>
        <strong>${winner ? escapeHtml(winner.name) : 'Не определён'}</strong>
        <small>${winner ? `${escapeHtml(winner.userName)} • ${resultNumber(winner.simulationScore?.total)} очков • ${money(winner.netWorth)}` : 'Недостаточно данных для рейтинга'}</small>
      </div>
    </article>
    <section class="teacher-results-kpis results-wide" aria-label="Итоги класса">
      <article><span>Команды</span><strong>${teams.length}</strong><small>завершили занятие</small></article>
      <article><span>Средний балл</span><strong>${averageScore}</strong><small>simulation score</small></article>
      <article><span>Продано</span><strong>${totalSales}</strong><small>единиц за матч</small></article>
      <article class="${riskTeams ? 'warning' : 'positive'}"><span>Плюсовой ход</span><strong>${profitableTeams}/${teams.length || 0}</strong><small>высокий риск: ${riskTeams}</small></article>
    </section>
    ${renderClassroomReportPack(classroomReportPack)}
    ${renderTeacherResultsMarketReplayCard(summary)}
    <article class="market-item results-wide teacher-results-leaderboard">
      <div class="teacher-results-section-head">
        <div>
          <span class="factory-node-label">Рейтинг класса</span>
          <strong>Результаты всех команд</strong>
          <small>Очки, капитал и выполнение полного производственного цикла.</small>
        </div>
        <span class="teacher-results-highlight">${teams.length} из ${state.room?.settings?.maxPlayers || teams.length} мест</span>
      </div>
      <div class="teacher-results-table-wrap">
        <table class="teacher-results-table">
          <thead><tr><th>#</th><th>Команда</th><th>Капитал</th><th>Продано</th><th>Прибыль хода</th><th>Очки</th><th>Статус</th></tr></thead>
          <tbody>
            ${teams.map((player, index) => {
              const status = teacherResultStatus(player);
              return `
                <tr>
                  <td data-label="Место"><strong>#${index + 1}</strong></td>
                  <td data-label="Команда"><strong>${escapeHtml(player.name || 'Команда')}</strong><small>${escapeHtml(player.userName || '')}</small></td>
                  <td data-label="Капитал">${money(player.netWorth || 0)}</td>
                  <td data-label="Продано">${resultNumber(player.totalSalesSeason)}</td>
                  <td data-label="Прибыль" class="${resultNumber(player.lastTickBreakdown?.profit) >= 0 ? 'positive' : 'negative'}">${money(player.lastTickBreakdown?.profit || 0)}</td>
                  <td data-label="Очки"><strong>${resultNumber(player.simulationScore?.total)}</strong></td>
                  <td data-label="Статус"><span class="teacher-results-status ${status.tone}">${status.label}</span></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </article>`;
}

function buildClassroomReportPack(summary) {
  const debrief = summary.classDebrief || {};
  const replay = summary.marketReplay || {};
  const winner = summary.winner || null;
  const teams = classroomResultsPlayers(summary);
  const averageScore = teams.length
    ? Math.round(teams.reduce((sum, player) => sum + resultNumber(player.simulationScore?.total), 0) / teams.length)
    : 0;
  const totalSales = teams.reduce((sum, player) => sum + resultNumber(player.totalSalesSeason), 0);
  const riskTeams = teams.filter(player => player.bankrupt || resultDebtRisk(player) === 'high').length;
  const marketFocus = replay.turnReview?.nextBestAction
    || replay.turnReview?.summary
    || 'Обсудите, как цена, запас и заявка повлияли на продажи.';
  const discussionPrompts = (debrief.discussionPrompts || []).length
    ? debrief.discussionPrompts
    : [
      'Какая команда лучше всего связала закупку, сборку и цену?',
      'Где рынок наказал завышенную цену или слабый запас?',
      'Что изменили бы команды в первом ходе следующего матча?',
    ];
  const commonIssues = (debrief.commonIssues || []).slice(0, 3).map(issue => ({
    label: issue.label || 'Зона внимания',
    count: issue.count || 0,
    recommendation: issue.recommendation || 'Разберите с классом на примере команды.',
  }));
  const nextLessonFocus = debrief.nextLessonFocus
    || 'Повторить первый цикл: купить ресурсы, нанять сотрудников, собрать продукт, выставить заявку.';

  return {
    title: 'Пакет отчета преподавателя',
    summary: debrief.summary || `Матч завершен. Победитель: ${winner ? winner.name : 'не определен'}.`,
    winnerReason: debrief.winnerReason || (winner ? `${winner.userName} лидирует по итоговым очкам и капиталу.` : 'Победитель не определен.'),
    marketFocus,
    discussionPrompts: discussionPrompts.slice(0, 4),
    commonIssues,
    nextLessonFocus,
    evidence: [
      { key: 'leaderboard', label: 'Команды', value: `${teams.length} завершили матч`, icon: 'reports' },
      { key: 'score', label: 'Средний балл', value: String(averageScore), icon: 'goal' },
      { key: 'market', label: 'Продажи класса', value: `${totalSales} ед.`, icon: 'market' },
      { key: 'risk', label: 'Высокий риск', value: `${riskTeams} команд`, icon: riskTeams ? 'alert' : 'check' },
    ],
    teacherActions: [
      'Показать топ-3 и объяснить, за счет чего сформировался результат.',
      'Открыть Replay рынка и разобрать спрос, цену, продажи и остаток.',
      'Задать классу вопросы из блока обсуждения.',
      'Экспортировать JSON-отчет как доказательство занятия.',
    ],
  };
}

function renderClassroomReportPack(pack) {
  if (!pack) return '';
  return `
    <article class="market-item results-wide classroom-report-pack">
      <div class="classroom-report-head">
        <div>
          <span class="factory-node-label">Отчет занятия</span>
          <strong>${escapeHtml(pack.title || 'Пакет отчета преподавателя')}</strong>
          <small>${escapeHtml(pack.summary || '')}</small>
        </div>
        <button type="button" class="ghost" data-results-export-inline>${iconButtonLabel('reports', 'Экспорт JSON', 'market-action-icon')}</button>
      </div>
      <div class="classroom-report-evidence">
        ${(pack.evidence || []).map(item => `
          <span>
            <i>${gameIcon(item.icon || 'info')}</i>
            <b>${escapeHtml(item.value || '-')}</b>
            <small>${escapeHtml(item.label || '')}</small>
          </span>
        `).join('')}
      </div>
      <div class="classroom-report-body">
        <section>
          <strong>Что обсудить с классом</strong>
          <div class="teacher-prompts">
            ${(pack.discussionPrompts || []).slice(0, 4).map(prompt => `<span>${escapeHtml(prompt)}</span>`).join('')}
          </div>
        </section>
        <section>
          <strong>План разбора</strong>
          <ol class="classroom-report-actions">
            ${(pack.teacherActions || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ol>
        </section>
      </div>
      <div class="classroom-report-focus">
        <article>
          <span>Главная зона роста</span>
          <strong>${(pack.commonIssues || []).length
            ? pack.commonIssues.map(issue => `${escapeHtml(issue.label)}: ${resultNumber(issue.count)}`).join(' • ')
            : 'Критических ошибок не зафиксировано'}</strong>
        </article>
        <article>
          <span>Фокус следующего занятия</span>
          <strong>${escapeHtml(pack.nextLessonFocus || '')}</strong>
          <small>${escapeHtml(pack.marketFocus || '')}</small>
        </article>
      </div>
    </article>`;
}

function renderResultsOverview() {
  elements.resultsOverview.innerHTML = '';
  elements.resultsOverview.classList.remove('placeholder');
  elements.resultsOverview.classList.add('results-grid');
  elements.resultsOverview.classList.remove('teacher-results-grid');
  if (!state.room) {
    elements.resultsOverview.classList.add('placeholder');
    elements.resultsOverview.classList.remove('results-grid');
    elements.resultsOverview.innerHTML = `<div>${t('results_placeholder')}</div>`;
    return;
  }

  const summary = buildResultsSummary();
  const winner = summary.winner;
  const viewer = summary.viewer;
  const rankText = summary.viewerRank ? `#${summary.viewerRank}` : '-';
  const scoreBreakdownItems = renderSimulationScoreBreakdownItems(viewer);
  const topThree = summary.topThree.length
    ? summary.topThree.map((player, index) => `<li><span>#${index + 1} ${escapeHtml(player.name)}</span><strong>${resultNumber(player.simulationScore?.total)} ${t('points_short') || 'pts'} • ${money(player.netWorth)}</strong></li>`).join('')
    : `<li><span>${t('empty_leaderboard')}</span><strong>-</strong></li>`;
  const comparison = summary.comparisonToLeader;
  const review = summary.turnReview;
  const playerDebrief = summary.playerDebrief;
  const debrief = summary.classDebrief;
  const teacherViewer = isTeacherViewer();
  const classroomReportPack = teacherViewer ? buildClassroomReportPack(summary) : null;

  elements.resultsStatus.textContent = t('results_finished');
  elements.resultsOverview.dataset.resultsContract = teacherViewer ? 'class-debrief-v1' : 'student-results-v1';
  elements.resultsOverview.dataset.resultsRole = teacherViewer ? 'teacher' : 'student';
  elements.resultsOverview.dataset.finishReason = state.room.finishReason || 'completed';
  if (teacherViewer) {
    elements.resultsOverview.classList.add('teacher-results-grid');
    elements.resultsOverview.dataset.resultsContract = 'classroom-results-v2';
    elements.resultsOverview.innerHTML = renderTeacherResultsOverview(summary, classroomReportPack);
    elements.resultsOverview.querySelectorAll('[data-results-export-inline]').forEach(button => {
      button.addEventListener('click', exportResultsReport);
    });
    return;
  }
  elements.resultsOverview.innerHTML = `
    <article class="market-item results-wide results-hero-card" data-match-phase="finished">
      <strong>Финал матча</strong>
      <div class="value">${winner ? escapeHtml(winner.name) : t('no_winner')}</div>
      <small>${finishReasonLabel(state.room.finishReason)} ${winner ? `Победитель: ${escapeHtml(winner.userName)} • ${resultNumber(winner.simulationScore?.total)} очков` : t('no_winner')}</small>
    </article>
    ${renderClassroomReportPack(classroomReportPack)}
    ${renderPlayerDebriefCard(playerDebrief)}
    ${renderResultsMarketReplayCard(summary.marketReplay)}
    ${debrief ? `
      <article class="market-item results-wide class-debrief-card" data-teacher-debrief-contract="class-debrief-v1">
        <strong>${escapeHtml(debrief.title || 'Разбор занятия')}</strong>
        <p>${escapeHtml(debrief.summary || '')}</p>
        <small>${escapeHtml(debrief.winnerReason || '')}</small>
        <div class="debrief-metrics">
          ${(debrief.classMetrics || []).map(item => `
            <span>
              <b>${escapeHtml(String(item.value ?? ''))}</b>
              ${escapeHtml(item.label || '')}
              <small>${escapeHtml(item.hint || '')}</small>
            </span>
          `).join('')}
        </div>
        ${(debrief.commonIssues || []).length ? `
          <ul class="results-list">
            ${(debrief.commonIssues || []).slice(0, 3).map(issue => `<li><span>${escapeHtml(issue.label)}: ${issue.count}</span><strong>${escapeHtml(issue.recommendation)}</strong></li>`).join('')}
          </ul>
        ` : ''}
        <div class="teacher-prompts top-gap">
          ${(debrief.discussionPrompts || []).slice(0, 3).map(prompt => `<span>${escapeHtml(prompt)}</span>`).join('')}
        </div>
        <p class="muted">${escapeHtml(debrief.nextLessonFocus || '')}</p>
      </article>
    ` : ''}
    <article class="market-item">
      <strong>${t('winner_label')}</strong>
      <div class="value">${winner ? escapeHtml(winner.userName) : t('no_winner')}</div>
      <small>${winner ? `${escapeHtml(winner.name)} • ${t('score_label') || 'Score'} ${resultNumber(winner.simulationScore?.total)} • ${money(winner.netWorth)}` : t('no_winner')}</small>
    </article>
    <article class="market-item">
      <strong>${t('results_player_rank')}</strong>
      <div class="value">${rankText}</div>
      <small>${viewer ? `${escapeHtml(viewer.name)} • ${t('score_label') || 'Score'} ${summary.simulationScore} • ${money(summary.netWorth)}` : t('not_connected')}</small>
    </article>
    <article class="market-item">
      <strong>${t('results_company_result')}</strong>
      <div class="value">${money(summary.netWorth)}</div>
      <small>${t('results_cash')}: ${money(summary.cash)} • ${t('debt')}: ${money(summary.debt)}</small>
    </article>
    <article class="market-item">
      <strong>Продано за матч</strong>
      <div class="value">${summary.totalSalesSeason}</div>
      <small>${viewer?.factory?.productUnit || 'ед.'} • последний ход: ${money(summary.lastProfit)}</small>
    </article>
    <article class="market-item">
      <strong>${t('results_contracts_done')}</strong>
      <div class="value">${summary.completedContracts}</div>
      <small>${t('contract_title')} • ${t('contract_progress')}</small>
    </article>
    <article class="market-item">
      <strong>${t('results_research_done')}</strong>
      <div class="value">${summary.completedResearch}</div>
      <small>${t('research_title')} • ${t('innovation')}</small>
    </article>
    <article class="market-item result-risk-${summary.riskLevel}">
      <strong>${t('results_debt_risk')}</strong>
      <div class="value">${summary.riskLabel}</div>
      <small>${t('debt')}: ${money(summary.debt)}</small>
    </article>
    <article class="market-item">
      <strong>${t('final_day')}</strong>
      <div class="value">${state.room.day}</div>
      <small>${t('scenario_label')}: ${localizedScenarioLabel()} • ${localizedDifficultyLabel()}</small>
    </article>
    <article class="market-item">
      <strong>${t('players_label')}</strong>
      <div class="value">${state.room.playerCount}</div>
      <small>${t('companies_room')} • ${t('day_limit_title')}: ${state.room.settings?.dayLimit || '-'}</small>
    </article>
    ${comparison ? `
      <article class="market-item results-wide comparison-card">
        <strong>Сравнение с лидером</strong>
        <small>${escapeHtml(comparison.takeaway || '')}</small>
        <ul class="results-list">
          <li><span>Ваше место</span><strong>#${comparison.rank}</strong></li>
          <li><span>Лидер</span><strong>${escapeHtml(comparison.leaderName)}</strong></li>
          <li><span>Разрыв по очкам</span><strong>${comparison.scoreGap}</strong></li>
          <li><span>Разрыв по капиталу</span><strong>${money(comparison.netWorthGap)}</strong></li>
          <li><span>Разрыв по продажам</span><strong>${comparison.salesGap} ед.</strong></li>
        </ul>
      </article>
    ` : ''}
    ${review ? renderTurnReviewCard(review) : ''}
    <article class="market-item results-wide personal-path-card">
      <strong>Личный путь игрока</strong>
      <ul class="results-list">
        <li><span>Старт</span><strong>${escapeHtml(viewer?.name || 'Команда')} вошла в ${escapeHtml(state.room.scenarioLabel || localizedScenarioLabel())}</strong></li>
        <li><span>Производство</span><strong>${summary.totalSalesSeason} продано • ${viewer?.producedLastTick || 0} собрано в последнем ходе</strong></li>
        <li><span>Финансы</span><strong>${money(summary.cash)} денег • ${money(summary.debt)} долг</strong></li>
        <li><span>Итог</span><strong>${rankText} • ${summary.simulationScore} очков</strong></li>
      </ul>
    </article>
    <article class="market-item results-wide score-breakdown-card">
      <strong>${t('score_breakdown_title')}</strong>
      <small>${t('score_breakdown_hint')}</small>
      <ul class="results-list score-breakdown-list">${scoreBreakdownItems}</ul>
    </article>
    <article class="market-item results-wide">
      <strong>${t('results_learning_title')}</strong>
      <p>${summary.defenseConclusion}</p>
      <p class="muted">${summary.learningText}</p>
      <small>${t('results_winner_reason')}</small>
    </article>
    <article class="market-item results-wide">
      <strong>${t('results_top_three')}</strong>
      <ul class="results-list">${topThree}</ul>
    </article>`;

  elements.resultsOverview.querySelectorAll('[data-results-export-inline]').forEach(button => {
    button.addEventListener('click', exportResultsReport);
  });
}

function exportResultsReport() {
  if (!state.room || state.room.status !== 'finished') {
    showToast(t('results_export_unavailable'), 'error');
    return;
  }

  const summary = buildResultsSummary();
  const winner = summary.winner;
  const viewer = summary.viewer;
  const teacherViewer = isTeacherViewer();
  const classroomReportPack = teacherViewer ? buildClassroomReportPack(summary) : null;
  const payload = {
    project: 'Biz Arena',
    version: state.runtimeMeta?.version || '0.5.0-alpha.1',
    exportedAt: new Date().toISOString(),
    author: 'Damir Nadrov',
    organization: 'AF KNITU-KAI',
    purpose: 'Educational business simulator demo and defense evidence',
    room: {
      code: state.room.code,
      name: state.room.name,
      status: state.room.status,
      scenario: state.room.scenarioLabel,
      scenarioKey: state.room.settings?.scenarioKey,
      difficulty: state.room.difficulty || state.room.settings?.difficulty,
      difficultyLabel: state.room.difficultyLabel,
      tickMode: state.room.tickMode,
      finalDay: state.room.day,
      finalTurn: state.room.tick,
      dayLimit: state.room.settings?.dayLimit,
      playerCount: state.room.playerCount,
    },
    summary: {
      playerRank: summary.viewerRank || null,
      playerCompany: viewer?.name || null,
      playerUserName: viewer?.userName || null,
      playerNetWorth: summary.netWorth,
      playerSimulationScore: summary.simulationScore,
      playerCash: summary.cash,
      playerDebt: summary.debt,
      completedContracts: summary.completedContracts,
      completedResearch: summary.completedResearch,
      debtRisk: summary.riskLevel,
      defenseTakeaway: summary.learningText,
      playerDebrief: summary.playerDebrief || null,
      marketReplay: summary.marketReplay || null,
    },
    classDebrief: summary.classDebrief || null,
    teacherReportPack: classroomReportPack,
    replay: {
      market: summary.marketReplay || null,
      turnReview: summary.turnReview || null,
      marketHints: summary.marketReplay?.marketHints || [],
    },
    winner: winner ? {
      userName: winner.userName,
      company: winner.name,
      netWorth: winner.netWorth,
      simulationScore: resultNumber(winner.simulationScore?.total),
      city: winner.cityLabel,
      product: winner.productLabel,
    } : null,
    leaderboard: (state.room.leaderboard || []).map((player, index) => ({
      rank: index + 1,
      userName: player.userName,
      company: player.name,
      simulationScore: resultNumber(player.simulationScore?.total),
      simulationScoreBreakdown: player.simulationScore?.components || {},
      netWorth: player.netWorth,
      balance: player.money,
      debt: player.debt,
      product: player.productLabel,
      city: player.cityLabel,
      completedContracts: resultNumber(player.completedContracts),
      completedResearch: resultResearchCount(player),
      reputation: player.reputation,
      lastAction: player.lastAction,
      isBot: Boolean(player.isBot),
    })),
    contracts: (state.room.contractBoard || []).map(contract => ({
      id: contract.id,
      title: contract.title,
      product: contract.productLabel || contract.productKey || null,
      city: contract.cityLabel || contract.cityKey || null,
      reward: contract.reward,
      progress: contract.progress,
      targetSales: contract.targetSales,
      expiresDay: contract.expiresDay,
      assignedPlayerName: contract.assignedPlayerName || null,
      completed: Boolean(contract.completed),
    })),
    market: {
      latest: (state.room.market || []).at(-1) || null,
      recent: state.room.market || [],
      factoryStats: state.room.factoryStats || null,
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `biz-arena-results-${safeFilePart(state.room.code, 'room')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function syncControls() {
  const enabled = canUseBusinessActions();
  elements.actionButtons.forEach(button => {
    const action = button.dataset.action;
    if (action === 'leave-room') button.disabled = !isConnected();
    else if (action === 'start-research') button.disabled = !enabled || !elements.researchSelect.value;
    else button.disabled = !enabled;
  });
  elements.saveFocusPlan.disabled = !enabled;
}

function renderRuntimeMeta() {
  renderServerHome();
  if (!elements.runtimeMeta) return;
  elements.runtimeMeta.innerHTML = '';
  elements.runtimeMeta.classList.remove('placeholder');
  const meta = state.runtimeMeta;
  if (!meta) {
    if (elements.buildBadge) elements.buildBadge.textContent = 'v1.0.0-beta.1 - Pilot Beta';
    elements.runtimeMeta.classList.add('placeholder');
    elements.runtimeMeta.innerHTML = `<div>${t('runtime_loading')}</div>`;
    return;
  }
  if (elements.buildBadge) {
    elements.buildBadge.textContent = 'v' + meta.version + ' - ' + (meta.desktopShell ? 'classroom desktop build' : 'classroom web build');
  }

  const cards = [
    [t('runtime_mode'), meta.desktopShell ? t('runtime_mode_desktop') : t('runtime_mode_web'), 'v' + meta.version + ' - port ' + meta.port],
    [t('runtime_local'), meta.localUrls, t('runtime_hint')],
    [t('runtime_lan'), meta.lanUrls.length ? meta.lanUrls : t('runtime_lan_empty'), t('runtime_hint')],
  ];

  cards.forEach(([title, value, hint]) => {
    const node = document.createElement('article');
    node.className = 'market-item';
    const valueMarkup = Array.isArray(value)
      ? value.map(item => escapeHtml(item)).join('<br />')
      : escapeHtml(value);
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="value small-value">${valueMarkup}</div><small>${escapeHtml(hint)}</small>`;
    elements.runtimeMeta.appendChild(node);
  });
}

async function fetchRuntimeMeta() {
  try {
    const data = await request('/api/meta', { method: 'GET' });
    state.runtimeMeta = data.meta || null;
    if (state.appMode === 'unified' && ['server', 'client'].includes(state.runtimeMeta?.appMode)) {
      state.appMode = state.runtimeMeta.appMode;
    }
  } catch (_error) {
    state.runtimeMeta = null;
  }
  if (isServerMode() && isCloudDeployment()) {
    if (state.teacherSessionToken) {
      try {
        const data = await request('/api/teacher/overview', {
          method: 'GET',
          headers: teacherAuthHeaders(),
        });
        state.teacherOverview = data.overview || null;
        state.teacherAccount = state.teacherOverview?.teacher || state.teacherAccount;
        const sessionsData = await request('/api/teacher/sessions?limit=20', {
          method: 'GET',
          headers: teacherAuthHeaders(),
        });
        state.completedSessions = sessionsData.items || [];
      } catch (error) {
        state.teacherOverview = null;
        state.completedSessions = [];
        if (shouldInvalidateTeacherSession(error)) {
          persistTeacherSession('');
          state.teacherAccount = null;
        }
      }
    } else {
      state.teacherOverview = null;
      state.completedSessions = [];
    }
  } else if (isServerMode()) {
    try {
      const data = await request('/api/server/overview', { method: 'GET' });
      state.serverOverview = data.overview || null;
      const sessionsData = await request('/api/server/sessions?limit=20', { method: 'GET' });
      state.completedSessions = sessionsData.items || [];
    } catch (_error) {
      state.serverOverview = null;
      state.completedSessions = [];
    }
  }
  renderRuntimeMeta();
  applyAppMode();
  setupRealtimeChannel();
}

async function fetchAccount() {
  if (isCloudDeployment()) {
    renderCareer();
    renderAchievements();
    return;
  }
  try {
    const data = await request(`/api/account?userName=${encodeURIComponent(state.profile.userName)}`, { method: 'GET' });
    state.account = data.account;
  } catch (_error) {
    state.account = null;
  }
  renderCareer();
  renderAchievements();
}

async function refreshState() {
  if (state.refreshInFlight) {
    state.refreshPendingAfterFlight = true;
    return;
  }
  state.refreshInFlight = true;
  const focusedTradeInput = captureFocusedTradeInput();
  captureFactorySaleDraftFromDom();
  captureSupplierPurchaseDraftsFromDom();
  try {
    if (!state.playerId) {
      clearSession();
      renderRoomOverview(); renderCompany(); renderFactoryOperations(); renderFactoryPurchases(); renderTickBreakdown(); renderIntel(); renderMarket(); renderGameMarketRail(); renderPlayerList(); renderCompetitors(); renderLeaderboard(); renderLog(); renderGameHud(); renderTeacherPanel(); renderResultsOverview(); renderCareer(); renderAchievements(); syncControls(); syncLobbyControls();
      elements.dayCounter.textContent = `${t('day')} 1`;
      if (elements.gameRoundInline) elements.gameRoundInline.textContent = '1 / 30';
      elements.roomCodeChip.textContent = `${t('room_code_label')}: —`;
      elements.playerCount.textContent = '0';
      elements.resultsStatus.textContent = t('results_finished');
      setStatus(t('not_connected'), false);
      updateTurnTimer();
      syncScreenWithRoom();
      return;
    }
    const params = new URLSearchParams({
      playerId: state.playerId,
      view: isClientMode() ? 'student' : 'full',
      sinceRoomVersion: String(state.lastRoomVersion || 0),
      sincePlayerVersion: String(state.lastPlayerVersion || 0),
    });
    const data = await request(`/api/state?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-Player-Session': state.sessionToken },
    });
    hydrateStateFromPayload(data);
    setupRealtimeChannel();
    restoreFocusedTradeInput(focusedTradeInput);
  } catch (error) {
    setStatus(error.message, false);
    if (shouldInvalidatePlayerSession(error)) {
      clearSession();
      renderDisconnectedState();
      syncScreenWithRoom();
    }
    restoreFocusedTradeInput(focusedTradeInput);
    updateTurnTimer();
  } finally {
    state.refreshInFlight = false;
    if (state.refreshPendingAfterFlight) {
      state.refreshPendingAfterFlight = false;
      scheduleRealtimeRefresh();
    }
  }
}

async function createRoom(overrides = {}) {
  const data = await request('/api/rooms/create', {
    method: 'POST',
    body: JSON.stringify({
      roomName: overrides.roomName ?? elements.roomName.value.trim(),
      companyName: overrides.companyName ?? elements.createCompanyName.value.trim(),
      userName: overrides.userName ?? state.profile.userName,
      avatar: state.profile.avatar,
      scenarioKey: overrides.scenarioKey ?? elements.createScenarioSelect.value,
      difficulty: overrides.difficulty ?? elements.createDifficultySelect.value,
      practiceMode: overrides.practiceMode ?? '',
      teacherHost: overrides.teacherHost ?? isServerMode(),
      maxPlayers: overrides.maxPlayers ?? Number(elements.createMaxPlayersSelect?.value || 30),
      dayLimit: overrides.dayLimit ?? Number(elements.createDayLimitSelect?.value || 30),
      turnDurationMs: overrides.turnDurationMs ?? Number(elements.createTurnDurationSelect?.value || 1800000),
    })
  });
  persistSession(data.playerId, data.roomCode, data.sessionToken);
  hydrateStateFromPayload(data);
  showScreen('lobby-screen', { addToHistory: false });
}

async function createDemoSession() {
  await createRoom({
    roomName: 'KAI Demo Championship',
    companyName: 'AFKAIstudent1',
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
    practiceMode: 'demo',
  });
  await sendAction('add-bot', undefined, { throwOnError: true });
  await sendAction('add-bot', undefined, { throwOnError: true });
  elements.dayLimitSelect.value = '30';
  elements.scenarioSelect.value = 'motorcycles';
  elements.difficultySelect.value = 'easy';
  await sendAction('update-room-settings', undefined, { throwOnError: true });
  if (!state.player?.ready) await sendAction('toggle-ready', undefined, { throwOnError: true });
  await sendAction('start-game', undefined, { throwOnError: true });
  if (!gameIsRunning()) throw new Error('Demo match did not start.');
  setGameTab('operations');
  showScreen('game-screen', { addToHistory: false });
  setStatus(t('demo_session_ready'), true);
}

async function createTutorialSession() {
  const baseName = state.profile.userName || 'BizPlayer';
  stopTutorial();
  await createRoom({
    roomName: 'Training Room',
    companyName: `${baseName} Academy`,
    scenarioKey: 'motorcycles',
    difficulty: 'easy',
    practiceMode: 'tutorial',
  });
  elements.dayLimitSelect.value = '30';
  elements.scenarioSelect.value = 'motorcycles';
  elements.difficultySelect.value = 'easy';
  await sendAction('update-room-settings');
  await sendAction('toggle-ready');
  await sendAction('start-game');
  setGameTab('operations');
  showScreen('game-screen', { addToHistory: false });
  startTutorial();
  setStatus(t('tutorial_session_ready'), true);
}

async function joinRoom() {
  const joinUserName = elements.joinUserName?.value.trim() || '';
  const roomCode = elements.roomCodeInput.value.trim().toUpperCase();
  const companyName = elements.joinCompanyName.value.trim();
  if (!joinUserName) throw new Error('Введите имя участника.');
  if (!roomCode) throw new Error('Введите код комнаты с экрана преподавателя.');
  if (!companyName) throw new Error('Введите название команды.');
  state.profile.userName = joinUserName;
  localStorage.setItem('bizArenaUserName', state.profile.userName);
  const data = await request('/api/rooms/join', {
    method: 'POST',
    body: JSON.stringify({
      roomCode,
      companyName,
      userName: joinUserName,
      avatar: state.profile.avatar,
      sessionToken: state.roomCode === roomCode ? state.sessionToken : '',
    })
  });
  persistSession(data.playerId, data.roomCode, data.sessionToken);
  hydrateStateFromPayload(data);
  showScreen('lobby-screen', { addToHistory: false });
}

async function sendAction(action, value, options = {}) {
  if (!state.playerId) {
    showToast(t('join_first'), 'error');
    return;
  }
  const queueItem = options.queueItem || null;
  const previousQueueSignature = queueItem ? queueSignature(state.player?.executionPlan || []) : '';
  try {
    if (queueItem) {
      setIntelFeedback('pending', `${t('queue_feedback_running')}: ${executionLabel(queueItem.key)}`);
      renderIntel();
    }
    const actionId = `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const localTeacherConsole = Boolean(isServerMode() && state.player?.isTeacherHost);
    const payload = localTeacherConsole
      ? { roomCode: state.roomCode || state.room?.code || '', actionId, action, value }
      : { playerId: state.playerId, sessionToken: state.sessionToken, actionId, action, value };
    if (action === 'update-room-settings') {
      payload.maxPlayers = Number(elements.maxPlayersSelect.value);
      payload.demandProfile = elements.demandProfileSelect.value;
      payload.scenarioKey = elements.scenarioSelect.value;
      payload.difficulty = elements.difficultySelect.value;
      payload.dayLimit = Number(elements.dayLimitSelect.value);
      payload.turnDurationMs = Number(elements.turnDurationSelect?.value || 1800000);
    }
    await request(localTeacherConsole ? '/api/server/action' : '/api/action', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (action === 'set-sale-offer') clearFactorySaleDraft();
    if (action === 'leave-room') {
      setIntelFeedback();
      clearSession();
      state.screenHistory = [];
      showScreen('main-menu-screen', { addToHistory: false });
    }
    await refreshState();
    if (queueItem) {
      const nextQueueSignature = queueSignature(state.player?.executionPlan || []);
      const feedbackKey = nextQueueSignature !== previousQueueSignature ? 'queue_feedback_updated' : 'queue_feedback_done';
      setIntelFeedback(nextQueueSignature !== previousQueueSignature ? 'success' : 'info', `${t(feedbackKey)}: ${executionLabel(queueItem.key)}`);
      renderIntel();
    }
    await fetchAccount();
  } catch (error) {
    if (queueItem) {
      setIntelFeedback('error', `${t('queue_feedback_failed')}: ${error.message}`);
      renderIntel();
    }
    showToast(error.message, 'error');
    if (options.throwOnError) throw error;
  }
}

function saveProfile() {
  state.profile.userName = elements.profileUsername.value.trim() || 'BizPlayer';
  localStorage.setItem('bizArenaUserName', state.profile.userName);
  if (state.profile.avatar) localStorage.setItem('bizArenaAvatar', state.profile.avatar);
  else localStorage.removeItem('bizArenaAvatar');
  applyProfileUI();
  elements.profileStatus.textContent = t('profile_saved');
  fetchAccount();
}

function saveSettings() {
  state.settings.language = normalizeLanguage(elements.languageSelect.value);
  state.settings.fontSize = elements.fontSizeSelect.value;
  state.settings.background = elements.backgroundSelect.value;
  state.settings.visualPreset = elements.visualPresetSelect.value;
  state.settings.performanceMode = normalizePerformanceMode(elements.performanceModeSelect?.value || 'auto');
  state.settings.refreshCadence = normalizeRefreshCadence(elements.refreshCadenceSelect?.value || 'auto');
  state.settings.animationMode = normalizeAnimationMode(elements.animationModeSelect?.value || 'auto');
  localStorage.setItem('bizArenaLanguage', state.settings.language);
  localStorage.setItem('bizArenaFontSize', state.settings.fontSize);
  localStorage.setItem('bizArenaBackground', state.settings.background);
  localStorage.setItem('bizArenaVisualPreset', state.settings.visualPreset);
  localStorage.setItem('bizArenaPerformanceMode', state.settings.performanceMode);
  localStorage.setItem('bizArenaRefreshCadence', state.settings.refreshCadence);
  localStorage.setItem('bizArenaAnimationMode', state.settings.animationMode);
  resetRenderCache();
  applyTranslations();
  applyBackgroundTheme();
  applyAppMode();
  scheduleRefreshLoop();
  const selectedScenario = elements.createScenarioSelect.value || 'motorcycles';
  elements.createScenarioSelect.innerHTML = createOptionMarkup(factoryScenarioCatalog(), selectedScenario);
  renderCreateScenarioPreview();
  renderRuntimeMeta();
  refreshState();
}

elements.screenButtons.forEach(button => button.addEventListener('click', () => {
  if (ROOM_MANAGED_SCREENS.includes(button.dataset.openScreen)) state.roomAutoOpenDismissed = false;
  showScreen(button.dataset.openScreen);
}));
elements.homeLinks.forEach(button => button.addEventListener('click', () => {
  state.roomAutoOpenDismissed = true;
  state.screenHistory = [];
  showScreen('main-menu-screen', { addToHistory: false });
}));
elements.backButtons.forEach(button => button.addEventListener('click', goBack));
elements.gameTabs.forEach(button => button.addEventListener('click', () => setGameTab(button.dataset.gameTab)));
elements.gameNextActionChip?.addEventListener('click', activateGameNextAction);
elements.gameCopyStudentLink?.addEventListener('click', async () => {
  try {
    const value = elements.gameCopyStudentLink.dataset.copyUrl || gameStudentClientUrl();
    await copyTextToClipboard(value);
    showToast(`Скопировано: ${value}`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.createScenarioSelect.addEventListener('change', renderCreateScenarioPreview);
[
  elements.roomName,
  elements.createCompanyName,
  elements.createMaxPlayersSelect,
  elements.createDayLimitSelect,
  elements.createTurnDurationSelect,
].forEach(input => {
  input?.addEventListener('input', renderCreateRoomLiveSummary);
  input?.addEventListener('change', renderCreateRoomLiveSummary);
});
elements.createDifficultyButtons.forEach(button => button.addEventListener('click', () => setCreateDifficulty(button.dataset.createDifficulty)));
elements.createForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await createRoom({ teacherHost: true });
    elements.roomName.value = 'Аудитория';
    elements.createCompanyName.value = 'Команда преподавателя';
    renderCreateRoomLiveSummary();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.demoStartButton?.addEventListener('click', async () => {
  try {
    await createDemoSession();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.studentDemoStartButton?.addEventListener('click', async () => {
  try {
    await createDemoSession();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.tutorialStartButton?.addEventListener('click', async () => {
  try {
    await createTutorialSession();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.studentTutorialButtons.forEach(button => {
  button.addEventListener('click', async () => {
    try {
      await createTutorialSession();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
});
elements.gameTutorialButton?.addEventListener('click', async () => {
  try {
    if (state.currentScreen === 'game-screen' && isFactoryRoom()) {
      startTutorial();
      setStatus(t('tutorial_session_ready'), true);
      return;
    }
    await createTutorialSession();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
elements.serverCopyButtons.forEach(button => {
  button.addEventListener('click', () => copyServerAddress(button.dataset.serverCopy));
});
elements.serverExitButton?.addEventListener('click', () => {
  window.close();
  showToast('Если окно не закрылось автоматически, закройте вкладку или приложение вручную.', 'success');
});
elements.serverExitButtons.forEach(button => {
  button.addEventListener('click', () => {
    window.close();
    showToast('Если окно не закрылось автоматически, закройте вкладку или приложение вручную.', 'success');
  });
});
elements.joinForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = elements.joinForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setJoinFormStatus('Подключаемся к комнате...', 'pending');
  try {
    await joinRoom();
    setJoinFormStatus();
    elements.roomCodeInput.value = '';
    elements.joinCompanyName.value = '';
  } catch (error) {
    const message = friendlyConnectionError(error.message);
    setJoinFormStatus(message, 'error');
    showToast(message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});
elements.priceInput.addEventListener('input', event => { elements.priceValue.textContent = event.target.value; });
elements.actionButtons.forEach(button => button.addEventListener('click', () => {
  const { action, value, source } = button.dataset;
  let payload = value ? Number(value) : undefined;
  if (action === 'set-price') payload = Number(elements.priceInput.value);
  if (source) payload = document.querySelector(`#${source}`).value;
  sendAction(action, payload);
}));
elements.profileToggle.addEventListener('click', () => showScreen('profile-screen'));
elements.settingsToggle.addEventListener('click', () => showScreen('settings-screen'));
elements.saveProfile.addEventListener('click', saveProfile);
elements.clearAvatar.addEventListener('click', () => {
  state.profile.avatar = '';
  saveProfile();
});
elements.profileAvatar.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.profile.avatar = String(reader.result || '');
    applyProfileUI();
  };
  reader.readAsDataURL(file);
});
elements.saveSettings.addEventListener('click', saveSettings);
elements.performanceModeSelect?.addEventListener('change', renderPerformanceModeSummary);
elements.saveFocusPlan.addEventListener('click', () => sendAction('set-focus-segment', {
  productKey: elements.focusProductSelect.value,
}));
elements.toggleReady.addEventListener('click', () => sendAction('toggle-ready'));
elements.roomSettingsForm.addEventListener('submit', async event => {
  event.preventDefault();
  await sendAction('update-room-settings');
});
elements.saveRoomButton.addEventListener('click', () => sendAction('save-room'));
elements.loadRoomButton.addEventListener('click', () => sendAction('load-room'));
elements.saveRoomButtonGame.addEventListener('click', () => sendAction('save-room'));
elements.loadRoomButtonGame.addEventListener('click', () => sendAction('load-room'));
elements.leaveGameButton.addEventListener('click', () => sendAction('leave-room'));
elements.playAgain.addEventListener('click', () => sendAction('reset-room'));
elements.exportResults.addEventListener('click', exportResultsReport);
elements.leaveAfterResults.addEventListener('click', () => sendAction('leave-room'));
elements.tutorialSkipButton.addEventListener('click', () => stopTutorial());
elements.tutorialNextButton.addEventListener('click', () => advanceTutorialStep());
document.addEventListener('click', handleTutorialClick, true);
window.addEventListener('resize', renderTutorialOverlay);
window.addEventListener('scroll', renderTutorialOverlay, true);
document.addEventListener('visibilitychange', () => {
  scheduleRefreshLoop();
  if (!document.hidden) refreshState();
});

function bootstrap() {
  if (!SUPPORTED_LANGUAGES.includes(state.settings.language)) {
    state.settings.language = 'ru';
    localStorage.setItem('bizArenaLanguage', 'ru');
  }
  elements.languageSelect.value = state.settings.language;
  elements.fontSizeSelect.value = state.settings.fontSize;
  elements.backgroundSelect.value = state.settings.background;
  elements.visualPresetSelect.value = state.settings.visualPreset;
  if (elements.performanceModeSelect) elements.performanceModeSelect.value = state.settings.performanceMode;
  if (elements.refreshCadenceSelect) elements.refreshCadenceSelect.value = state.settings.refreshCadence;
  if (elements.animationModeSelect) elements.animationModeSelect.value = state.settings.animationMode;
  elements.createScenarioSelect.innerHTML = createOptionMarkup(factoryScenarioCatalog(), 'motorcycles');
  elements.createScenarioSelect.value = 'motorcycles';
  setCreateDifficulty('easy');
  renderCreateScenarioPreview();
  applyTranslations();
  applyBackgroundTheme();
  applyAppMode();
  applyClientLaunchParams();
  applyProfileUI();
  showScreen(isClientMode() ? 'join-room-screen' : isServerMode() ? 'server-home-screen' : 'main-menu-screen', { addToHistory: false });
  syncLobbyControls();
  setGameTab(state.currentGameTab);
  renderResultsOverview();
  renderIntel();
  renderCareer();
  renderAchievements();
  renderRuntimeMeta();
  renderTutorialOverlay();
  fetchRuntimeMeta().then(fetchAccount);
  refreshState();
  syncControls();
  renderNavigationState();
  maybeAutoJoinFromClientLaunch();
  scheduleRefreshLoop();
  state.turnTimerHandle = setInterval(updateTurnTimer, 1000);
  updateTurnTimer();
}
