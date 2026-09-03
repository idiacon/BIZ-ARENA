const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const QRCode = require('qrcode');
const { WebSocketServer } = require('ws');
const {
  BOARD_POLICIES,
  OPERATING_PLANS,
  SEASON_GOALS,
  clamp,
  demandMultiplier,
  eventApplies,
  researchEffects,
  computeSeasonGoalProgress,
  buildOperatingPlanPreview,
  pickOperatingPlanAction,
  buildForecastSegments,
  buildPlayerIntel,
  buildFocusPlan,
  buildPivotPreview,
  buildExecutionPlan,
  buildFinancialBreakdown,
  buildSimulationScore,
} = require('./server/game-rules');
const { createApiRouter } = require('./server/http/routes');
const { applyResponseSecurityHeaders } = require('./server/http/response-security');
const { createCorsPolicy } = require('./server/http/cors-policy');
const { parseRequestUrl } = require('./server/http/request-url');
const { forwardedClientAddress } = require('./server/http/client-address');
const { createRoomActionHandler } = require('./server/room/actions');
const { createRuntimeStorage } = require('./server/storage/runtime-storage');
const {
  createMigrationRegistry,
  isSchemaMigrationError,
} = require('./server/storage/schema-migrations');
const { createClassroomIdentity } = require('./server/security/classroom-identity');
const { createRealtimeTicketStore } = require('./server/security/realtime-tickets');
const { createFactorySummaryHelpers } = require('./server/factory/summary');
const {
  buildScenarioDefinitionFromFactoryConfig,
  buildScenarioLabSummary,
} = require('./server/scenarios/schema');
const { runParameterSweep } = require('./server/experiments/runner');

const APP_VERSION = require('./package.json').version;
const PORT = process.env.PORT || 3000;
const HOST = String(process.env.BIZ_ARENA_HOST || '0.0.0.0').trim() || '0.0.0.0';
const DEPLOYMENT_MODE = ['local', 'cloud'].includes(process.env.BIZ_ARENA_DEPLOYMENT)
  ? process.env.BIZ_ARENA_DEPLOYMENT
  : 'local';
const APP_MODE = ['server', 'client', 'unified'].includes(process.env.BIZ_ARENA_APP_MODE)
  ? process.env.BIZ_ARENA_APP_MODE
  : 'unified';
const PUBLIC_URL = String(process.env.BIZ_ARENA_PUBLIC_URL || '').replace(/\/+$/, '');
const CORS_ALLOWED_ORIGINS = String(process.env.BIZ_ARENA_CORS_ORIGINS || '').trim();
const ALLOW_REGISTRATION = String(process.env.BIZ_ARENA_ALLOW_REGISTRATION || 'true').toLowerCase() !== 'false';
const TEACHER_SESSION_TTL_MS = Math.max(
  1,
  Number(process.env.BIZ_ARENA_TEACHER_SESSION_TTL_HOURS || 24 * 7) || 24 * 7
) * 60 * 60 * 1000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const corsPolicy = createCorsPolicy({
  allowedOrigins: CORS_ALLOWED_ORIGINS,
  publicUrl: PUBLIC_URL,
});
const DATA_DIR = process.env.BIZ_ARENA_DATA_DIR
  ? path.resolve(process.env.BIZ_ARENA_DATA_DIR)
  : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'biz-arena-db.json');
const DB_BACKUP_PATH = `${DB_PATH}.bak`;
const DB_TEMP_PATH = `${DB_PATH}.tmp`;
const STORAGE_BACKEND = ['json', 'sqlite'].includes(String(process.env.BIZ_ARENA_STORAGE || 'json').toLowerCase())
  ? String(process.env.BIZ_ARENA_STORAGE || 'json').toLowerCase()
  : 'json';
const SQLITE_PATH = process.env.BIZ_ARENA_SQLITE_PATH
  ? path.resolve(process.env.BIZ_ARENA_SQLITE_PATH)
  : path.join(DATA_DIR, 'biz-arena.sqlite');
const DEFAULT_TICK_MS = 7000;
const MAX_TURN_COUNT = 30;
const MIN_TURN_COUNT = 10;
const MAX_CLASSROOM_PLAYERS = 30;
const MIN_CLASSROOM_PLAYERS = 2;
const MANUAL_TURN_MS = 30 * 60 * 1000;
const ALLOWED_MANUAL_TURN_MINUTES = [5, 10, 15, 20, 30];
const HEARTBEAT_MS = 1000;
const MAX_LOG = 120;
const MAX_MARKET_HISTORY = 40;
const MAX_AVATAR_LENGTH = 250_000;
const MAX_WEBSOCKET_PAYLOAD_BYTES = 16 * 1024;
const MAX_WEBSOCKET_CONNECTIONS = Math.max(30, Number(process.env.BIZ_ARENA_WS_MAX_CONNECTIONS || 512) || 512);
const MAX_WEBSOCKET_CONNECTIONS_PER_IDENTITY = Math.max(1, Number(process.env.BIZ_ARENA_WS_MAX_PER_IDENTITY || 2) || 2);
const MAX_LIVE_ROOMS = Math.max(1, Number(process.env.BIZ_ARENA_MAX_LIVE_ROOMS || 100) || 100);
const MAX_ACTIVE_ROOMS_PER_TEACHER = Math.max(1, Number(process.env.BIZ_ARENA_MAX_ACTIVE_ROOMS_PER_TEACHER || 3) || 3);
const MAX_LISTED_LOBBIES_PER_TEACHER = Math.max(1, Number(process.env.BIZ_ARENA_MAX_LISTED_LOBBIES_PER_TEACHER || 2) || 2);
const CLOUD_EMPTY_LOBBY_TTL_MS = Math.max(1, Number(process.env.BIZ_ARENA_CLOUD_EMPTY_LOBBY_TTL_HOURS || 2) || 2) * 60 * 60 * 1000;
const LOCAL_EMPTY_LOBBY_TTL_MS = Math.max(1, Number(process.env.BIZ_ARENA_LOCAL_EMPTY_LOBBY_TTL_HOURS || 24) || 24) * 60 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = Math.max(1, Number(process.env.BIZ_ARENA_FINISHED_ROOM_TTL_HOURS || 24) || 24) * 60 * 60 * 1000;
const WEBSOCKET_HEARTBEAT_MS = 30_000;
const DB_SCHEMA_VERSION = 4;
const ROOM_SNAPSHOT_SCHEMA_VERSION = 3;
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;
const DIRECTORY_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const roomSnapshotMigrationRegistry = createMigrationRegistry({
  schemaName: 'room snapshot',
  currentVersion: ROOM_SNAPSHOT_SCHEMA_VERSION,
  migrations: {
    1: migrateRoomSnapshotV1ToV2,
    2: migrateRoomSnapshotV2ToV3,
  },
});
const databaseMigrationRegistry = createMigrationRegistry({
  schemaName: 'database',
  currentVersion: DB_SCHEMA_VERSION,
  migrations: {
    1: migrateDbV1ToV2,
    2: migrateDbV2ToV3,
    3: migrateDbV3ToV4,
  },
});
const TEACHER_PHASE_LOCKS = {
  open: {
    label: 'Открыть решения',
    description: 'Студенты могут менять решения и готовить следующий ход.',
  },
  review: {
    label: 'Фаза разбора',
    description: 'Преподаватель фиксирует решения и обсуждает результаты перед следующим ходом.',
  },
};

const PRODUCTS = {
  food: { label: 'Food', rawCost: 38, demand: 1.18, qualityWeight: 0.9, marginWeight: 1.02 },
  electronics: { label: 'Electronics', rawCost: 86, demand: 0.88, qualityWeight: 1.28, marginWeight: 1.14 },
  furniture: { label: 'Furniture', rawCost: 61, demand: 1.0, qualityWeight: 1.05, marginWeight: 1.08 },
  pharma: { label: 'Pharma', rawCost: 108, demand: 0.72, qualityWeight: 1.45, marginWeight: 1.26 },
};

const CITIES = {
  capital: { label: 'Capital', demand: 1.2, priceSensitivity: 0.95, salary: 1.14 },
  regional: { label: 'Regional', demand: 1.0, priceSensitivity: 1.0, salary: 1.0 },
  industrial: { label: 'Industrial', demand: 0.92, priceSensitivity: 1.08, salary: 0.92 },
  coastal: { label: 'Coastal', demand: 1.08, priceSensitivity: 0.98, salary: 1.06 },
};

const SCENARIOS = {
  standard: {
    label: 'Balanced growth',
    description: 'Default LAN sandbox with stable demand and neutral costs.',
    demand: 1,
    rawCost: 1,
    salary: 1,
    research: 1,
  },
  boom: {
    label: 'Consumer boom',
    description: 'Demand is high and premium goods move faster, but payroll rises.',
    demand: 1.22,
    rawCost: 1.04,
    salary: 1.08,
    research: 1,
  },
  crunch: {
    label: 'Supply crunch',
    description: 'Demand softens while logistics and raw materials become painful.',
    demand: 0.86,
    rawCost: 1.18,
    salary: 0.98,
    research: 0.95,
  },
  tech: {
    label: 'Tech acceleration',
    description: 'Research advances faster and complex sectors thrive.',
    demand: 0.98,
    rawCost: 1.06,
    salary: 1.02,
    research: 1.35,
  },
  motorcycles: {
    label: 'Завод мотоциклов',
    description: 'Все команды управляют одинаковыми сборочными линиями мотоциклов: найм, компоненты, сборка, цена и книга заявок.',
    demand: 1,
    rawCost: 1,
    salary: 1,
    research: 1,
  },
  drones: {
    label: 'Фабрика дронов',
    description: 'Все команды собирают гражданские дроны из батарей, моторов, контроллеров и камер.',
    demand: 1,
    rawCost: 1,
    salary: 1,
    research: 1,
  },
  smartphones: {
    label: 'Сборка смартфонов',
    description: 'Все команды работают на одной и той же линии смартфонов с дорогими компонентами и быстрым ценовым давлением.',
    demand: 1,
    rawCost: 1,
    salary: 1,
    research: 1,
  },
  ev_scooters: {
    label: 'Линия электросамокатов',
    description: 'Все команды собирают электросамокаты и конкурируют через себестоимость батарей, объём и финальную цену.',
    demand: 1,
    rawCost: 1,
    salary: 1,
    research: 1,
  },
  appliances: {
    label: 'Мастерская техники',
    description: 'Все команды производят малую технику на более спокойном, но менее маржинальном рынке заявок.',
    demand: 1,
    rawCost: 1,
    salary: 1,
    research: 1,
  },
};

const FACTORY_SCENARIOS = {
  motorcycles: {
    key: 'motorcycles',
    productKey: 'motorcycles',
    productLabel: 'Мотоциклы',
    productUnit: 'шт.',
    priceRange: { min: 4800, max: 9000 },
    basePrice: 6400,
    baseDemandMin: 7,
    baseDemandMax: 14,
    upkeep: 3500,
    starterCash: 180000,
    starterInventory: { frames: 3, engines: 3, wheels: 6, electronics: 3 },
    salaryBand: [38, 88],
    components: {
      frames: { label: 'Рамы', unitCost: 620, lotSize: 2, recipe: 1 },
      engines: { label: 'Двигатели', unitCost: 1050, lotSize: 2, recipe: 1 },
      wheels: { label: 'Колёса', unitCost: 280, lotSize: 4, recipe: 2 },
      electronics: { label: 'Электроника', unitCost: 390, lotSize: 2, recipe: 1 },
    },
    roles: ['Сборщик', 'Механик', 'Техник качества', 'Сменный мастер'],
  },
  drones: {
    key: 'drones',
    productKey: 'drones',
    productLabel: 'Дроны',
    productUnit: 'компл.',
    priceRange: { min: 3200, max: 7000 },
    basePrice: 4800,
    baseDemandMin: 10,
    baseDemandMax: 18,
    upkeep: 2500,
    starterCash: 170000,
    starterInventory: { motors: 12, batteries: 4, controllers: 4, cameras: 4, frames: 4 },
    salaryBand: [28, 62],
    components: {
      motors: { label: 'Моторы', unitCost: 170, lotSize: 4, recipe: 4 },
      batteries: { label: 'Батареи', unitCost: 360, lotSize: 2, recipe: 1 },
      controllers: { label: 'Контроллеры', unitCost: 300, lotSize: 2, recipe: 1 },
      cameras: { label: 'Камеры', unitCost: 220, lotSize: 2, recipe: 1 },
      frames: { label: 'Рамы', unitCost: 140, lotSize: 2, recipe: 1 },
    },
    roles: ['Сборщик', 'Техник электроники', 'Техник качества', 'Калибровщик'],
  },
  smartphones: {
    key: 'smartphones',
    productKey: 'smartphones',
    productLabel: 'Смартфоны',
    productUnit: 'шт.',
    priceRange: { min: 2400, max: 5200 },
    basePrice: 3400,
    baseDemandMin: 14,
    baseDemandMax: 24,
    upkeep: 2200,
    starterCash: 190000,
    starterInventory: { displays: 5, batteries: 5, boards: 5, cameras: 10, cases: 5 },
    salaryBand: [22, 52],
    components: {
      displays: { label: 'Дисплеи', unitCost: 190, lotSize: 3, recipe: 1 },
      batteries: { label: 'Батареи', unitCost: 130, lotSize: 3, recipe: 1 },
      boards: { label: 'Платы', unitCost: 230, lotSize: 3, recipe: 1 },
      cameras: { label: 'Камерные модули', unitCost: 85, lotSize: 6, recipe: 2 },
      cases: { label: 'Корпуса', unitCost: 60, lotSize: 3, recipe: 1 },
    },
    roles: ['Сборщик', 'Техник электроники', 'Тестировщик', 'Руководитель упаковки'],
  },
  ev_scooters: {
    key: 'ev_scooters',
    productKey: 'ev_scooters',
    productLabel: 'Электросамокаты',
    productUnit: 'шт.',
    priceRange: { min: 3200, max: 6800 },
    basePrice: 4600,
    baseDemandMin: 9,
    baseDemandMax: 16,
    upkeep: 2800,
    starterCash: 175000,
    starterInventory: { motorWheels: 4, batteries: 4, controllers: 4, frames: 4, brakes: 4 },
    salaryBand: [30, 68],
    components: {
      motorWheels: { label: 'Мотор-колёса', unitCost: 430, lotSize: 2, recipe: 1 },
      batteries: { label: 'Батареи', unitCost: 540, lotSize: 2, recipe: 1 },
      controllers: { label: 'Контроллеры', unitCost: 230, lotSize: 2, recipe: 1 },
      frames: { label: 'Рамы', unitCost: 180, lotSize: 2, recipe: 1 },
      brakes: { label: 'Тормозные комплекты', unitCost: 120, lotSize: 2, recipe: 1 },
    },
    roles: ['Сборщик', 'Техник батарей', 'Инспектор безопасности', 'Мастер линии'],
  },
  appliances: {
    key: 'appliances',
    productKey: 'appliances',
    productLabel: 'Кофемашины',
    productUnit: 'шт.',
    priceRange: { min: 1800, max: 3800 },
    basePrice: 2500,
    baseDemandMin: 12,
    baseDemandMax: 20,
    upkeep: 1500,
    starterCash: 165000,
    starterInventory: { housings: 5, motors: 5, heaters: 5, boards: 5, packaging: 5 },
    salaryBand: [18, 42],
    components: {
      housings: { label: 'Корпуса', unitCost: 100, lotSize: 3, recipe: 1 },
      motors: { label: 'Моторы', unitCost: 190, lotSize: 3, recipe: 1 },
      heaters: { label: 'Нагреватели', unitCost: 130, lotSize: 3, recipe: 1 },
      boards: { label: 'Платы управления', unitCost: 110, lotSize: 3, recipe: 1 },
      packaging: { label: 'Упаковка', unitCost: 30, lotSize: 3, recipe: 1 },
    },
    roles: ['Сборщик', 'Тестировщик', 'Техник качества', 'Руководитель упаковки'],
  },
};

const SUPPLIER_NAMES = [
  'Завод 1',
  'Завод 2',
  'Завод 3',
  'Индустрия Север',
  'ТехПоставка',
  'Региональный склад',
  'Механика Плюс',
  'Линия Комплект',
];

const SUPPLIER_PROFILES = [
  { tier: 'budget', label: 'Дешевый лот', spread: -0.18, quantityMultiplier: 0.8, qualityBase: 58, reliability: 72, scarcity: 'high' },
  { tier: 'spot', label: 'Спотовый рынок', spread: -0.08, quantityMultiplier: 1.1, qualityBase: 68, reliability: 80, scarcity: 'medium' },
  { tier: 'standard', label: 'Стандартная поставка', spread: 0.02, quantityMultiplier: 1.6, qualityBase: 76, reliability: 88, scarcity: 'medium' },
  { tier: 'bulk', label: 'Крупная партия', spread: 0.08, quantityMultiplier: 2.4, qualityBase: 82, reliability: 91, scarcity: 'low' },
  { tier: 'premium', label: 'Премиум качество', spread: 0.16, quantityMultiplier: 1.3, qualityBase: 92, reliability: 96, scarcity: 'low' },
  { tier: 'urgent', label: 'Срочная поставка', spread: 0.24, quantityMultiplier: 0.9, qualityBase: 72, reliability: 84, scarcity: 'high' },
];

const SPECIALIZATIONS = {
  balanced: {
    label: 'Balanced board',
    description: 'Steady development across price, quality and logistics.',
    demandScore: 1,
    rawDiscount: 0,
    salaryMultiplier: 1,
    reputationGain: 1,
    productionBonus: 0,
  },
  cost: {
    label: 'Cost leader',
    description: 'Cheaper operations and stronger low-price play.',
    demandScore: 1.06,
    rawDiscount: 0.12,
    salaryMultiplier: 0.96,
    reputationGain: 0.92,
    productionBonus: 1,
  },
  premium: {
    label: 'Premium brand',
    description: 'Higher upside from quality, branding and reputation.',
    demandScore: 1.08,
    rawDiscount: 0,
    salaryMultiplier: 1.08,
    reputationGain: 1.12,
    productionBonus: 0,
  },
  logistics: {
    label: 'Supply nexus',
    description: 'Better resilience in harsh scenarios and stronger throughput.',
    demandScore: 1.03,
    rawDiscount: 0.06,
    salaryMultiplier: 1,
    reputationGain: 1,
    productionBonus: 2,
  },
};

const RESEARCH_PROJECTS = {
  retail_ai: {
    label: 'Retail AI',
    cost: 34,
    description: 'Improves targeting and store efficiency.',
    effects: { marketing: 0.16, retail: 0.1 },
  },
  lean_ops: {
    label: 'Lean operations',
    cost: 30,
    description: 'Cuts waste and boosts production efficiency.',
    effects: { rawSave: 0.1, production: 2 },
  },
  brand_lab: {
    label: 'Brand lab',
    cost: 38,
    description: 'Raises the value of quality and brand power.',
    effects: { quality: 0.18, reputation: 0.08 },
  },
  finance_stack: {
    label: 'Finance stack',
    cost: 32,
    description: 'Reduces debt drag and improves net worth growth.',
    effects: { debtCost: 0.35, upkeep: 0.06 },
  },
};

const EVENT_TEMPLATES = {
  city_festival: {
    label: 'City festival',
    description: 'Consumer traffic surges in one city for a few days.',
    duration: 3,
    demandMultiplier: 1.24,
  },
  premium_wave: {
    label: 'Premium wave',
    description: 'One product segment gets a short premium demand spike.',
    duration: 3,
    demandMultiplier: 1.18,
  },
  port_strike: {
    label: 'Port strike',
    description: 'Import friction raises raw material costs in one city.',
    duration: 2,
    rawCostMultiplier: 1.15,
  },
  innovation_grant: {
    label: 'Innovation grant',
    description: 'Public support boosts research across the room.',
    duration: 2,
    researchMultiplier: 1.35,
  },
};

const FACTORY_EVENT_TEMPLATES = {
  factory_demand_surge: {
    label: 'Рыночный всплеск',
    description: 'Дилеры резко поднимают спрос в книге заявок. Хороший момент отгрузить готовый склад.',
    duration: 2,
    demandMultiplier: 1.35,
  },
  factory_supplier_delay: {
    label: 'Сбой поставок',
    description: 'Поставщики поднимают цену комплектующих. Ошибка закупки сразу давит на денежный поток.',
    duration: 2,
    demandMultiplier: 0.96,
    rawCostMultiplier: 1.22,
  },
  factory_quality_audit: {
    label: 'Проверка качества',
    description: 'Дилеры внимательнее смотрят на стабильность сборки. Слабая команда проигрывает спорные сделки.',
    duration: 2,
    demandMultiplier: 0.92,
    qualityMultiplier: 0.9,
  },
  factory_payroll_pressure: {
    label: 'Рост зарплат',
    description: 'Рынок труда перегрет: фонд оплаты и содержание линии временно становятся дороже.',
    duration: 2,
    demandMultiplier: 1.02,
    payrollMultiplier: 1.18,
    upkeepMultiplier: 1.1,
  },
  factory_dealer_campaign: {
    label: 'Акция дилеров',
    description: 'Сети магазинов готовы брать больше товара, но первыми уходят заявки с разумной ценой.',
    duration: 2,
    demandMultiplier: 1.18,
    pricePressureMultiplier: 1.2,
  },
};

const CRISIS_CARD_LABELS = {
  factory_demand_surge: 'Резкий всплеск спроса',
  factory_supplier_delay: 'Срыв поставок',
  factory_payroll_pressure: 'Давление зарплат',
};

const DECISION_HISTORY_LIMIT = 3;
const MOTORCYCLE_DECISION_INTERVAL_DAYS = 2;
const DRONE_DECISION_INTERVAL_DAYS = 2;
const MOTORCYCLE_DECISION_ROUNDS = [
  {
    roundKey: 'supplier_window',
    titleKey: 'decision_round_supplier_title',
    descriptionKey: 'decision_round_supplier_desc',
    defaultOptionKey: 'balanced_lot',
    options: [
      {
        key: 'balanced_lot',
        labelKey: 'decision_option_balanced_lot',
        effectSummaryKey: 'decision_effect_balanced_lot',
        effects: {
          debt: 3000,
          reputation: 1,
          inventory: { frames: 1, engines: 1, wheels: 2, electronics: 1 },
        },
      },
      {
        key: 'cash_bulk_buy',
        labelKey: 'decision_option_cash_bulk_buy',
        effectSummaryKey: 'decision_effect_cash_bulk_buy',
        effects: {
          money: -7000,
          reputation: 2,
          inventory: { frames: 2, engines: 2, wheels: 4, electronics: 2 },
        },
      },
      {
        key: 'skip_offer',
        labelKey: 'decision_option_skip_offer',
        effectSummaryKey: 'decision_effect_skip_offer',
        effects: {
          money: 1200,
          reputation: -2,
        },
      },
    ],
  },
  {
    roundKey: 'workforce_policy',
    titleKey: 'decision_round_workforce_title',
    descriptionKey: 'decision_round_workforce_desc',
    defaultOptionKey: 'training_grant',
    options: [
      {
        key: 'training_grant',
        labelKey: 'decision_option_training_grant',
        effectSummaryKey: 'decision_effect_training_grant',
        effects: {
          debt: 1500,
          quality: 1,
          reputation: 1,
        },
      },
      {
        key: 'overtime_push',
        labelKey: 'decision_option_overtime_push',
        effectSummaryKey: 'decision_effect_overtime_push',
        effects: {
          money: 2200,
          reputation: -2,
          finishedGoods: 1,
        },
      },
      {
        key: 'morale_bonus',
        labelKey: 'decision_option_morale_bonus',
        effectSummaryKey: 'decision_effect_morale_bonus',
        effects: {
          money: -2500,
          reputation: 3,
        },
      },
    ],
  },
  {
    roundKey: 'maintenance_window',
    titleKey: 'decision_round_maintenance_title',
    descriptionKey: 'decision_round_maintenance_desc',
    defaultOptionKey: 'preventive_maintenance',
    options: [
      {
        key: 'preventive_maintenance',
        labelKey: 'decision_option_preventive_maintenance',
        effectSummaryKey: 'decision_effect_preventive_maintenance',
        effects: {
          debt: 2000,
          automation: 1,
        },
      },
      {
        key: 'postpone_maintenance',
        labelKey: 'decision_option_postpone_maintenance',
        effectSummaryKey: 'decision_effect_postpone_maintenance',
        effects: {
          money: 2600,
          automation: -1,
          reputation: -1,
        },
      },
      {
        key: 'upgrade_line',
        labelKey: 'decision_option_upgrade_line',
        effectSummaryKey: 'decision_effect_upgrade_line',
        effects: {
          money: -6000,
          automation: 2,
          supplyLevel: 1,
        },
      },
    ],
  },
  {
    roundKey: 'dealer_campaign',
    titleKey: 'decision_round_dealer_title',
    descriptionKey: 'decision_round_dealer_desc',
    defaultOptionKey: 'targeted_campaign',
    options: [
      {
        key: 'targeted_campaign',
        labelKey: 'decision_option_targeted_campaign',
        effectSummaryKey: 'decision_effect_targeted_campaign',
        effects: {
          debt: 2500,
          reputation: 2,
        },
      },
      {
        key: 'premium_showcase',
        labelKey: 'decision_option_premium_showcase',
        effectSummaryKey: 'decision_effect_premium_showcase',
        effects: {
          money: -5000,
          quality: 1,
          reputation: 4,
        },
      },
      {
        key: 'hold_budget',
        labelKey: 'decision_option_hold_budget',
        effectSummaryKey: 'decision_effect_hold_budget',
        effects: {
          money: 2200,
          supplyLevel: -1,
          reputation: -2,
        },
      },
    ],
  },
];

const DRONE_DECISION_ROUNDS = [
  {
    roundKey: 'battery_supply',
    titleKey: 'decision_round_battery_supply_title',
    descriptionKey: 'decision_round_battery_supply_desc',
    defaultOptionKey: 'safety_stock',
    options: [
      {
        key: 'safety_stock',
        labelKey: 'decision_option_safety_stock',
        effectSummaryKey: 'decision_effect_safety_stock',
        effects: {
          debt: 2200,
          supplyLevel: 1,
          inventory: { batteries: 2, motors: 4 },
        },
      },
      {
        key: 'spot_market_cells',
        labelKey: 'decision_option_spot_market_cells',
        effectSummaryKey: 'decision_effect_spot_market_cells',
        effects: {
          money: -4800,
          quality: 1,
          inventory: { batteries: 3, controllers: 1 },
        },
      },
      {
        key: 'delay_purchase',
        labelKey: 'decision_option_delay_purchase',
        effectSummaryKey: 'decision_effect_delay_purchase',
        effects: {
          money: 1800,
          supplyLevel: -1,
          reputation: -2,
        },
      },
    ],
  },
  {
    roundKey: 'firmware_release',
    titleKey: 'decision_round_firmware_title',
    descriptionKey: 'decision_round_firmware_desc',
    defaultOptionKey: 'stability_patch',
    options: [
      {
        key: 'stability_patch',
        labelKey: 'decision_option_stability_patch',
        effectSummaryKey: 'decision_effect_stability_patch',
        effects: {
          debt: 1400,
          quality: 1,
          reputation: 1,
        },
      },
      {
        key: 'rush_features',
        labelKey: 'decision_option_rush_features',
        effectSummaryKey: 'decision_effect_rush_features',
        effects: {
          money: 2400,
          finishedGoods: 1,
          quality: -1,
          reputation: -2,
        },
      },
      {
        key: 'pilot_program',
        labelKey: 'decision_option_pilot_program',
        effectSummaryKey: 'decision_effect_pilot_program',
        effects: {
          money: -2200,
          automation: 1,
          reputation: 2,
        },
      },
    ],
  },
  {
    roundKey: 'airspace_compliance',
    titleKey: 'decision_round_compliance_title',
    descriptionKey: 'decision_round_compliance_desc',
    defaultOptionKey: 'compliance_audit',
    options: [
      {
        key: 'compliance_audit',
        labelKey: 'decision_option_compliance_audit',
        effectSummaryKey: 'decision_effect_compliance_audit',
        effects: {
          debt: 2000,
          quality: 1,
          reputation: 2,
        },
      },
      {
        key: 'delay_audit',
        labelKey: 'decision_option_delay_audit',
        effectSummaryKey: 'decision_effect_delay_audit',
        effects: {
          money: 2600,
          quality: -1,
          reputation: -3,
        },
      },
      {
        key: 'premium_certification',
        labelKey: 'decision_option_premium_certification',
        effectSummaryKey: 'decision_effect_premium_certification',
        effects: {
          money: -4500,
          quality: 1,
          reputation: 4,
        },
      },
    ],
  },
  {
    roundKey: 'payload_strategy',
    titleKey: 'decision_round_payload_title',
    descriptionKey: 'decision_round_payload_desc',
    defaultOptionKey: 'balanced_payload',
    options: [
      {
        key: 'balanced_payload',
        labelKey: 'decision_option_balanced_payload',
        effectSummaryKey: 'decision_effect_balanced_payload',
        effects: {
          debt: 1600,
          automation: 1,
        },
      },
      {
        key: 'heavy_payload',
        labelKey: 'decision_option_heavy_payload',
        effectSummaryKey: 'decision_effect_heavy_payload',
        effects: {
          money: 2600,
          supplyLevel: -1,
          reputation: -1,
          finishedGoods: 1,
        },
      },
      {
        key: 'lightweight_focus',
        labelKey: 'decision_option_lightweight_focus',
        effectSummaryKey: 'decision_effect_lightweight_focus',
        effects: {
          money: -3000,
          quality: 1,
          reputation: 2,
          supplyLevel: 1,
        },
      },
    ],
  },
];

const FACTORY_DECISION_SCENARIOS = {
  motorcycles: {
    intervalDays: MOTORCYCLE_DECISION_INTERVAL_DAYS,
    rounds: MOTORCYCLE_DECISION_ROUNDS,
  },
  drones: {
    intervalDays: DRONE_DECISION_INTERVAL_DAYS,
    rounds: DRONE_DECISION_ROUNDS,
  },
};

const DIFFICULTY_CONFIGS = {
  easy: {
    key: 'easy',
    label: 'Лёгкая',
    description: 'Guided flow, higher cash buffer, softer factory costs, and fewer visible panels.',
    uiMode: 'guided',
    visibleTabs: ['overview', 'operations', 'market', 'events'],
    advancedTabs: [],
    starterCashMultiplier: 1.18,
    costMultiplier: 0.75,
    demandMultiplier: 1.08,
    eventDemandMultiplier: 0.85,
    pricePressure: 0.65,
    bankruptcyBuffer: -45000,
    legacyBankruptcyBuffer: -45000,
    debtLimit: 210000,
    hintLevel: 'high',
  },
  normal: {
    key: 'normal',
    label: 'Normal',
    description: 'Standard Biz Arena rules with clean default panels and optional advanced tools.',
    uiMode: 'standard',
    visibleTabs: ['overview', 'operations', 'market', 'statistics', 'events'],
    advancedTabs: ['competitors', 'intel'],
    starterCashMultiplier: 1,
    costMultiplier: 1,
    demandMultiplier: 1,
    eventDemandMultiplier: 1,
    pricePressure: 1,
    bankruptcyBuffer: -20000,
    legacyBankruptcyBuffer: -30000,
    debtLimit: 150000,
    hintLevel: 'medium',
  },
  hard: {
    key: 'hard',
    label: 'Hard',
    description: 'Full interface, tighter cash, higher costs, stronger volatility, and harsher mistakes.',
    uiMode: 'advanced',
    visibleTabs: ['overview', 'operations', 'market', 'statistics', 'competitors', 'intel', 'events'],
    advancedTabs: ['competitors', 'intel'],
    starterCashMultiplier: 0.88,
    costMultiplier: 1.25,
    demandMultiplier: 0.92,
    eventDemandMultiplier: 1.25,
    pricePressure: 1.35,
    bankruptcyBuffer: -12000,
    legacyBankruptcyBuffer: -18000,
    debtLimit: 120000,
    hintLevel: 'low',
  },
};

const ACHIEVEMENTS = {
  first_win: 'First win',
  research_director: 'R&D director',
  contract_hunter: 'Contract hunter',
  industry_titan: 'Industry titan',
  goal_closer: 'Goal closer',
};



const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

let runtimeStorageInstance = null;

function getRuntimeStorage() {
  if (!runtimeStorageInstance) {
    runtimeStorageInstance = createRuntimeStorage({
      backend: STORAGE_BACKEND,
      deploymentMode: DEPLOYMENT_MODE,
      dataDir: DATA_DIR,
      jsonPath: DB_PATH,
      sqlitePath: SQLITE_PATH,
      durablePathConfigured: Boolean(process.env.BIZ_ARENA_DATA_DIR || process.env.BIZ_ARENA_SQLITE_PATH),
      createEmptyDb,
      normalizeDb,
    });
  }
  return runtimeStorageInstance;
}

const state = {
  rooms: new Map(),
  playerRoomIndex: new Map(),
  db: loadDb(),
};
const realtimeTicketStore = createRealtimeTicketStore();

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

let classroomIdentityInstance = null;

function getClassroomIdentity() {
  if (!classroomIdentityInstance) {
    classroomIdentityInstance = createClassroomIdentity({
      getRooms: () => state.rooms,
      getDb: () => state.db,
      persistRuntimeState,
      persistDbDebounced,
      isClassPlayer,
      isPlayerSessionParticipant: player => Boolean(player) && !player.isBot,
      safeName,
      uid,
      allowRegistration: ALLOW_REGISTRATION,
      teacherSessionTtlMs: TEACHER_SESSION_TTL_MS,
    });
  }
  return classroomIdentityInstance;
}

function createSessionToken() { return getClassroomIdentity().player.createSessionToken(); }
function ensurePlayerSessionToken(player) { return getClassroomIdentity().player.ensureSessionToken(player); }
function requirePlayerSession(player, providedToken) { return getClassroomIdentity().player.requireSession(player, providedToken); }
function ensurePlayerSecurityState(player) { return getClassroomIdentity().player.ensureSecurityState(player); }
function resolvePlayerSession(providedToken, claimedPlayerId = '') { return getClassroomIdentity().player.resolveSession(providedToken, claimedPlayerId); }
function verifyClientActionEnvelope(room, player, body, req = {}) { return getClassroomIdentity().player.verifyActionEnvelope(room, player, body, req); }

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 5; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return state.rooms.has(code) ? roomCode() : code;
}

function normalizeRoomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : '';
}

function randomDirectoryId() {
  return crypto.randomBytes(18).toString('base64url');
}

function normalizeDirectoryId(value) {
  const directoryId = String(value || '').trim();
  return DIRECTORY_ID_PATTERN.test(directoryId) ? directoryId : '';
}

function normalizeLobbyVisibility(value) {
  return value === 'listed' ? 'listed' : 'code-only';
}

function ensureRoomDirectoryId(room) {
  const current = normalizeDirectoryId(room?.directoryId);
  if (current) return current;
  const directoryId = randomDirectoryId();
  if (room) room.directoryId = directoryId;
  return directoryId;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDifficulty(value, fallback = 'normal') {
  const key = String(value || '').trim();
  return DIFFICULTY_CONFIGS[key] ? key : fallback;
}

function difficultyConfigForKey(value, fallback = 'normal') {
  return DIFFICULTY_CONFIGS[normalizeDifficulty(value, fallback)] || DIFFICULTY_CONFIGS.normal;
}

function difficultyConfigForRoom(room) {
  return difficultyConfigForKey(room?.settings?.difficulty, 'normal');
}

function publicDifficultyRules(config) {
  return {
    key: config.key,
    label: config.label,
    description: config.description,
    uiMode: config.uiMode,
    visibleTabs: [...config.visibleTabs],
    advancedTabs: [...config.advancedTabs],
    starterCashMultiplier: config.starterCashMultiplier,
    costMultiplier: config.costMultiplier,
    demandMultiplier: config.demandMultiplier,
    eventDemandMultiplier: config.eventDemandMultiplier,
    pricePressure: config.pricePressure,
    bankruptcyBuffer: config.bankruptcyBuffer,
    legacyBankruptcyBuffer: config.legacyBankruptcyBuffer,
    debtLimit: config.debtLimit,
    hintLevel: config.hintLevel,
  };
}

function difficultyCatalog() {
  return Object.values(DIFFICULTY_CONFIGS).map(publicDifficultyRules);
}

function createEmptyDb() {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    accounts: {},
    teacherAccounts: {},
    teacherSessions: {},
    activeRooms: {},
    savedRooms: {},
    completedSessions: {},
  };
}

function ensureSnapshotSettings(settings) {
  const defaults = defaultRoomSettings();
  const merged = {
    ...defaults,
    ...(isPlainObject(settings) ? settings : {}),
  };
  merged.difficulty = normalizeDifficulty(merged.difficulty, 'normal');
  merged.practiceMode = normalizePracticeMode(merged.practiceMode);
  merged.dayLimit = normalizeDayLimit(merged.dayLimit);
  merged.turnDurationMs = normalizeManualTurnDurationMs(merged.turnDurationMs);
  return merged;
}

function normalizeTeacherPhaseLock(value) {
  return TEACHER_PHASE_LOCKS[value] ? value : 'open';
}

function defaultTeacherState() {
  return {
    phaseLock: 'open',
    updatedAt: null,
    actorPlayerId: null,
  };
}

function ensureTeacherState(teacherState) {
  return {
    ...defaultTeacherState(),
    ...(isPlainObject(teacherState) ? teacherState : {}),
    phaseLock: normalizeTeacherPhaseLock(teacherState?.phaseLock),
  };
}

function nullableFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function persistedDataError(message, details = {}) {
  return Object.assign(new Error(message), {
    code: 'BIZ_ARENA_INVALID_PERSISTED_DATA',
    ...details,
  });
}

function readDbRecord(db, key) {
  if (!Object.hasOwn(db, key)) return {};
  if (!isPlainObject(db[key])) {
    throw persistedDataError(`Database field ${key} must be an object`, { field: key });
  }
  return db[key];
}

function validateRawRoomSnapshotShape(snapshot) {
  const arrayFields = [
    'players',
    'log',
    'adminSnapshots',
    'marketHistory',
    'segmentSnapshots',
    'contractBoard',
  ];
  for (const field of arrayFields) {
    if (Object.hasOwn(snapshot, field) && !Array.isArray(snapshot[field])) {
      throw persistedDataError(`Room snapshot field ${field} must be an array`, { field });
    }
  }

  for (const field of ['settings', 'teacherState']) {
    if (Object.hasOwn(snapshot, field) && !isPlainObject(snapshot[field])) {
      throw persistedDataError(`Room snapshot field ${field} must be an object`, { field });
    }
  }

  for (const field of ['activeEvent', 'factoryScenario']) {
    if (Object.hasOwn(snapshot, field) && snapshot[field] !== null && !isPlainObject(snapshot[field])) {
      throw persistedDataError(`Room snapshot field ${field} must be an object or null`, { field });
    }
  }

  if (Object.hasOwn(snapshot, 'status') && (typeof snapshot.status !== 'string' || !snapshot.status.trim())) {
    throw persistedDataError('Room snapshot status must be a non-empty string', { field: 'status' });
  }
  if (Object.hasOwn(snapshot, 'day') && (!Number.isFinite(Number(snapshot.day)) || Number(snapshot.day) < 1)) {
    throw persistedDataError('Room snapshot day must be a positive number', { field: 'day' });
  }
  if (Object.hasOwn(snapshot, 'tick') && (!Number.isFinite(Number(snapshot.tick)) || Number(snapshot.tick) < 0)) {
    throw persistedDataError('Room snapshot tick must be a non-negative number', { field: 'tick' });
  }
}

function normalizeSavedRoomError(error, roomCode = '') {
  if (isSchemaMigrationError(error) || error?.code === 'BIZ_ARENA_INVALID_PERSISTED_DATA') return error;
  return persistedDataError(
    `Saved room ${roomCode || 'entry'} is invalid: ${error?.message || 'unknown error'}`,
    { roomCode, cause: error }
  );
}

function migrateRoomSnapshotV1ToV2(snapshot) {
  return {
    ...snapshot,
    schemaVersion: 2,
    status: typeof snapshot.status === 'string' ? snapshot.status : 'lobby',
    day: Math.max(1, Number(snapshot.day) || 1),
    tick: Math.max(0, Number(snapshot.tick) || 0),
    winnerPlayerId: snapshot.winnerPlayerId || null,
    log: Array.isArray(snapshot.log) ? snapshot.log : [],
    marketHistory: Array.isArray(snapshot.marketHistory) ? snapshot.marketHistory : [],
    segmentSnapshots: Array.isArray(snapshot.segmentSnapshots) ? snapshot.segmentSnapshots : [],
    settings: ensureSnapshotSettings(snapshot.settings),
    activeEvent: isPlainObject(snapshot.activeEvent) ? snapshot.activeEvent : null,
    contractBoard: Array.isArray(snapshot.contractBoard) ? snapshot.contractBoard : [],
    lastSavedAt: snapshot.lastSavedAt || null,
    players: Array.isArray(snapshot.players) ? snapshot.players : [],
  };
}

function migrateRoomSnapshotV2ToV3(snapshot) {
  return {
    ...snapshot,
    schemaVersion: 3,
    teacherAccountId: typeof snapshot.teacherAccountId === 'string' ? snapshot.teacherAccountId : '',
    version: Math.max(1, Number(snapshot.version) || 1),
    finishReason: typeof snapshot.finishReason === 'string' ? snapshot.finishReason : null,
    startedAt: typeof snapshot.startedAt === 'string' ? snapshot.startedAt : null,
    finishedAt: typeof snapshot.finishedAt === 'string' ? snapshot.finishedAt : null,
    completedSessionId: typeof snapshot.completedSessionId === 'string' ? snapshot.completedSessionId : '',
    adminSnapshots: Array.isArray(snapshot.adminSnapshots) ? snapshot.adminSnapshots : [],
    teacherState: ensureTeacherState(snapshot.teacherState),
    factoryScenario: isPlainObject(snapshot.factoryScenario) ? snapshot.factoryScenario : null,
    turnStartedAt: nullableFiniteNumber(snapshot.turnStartedAt),
    pausedRemainingMs: nullableFiniteNumber(snapshot.pausedRemainingMs),
  };
}

function migrateDbV1ToV2(db) {
  return {
    ...db,
    schemaVersion: 2,
    accounts: readDbRecord(db, 'accounts'),
    savedRooms: readDbRecord(db, 'savedRooms'),
  };
}

function migrateDbV2ToV3(db) {
  return {
    ...db,
    schemaVersion: 3,
    teacherAccounts: readDbRecord(db, 'teacherAccounts'),
    teacherSessions: readDbRecord(db, 'teacherSessions'),
    activeRooms: readDbRecord(db, 'activeRooms'),
  };
}

function migrateDbV3ToV4(db) {
  return {
    ...db,
    schemaVersion: 4,
    completedSessions: readDbRecord(db, 'completedSessions'),
  };
}

function validateRoomSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) throw new Error('Snapshot must be an object');
  if (typeof snapshot.code !== 'string' || !snapshot.code.trim()) throw new Error('Snapshot room code is required');
  if (typeof snapshot.name !== 'string' || !snapshot.name.trim()) throw new Error('Snapshot room name is required');
  if (!Array.isArray(snapshot.players)) throw new Error('Snapshot players must be an array');
  if (!isPlainObject(snapshot.settings)) throw new Error('Snapshot settings must be an object');
  if (typeof snapshot.status !== 'string' || !snapshot.status.trim()) throw new Error('Snapshot status is required');
  if (!Number.isFinite(Number(snapshot.day)) || Number(snapshot.day) < 1) throw new Error('Snapshot day must be a positive number');
  if (!Number.isFinite(Number(snapshot.tick)) || Number(snapshot.tick) < 0) throw new Error('Snapshot tick must be a non-negative number');
}

function migrateRoomSnapshot(rawSnapshot) {
  if (!isPlainObject(rawSnapshot)) throw new Error('Snapshot payload is invalid');
  validateRawRoomSnapshotShape(rawSnapshot);

  const migration = roomSnapshotMigrationRegistry.migrate(rawSnapshot);
  const snapshot = migration.value;
  const migrated = {
    ...snapshot,
    schemaVersion: ROOM_SNAPSHOT_SCHEMA_VERSION,
    teacherAccountId: typeof snapshot.teacherAccountId === 'string' ? snapshot.teacherAccountId : '',
    directoryId: normalizeDirectoryId(snapshot.directoryId) || randomDirectoryId(),
    lobbyVisibility: normalizeLobbyVisibility(snapshot.lobbyVisibility),
    version: Math.max(1, Number(snapshot.version) || 1),
    createdAt: Number(snapshot.createdAt) || Date.now(),
    lastActivityAt: Number(snapshot.lastActivityAt) || Number(snapshot.createdAt) || Date.now(),
    status: typeof snapshot.status === 'string' ? snapshot.status : 'lobby',
    day: Math.max(1, Number(snapshot.day) || 1),
    tick: Math.max(0, Number(snapshot.tick) || 0),
    winnerPlayerId: snapshot.winnerPlayerId || null,
    finishReason: typeof snapshot.finishReason === 'string' ? snapshot.finishReason : null,
    log: Array.isArray(snapshot.log) ? snapshot.log : [],
    adminSnapshots: Array.isArray(snapshot.adminSnapshots) ? snapshot.adminSnapshots : [],
    marketHistory: Array.isArray(snapshot.marketHistory) ? snapshot.marketHistory : [],
    segmentSnapshots: Array.isArray(snapshot.segmentSnapshots) ? snapshot.segmentSnapshots : [],
    settings: ensureSnapshotSettings(snapshot.settings),
    teacherState: ensureTeacherState(snapshot.teacherState),
    activeEvent: isPlainObject(snapshot.activeEvent) ? snapshot.activeEvent : null,
    contractBoard: Array.isArray(snapshot.contractBoard) ? snapshot.contractBoard : [],
    factoryScenario: isPlainObject(snapshot.factoryScenario) ? snapshot.factoryScenario : null,
    lastSavedAt: snapshot.lastSavedAt || null,
    turnStartedAt: nullableFiniteNumber(snapshot.turnStartedAt),
    pausedRemainingMs: nullableFiniteNumber(snapshot.pausedRemainingMs),
    players: Array.isArray(snapshot.players) ? snapshot.players : [],
  };

  validateRoomSnapshot(migrated);
  migrated.schemaVersion = ROOM_SNAPSHOT_SCHEMA_VERSION;
  return migrated;
}

function migrateSavedRoomEntry(entry) {
  if (!isPlainObject(entry)) throw persistedDataError('Saved room entry must be an object');
  if (!Object.hasOwn(entry, 'snapshot')) throw persistedDataError('Saved room entry must contain a snapshot');

  let snapshot = null;
  let previousSnapshot = null;
  try {
    snapshot = migrateRoomSnapshot(entry.snapshot);
  } catch (error) {
    if (isSchemaMigrationError(error)) throw error;
    if (!entry.previousSnapshot) {
      throw normalizeSavedRoomError(error, entry.meta?.roomCode);
    }
    try {
      snapshot = migrateRoomSnapshot(entry.previousSnapshot);
    } catch (previousError) {
      throw normalizeSavedRoomError(previousError, entry.meta?.roomCode);
    }
  }

  if (entry.previousSnapshot) {
    try {
      previousSnapshot = migrateRoomSnapshot(entry.previousSnapshot);
    } catch (error) {
      if (isSchemaMigrationError(error)) throw error;
      previousSnapshot = null;
    }
  }

  const migrated = {
    meta: { ...readDbRecord(entry, 'meta') },
    snapshot,
  };

  if (previousSnapshot) migrated.previousSnapshot = previousSnapshot;

  migrated.meta.schemaVersion = ROOM_SNAPSHOT_SCHEMA_VERSION;
  return migrated;
}

function normalizeDb(raw) {
  if (!isPlainObject(raw)) throw new Error('DB root must be an object');

  const migration = databaseMigrationRegistry.migrate(raw);
  const database = migration.value;
  const normalized = {
    schemaVersion: DB_SCHEMA_VERSION,
    accounts: readDbRecord(database, 'accounts'),
    teacherAccounts: readDbRecord(database, 'teacherAccounts'),
    teacherSessions: readDbRecord(database, 'teacherSessions'),
    activeRooms: {},
    savedRooms: {},
    completedSessions: readDbRecord(database, 'completedSessions'),
  };

  Object.entries(readDbRecord(database, 'activeRooms')).forEach(([roomCodeKey, snapshot]) => {
    try {
      normalized.activeRooms[roomCodeKey] = migrateRoomSnapshot(snapshot);
    } catch (error) {
      if (isSchemaMigrationError(error)) throw error;
      throw persistedDataError(
        `Active room ${roomCodeKey || 'entry'} is invalid: ${error?.message || 'unknown error'}`,
        { roomCode: roomCodeKey, cause: error }
      );
    }
  });

  Object.entries(readDbRecord(database, 'savedRooms')).forEach(([roomCodeKey, entry]) => {
    const migrated = migrateSavedRoomEntry(entry);
    if (migrated) normalized.savedRooms[roomCodeKey] = migrated;
  });

  normalized.schemaVersion = DB_SCHEMA_VERSION;
  return normalized;
}

function atomicWriteJson(...args) { return getRuntimeStorage().atomicWriteJson(...args); }
function readJsonWithRecovery(...args) { return getRuntimeStorage().readJsonWithRecovery(...args); }
function loadDbFromDisk(...args) { return getRuntimeStorage().loadDbFromDisk(...args); }
function persistDbToDisk(...args) { return getRuntimeStorage().persistDbToDisk(...args); }
function loadDbFromSqlite(...args) { return getRuntimeStorage().loadDbFromSqlite(...args); }
function persistDbToSqlite(...args) { return getRuntimeStorage().persistDbToSqlite(...args); }
function storageInfo() { return getRuntimeStorage().info(); }

function safeName(input, fallback = 'Игрок') {
  const normalized = String(input || fallback)
    .replace(/[<>&"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return normalized || fallback;
}

function sanitizeAvatar(avatar) {
  if (typeof avatar !== 'string') return '';
  if (!avatar.startsWith('data:image/')) return '';
  return avatar.slice(0, MAX_AVATAR_LENGTH);
}

function normalizeAccountKey(userName) {
  return safeName(userName, 'Player').toLowerCase().replace(/\s+/g, '-');
}

function findHumanPlayerByUserName(room, userName) {
  const accountKey = normalizeAccountKey(userName);
  return [...room.players.values()].find(player => isClassPlayer(player) && normalizeAccountKey(player.userName) === accountKey) || null;
}

function isClassPlayer(player) {
  return Boolean(player) && !player.isBot && !player.isTeacherHost;
}

function isActiveCompetitor(player) {
  return Boolean(player) && !player.bankrupt && !player.isTeacherHost;
}

function loadDb() {
  try {
    const storage = getRuntimeStorage();
    const loaded = storage.load();
    const recovery = storage.info().recovery;
    if (recovery) {
      operationalLog('warn', 'storage-recovered', {
        backend: STORAGE_BACKEND,
        source: recovery.source,
        recoveredAt: recovery.recoveredAt,
      });
    }
    return loaded;
  } catch (error) {
    operationalLog('error', 'storage-load-failed', {
      backend: STORAGE_BACKEND,
      path: STORAGE_BACKEND === 'sqlite' ? SQLITE_PATH : DB_PATH,
      code: error.code || 'STORAGE_LOAD_FAILED',
      message: error.message,
    });
    throw error;
  }
}

function persistDb() {
  state.db = getRuntimeStorage().persist(state.db);
}

let persistTimer = null;
let activeRoomsPersistenceDirty = false;

function persistDbDebounced(delayMs = 250) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (activeRoomsPersistenceDirty) {
      syncActiveRoomsToDb();
      activeRoomsPersistenceDirty = false;
    }
    persistDb();
  }, delayMs);
}

function syncActiveRoomsToDb() {
  state.db.activeRooms = {};
  state.rooms.forEach(room => {
    state.db.activeRooms[room.code] = serializeRoom(room);
  });
}

function persistRuntimeState({ immediate = false } = {}) {
  if (immediate) {
    syncActiveRoomsToDb();
    activeRoomsPersistenceDirty = false;
    persistDb();
    return;
  }
  activeRoomsPersistenceDirty = true;
  persistDbDebounced();
}

function touchPlayer(player) {
  if (!player) return;
  player.version = Math.max(1, Number(player.version) || 1) + 1;
}

function touchRoom(room, ...players) {
  if (!room) return;
  room.version = Math.max(1, Number(room.version) || 1) + 1;
  room.lastActivityAt = Date.now();
  players.filter(Boolean).forEach(touchPlayer);
}

function restoreActiveRoomsFromDb() {
  Object.values(state.db.activeRooms || {}).forEach(snapshot => {
    const room = hydrateRoom(snapshot);
    state.rooms.set(room.code, room);
    room.players.forEach(player => {
      state.playerRoomIndex.set(player.id, room.code);
    });
  });
}

function flushRuntimeState() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistRuntimeState({ immediate: true });
}

function publicTeacherAccount(account) { return getClassroomIdentity().teacher.publicAccount(account); }
function createTeacherAccount(input) { return getClassroomIdentity().teacher.createAccount(input); }
function createTeacherSession(account) { return getClassroomIdentity().teacher.createSession(account); }
function loginTeacher(input) { return getClassroomIdentity().teacher.login(input); }
function resolveTeacherSessionToken(token) { return getClassroomIdentity().teacher.resolveSessionToken(token); }
function resolveTeacherRequest(req, url) { return getClassroomIdentity().teacher.resolveRequest(req, url); }

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function operationalLog(level, event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const output = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') console.error(output);
  else console.log(output);
}

async function createQrSvg(data) {
  const value = String(data || '').trim();
  if (!value) {
    const error = new Error('QR data is required');
    error.status = 400;
    throw error;
  }
  if (value.length > 320) {
    const error = new Error('QR data is too long');
    error.status = 400;
    throw error;
  }
  return QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 196,
    color: {
      dark: '#04121e',
      light: '#f2fbff',
    },
  });
}

function allowedDiagnosticHosts() {
  const meta = getRuntimeMeta();
  return new Set([
    ...meta.localUrls,
    ...meta.lanUrls,
  ].map(rawUrl => {
    try {
      return new URL(rawUrl).host;
    } catch (_error) {
      return '';
    }
  }).filter(Boolean));
}

function validateDiagnosticHealthUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value || value.length > 320) {
    const error = new Error('Health URL is required');
    error.status = 400;
    throw error;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    const error = new Error('Health URL is invalid');
    error.status = 400;
    throw error;
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/api/health') {
    const error = new Error('Only /api/health URLs can be checked');
    error.status = 400;
    throw error;
  }
  if (!allowedDiagnosticHosts().has(parsed.host)) {
    const error = new Error('This health URL is not one of the advertised Biz Arena addresses');
    error.status = 403;
    throw error;
  }
  return parsed;
}

function checkNetworkHealthUrl(rawUrl) {
  const parsed = validateDiagnosticHealthUrl(rawUrl);
  const startedAt = Date.now();
  const client = parsed.protocol === 'https:' ? https : http;
  return new Promise(resolve => {
    const request = client.get(parsed, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 2048) request.destroy();
      });
      response.on('end', () => {
        let okPayload = false;
        try {
          okPayload = JSON.parse(body).ok === true;
        } catch (_error) {
          okPayload = false;
        }
        resolve({
          ok: response.statusCode === 200 && okPayload,
          status: response.statusCode || 0,
          elapsedMs: Date.now() - startedAt,
          url: parsed.toString(),
        });
      });
    });
    request.setTimeout(3500, () => {
      request.destroy(new Error('timeout'));
    });
    request.on('error', error => {
      resolve({
        ok: false,
        status: 0,
        elapsedMs: Date.now() - startedAt,
        url: parsed.toString(),
        error: error.message,
      });
    });
  });
}

function detectLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = new Set();

  Object.values(interfaces).flat().forEach(entry => {
    if (!entry || entry.internal) return;
    if (entry.family !== 'IPv4') return;
    urls.add(`http://${entry.address}:${port}`);
  });

  return [...urls].sort();
}

function getRuntimeMeta() {
  const port = Number(PORT);
  const publicBase = PUBLIC_URL || '';
  const cloudUrls = publicBase ? [publicBase] : [];
  return {
    version: APP_VERSION,
    appMode: APP_MODE,
    deployment: DEPLOYMENT_MODE,
    publicUrl: publicBase,
    cloudUrls,
    allowRegistration: ALLOW_REGISTRATION,
    storage: storageInfo(),
    desktopShell: process.env.BIZ_ARENA_DESKTOP === '1',
    host: HOST,
    port,
    localUrls: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
    lanUrls: detectLanUrls(port),
  };
}

function serverOverview() {
  const meta = getRuntimeMeta();
  const rooms = [...state.rooms.values()].map(room => {
    const currentAdminSnapshot = buildServerAdminRoomSnapshot(room);
    const players = [...room.players.values()];
    const visiblePlayers = players.filter(player => !player.isTeacherHost);
    const humans = players.filter(isClassPlayer);
    const storedSnapshots = Array.isArray(room.adminSnapshots) ? room.adminSnapshots : [];
    const adminDaysByDay = new Map(storedSnapshots.map(snapshot => [snapshot.day, snapshot]));
    adminDaysByDay.set(currentAdminSnapshot.day, currentAdminSnapshot);
    const adminDays = [...adminDaysByDay.values()].sort((left, right) => left.day - right.day);
    const host = room.players.get(room.hostPlayerId) || [...room.players.values()].find(isClassPlayer);
    return {
      code: room.code,
      name: room.name,
      status: room.status,
      version: Math.max(1, Number(room.version) || 1),
      scenarioLabel: scenarioLabel(room.settings.scenarioKey),
      difficulty: room.settings.difficulty || 'normal',
      day: room.day,
      tick: room.tick,
      finishReason: room.finishReason || null,
      dayLimit: room.settings.dayLimit || MAX_TURN_COUNT,
      turnDurationMs: turnDurationMsForRoom(room),
      maxPlayers: room.settings.maxPlayers,
      playerCount: visiblePlayers.length,
      humanCount: humans.length,
      readyCount: humans.filter(player => player.ready).length,
      hostUserName: room.players.get(room.hostPlayerId)?.userName || '',
      leader: currentAdminSnapshot.leader,
      classStats: currentAdminSnapshot.classStats,
      players: currentAdminSnapshot.players.filter(player => !player.isTeacherHost),
      adminDays,
      teacherControls: publicTeacherControls(room, host?.id || ''),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    appMode: APP_MODE,
    deployment: DEPLOYMENT_MODE,
    publicUrl: meta.publicUrl || '',
    storage: meta.storage,
    port: meta.port,
    localUrls: meta.localUrls,
    lanUrls: meta.lanUrls,
    lanUrlCount: meta.lanUrls.length,
    roomCount: rooms.length,
    runningRooms: rooms.filter(room => room.status === 'running').length,
    humanPlayers: rooms.reduce((sum, room) => sum + room.humanCount, 0),
    rooms,
  };
}

function buildServerAdminRoomSnapshot(room) {
  const players = [...room.players.values()].map(player => serverAdminPlayerSnapshot(room, player));
  const humans = players.filter(isClassPlayer);
  const leader = [...humans].sort((a, b) => b.capital - a.capital || b.money - a.money)[0] || null;
  return {
    day: room.day,
    tick: room.tick,
    status: room.status,
    generatedAt: new Date().toISOString(),
    leader,
    classStats: {
      totalMoney: humans.reduce((sum, player) => sum + player.money, 0),
      totalCapital: humans.reduce((sum, player) => sum + player.capital, 0),
      totalDebt: humans.reduce((sum, player) => sum + player.debt, 0),
      totalPayroll: humans.reduce((sum, player) => sum + player.payroll, 0),
      totalMarketOffer: humans.reduce((sum, player) => sum + player.marketOfferValue, 0),
      totalFinishedGoods: humans.reduce((sum, player) => sum + player.finishedGoods, 0),
      totalSoldLastTurn: humans.reduce((sum, player) => sum + player.soldLastTurn, 0),
      totalRejectedActions: humans.reduce((sum, player) => sum + Number(player.rejectedActionCount || 0), 0),
      totalAcceptedActions: humans.reduce((sum, player) => sum + Number(player.acceptedActionCount || 0), 0),
      readyCount: humans.filter(player => player.ready).length,
    },
    players,
  };
}

function recordServerAdminSnapshot(room) {
  const snapshot = buildServerAdminRoomSnapshot(room);
  const existing = Array.isArray(room.adminSnapshots) ? room.adminSnapshots : [];
  const withoutSameDay = existing.filter(item => item.day !== snapshot.day);
  room.adminSnapshots = [...withoutSameDay, snapshot]
    .sort((left, right) => left.day - right.day)
    .slice(-MAX_TURN_COUNT);
  return snapshot;
}

function serverAdminPlayerSnapshot(room, player) {
  const factory = player.factory || null;
  const config = factory ? factoryScenarioConfig(factory.scenarioKey || room.settings.scenarioKey) : null;
  const workers = factory?.workers || [];
  const components = config
    ? Object.entries(config.components || {}).map(([key, component]) => ({
      key,
      label: component.label,
      quantity: Math.round(Number(factory.inventory?.[key] || 0)),
      unitCost: Math.round(Number(component.unitCost || 0)),
      recipe: Math.round(Number(component.recipe || 1)),
    }))
    : [];
  const rawStock = components.reduce((sum, component) => sum + component.quantity, 0);
  const componentText = components.length
    ? components.map(component => `${component.label}: ${component.quantity}`).join(' • ')
    : `${Math.round(player.rawStock || 0)} ед.`;
  const payroll = workers.length
    ? workers.reduce((sum, worker) => sum + Number(worker.expectedSalary || 0), 0)
    : Number(player.salary || 0) * Number(player.staff || 0);
  const avgSuitability = workers.length
    ? Math.round(workers.reduce((sum, worker) => sum + Number(worker.suitability || 0), 0) / workers.length)
    : 0;
  const finishedGoods = Math.round(Number(factory?.finishedGoods ?? player.productStock ?? 0));
  const capacity = config && factory ? Math.round(availableAssemblyCount(factory, config)) : Math.round(Number(player.factories || 0) * 8);
  const salePrice = Math.round(Number(factory?.saleOffer?.price || player.price || config?.basePrice || 0));
  const saleQuantity = Math.round(Number(factory?.saleOffer?.quantity || 0));
  const soldLastTurn = Math.round(Number(factory?.soldThisTurn ?? player.soldLastTick ?? 0));
  const revenueLastTurn = Math.round(Number(factory?.revenueThisTurn || player.lastTickBreakdown?.revenue || 0));
  const expensesLastTurn = Math.round(Number(player.lastTickBreakdown?.expenses || factory?.workerPayroll || payroll || 0));
  const profitLastTurn = Math.round(Number(player.lastTickBreakdown?.profit || revenueLastTurn - expensesLastTurn));
  const capital = Math.round(player.netWorth || (player.money + playerAssets(player) - player.debt));
  const stockValue = config && factory
    ? Math.round(
      finishedGoods * (config.basePrice || 0)
      + components.reduce((sum, component) => sum + component.quantity * component.unitCost, 0)
    )
    : Math.round((player.productStock || 0) * 70 + (player.rawStock || 0) * 30);
  const security = ensurePlayerSecurityState(player);
  return {
    id: player.id,
    userName: player.userName || player.name,
    companyName: player.name,
    ready: Boolean(player.ready),
    isHost: player.id === room.hostPlayerId,
    isBot: Boolean(player.isBot),
    isTeacherHost: Boolean(player.isTeacherHost),
    bankrupt: Boolean(player.bankrupt),
    status: player.ready ? 'ready' : 'not-ready',
    money: Math.round(player.money || 0),
    capital,
    debt: Math.round(player.debt || 0),
    marketOfferValue: Math.round(salePrice * saleQuantity),
    marketOfferText: `${saleQuantity} ед. @ ${salePrice} ₽`,
    payroll: Math.round(payroll),
    workerCount: workers.length || Math.round(Number(player.staff || 0)),
    avgSuitability,
    capacity,
    finishedGoods,
    rawStock,
    componentText,
    stockValue,
    soldLastTurn,
    revenueLastTurn,
    expensesLastTurn,
    profitLastTurn,
    productLabel: config?.productLabel || productLabel(player.productKey || room.settings.scenarioKey),
    lastAction: player.lastAction || '',
    acceptedActionCount: Math.round(Number(security.acceptedActionCount || 0)),
    rejectedActionCount: Math.round(Number(security.rejectedActionCount || 0)),
    lastRejectReason: security.lastRejectReason || '',
    lastRemoteAddress: security.lastRemoteAddress || '',
    lastActionAt: Math.round(Number(security.lastActionAt || 0)),
  };
}

function handleServerAdminAction(body = {}) {
  const roomCode = String(body.roomCode || '').trim().toUpperCase();
  const room = state.rooms.get(roomCode);
  if (!room) throw Object.assign(new Error('Комната не найдена'), { status: 404 });
  const host = room.players.get(room.hostPlayerId) || [...room.players.values()].find(isClassPlayer);
  if (!host) throw Object.assign(new Error('В комнате нет хоста для управления матчем'), { status: 400 });
  const action = String(body.action || '');
  if (action === 'close-room' || action === 'finish-and-close-room') {
    return closeRoom(room, {
      finishActive: action === 'finish-and-close-room',
      reason: 'closed_by_local_admin',
    });
  }
  const hostActions = new Set([
    'start-game',
    'pause-game',
    'resume-game',
    'next-turn',
    'save-room',
    'reset-room',
    'add-bot',
    'force-event',
    'force-decision-round',
    'run-experiment',
    'set-phase-lock',
    'update-room-settings',
    'finish-room',
    'acknowledge-help-request',
    'resolve-help-request',
    'accept-pause-request',
  ]);
  if (hostActions.has(action)) {
    handleRoomAction(room, host, { ...body, action, value: body.value });
    touchRoom(room, host);
    persistRuntimeState();
    return {
      roomCode: room.code,
      action,
      status: room.status,
      day: room.day,
      tick: room.tick,
      lifecycle: publicTeacherControls(room, host.id).lifecycle,
    };
  }
  throw Object.assign(new Error('Неизвестное действие панели преподавателя'), { status: 400 });
}

function teacherOwnsRoom(teacher, room) {
  return Boolean(teacher?.id && room?.teacherAccountId && room.teacherAccountId === teacher.id);
}

function cloudTeacherOverview(teacher) {
  const meta = getRuntimeMeta();
  const rooms = [...state.rooms.values()]
    .filter(room => teacherOwnsRoom(teacher, room))
    .map(room => {
      const currentAdminSnapshot = buildServerAdminRoomSnapshot(room);
      const humans = currentAdminSnapshot.players.filter(isClassPlayer);
      const host = room.players.get(room.hostPlayerId) || [...room.players.values()].find(isClassPlayer);
      return {
        code: room.code,
        name: room.name,
        status: room.status,
        version: Math.max(1, Number(room.version) || 1),
        scenarioLabel: scenarioLabel(room.settings.scenarioKey),
        difficulty: room.settings.difficulty || 'normal',
        day: room.day,
        tick: room.tick,
        dayLimit: room.settings.dayLimit || MAX_TURN_COUNT,
        turnDurationMs: turnDurationMsForRoom(room),
        maxPlayers: room.settings.maxPlayers,
        playerCount: humans.length,
        humanCount: humans.length,
        readyCount: humans.filter(player => player.ready).length,
        hostUserName: host?.userName || teacher.displayName,
        leader: currentAdminSnapshot.leader,
        classStats: currentAdminSnapshot.classStats,
        players: currentAdminSnapshot.players.filter(isClassPlayer),
        activeEvent: room.activeEvent,
        teacherControls: publicTeacherControls(room, host?.id || ''),
        studentUrl: cloudStudentUrl(room.code),
      };
    });
  return {
    generatedAt: new Date().toISOString(),
    version: rooms.reduce((sum, room) => sum + Number(room.version || 0), rooms.length),
    deployment: DEPLOYMENT_MODE,
    publicUrl: meta.publicUrl || '',
    storage: meta.storage,
    teacher: publicTeacherAccount(teacher),
    roomCount: rooms.length,
    runningRooms: rooms.filter(room => room.status === 'running').length,
    humanPlayers: rooms.reduce((sum, room) => sum + room.humanCount, 0),
    rooms,
  };
}

function cloudStudentUrl(roomCode = '') {
  const meta = getRuntimeMeta();
  const base = (meta.publicUrl || meta.localUrls?.[0] || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  return `${base}/client${roomCode ? `?roomCode=${encodeURIComponent(roomCode)}` : ''}`;
}

function handleTeacherAction(teacher, body = {}) {
  const action = String(body.action || '').trim();
  if (action === 'create-room') {
    const payload = createRoom({
      roomName: body.roomName || `${teacher.displayName} Classroom`,
      companyName: body.companyName || `${teacher.displayName} Host`,
      userName: teacher.displayName,
      scenarioKey: body.scenarioKey || 'motorcycles',
      difficulty: body.difficulty || 'easy',
      maxPlayers: body.maxPlayers,
      demandProfile: body.demandProfile,
      dayLimit: body.dayLimit,
      turnDurationMs: body.turnDurationMs,
      lobbyVisibility: body.lobbyVisibility,
      teacherAccountId: teacher.id,
    });
    touchRoom(payload.room, payload.player);
    persistRuntimeState({ immediate: true });
    return {
      action,
      roomCode: payload.room.code,
      studentUrl: cloudStudentUrl(payload.room.code),
      room: roomSummary(payload.room, payload.player.id, { view: 'teacher' }),
    };
  }

  const roomCode = String(body.roomCode || '').trim().toUpperCase();
  const room = state.rooms.get(roomCode);
  if (!room) throw Object.assign(new Error('Комната не найдена'), { status: 404 });
  if (!teacherOwnsRoom(teacher, room)) {
    throw Object.assign(new Error('Эта cloud room принадлежит другому преподавателю.'), { status: 403 });
  }

  if (action === 'close-room' || action === 'finish-and-close-room') {
    return closeRoom(room, {
      finishActive: action === 'finish-and-close-room',
      reason: 'closed_by_teacher',
    });
  }

  const host = room.players.get(room.hostPlayerId) || [...room.players.values()].find(isClassPlayer);
  if (!host) throw Object.assign(new Error('В комнате нет хоста для управления матчем'), { status: 400 });
  const teacherActions = new Set([
    'start-game',
    'pause-game',
    'resume-game',
    'next-turn',
    'save-room',
    'reset-room',
    'add-bot',
    'force-event',
    'finish-room',
    'acknowledge-help-request',
    'resolve-help-request',
    'accept-pause-request',
  ]);
  if (!teacherActions.has(action)) {
    throw Object.assign(new Error('Неизвестное действие cloud-панели преподавателя'), { status: 400 });
  }
  handleRoomAction(room, host, { action, value: body.value });
  touchRoom(room, host);
  persistRuntimeState();
  return {
    roomCode: room.code,
    action,
    status: room.status,
    day: room.day,
    tick: room.tick,
    lifecycle: publicTeacherControls(room, host.id).lifecycle,
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      raw += chunk;
      if (raw.length > 1_000_000) {
        settled = true;
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (settled) return;
      try {
        settled = true;
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(Object.assign(new Error('Invalid JSON payload'), { status: 400 }));
      }
    });
    req.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function ensureAccount(userName) {
  const normalized = safeName(userName, 'Player');
  const key = normalizeAccountKey(normalized);
  if (!state.db.accounts[key]) {
    state.db.accounts[key] = {
      id: uid('acct'),
      userName: normalized,
      createdAt: Date.now(),
      gamesPlayed: 0,
      wins: 0,
      totalRevenue: 0,
      bestNetWorth: 0,
      lastCompany: '',
      favoriteScenario: 'standard',
      completedResearch: {},
      completedContracts: 0,
      goalsCompleted: 0,
      achievements: {},
      lastActiveAt: Date.now(),
    };
    persistDb();
  }
  return state.db.accounts[key];
}

function accountSummary(account) {
  return {
    id: account.id,
    userName: account.userName,
    gamesPlayed: account.gamesPlayed,
    wins: account.wins,
    totalRevenue: Math.round(account.totalRevenue || 0),
    bestNetWorth: Math.round(account.bestNetWorth || 0),
    lastCompany: account.lastCompany || '—',
    favoriteScenario: account.favoriteScenario || 'standard',
    completedResearchCount: Object.keys(account.completedResearch || {}).length,
    completedContracts: account.completedContracts || 0,
    goalsCompleted: account.goalsCompleted || 0,
    achievements: Object.keys(account.achievements || {}),
    achievementCount: Object.keys(account.achievements || {}).length,
    lastActiveAt: account.lastActiveAt || null,
  };
}

function updateAccountPresence(userName, companyName, scenarioKey) {
  const account = ensureAccount(userName);
  account.userName = safeName(userName, account.userName);
  account.lastCompany = safeName(companyName, account.lastCompany || 'Company');
  account.favoriteScenario = scenarioKey || account.favoriteScenario || 'standard';
  account.lastActiveAt = Date.now();
  persistDb();
  return account;
}

function addRoomLog(room, message) {
  room.log.unshift(`[Day ${room.day}] ${message}`);
  room.log = room.log.slice(0, MAX_LOG);
}

function factoryScenarioConfig(scenarioKey) {
  return FACTORY_SCENARIOS[scenarioKey] || null;
}

function isFactoryScenario(scenarioKey) {
  return Boolean(factoryScenarioConfig(scenarioKey));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNamePart(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function makeWorkerCandidate(scenarioKey, index = 0) {
  const config = factoryScenarioConfig(scenarioKey);
  const role = config?.roles?.[index % config.roles.length] || 'Assembler';
  const first = ['Alex', 'Sam', 'Nika', 'Dana', 'Ira', 'Maks', 'Tim', 'Oleg', 'Kate', 'Artem'];
  const last = ['Volkov', 'Smirnov', 'Petrov', 'Orlov', 'Kim', 'Sokolov', 'Giniatov', 'Yakovlev', 'Borisov'];
  const [salaryMin, salaryMax] = Array.isArray(config?.salaryBand) && config.salaryBand.length === 2
    ? config.salaryBand
    : [38, 88];
  const experienceYears = randomBetween(1, 12);
  const expectedSalary = randomBetween(salaryMin, salaryMax) * 100;
  const salaryMidpoint = (salaryMin + salaryMax) / 200;
  // Дорогие кандидаты в среднем опытнее/качественнее: зарплата — осознанный выбор, а не штраф.
  const suitability = clamp(Math.round(38 + experienceYears * 4.5 + ((expectedSalary - salaryMidpoint) / 260) + Math.random() * 14), 35, 96);
  const hint = suitability >= 82
    ? 'Подходит для производительной линии.'
    : suitability >= 64
      ? 'Надёжный кандидат с умеренными ожиданиями по зарплате.'
      : 'Недорогой кандидат для резервной мощности.';
  return {
    id: uid('cand'),
    name: `${randomNamePart(first)} ${randomNamePart(last)}`,
    role,
    experienceYears,
    expectedSalary,
    suitability,
    hint,
  };
}

function makeSupplierOffer(scenarioKey, componentKey, index = 0) {
  const config = factoryScenarioConfig(scenarioKey);
  const component = config?.components?.[componentKey];
  if (!component) return null;
  const profile = SUPPLIER_PROFILES[index % SUPPLIER_PROFILES.length];
  const volatility = randomBetween(-4, 5) / 100;
  const spread = profile.spread + volatility;
  const quantityNoise = randomBetween(-1, 2);
  const quantity = Math.max(
    component.recipe || 1,
    Math.round((component.lotSize || 1) * profile.quantityMultiplier) + quantityNoise
  );
  const unitPrice = Math.max(1, Math.round(component.unitCost * (1 + spread)));
  const priceDeltaPct = Math.round(((unitPrice / Math.max(component.unitCost, 1)) - 1) * 100);
  const quality = clamp(profile.qualityBase + randomBetween(-7, 8) - Math.round(Math.min(spread, 0) * 35), 42, 99);
  const reliability = clamp(profile.reliability + randomBetween(-5, 6), 55, 99);
  return {
    id: uid('supplier'),
    componentKey,
    componentLabel: component.label,
    supplierName: SUPPLIER_NAMES[index % SUPPLIER_NAMES.length],
    tier: profile.tier,
    tierLabel: profile.label,
    scarcity: profile.scarcity,
    quantity,
    unitPrice,
    baseUnitCost: component.unitCost,
    priceDeltaPct,
    quality,
    reliability,
    score: Math.round((100 - Math.max(priceDeltaPct, -25)) * 0.52 + quality * 0.28 + reliability * 0.2),
    createdDay: 1,
  };
}

function buildSupplierOffers(scenarioKey) {
  const config = factoryScenarioConfig(scenarioKey);
  if (!config) return [];
  return Object.keys(config.components).flatMap(componentKey => (
    SUPPLIER_PROFILES.map((_profile, index) => makeSupplierOffer(scenarioKey, componentKey, index)).filter(Boolean)
  ));
}

function restockFactorySuppliers(room, { force = false } = {}) {
  if (!room.factoryScenario) return;
  const config = factoryScenarioConfig(room.settings.scenarioKey);
  if (!config) return;
  const offers = Array.isArray(room.factoryScenario.supplierOffers)
    ? room.factoryScenario.supplierOffers
    : [];
  const humanPlayers = [...room.players.values()].filter(player => isClassPlayer(player) && !player.bankrupt).length || 1;
  Object.keys(config.components).forEach(componentKey => {
    const current = offers.filter(offer => offer.componentKey === componentKey);
    const targetCount = force
      ? Math.min(SUPPLIER_PROFILES.length, Math.max(4, humanPlayers + 3))
      : Math.min(SUPPLIER_PROFILES.length, Math.max(3, humanPlayers + 1));
    if (!force && current.length >= targetCount) return;
    for (let index = current.length; index < targetCount; index += 1) {
      const offer = makeSupplierOffer(room.settings.scenarioKey, componentKey, index + (room.day || 1));
      if (offer) {
        offer.createdDay = room.day || 1;
        offers.push(offer);
      }
    }
  });
  room.factoryScenario.supplierOffers = offers;
}

function workerPower(worker) {
  return 1.2 + worker.suitability / 100 + worker.experienceYears * 0.06;
}

function buildFactoryState(scenarioKey) {
  const config = factoryScenarioConfig(scenarioKey);
  if (!config) return null;
  const inventory = Object.fromEntries(Object.keys(config.components).map(key => [key, config.starterInventory[key] || 0]));
  return {
    scenarioKey,
    productKey: config.productKey,
    productLabel: config.productLabel,
    productUnit: config.productUnit,
    inventory,
    finishedGoods: 0,
    workers: [],
    saleOffer: { price: config.basePrice, quantity: 0 },
    assembledThisTurn: 0,
    soldThisTurn: 0,
    revenueThisTurn: 0,
    workerPayroll: 0,
    lastSuitability: 0,
  };
}

function buildRoomFactoryState(scenarioKey) {
  const config = factoryScenarioConfig(scenarioKey);
  if (!config) return null;
  return {
    key: config.key,
    label: config.label || SCENARIOS[scenarioKey]?.label || scenarioKey,
    description: SCENARIOS[scenarioKey]?.description || '',
    productLabel: config.productLabel,
    productUnit: config.productUnit,
    baseDemandMin: config.baseDemandMin,
    baseDemandMax: config.baseDemandMax,
    upkeep: config.upkeep,
    roles: [...(config.roles || [])],
    components: Object.entries(config.components).map(([key, component]) => ({
      key,
      label: component.label,
      unitCost: component.unitCost,
      lotSize: component.lotSize,
      recipe: component.recipe,
    })),
    priceRange: config.priceRange,
    candidates: Array.from({ length: 6 }, (_, index) => makeWorkerCandidate(scenarioKey, index)),
    supplierOffers: buildSupplierOffers(scenarioKey),
    marketBook: [],
  };
}

function applyScenarioToPlayer(player, scenarioKey, difficultyKey = 'normal') {
  const config = factoryScenarioConfig(scenarioKey);
  if (!config) {
    player.factory = null;
    return;
  }
  const difficulty = difficultyConfigForKey(difficultyKey, 'normal');
  const factory = buildFactoryState(scenarioKey);
  player.money = Math.round(config.starterCash * difficulty.starterCashMultiplier);
  player.debt = 0;
  player.reputation = 50;
  player.staff = 0;
  player.factories = 1;
  player.stores = 0;
  player.productStock = 0;
  player.rawStock = 0;
  player.marketing = 1;
  player.automation = 0;
  player.quality = 1;
  player.innovation = 0;
  player.researchPoints = 0;
  player.research = { activeKey: '', progress: 0, completed: [] };
  player.specializationKey = 'balanced';
  player.boardPolicyKey = 'balanced';
  player.strategyKey = 'balanced';
  player.activeContract = null;
  player.completedContracts = 0;
  player.totalSalesSeason = 0;
  player.decisionRound = null;
  player.decisionHistory = [];
  player.price = config.basePrice;
  player.salary = 0;
  player.supplyLevel = 1;
  player.productKey = config.productKey;
  player.cityKey = 'regional';
  player.focusProductKey = config.productKey;
  player.focusCityKey = '';
  player.factory = factory;
  player.lastAction = `${config.productLabel}: линия ждёт первую команду.`;
}

function configureRoomScenario(room) {
  const config = factoryScenarioConfig(room.settings.scenarioKey);
  room.factoryScenario = config ? buildRoomFactoryState(room.settings.scenarioKey) : null;
  if (!room.factoryScenario) {
    room.players.forEach((player, playerId) => {
      if (!player.factory) return;
      const fresh = {
        ...createPlayer(player.name, {
          userName: player.userName,
          avatar: player.avatar,
          isBot: player.isBot,
          isTeacherHost: player.isTeacherHost,
        }),
        id: playerId,
        ready: player.isBot || player.isTeacherHost,
        seasonGoal: createSeasonGoal(player.seasonGoal?.key),
      };
      room.players.set(playerId, fresh);
    });
    return;
  }
  room.activeEvent = null;
  room.contractBoard = [];
  room.segmentSnapshots = [];
  room.marketHistory = [];
  restockFactorySuppliers(room, { force: true });
  room.players.forEach(player => {
    if (player.isTeacherHost) return;
    applyScenarioToPlayer(player, room.settings.scenarioKey, room.settings.difficulty);
  });
}

function ensureFactoryPlayer(player, room) {
  const config = factoryScenarioConfig(room.settings.scenarioKey);
  if (!config) throw Object.assign(new Error('Factory actions are only available in factory scenarios.'), { status: 400 });
  if (!player.factory || player.factory.scenarioKey !== room.settings.scenarioKey) applyScenarioToPlayer(player, room.settings.scenarioKey, room.settings.difficulty);
  return config;
}

function availableAssemblyCount(factory, config) {
  const fromInventory = Object.entries(config.components).map(([key, component]) => Math.floor((factory.inventory[key] || 0) / component.recipe));
  const workerCapacity = Math.max(0, Math.floor(factory.workers.reduce((sum, worker) => sum + workerPower(worker), 0)));
  return Math.max(0, Math.min(workerCapacity, ...(fromInventory.length ? fromInventory : [0])));
}

function buildFactoryAssemblyHints(player, config) {
  const factory = player.factory;
  if (!factory || !config) return null;
  const workerCapacity = Math.max(0, Math.floor((factory.workers || []).reduce((sum, worker) => sum + workerPower(worker), 0)));
  const componentRows = Object.entries(config.components || {}).map(([key, component]) => {
    const recipe = Math.max(1, Number(component.recipe || 1));
    const stock = Math.max(0, Number(factory.inventory?.[key] || 0));
    const canAssemble = Math.floor(stock / recipe);
    const missingForOne = Math.max(0, recipe - stock);
    return {
      key,
      label: component.label,
      stock: Math.round(stock),
      recipe,
      canAssemble,
      missingForOne: Math.round(missingForOne),
      status: missingForOne > 0 ? 'blocked' : canAssemble <= workerCapacity ? 'attention' : 'ready',
    };
  });
  const inventoryCapacity = componentRows.length
    ? Math.min(...componentRows.map(item => item.canAssemble))
    : 0;
  const maxAssembly = Math.max(0, Math.min(workerCapacity, inventoryCapacity));
  const blockingComponents = componentRows
    .filter(item => item.canAssemble <= maxAssembly || item.missingForOne > 0)
    .sort((left, right) => left.canAssemble - right.canAssemble || right.missingForOne - left.missingForOne);
  const primaryComponent = blockingComponents[0] || componentRows[0] || null;
  const bottleneck = maxAssembly > 0
    ? 'ready'
    : workerCapacity <= 0
      ? 'people'
      : inventoryCapacity <= 0
        ? 'components'
        : workerCapacity <= inventoryCapacity
          ? 'people'
          : 'components';
  const title = bottleneck === 'ready'
    ? `Можно собрать ${maxAssembly} ед.`
    : bottleneck === 'people'
      ? 'Сборку ограничивают работники'
      : primaryComponent
        ? `Сборку ограничивает компонент: ${primaryComponent.label}`
        : 'Сборка пока заблокирована';
  const studentText = bottleneck === 'ready'
    ? 'Нажмите “Собрать максимум”, затем переходите в маркетинг и выставляйте заявку.'
    : bottleneck === 'people'
      ? 'Наймите хотя бы одного подходящего сотрудника, иначе детали не превратятся в готовый товар.'
      : primaryComponent
        ? `Докупить нужно: ${primaryComponent.label}. Без него линия не сможет собрать следующую единицу.`
        : 'Проверьте склад и персонал перед сборкой.';
  const nextAction = bottleneck === 'ready'
    ? { action: 'assemble-product', value: 'max', label: 'Собрать максимум' }
    : bottleneck === 'people'
      ? { tab: 'operations', department: 'workforce', label: 'Открыть персонал' }
      : { tab: 'purchase', componentKey: primaryComponent?.key || '', label: 'Открыть закупку' };
  return {
    workerCapacity,
    inventoryCapacity: Math.max(0, inventoryCapacity),
    maxAssembly,
    finishedGoods: Math.round(Number(factory.finishedGoods || 0)),
    bottleneck,
    title,
    studentText,
    nextAction,
    blockingComponentKey: primaryComponent?.key || '',
    componentRows,
  };
}

function buildFactoryUnitEconomics(room, player, config) {
  const factory = player.factory;
  if (!factory || !config) return null;
  const difficulty = difficultyConfigForRoom(room);
  const rawCostMultiplier = factoryEventMultiplier(room, 'rawCostMultiplier');
  const supplierOffers = Array.isArray(room.factoryScenario?.supplierOffers)
    ? room.factoryScenario.supplierOffers
    : [];
  const componentBreakdown = Object.entries(config.components || {}).map(([key, component]) => {
    const required = Math.max(0, Number(component.recipe || 0));
    const baseUnitCost = Math.round(factoryComponentCost(room, config, key, 1));
    const offers = supplierOffers
      .filter(offer => offer.componentKey === key && Number(offer.quantity || 0) > 0)
      .sort((left, right) => Number(left.unitPrice || 0) - Number(right.unitPrice || 0));
    let remaining = required;
    let marketCost = 0;
    let available = 0;
    offers.forEach(offer => {
      const quantity = Math.max(0, Number(offer.quantity || 0));
      available += quantity;
      if (remaining <= 0) return;
      const used = Math.min(remaining, quantity);
      marketCost += used * Number(offer.unitPrice || 0) * rawCostMultiplier;
      remaining -= used;
    });
    if (remaining > 0) marketCost += remaining * baseUnitCost;
    const cheapestOffer = offers[0] || null;
    return {
      key,
      label: component.label,
      required,
      available: Math.round(available),
      enoughSupply: available >= required,
      baseCost: Math.round(required * baseUnitCost),
      marketCost: Math.round(marketCost),
      cheapestUnitPrice: cheapestOffer ? Math.round(Number(cheapestOffer.unitPrice || 0) * rawCostMultiplier) : baseUnitCost,
      cheapestSupplier: cheapestOffer?.supplierName || '',
    };
  });
  const materialUnitCost = Math.round(componentBreakdown.reduce((sum, item) => sum + item.marketCost, 0));
  const payroll = (factory.workers || []).reduce((sum, worker) => sum + Number(worker.expectedSalary || 0), 0);
  const eventPayrollMultiplier = factoryEventMultiplier(room, 'payrollMultiplier');
  const eventUpkeepMultiplier = factoryEventMultiplier(room, 'upkeepMultiplier');
  const adjustedPayroll = Math.round(payroll * (difficulty.costMultiplier || 1) * eventPayrollMultiplier);
  const adjustedUpkeep = Math.round(Number(config.upkeep || 0) * (difficulty.costMultiplier || 1) * eventUpkeepMultiplier);
  const plannedBatchSize = Math.max(1, Math.round(Number(config.baseDemandMin || config.baseDemandMax || 1)));
  const capacity = Math.max(
    availableAssemblyCount(factory, config),
    Number(factory.assembledThisTurn || 0),
    Number(factory.finishedGoods || 0),
    Number(factory.saleOffer?.quantity || 0),
    plannedBatchSize,
  );
  const overheadPerUnit = Math.round((adjustedPayroll + adjustedUpkeep) / capacity);
  const breakEvenPrice = materialUnitCost + overheadPerUnit;
  const salePrice = Math.round(Number(factory.saleOffer?.price || config.basePrice || 0));
  const marginPerUnit = salePrice - breakEvenPrice;
  const marginPct = breakEvenPrice > 0 ? Math.round((marginPerUnit / breakEvenPrice) * 100) : 0;
  const saleQuantity = Math.max(0, Number(factory.saleOffer?.quantity || 0));
  const expectedProfit = saleQuantity > 0
    ? Math.round(marginPerUnit * Math.min(saleQuantity, Math.max(Number(factory.finishedGoods || 0), saleQuantity)))
    : 0;
  const supplyCoverage = componentBreakdown.length
    ? Math.round((componentBreakdown.filter(item => item.enoughSupply).length / componentBreakdown.length) * 100)
    : 100;
  const hasSupplierShortage = componentBreakdown.some(item => !item.enoughSupply);
  const recommendedFloorPrice = Math.round(breakEvenPrice * 1.12);
  return {
    materialUnitCost,
    overheadPerUnit,
    breakEvenPrice,
    recommendedFloorPrice,
    salePrice,
    marginPerUnit,
    marginPct,
    expectedProfit,
    capacityBasis: capacity,
    supplyCoverage,
    hasSupplierShortage,
    componentBreakdown,
    status: marginPerUnit < 0 ? 'loss' : marginPct < 10 ? 'thin' : marginPct < 25 ? 'ok' : 'strong',
    explanation: marginPerUnit < 0
      ? 'Цена ниже безубыточности: каждая продажа ухудшит результат.'
      : marginPct < 10
        ? 'Маржа тонкая: малейший рост расходов может съесть прибыль.'
        : marginPct < 25
          ? 'Маржа рабочая: цена покрывает материалы и текущие расходы.'
          : 'Маржа высокая: проверьте, не потеряете ли спрос из-за цены.',
  };
}

function buildFactoryPurchaseHints(room, player, config) {
  const factory = player.factory;
  if (!factory || !config) return [];
  const supplierOffers = Array.isArray(room.factoryScenario?.supplierOffers)
    ? room.factoryScenario.supplierOffers
    : [];
  const targetUnits = Math.max(
    1,
    Math.min(4, Math.round(Number(config.baseDemandMin || config.baseDemandMax || 1))),
  );
  return Object.entries(config.components || {}).map(([key, component]) => {
    const stock = Math.max(0, Number(factory.inventory?.[key] || 0));
    const recipe = Math.max(1, Number(component.recipe || 1));
    const requiredForBatch = recipe * targetUnits;
    const missingForBatch = Math.max(0, requiredForBatch - stock);
    const canAssembleNow = Math.floor(stock / recipe);
    const offers = supplierOffers
      .filter(offer => offer.componentKey === key && Number(offer.quantity || 0) > 0)
      .sort((left, right) => (
        Number(left.unitPrice || 0) - Number(right.unitPrice || 0)
        || Number(right.score || 0) - Number(left.score || 0)
        || Number(right.quantity || 0) - Number(left.quantity || 0)
      ));
    const totalAvailable = offers.reduce((sum, offer) => sum + Number(offer.quantity || 0), 0);
    const bestOffer = offers[0] || null;
    const recommendedQuantity = bestOffer
      ? Math.min(Number(bestOffer.quantity || 0), Math.max(recipe, missingForBatch || recipe))
      : 0;
    const shortage = missingForBatch > 0 && totalAvailable < missingForBatch;
    const status = missingForBatch <= 0
      ? 'ready'
      : bestOffer
        ? (shortage ? 'attention' : 'buy')
        : 'blocked';
    const reason = missingForBatch <= 0
      ? `Запаса хватит примерно на ${canAssembleNow} ед.`
      : bestOffer
        ? `Для партии ${targetUnits} ед. не хватает ${missingForBatch}.`
        : `Лотов нет: ${component.label.toLowerCase()} временно в дефиците.`;
    const studentText = missingForBatch <= 0
      ? 'Пока можно не докупать: этот компонент не блокирует ближайшую сборку.'
      : bestOffer
        ? `Сначала купите ${recommendedQuantity} у ${bestOffer.supplierName}: это самый дешевый доступный лот.`
        : 'Ждите пополнения поставщиков или меняйте план сборки: другой игрок мог выкупить лоты раньше.';
    const priority = status === 'blocked'
      ? 4
      : status === 'buy'
        ? 3
        : status === 'attention'
          ? 2
          : 0;
    return {
      key,
      label: component.label,
      stock: Math.round(stock),
      recipe,
      targetUnits,
      requiredForBatch: Math.round(requiredForBatch),
      missingForBatch: Math.round(missingForBatch),
      canAssembleNow,
      totalAvailable: Math.round(totalAvailable),
      bestPrice: bestOffer ? Math.round(Number(bestOffer.unitPrice || 0) * factoryEventMultiplier(room, 'rawCostMultiplier')) : 0,
      recommendedOfferId: bestOffer?.id || '',
      recommendedSupplier: bestOffer?.supplierName || '',
      recommendedQuantity: Math.round(recommendedQuantity),
      status,
      shortage,
      priority,
      reason,
      studentText,
    };
  }).sort((left, right) => (
    right.priority - left.priority
    || right.missingForBatch - left.missingForBatch
    || left.label.localeCompare(right.label, 'ru')
  ));
}

function buildFactoryPersonnelHints(room, player, config, unitEconomics = null) {
  const factory = player.factory;
  if (!factory || !config) return { summary: null, candidates: [] };
  const workers = factory.workers || [];
  const candidates = Array.isArray(room.factoryScenario?.candidates)
    ? room.factoryScenario.candidates
    : [];
  const inventoryCapacity = Object.entries(config.components || {}).reduce((limit, [key, component]) => {
    const recipe = Math.max(1, Number(component.recipe || 1));
    const count = Math.floor(Number(factory.inventory?.[key] || 0) / recipe);
    return Math.min(limit, count);
  }, Number.POSITIVE_INFINITY);
  const safeInventoryCapacity = Number.isFinite(inventoryCapacity) ? Math.max(0, inventoryCapacity) : 0;
  const currentPower = workers.reduce((sum, worker) => sum + workerPower(worker), 0);
  const currentWorkerCapacity = Math.max(0, Math.floor(currentPower));
  const currentAssemblyCapacity = Math.min(currentWorkerCapacity, safeInventoryCapacity);
  const currentPayroll = workers.reduce((sum, worker) => sum + Number(worker.expectedSalary || 0), 0);
  const targetWorkers = Math.max(2, Math.min(4, Math.round(Number(config.baseDemandMin || config.baseDemandMax || 2) / 3)));
  const marginPerUnit = Number(unitEconomics?.marginPerUnit || 0);
  const candidateHints = candidates.map(candidate => {
    const candidatePower = workerPower(candidate);
    const projectedWorkerCapacity = Math.max(0, Math.floor(currentPower + candidatePower));
    const projectedAssemblyCapacity = Math.min(projectedWorkerCapacity, safeInventoryCapacity);
    const capacityGain = Math.max(0, projectedAssemblyCapacity - currentAssemblyCapacity);
    const linePowerGain = Math.max(0, projectedWorkerCapacity - currentWorkerCapacity);
    const signOnCost = Math.round(Number(candidate.expectedSalary || 0) * 1.5);
    const salaryPerPower = Math.round(Number(candidate.expectedSalary || 0) / Math.max(candidatePower, 0.1));
    const paybackTurns = marginPerUnit > 0 && capacityGain > 0
      ? Math.max(1, Math.ceil(signOnCost / Math.max(1, marginPerUnit * capacityGain)))
      : null;
    const affordable = Number(player.money || 0) >= signOnCost;
    const score = Math.round(
      Number(candidate.suitability || 0) * 1.25
      + Number(candidate.experienceYears || 0) * 3
      + linePowerGain * 18
      + capacityGain * 20
      - Number(candidate.expectedSalary || 0) / 520
      + (affordable ? 8 : -24)
    );
    const status = !affordable
      ? 'blocked'
      : capacityGain > 0 || workers.length === 0
        ? 'recommended'
        : linePowerGain > 0
          ? 'reserve'
          : 'expensive';
    const reason = !affordable
      ? `Нужно ${signOnCost} на оформление, денег не хватает.`
      : capacityGain > 0
        ? `Добавит примерно ${capacityGain} ед. мощности при текущем складе.`
        : safeInventoryCapacity <= currentAssemblyCapacity
          ? 'Сейчас линию ограничивают комплектующие, а не люди.'
          : 'Усилит смену, но прирост выпуска будет небольшим.';
    const studentText = !affordable
      ? 'Пока не нанимайте: сначала сохраните деньги или продайте товар.'
      : capacityGain > 0 || workers.length === 0
        ? `Наймите, если планируете сборку: зарплата ${Math.round(candidate.expectedSalary || 0)} за ход, оформление ${signOnCost}.`
        : 'Это запасной вариант: сначала проверьте склад и маржу.';
    return {
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
      experienceYears: Number(candidate.experienceYears || 0),
      expectedSalary: Math.round(Number(candidate.expectedSalary || 0)),
      suitability: Math.round(Number(candidate.suitability || 0)),
      power: Number(candidatePower.toFixed(2)),
      signOnCost,
      salaryPerPower,
      capacityGain,
      linePowerGain,
      projectedAssemblyCapacity,
      paybackTurns,
      affordable,
      score,
      status,
      reason,
      studentText,
    };
  }).sort((left, right) => (
    (right.affordable ? 1 : 0) - (left.affordable ? 1 : 0)
    || right.score - left.score
    || left.expectedSalary - right.expectedSalary
  ));
  const recommended = candidateHints[0] || null;
  const bottleneck = currentWorkerCapacity <= 0
    ? 'people'
    : safeInventoryCapacity <= currentAssemblyCapacity
      ? 'components'
      : 'people';
  const summary = {
    workerCount: workers.length,
    targetWorkers,
    currentPayroll: Math.round(currentPayroll),
    currentWorkerCapacity,
    currentAssemblyCapacity,
    inventoryCapacity: safeInventoryCapacity,
    needsHiring: workers.length < targetWorkers || currentWorkerCapacity <= 0,
    bottleneck,
    recommendedCandidateId: recommended?.id || '',
    title: bottleneck === 'components'
      ? 'Сначала проверьте склад: людей пока достаточно'
      : recommended
      ? `Лучший кандидат: ${recommended.name}`
      : 'Кандидатов пока нет',
    studentText: bottleneck === 'components'
      ? 'Новый сотрудник почти не увеличит выпуск, пока не хватает комплектующих для сборки.'
      : recommended
      ? recommended.studentText
      : 'Подождите обновления рынка труда или продолжайте сборку текущей командой.',
  };
  return { summary, candidates: candidateHints };
}

function buildFactoryTurnGuide(room, player, {
  turnChecklist = [],
  purchaseHints = [],
  personnelHints = null,
  assemblyHints = null,
  marketHints = [],
} = {}) {
  if (!player.factory) return null;
  const factory = player.factory;
  const checklistByKey = new Map(turnChecklist.map(item => [item.key, item]));
  const purchaseHint = purchaseHints[0] || null;
  const personnelSummary = personnelHints?.summary || null;
  const marketDecision = marketHints.find(hint => hint.kind === 'decision') || null;
  const checklistStatus = (key, fallback = 'blocked') => checklistByKey.get(key)?.status || fallback;
  const coreReady = ['warehouse', 'workforce', 'assembly', 'sale'].every(key => checklistStatus(key) === 'ready')
    && player.decisionRound?.status !== 'pending';
  const steps = [
    {
      key: 'purchase',
      number: 1,
      label: 'Закупка',
      shortLabel: 'детали',
      status: checklistStatus('warehouse'),
      title: purchaseHint?.missingForBatch > 0 ? `Докупить: ${purchaseHint.label}` : 'Закупка готова',
      summary: purchaseHint?.studentText || checklistByKey.get('warehouse')?.summary || 'Проверьте склад комплектующих.',
      tab: 'purchase',
      componentKey: purchaseHint?.key || '',
      buttonLabel: purchaseHint?.missingForBatch > 0 ? 'Открыть закупку' : 'Проверить закупку',
    },
    {
      key: 'personnel',
      number: 2,
      label: 'Персонал',
      shortLabel: 'люди',
      status: checklistStatus('workforce'),
      title: personnelSummary?.title || 'Проверить людей',
      summary: personnelSummary?.studentText || checklistByKey.get('workforce')?.summary || 'Проверьте сотрудников линии.',
      tab: 'operations',
      department: 'workforce',
      buttonLabel: 'Открыть персонал',
    },
    {
      key: 'assembly',
      number: 3,
      label: 'Сборка',
      shortLabel: 'товар',
      status: checklistStatus('assembly'),
      title: assemblyHints?.title || 'Проверить сборку',
      summary: assemblyHints?.studentText || checklistByKey.get('assembly')?.summary || 'Соберите готовый товар.',
      tab: assemblyHints?.nextAction?.tab || 'operations',
      department: assemblyHints?.nextAction?.department || 'assembly',
      componentKey: assemblyHints?.nextAction?.componentKey || '',
      action: assemblyHints?.bottleneck === 'ready' ? 'assemble-product' : '',
      value: assemblyHints?.bottleneck === 'ready' ? 'max' : '',
      buttonLabel: assemblyHints?.bottleneck === 'ready' ? 'Собрать максимум' : assemblyHints?.nextAction?.label || 'Открыть сборку',
    },
    {
      key: 'market',
      number: 4,
      label: 'Продажа',
      shortLabel: 'цена',
      status: checklistStatus('sale'),
      title: Number(factory.saleOffer?.quantity || 0) > 0 ? 'Заявка выставлена' : 'Выставить заявку',
      summary: marketDecision?.studentText || checklistByKey.get('sale')?.summary || 'Проверьте цену и объем продажи.',
      tab: 'market',
      department: 'sales',
      buttonLabel: 'Открыть маркетинг',
    },
    {
      key: 'finish',
      number: 5,
      label: 'Завершить ход',
      shortLabel: 'итог',
      status: coreReady ? 'ready' : 'blocked',
      title: 'Завершить ход',
      summary: 'После завершения игра посчитает продажи, расходы, прибыль и обновит рейтинг.',
      action: 'next-turn',
      buttonLabel: 'Завершить ход',
    },
  ];
  const primaryStep = steps.find(step => step.status !== 'ready') || steps[steps.length - 1];
  const readyCount = steps.filter(step => step.status === 'ready').length;
  return {
    title: primaryStep.title,
    summary: primaryStep.summary,
    primaryKey: primaryStep.key,
    buttonLabel: primaryStep.buttonLabel,
    target: {
      action: primaryStep.action || '',
      value: primaryStep.value || '',
      tab: primaryStep.tab || '',
      department: primaryStep.department || '',
      componentKey: primaryStep.componentKey || '',
    },
    progress: {
      ready: readyCount,
      total: steps.length,
      percent: steps.length ? Math.round((readyCount / steps.length) * 100) : 0,
    },
    steps,
  };
}

function signedRub(value) {
  const rounded = Math.round(Number(value || 0));
  return `${rounded > 0 ? '+' : ''}${rounded} ₽`;
}

function plainRub(value) {
  return `${Math.round(Number(value || 0))} ₽`;
}

function buildFactoryPlayerDebrief(room, player, config, {
  comparisonToLeader = null,
  unitEconomics = null,
  turnGuide = null,
} = {}) {
  if (!player.factory) return null;
  const breakdown = player.lastTickBreakdown || {};
  const profit = Math.round(Number(breakdown.profit || 0));
  const revenue = Math.round(Number(breakdown.revenue || player.factory.revenueThisTurn || 0));
  const expenses = Math.round(Number(breakdown.expenses || 0));
  const soldLastTurn = Math.round(Number(player.factory.soldThisTurn || player.soldLastTick || 0));
  const totalSales = Math.round(Number(player.totalSalesSeason || 0));
  const finishedGoods = Math.round(Number(player.factory.finishedGoods || 0));
  const saleQuantity = Math.round(Number(player.factory.saleOffer?.quantity || 0));
  const salePrice = Math.round(Number(player.factory.saleOffer?.price || config.basePrice || 0));
  const marginPerUnit = Math.round(Number(unitEconomics?.marginPerUnit || 0));
  const breakEvenPrice = Math.round(Number(unitEconomics?.breakEvenPrice || 0));
  const hasWorkers = (player.factory.workers || []).length > 0;
  const canAssemble = availableAssemblyCount(player.factory, config) > 0;
  const stepLabel = turnGuide?.steps?.find(step => step.key === turnGuide.primaryKey)?.label || '';

  let outcome = 'stable';
  let title = 'Личный разбор результата';
  let summary = 'Вы прошли полный производственный цикл. Сравните цену, выпуск и прибыль с лидером.';
  let mainStrength = 'Вы держали компанию в игре и дошли до итогового рейтинга.';
  let mainWeakness = 'Следующий рост зависит от более полного цикла: закупка, сборка, продажа.';
  let nextMatchFocus = 'В следующем матче попробуйте заранее считать себестоимость и выставлять заявку до завершения хода.';

  if (totalSales <= 0 && soldLastTurn <= 0) {
    outcome = 'no_sales';
    summary = 'Главная потеря: товар не дошел до рынка. Без заявки и продаж склад не превращается в прибыль.';
    mainStrength = hasWorkers || canAssemble
      ? 'Вы начали строить производственный контур.'
      : 'Вы увидели стартовую точку бизнеса: сначала нужны ресурсы и люди.';
    mainWeakness = saleQuantity <= 0
      ? 'Не было рабочей заявки на продажу.'
      : 'Заявка не закрылась рынком: цена или объем были слабее конкурентов.';
    nextMatchFocus = 'Фокус следующего матча: собрать хотя бы одну партию и выставить понятную цену продажи.';
  } else if (profit < 0) {
    outcome = 'loss';
    summary = 'Продажи были, но расходы оказались выше выручки. Нужно контролировать закупку, зарплаты и цену.';
    mainStrength = 'Вы смогли вывести продукцию на рынок.';
    mainWeakness = marginPerUnit < 0
      ? `Цена ${plainRub(salePrice)} ниже точки безубыточности ${plainRub(breakEvenPrice)}.`
      : 'Постоянные расходы и закупки съели прибыль хода.';
    nextMatchFocus = 'Фокус следующего матча: сначала выбрать дешевый лот поставщика, затем ставить цену выше себестоимости.';
  } else if (comparisonToLeader?.salesGap > 0 || comparisonToLeader?.scoreGap > 0) {
    outcome = 'behind_leader';
    summary = 'Компания заработала, но лидер прошел цикл быстрее или продал больше товара.';
    mainStrength = 'Экономика хода была положительной: продажи покрыли основные расходы.';
    mainWeakness = comparisonToLeader?.salesGap > 0
      ? `До лидера не хватило ${Math.round(comparisonToLeader.salesGap)} ед. продаж.`
      : `До лидера не хватило ${Math.round(comparisonToLeader.scoreGap || 0)} очков.`;
    nextMatchFocus = 'Фокус следующего матча: раньше закрывать закупку и сборку, чтобы чаще продавать до пересчета хода.';
  } else {
    outcome = 'leader_like';
    summary = 'Результат сильный: производство превращалось в продажи, а продажи поддерживали капитал.';
    mainStrength = 'Вы держали положительную прибыль и конкурентную цену.';
    mainWeakness = finishedGoods > 0
      ? 'Часть товара осталась на складе: можно точнее подбирать объем заявки.'
      : 'Главный риск роста теперь в дефиците поставщиков и перегрузе персонала.';
    nextMatchFocus = 'Фокус следующего матча: масштабировать выпуск, не теряя маржу и ликвидность.';
  }

  const actionItems = [
    totalSales <= 0
      ? {
          key: 'market',
          label: 'Довести товар до продажи',
          text: 'Соберите минимум одну партию и выставьте заявку в маркетинге до конца хода.',
        }
      : {
          key: 'price',
          label: 'Проверять цену',
          text: `Ориентир: цена выше ${plainRub(breakEvenPrice)} и не слишком далеко от рынка.`,
        },
    profit < 0
      ? {
          key: 'costs',
          label: 'Срезать лишние расходы',
          text: 'Не нанимайте людей без комплектующих и выбирайте дешевые лоты поставщиков.',
        }
      : {
          key: 'scale',
          label: 'Ускорить цикл',
          text: 'Закупка и сборка должны быть готовы до того, как вы ставите цену.',
        },
    {
      key: 'next_step',
      label: stepLabel ? `Следующий шаг: ${stepLabel}` : 'Следующий шаг',
      text: turnGuide?.summary || 'После каждого хода смотрите разбор: где деньги пришли, а где ушли.',
    },
  ];

  return {
    title,
    outcome,
    summary,
    mainStrength,
    mainWeakness,
    nextMatchFocus,
    metrics: [
      {
        key: 'profit',
        label: 'Финансовый результат хода',
        value: profit,
        displayValue: signedRub(profit),
        tone: profit >= 0 ? 'positive' : 'danger',
      },
      {
        key: 'sales',
        label: 'Продано за матч',
        value: totalSales,
        displayValue: `${totalSales} ед.`,
        tone: totalSales > 0 ? 'positive' : 'warning',
      },
      {
        key: 'revenue',
        label: 'Выручка хода',
        value: revenue,
        displayValue: plainRub(revenue),
        tone: revenue > 0 ? 'positive' : '',
      },
      {
        key: 'expenses',
        label: 'Расходы хода',
        value: expenses,
        displayValue: plainRub(expenses),
        tone: expenses > revenue ? 'danger' : 'warning',
      },
      {
        key: 'margin',
        label: 'Расчётная маржа на единицу',
        value: marginPerUnit,
        displayValue: signedRub(marginPerUnit),
        tone: marginPerUnit >= 0 ? 'positive' : 'danger',
      },
    ],
    leaderComparison: comparisonToLeader ? {
      rank: comparisonToLeader.rank,
      leaderName: comparisonToLeader.leaderName,
      scoreGap: Math.round(Number(comparisonToLeader.scoreGap || 0)),
      netWorthGap: Math.round(Number(comparisonToLeader.netWorthGap || 0)),
      salesGap: Math.round(Number(comparisonToLeader.salesGap || 0)),
    } : null,
    actionItems,
  };
}

function createPlayer(companyName, { userName, avatar, isBot = false, isTeacherHost = false } = {}) {
  return {
    id: uid(isBot ? 'bot' : 'player'),
    version: 1,
    name: safeName(companyName, isBot ? 'Bot Corp' : 'Company'),
    userName: safeName(userName, isBot ? 'AI Manager' : 'Player'),
    sessionToken: isBot ? '' : createSessionToken(),
    avatar: sanitizeAvatar(avatar),
    money: 120000,
    debt: 0,
    reputation: 50,
    staff: 8,
    factories: 1,
    stores: 1,
    productStock: 24,
    rawStock: 28,
    soldLastTick: 0,
    producedLastTick: 0,
    incomeLastTick: 0,
    expensesLastTick: 0,
    lastTickBreakdown: null,
    marketing: 1,
    automation: 0,
    quality: 1,
    innovation: 0,
    researchPoints: 0,
    research: { activeKey: '', progress: 0, completed: [] },
    specializationKey: 'balanced',
    boardPolicyKey: 'balanced',
    strategyKey: 'balanced',
    activeContract: null,
    completedContracts: 0,
    totalSalesSeason: 0,
    decisionRound: null,
    decisionHistory: [],
    seasonGoal: null,
    price: 140,
    salary: 110,
    supplyLevel: 1,
    productKey: 'food',
    cityKey: 'regional',
    focusProductKey: 'food',
    focusCityKey: 'regional',
    lastAction: 'Company created.',
    bankrupt: false,
    isBot,
    isTeacherHost,
    ready: isBot || isTeacherHost,
    factory: null,
    lastAction: 'Компания создана',
    bankrupt: false,
    isBot,
    isTeacherHost,
    ready: isBot || isTeacherHost,
    createdAt: Date.now(),
  };
}

function defaultRoomSettings() {
  return {
    maxPlayers: MAX_CLASSROOM_PLAYERS,
    demandProfile: 'standard',
    scenarioKey: 'standard',
    difficulty: 'normal',
    practiceMode: '',
    dayLimit: MAX_TURN_COUNT,
    tickMode: 'manual',
    tickIntervalMs: DEFAULT_TICK_MS,
    turnDurationMs: MANUAL_TURN_MS,
  };
}

function normalizePracticeMode(value) {
  return ['demo', 'tutorial'].includes(value) ? value : '';
}

function normalizeDayLimit(value, fallback = MAX_TURN_COUNT) {
  return clamp(Number(value) || fallback, MIN_TURN_COUNT, MAX_TURN_COUNT);
}

function normalizeTickIntervalMs(value, fallback = DEFAULT_TICK_MS) {
  const allowed = [4000, 7000, 10000];
  const numeric = Number(value);
  return allowed.includes(numeric) ? numeric : fallback;
}

function normalizeManualTurnDurationMs(value, fallback = MANUAL_TURN_MS) {
  const numeric = Number(value);
  const minutes = Math.round(numeric / 60000);
  return ALLOWED_MANUAL_TURN_MINUTES.includes(minutes) ? minutes * 60 * 1000 : fallback;
}

function tickSpeedPreset(intervalMs) {
  if (intervalMs <= 4000) return 'fast';
  if (intervalMs >= 10000) return 'slow';
  return 'normal';
}

function turnDurationMsForRoom(room) {
  if ((room.settings?.tickMode || 'manual') !== 'manual') {
    return normalizeTickIntervalMs(room.settings?.tickIntervalMs);
  }
  return Number(room.settings?.turnDurationMs) || MANUAL_TURN_MS;
}

function assertRoomCreationAllowed({ teacherAccountId = '', lobbyVisibility = 'code-only' } = {}) {
  if (state.rooms.size >= MAX_LIVE_ROOMS) {
    throw Object.assign(new Error('Сервер достиг лимита одновременно открытых комнат.'), {
      status: 409,
      code: 'ROOM_CAPACITY_REACHED',
    });
  }
  const ownerId = String(teacherAccountId || '');
  if (!ownerId) return;
  const ownedRooms = [...state.rooms.values()].filter(room => room.teacherAccountId === ownerId);
  const activeRooms = ownedRooms.filter(room => room.status !== 'finished');
  if (activeRooms.length >= MAX_ACTIVE_ROOMS_PER_TEACHER) {
    throw Object.assign(new Error('У преподавателя уже открыто максимальное количество активных комнат.'), {
      status: 409,
      code: 'ROOM_QUOTA_REACHED',
    });
  }
  const listedLobbies = ownedRooms.filter(room => (
    room.status === 'lobby' && normalizeLobbyVisibility(room.lobbyVisibility) === 'listed'
  ));
  if (normalizeLobbyVisibility(lobbyVisibility) === 'listed' && listedLobbies.length >= MAX_LISTED_LOBBIES_PER_TEACHER) {
    throw Object.assign(new Error('У преподавателя уже опубликовано максимальное количество лобби.'), {
      status: 409,
      code: 'LISTED_ROOM_QUOTA_REACHED',
    });
  }
}

function createRoom({ roomName, companyName, userName, avatar, scenarioKey, difficulty, practiceMode, maxPlayers, demandProfile, dayLimit, turnDurationMs, lobbyVisibility, teacherAccountId = '', teacherHost = false }) {
  assertRoomCreationAllowed({ teacherAccountId, lobbyVisibility });
  const code = roomCode();
  const normalizedTeacherAccountId = String(teacherAccountId || '');
  const host = createPlayer(companyName, {
    userName,
    avatar,
    isTeacherHost: Boolean(normalizedTeacherAccountId || teacherHost),
  });
  ensurePlayerSessionToken(host);
  const settings = defaultRoomSettings();
  if (SCENARIOS[scenarioKey]) settings.scenarioKey = scenarioKey;
  settings.difficulty = normalizeDifficulty(difficulty, settings.difficulty);
  settings.practiceMode = normalizePracticeMode(practiceMode);
  settings.maxPlayers = clamp(Number(maxPlayers) || settings.maxPlayers, MIN_CLASSROOM_PLAYERS, MAX_CLASSROOM_PLAYERS);
  if (['standard', 'aggressive', 'lean'].includes(demandProfile)) settings.demandProfile = demandProfile;
  settings.dayLimit = normalizeDayLimit(dayLimit, settings.dayLimit);
  settings.turnDurationMs = normalizeManualTurnDurationMs(turnDurationMs, settings.turnDurationMs);
  if (isFactoryScenario(settings.scenarioKey) && !host.isTeacherHost) {
    applyScenarioToPlayer(host, settings.scenarioKey, settings.difficulty);
  }
  updateAccountPresence(host.userName, host.name, settings.scenarioKey);
  host.seasonGoal = createSeasonGoal();
  const room = {
    code,
    name: safeName(roomName, `Комната ${code}`),
    hostPlayerId: host.id,
    teacherAccountId: normalizedTeacherAccountId,
    directoryId: randomDirectoryId(),
    lobbyVisibility: normalizeLobbyVisibility(lobbyVisibility),
    version: 1,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    status: 'lobby',
    day: 1,
    tick: 0,
    winnerPlayerId: null,
    finishReason: null,
    startedAt: null,
    finishedAt: null,
    completedSessionId: '',
    players: new Map([[host.id, host]]),
    log: ['Room created. Invite players and start the match when everyone is ready.'],
    adminSnapshots: [],
    helpRequests: [],
    pauseRequest: null,
    marketHistory: [],
    segmentSnapshots: [],
    settings,
    teacherState: defaultTeacherState(),
    activeEvent: null,
    contractBoard: [],
    lastSavedAt: null,
    nextTickAt: null,
    turnStartedAt: null,
    pausedRemainingMs: null,
    factoryScenario: null,
  };
  configureRoomScenario(room);
  state.rooms.set(code, room);
  state.playerRoomIndex.set(host.id, code);
  addRoomLog(room, `${host.userName} created room ${room.name} for company ${host.name}.`);
  touchRoom(room, host);
  persistRuntimeState();
  return { room, player: host };
}

function getRoomByPlayerId(playerId) {
  const code = state.playerRoomIndex.get(playerId);
  if (!code) throw Object.assign(new Error('Сессия игрока не найдена'), { status: 404 });
  const room = state.rooms.get(code);
  if (!room) throw Object.assign(new Error('Комната не найдена'), { status: 404 });
  return room;
}

function getPlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) throw Object.assign(new Error('Игрок не найден'), { status: 404 });
  return player;
}

function requireFunds(player, amount) {
  if (player.money < amount) throw Object.assign(new Error('Недостаточно средств'), { status: 400 });
}

function ensureNotBankrupt(player) {
  if (player.bankrupt) throw Object.assign(new Error('Компания обанкротилась. Создайте новую сессию.'), { status: 400 });
}

function ensureHost(room, playerId) {
  if (room.hostPlayerId !== playerId) throw Object.assign(new Error('Только хост комнаты может выполнять это действие'), { status: 403 });
}

function ensureLobby(room) {
  if (room.status !== 'lobby') throw Object.assign(new Error('Действие доступно только в лобби'), { status: 400 });
}

function ensureLoadable(room) {
  if (!['lobby', 'paused', 'finished'].includes(room.status)) {
    throw Object.assign(new Error('Загрузка сохранения доступна только из лобби, паузы или после матча'), { status: 400 });
  }
}

function playerAssets(player) {
  if (player.factory) {
    const scenario = factoryScenarioConfig(player.factory.scenarioKey);
    const componentValue = Object.entries(player.factory.inventory || {}).reduce((sum, [key, amount]) => {
      const component = scenario?.components?.[key];
      return sum + Math.round((component?.unitCost || 0) * (amount || 0));
    }, 0);
    const workersValue = (player.factory.workers || []).reduce((sum, worker) => sum + worker.expectedSalary * 1.5, 0);
    return componentValue + player.factory.finishedGoods * (scenario?.basePrice || 0) + workersValue + 40000;
  }
  return player.factories * 45000 + player.stores * 30000 + player.staff * 2500 + player.productStock * 70 + player.rawStock * 30 + player.innovation * 9000;
}

function productLabel(productKey) {
  const factory = factoryScenarioConfig(productKey);
  if (factory) return factory.productLabel;
  return PRODUCTS[productKey]?.label || productKey;
}

function productCatalogForRoom(room) {
  if (isFactoryScenario(room.settings.scenarioKey)) {
    const config = factoryScenarioConfig(room.settings.scenarioKey);
    if (config) {
      return [{
        key: config.productKey,
        label: config.productLabel,
      }];
    }
  }
  return Object.keys(PRODUCTS).map(key => ({ key, label: PRODUCTS[key].label }));
}

function scenarioCatalogForRoom() {
  return Object.keys(FACTORY_SCENARIOS).map(key => ({
    key,
    label: SCENARIOS[key].label,
    description: SCENARIOS[key].description,
  }));
}

function buildScenarioLab(room) {
  const scenarioKey = room.settings?.scenarioKey || 'standard';
  const config = factoryScenarioConfig(scenarioKey);
  if (!config) return null;
  const definition = buildScenarioDefinitionFromFactoryConfig(config, {
    difficultyLabel: difficultyConfigForRoom(room).label,
    dayLimit: room.settings?.dayLimit || MAX_TURN_COUNT,
    turnMinutes: Math.round(turnDurationMsForRoom(room) / 60000),
  });
  return buildScenarioLabSummary(definition);
}

function buildScenarioLessonPlan(room) {
  const scenarioKey = room.settings?.scenarioKey || 'standard';
  const config = factoryScenarioConfig(scenarioKey);
  const difficulty = difficultyConfigForRoom(room);
  const scenarioLab = buildScenarioLab(room);
  if (!config) {
    return {
      scenarioKey,
      title: scenarioLabel(scenarioKey),
      audience: 'Студенты и старшие школьники',
      duration: `${room.settings?.dayLimit || 30} ходов`,
      objectives: [
        'Понять связь цены, спроса и денежного результата.',
        'Сравнить стратегии роста, риска и устойчивости компании.',
      ],
      firstSteps: [
        'Объяснить цель: заработать больше конкурентов и не уйти в долг.',
        'Попросить команды выбрать цену и базовые действия.',
        'После первого хода разобрать прибыль и ошибки.',
      ],
      successCriteria: [
        'Команда понимает, почему изменилась прибыль.',
        'Команда может объяснить свое ценовое решение.',
      ],
      discussionPrompts: [
        'Что сильнее повлияло на результат: цена, спрос или расходы?',
        'Почему лидер оказался выше остальных?',
      ],
      metrics: ['капитал', 'прибыль за ход', 'долг', 'рейтинг'],
      parameters: [],
      experimentAxes: [],
    };
  }

  const componentLabels = Object.values(config.components || {}).map(component => component.label.toLowerCase());
  const componentFocus = componentLabels.slice(0, 3).join(', ');
  const demandBand = `${config.baseDemandMin}-${config.baseDemandMax} ${config.productUnit}`;
  const priceBand = `${config.priceRange.min.toLocaleString('ru-RU')}-${config.priceRange.max.toLocaleString('ru-RU')} ₽`;
  return {
    scenarioKey,
    title: `Урок: ${config.productLabel}`,
    audience: '10-11 класс, колледж, 1-2 курс',
    duration: `${room.settings?.dayLimit || 30} ходов по ${Math.round(turnDurationMsForRoom(room) / 60000)} минут`,
    objectives: [
      'Собрать полный производственный цикл: закупка, персонал, сборка, продажа.',
      'Понять, как цена и ограниченный спрос влияют на продажи.',
      'Научиться читать результат хода: выручка, расходы, прибыль и капитал.',
    ],
    firstSteps: [
      `Показать состав изделия: ${componentFocus}.`,
      'Попросить каждую команду закрыть чеклист первого хода.',
      'После пересчета сравнить цену, проданные единицы и прибыль лидера.',
    ],
    successCriteria: [
      'Команда выставила товар в книгу заявок до пересчета хода.',
      'Команда может объяснить, почему её цена продалась или не продалась.',
      'Команда видит связь между закупкой, зарплатой и прибылью.',
    ],
    discussionPrompts: [
      'Какая команда поставила самую разумную цену и почему?',
      'Кто потерял деньги из-за склада, зарплат или слишком высокой цены?',
      'Что выгоднее на следующем ходе: купить больше деталей, нанять людей или снизить цену?',
    ],
    metrics: [
      `спрос: ${demandBand}`,
      `цена: ${priceBand}`,
      `сложность: ${difficulty.label}`,
      'прибыль за ход',
      'капитал',
    ],
    parameters: scenarioLab?.parameters || [],
    experimentAxes: scenarioLab?.experimentAxes || [],
    validation: scenarioLab?.validation || null,
  };
}

function cityLabel(cityKey) {
  return CITIES[cityKey]?.label || cityKey;
}

function boardPolicyLabel(policyKey) {
  return BOARD_POLICIES[policyKey]?.label || policyKey;
}

function strategyLabel(strategyKey) {
  return OPERATING_PLANS[strategyKey]?.label || strategyKey;
}

function advisorAlerts(player, room) {
  const alerts = [];
  if (player.rawStock < 12) alerts.push('raw_low');
  if (player.debt > 90000) alerts.push('debt_high');
  if (player.activeContract && player.activeContract.expiresDay - room.day <= 1) alerts.push('contract_due');
  if (player.research.activeKey && player.research.target - player.research.progress <= 8) alerts.push('research_ready');
  if ((room.settings.dayLimit - (room.tick || 0)) <= 2) alerts.push('season_ending');
  return alerts;
}

function createSeasonGoal(goalKey) {
  const key = goalKey || randomItem(Object.keys(SEASON_GOALS));
  const goal = SEASON_GOALS[key];
  return { key, label: goal.label, metric: goal.metric, target: goal.target, reward: goal.reward, progress: 0, completed: false };
}

function ensureSeasonGoal(player) {
  if (!player.seasonGoal) player.seasonGoal = createSeasonGoal();
}

function decisionScenarioConfig(scenarioKey) {
  return FACTORY_DECISION_SCENARIOS[scenarioKey] || null;
}

function canUseDecisionRoundsInRoom(room) {
  return Boolean(decisionScenarioConfig(room.settings.scenarioKey));
}

function decisionRoundCatalogForScenario(scenarioKey) {
  return decisionScenarioConfig(scenarioKey)?.rounds || [];
}

function createDecisionRoundForScenario(player, room) {
  const catalog = decisionRoundCatalogForScenario(room.settings.scenarioKey);
  if (!catalog.length || !player.factory) return null;
  const lastRoundKey = player.decisionHistory?.[0]?.roundKey || player.decisionRound?.roundKey || '';
  const pool = catalog.filter(item => item.roundKey !== lastRoundKey);
  const template = randomItem(pool.length ? pool : catalog);
  return {
    id: uid('decision'),
    scenarioKey: room.settings.scenarioKey,
    roundKey: template.roundKey,
    titleKey: template.titleKey,
    descriptionKey: template.descriptionKey,
    defaultOptionKey: template.defaultOptionKey,
    status: 'pending',
    resolution: 'pending',
    createdDay: room.day,
    expiresDay: room.day + 1,
    selectedOptionKey: '',
    selectedOptionLabelKey: '',
    resolvedDay: null,
    options: template.options.map(option => ({
      key: option.key,
      labelKey: option.labelKey,
      effectSummaryKey: option.effectSummaryKey,
      effects: {
        money: Number(option.effects?.money || 0),
        debt: Number(option.effects?.debt || 0),
        reputation: Number(option.effects?.reputation || 0),
        quality: Number(option.effects?.quality || 0),
        automation: Number(option.effects?.automation || 0),
        supplyLevel: Number(option.effects?.supplyLevel || 0),
        finishedGoods: Number(option.effects?.finishedGoods || 0),
        inventory: option.effects?.inventory ? { ...option.effects.inventory } : {},
      },
    })),
  };
}

function publicDecisionRound(round) {
  if (!round) return null;
  return {
    id: round.id,
    scenarioKey: round.scenarioKey || '',
    roundKey: round.roundKey,
    titleKey: round.titleKey,
    descriptionKey: round.descriptionKey,
    status: round.status,
    resolution: round.resolution || 'pending',
    createdDay: round.createdDay,
    expiresDay: round.expiresDay,
    defaultOptionKey: round.defaultOptionKey,
    selectedOptionKey: round.selectedOptionKey || '',
    selectedOptionLabelKey: round.selectedOptionLabelKey || '',
    resolvedDay: round.resolvedDay || null,
    options: (round.options || []).map(option => ({
      key: option.key,
      labelKey: option.labelKey,
      effectSummaryKey: option.effectSummaryKey,
      isDefault: option.key === round.defaultOptionKey,
    })),
  };
}

function publicDecisionHistory(history) {
  return (history || []).slice(0, DECISION_HISTORY_LIMIT).map(item => ({
    roundId: item.roundId,
    scenarioKey: item.scenarioKey || '',
    roundKey: item.roundKey,
    titleKey: item.titleKey,
    selectedOptionKey: item.selectedOptionKey,
    selectedOptionLabelKey: item.selectedOptionLabelKey,
    effectSummaryKey: item.effectSummaryKey,
    resolution: item.resolution,
    status: item.status,
    resolvedDay: item.resolvedDay,
  }));
}

function applyDecisionRoundEffects(player, effects) {
  const moneyDelta = Number(effects?.money || 0);
  const debtDelta = Number(effects?.debt || 0);
  const reputationDelta = Number(effects?.reputation || 0);
  const qualityDelta = Number(effects?.quality || 0);
  const automationDelta = Number(effects?.automation || 0);
  const supplyDelta = Number(effects?.supplyLevel || 0);
  const finishedGoodsDelta = Number(effects?.finishedGoods || 0);
  const inventoryDelta = effects?.inventory || {};

  player.money = Math.round(player.money + moneyDelta);
  player.debt = Math.max(0, Math.round(player.debt + debtDelta));
  player.reputation = clamp(Math.round(player.reputation + reputationDelta), 5, 95);
  player.quality = clamp(Math.round(player.quality + qualityDelta), 1, 6);
  player.automation = clamp(Math.round(player.automation + automationDelta), 0, 5);
  player.supplyLevel = clamp(Math.round(player.supplyLevel + supplyDelta), 1, 5);

  if (player.factory) {
    if (finishedGoodsDelta) {
      player.factory.finishedGoods = Math.max(0, Math.round(player.factory.finishedGoods + finishedGoodsDelta));
    }
    Object.entries(inventoryDelta).forEach(([componentKey, delta]) => {
      if (!Object.prototype.hasOwnProperty.call(player.factory.inventory || {}, componentKey)) return;
      player.factory.inventory[componentKey] = Math.max(0, Math.round((player.factory.inventory[componentKey] || 0) + Number(delta || 0)));
    });
    player.productStock = player.factory.finishedGoods;
    player.rawStock = Object.values(player.factory.inventory || {}).reduce((sum, qty) => sum + Math.max(0, Number(qty || 0)), 0);
  }
}

function applyDecisionRoundOption(room, player, optionKey, { resolution = 'manual' } = {}) {
  const decisionConfig = decisionScenarioConfig(room.settings.scenarioKey);
  if (!decisionConfig || !player.factory) {
    throw Object.assign(new Error('Strategic rounds are available only in supported factory scenarios.'), { status: 400 });
  }
  const round = player.decisionRound;
  if (!round || round.status !== 'pending') {
    throw Object.assign(new Error('No pending strategic decision round.'), { status: 400 });
  }
  if (round.scenarioKey && round.scenarioKey !== room.settings.scenarioKey) {
    throw Object.assign(new Error('Strategic decision round does not match current scenario.'), { status: 400 });
  }
  const option = (round.options || []).find(item => item.key === optionKey);
  if (!option) throw Object.assign(new Error('Unknown strategic round option.'), { status: 400 });

  const moneyDelta = Number(option.effects?.money || 0);
  const requiredFunds = moneyDelta < 0 ? Math.abs(moneyDelta) : 0;
  if (requiredFunds > 0) requireFunds(player, requiredFunds);

  applyDecisionRoundEffects(player, option.effects || {});

  const isAuto = resolution === 'auto_safe';
  round.status = isAuto ? 'auto_resolved' : 'resolved';
  round.resolution = resolution;
  round.selectedOptionKey = option.key;
  round.selectedOptionLabelKey = option.labelKey;
  round.resolvedDay = room.day;

  player.decisionHistory = player.decisionHistory || [];
  player.decisionHistory.unshift({
    roundId: round.id,
    scenarioKey: round.scenarioKey || room.settings.scenarioKey,
    roundKey: round.roundKey,
    titleKey: round.titleKey,
    selectedOptionKey: option.key,
    selectedOptionLabelKey: option.labelKey,
    effectSummaryKey: option.effectSummaryKey,
    resolution,
    status: round.status,
    resolvedDay: room.day,
  });
  player.decisionHistory = player.decisionHistory.slice(0, DECISION_HISTORY_LIMIT);

  player.lastAction = isAuto
    ? `Strategic round auto-safe: ${option.key}`
    : `Strategic round resolved: ${option.key}`;
  addRoomLog(
    room,
    isAuto
      ? `${player.name} auto-resolved strategic round ${round.roundKey} with ${option.key}.`
      : `${player.name} resolved strategic round ${round.roundKey} with ${option.key}.`
  );
}

function autoResolveExpiredDecisionRound(room, player) {
  const round = player.decisionRound;
  if (!round || round.status !== 'pending') return;
  if (Number(round.expiresDay || 0) > room.day) return;
  applyDecisionRoundOption(room, player, round.defaultOptionKey, { resolution: 'auto_safe' });
}

function shouldCreateDecisionRound(room, player) {
  const decisionConfig = decisionScenarioConfig(room.settings.scenarioKey);
  if (!decisionConfig) return false;
  if (room.status !== 'running') return false;
  if (!player || player.isBot || player.bankrupt) return false;
  if (player.decisionRound?.status === 'pending') return false;
  if (room.day < 2) return false;
  return room.day % decisionConfig.intervalDays === 0;
}

function createForcedDecisionRound(room, actorPlayer, targetPlayerId) {
  if (!canUseDecisionRoundsInRoom(room)) {
    throw Object.assign(new Error('Strategic rounds are not available in this scenario.'), { status: 400 });
  }
  if (room.status !== 'running') {
    throw Object.assign(new Error('Strategic rounds can be forced only during the match.'), { status: 400 });
  }
  if (room.hostPlayerId !== actorPlayer.id) {
    throw Object.assign(new Error('Only host can force strategic rounds.'), { status: 403 });
  }

  const targetId = String(targetPlayerId || actorPlayer.id);
  const targetPlayer = room.players.get(targetId);
  if (!targetPlayer) throw Object.assign(new Error('Target player was not found.'), { status: 404 });
  if (targetPlayer.isBot) throw Object.assign(new Error('Strategic rounds are not created for bots.'), { status: 400 });
  if (targetPlayer.bankrupt) throw Object.assign(new Error('Strategic rounds are not created for bankrupt players.'), { status: 400 });
  if (targetPlayer.decisionRound?.status === 'pending') {
    throw Object.assign(new Error('Target player already has a pending strategic round.'), { status: 400 });
  }

  const round = createDecisionRoundForScenario(targetPlayer, room);
  if (!round) {
    throw Object.assign(new Error('Could not create strategic round for this scenario.'), { status: 400 });
  }
  targetPlayer.decisionRound = round;
  targetPlayer.lastAction = `Strategic round ready: ${round.roundKey}`;
  addRoomLog(
    room,
    actorPlayer.id === targetPlayer.id
      ? `${actorPlayer.name} forced a strategic round for demo: ${round.roundKey}.`
      : `${actorPlayer.name} forced strategic round ${round.roundKey} for ${targetPlayer.name}.`
  );
  return round;
}

function maybeCreateDecisionRound(room, player) {
  if (!shouldCreateDecisionRound(room, player)) return;
  const round = createDecisionRoundForScenario(player, room);
  if (!round) return;
  player.decisionRound = round;
  addRoomLog(room, `${player.name} received strategic round ${round.roundKey}.`);
}

function runFactoryDecisionLifecycle(room, activePlayers) {
  if (!decisionScenarioConfig(room.settings.scenarioKey)) return;
  activePlayers.forEach(player => {
    if (player.isBot || player.bankrupt) return;
    autoResolveExpiredDecisionRound(room, player);
  });
  activePlayers.forEach(player => {
    if (player.isBot || player.bankrupt) return;
    maybeCreateDecisionRound(room, player);
  });
}


function scenarioLabel(scenarioKey) {
  return SCENARIOS[scenarioKey]?.label || scenarioKey;
}

function specializationLabel(key) {
  return SPECIALIZATIONS[key]?.label || key;
}

function researchLabel(key) {
  return RESEARCH_PROJECTS[key]?.label || key;
}

function roomForecast(room) {
  if (isFactoryScenario(room.settings.scenarioKey)) return [];
  const scenario = SCENARIOS[room.settings.scenarioKey] || SCENARIOS.standard;
  return buildForecastSegments({
    cities: Object.entries(CITIES).map(([key, city]) => ({ key, label: city.label, ...city })),
    products: Object.entries(PRODUCTS).map(([key, product]) => ({ key, label: product.label, ...product })),
    scenario,
    demandProfileKey: room.settings.demandProfile,
    activeEvent: room.activeEvent,
  });
}

function buildFactoryStats(room, viewerId) {
  if (!isFactoryScenario(room.settings.scenarioKey)) return null;
  const history = room.marketHistory || [];
  const latest = history[history.length - 1] || null;
  const previous = history[history.length - 2] || null;
  const latestDemand = Math.round(latest?.demand || 0);
  const latestSales = Math.round(latest?.totalSales || 0);
  const previousDemand = Math.round(previous?.demand || 0);
  const book = room.factoryScenario?.marketBook || [];
  const topEntry = [...book]
    .filter(entry => (entry.sold || 0) > 0)
    .sort((left, right) => (right.sold || 0) - (left.sold || 0) || ((right.sold || 0) * (right.price || 0)) - ((left.sold || 0) * (left.price || 0)))[0] || null;
  const viewer = room.players.get(viewerId);
  const breakdown = viewer?.lastTickBreakdown || null;

  return {
    hasData: Boolean(latest),
    latest: latest ? {
      day: latest.day,
      demand: latestDemand,
      baseDemand: Math.round(latest.baseDemand || latestDemand),
      demandMultiplier: Number(latest.demandMultiplier || 1),
      totalSales: latestSales,
      avgPrice: Math.round(latest.avgPrice || 0),
      unmatchedDemand: Math.max(0, latestDemand - latestSales),
    } : null,
    previous: previous ? {
      day: previous.day,
      demand: previousDemand,
      totalSales: Math.round(previous.totalSales || 0),
      avgPrice: Math.round(previous.avgPrice || 0),
    } : null,
    demandDelta: latest ? latestDemand - previousDemand : 0,
    sellThroughPct: latestDemand ? Math.round((latestSales / latestDemand) * 100) : 0,
    unmatchedDemand: latest ? Math.max(0, latestDemand - latestSales) : 0,
    avgPrice: latest ? Math.round(latest.avgPrice || 0) : 0,
    totalSales: latestSales,
    playerProfit: Math.round(breakdown?.profit || 0),
    playerRevenue: Math.round(breakdown?.revenue || 0),
    playerExpenses: Math.round(breakdown?.expenses || 0),
    topSeller: topEntry ? {
      playerId: topEntry.playerId,
      playerName: topEntry.playerName,
      sold: Math.round(topEntry.sold || 0),
      price: Math.round(topEntry.price || 0),
      revenue: Math.round((topEntry.sold || 0) * (topEntry.price || 0)),
    } : null,
    recentHistory: history.slice(-6).map(entry => {
      const demand = Math.round(entry.demand || 0);
      const totalSales = Math.round(entry.totalSales || 0);
      return {
        day: entry.day,
        demand,
        baseDemand: Math.round(entry.baseDemand || demand),
        demandMultiplier: Number(entry.demandMultiplier || 1),
        totalSales,
        avgPrice: Math.round(entry.avgPrice || 0),
        sellThroughPct: demand ? Math.round((totalSales / demand) * 100) : 0,
      };
    }),
  };
}

function factoryEventMultiplier(room, key) {
  if (room.activeEvent?.scope !== 'factory') return 1;
  return Number(room.activeEvent[key] || 1);
}

function factoryComponentCost(room, config, componentKey, quantity) {
  return Math.round(componentCost(config, componentKey, quantity) * factoryEventMultiplier(room, 'rawCostMultiplier'));
}

function buySupplierOffer(room, player, supplierOfferId, requestedQuantity = null) {
  const config = ensureFactoryPlayer(player, room);
  const offers = room.factoryScenario?.supplierOffers || [];
  const offerIndex = offers.findIndex(offer => offer.id === supplierOfferId);
  if (offerIndex < 0) {
    throw Object.assign(new Error('Этот поставщик уже выкуплен другим игроком.'), { status: 404 });
  }
  const offer = offers[offerIndex];
  const component = config.components[offer.componentKey];
  if (!component) throw Object.assign(new Error('Unknown component.'), { status: 400 });
  const quantity = clamp(Number(requestedQuantity) || offer.quantity, 1, offer.quantity);
  const eventMultiplier = factoryEventMultiplier(room, 'rawCostMultiplier');
  const cost = Math.round(quantity * offer.unitPrice * eventMultiplier);
  requireFunds(player, cost);
  player.money -= cost;
  player.factory.inventory[offer.componentKey] = (player.factory.inventory[offer.componentKey] || 0) + quantity;
  offers.splice(offerIndex, 1);
  player.rawStock = Object.values(player.factory.inventory || {}).reduce((sum, qty) => sum + Math.max(0, Number(qty || 0)), 0);
  player.lastAction = `Закуплено: ${quantity} ${component.label.toLowerCase()} у ${offer.supplierName}.`;
  addRoomLog(room, `${player.name} выкупил лот ${offer.supplierName}: ${quantity} ${component.label.toLowerCase()} за ${cost}.`);
  return { offer, quantity, cost };
}

const {
  buildTurnChecklist,
  buildMarketHints,
  buildTurnReview,
  buildComparisonToLeader,
  buildLearningHints,
  buildNextAction,
} = createFactorySummaryHelpers({
  isFactoryScenario,
  factoryScenarioConfig,
  availableAssemblyCount,
  factoryEventMultiplier,
  clamp,
  buildFactoryStats,
  buildSimulationScore,
  playerAssets,
});

function buildClassReadiness(room, players) {
  const rows = players
    .filter(isClassPlayer)
    .map(player => {
      const checklist = player.turnChecklist || [];
      const attention = checklist.filter(item => item.status === 'attention').length;
      const blocked = checklist.filter(item => item.status === 'blocked').length;
      const warehouseStep = checklist.find(item => item.key === 'warehouse') || null;
      const workforceStep = checklist.find(item => item.key === 'workforce') || null;
      const saleStep = checklist.find(item => item.key === 'sale') || null;
      const assemblyStep = checklist.find(item => item.key === 'assembly') || null;
      const turnGuide = player.turnGuide || null;
      const routePrimaryStep = turnGuide?.steps?.find(step => step.key === turnGuide.primaryKey) || null;
      const components = player.factory?.components || [];
      const componentStock = components.reduce((sum, component) => sum + Number(component.quantity || 0), 0);
      const noPurchase = Boolean(player.factory && componentStock <= 0);
      const noWorkers = Boolean(player.factory && Number(player.factory.workerCount || 0) <= 0);
      const noSaleOffer = Boolean(player.factory && (player.factory.finishedGoods || 0) > 0 && !(player.factory.saleOffer?.quantity || 0));
      const noProduction = Boolean(player.factory && !(player.factory.finishedGoods || 0) && !(player.producedLastTick || 0));
      const debtRisk = player.debt > Math.max(player.money, 1) * 0.45 || player.money < 12000;
      const needsDecision = player.decisionRound?.status === 'pending';
      const primaryIssue = noPurchase
        ? warehouseStep
        : noWorkers
          ? workforceStep
          : noProduction
            ? assemblyStep
            : noSaleOffer
              ? saleStep
              : checklist.find(item => item.status === 'blocked')
                || checklist.find(item => item.status === 'attention')
                || null;
      const readyForTurn = !blocked && !noPurchase && !noWorkers && !noSaleOffer && !noProduction && !debtRisk && !needsDecision;
      const actionHint = needsDecision
        ? 'Решить дилемму'
        : noPurchase
          ? 'Купить комплектующие'
          : noWorkers
            ? 'Нанять сотрудника'
            : noSaleOffer
              ? 'Выставить заявку'
              : noProduction
                ? 'Собрать товар'
                : debtRisk
                  ? 'Проверить финансы'
                  : attention
                    ? (primaryIssue?.action || 'Проверить решение')
                    : 'Готов к ходу';
      const reason = needsDecision
        ? 'не выбрана дилемма'
        : noPurchase
          ? 'без закупки'
          : noWorkers
            ? 'без работников'
            : noProduction
              ? 'без производства'
              : noSaleOffer
                ? 'без заявки'
                : debtRisk
                  ? 'риск долга'
                  : attention
                    ? 'требует внимания'
                    : 'готов';
      const priority = needsDecision || noPurchase || noWorkers || noProduction ? 3 : noSaleOffer || debtRisk ? 2 : attention ? 1 : 0;
      return {
        playerId: player.id,
        userName: player.userName,
        companyName: player.name,
        ready: Boolean(player.ready),
        status: readyForTurn ? 'ready' : priority >= 3 || blocked ? 'blocked' : 'attention',
        attention,
        blocked,
        noPurchase,
        noWorkers,
        noSaleOffer,
        noProduction,
        debtRisk,
        needsDecision,
        readyForTurn,
        actionHint,
        reason,
        priority,
        tab: primaryIssue?.tab || (needsDecision ? 'operations' : debtRisk ? 'overview' : 'operations'),
        department: primaryIssue?.department || 'command',
        routePrimaryKey: turnGuide?.primaryKey || '',
        routePrimaryLabel: routePrimaryStep?.label || '',
        routeButtonLabel: turnGuide?.buttonLabel || '',
        routeProgressReady: Math.round(turnGuide?.progress?.ready || 0),
        routeProgressTotal: Math.round(turnGuide?.progress?.total || 0),
        money: Math.round(player.money || 0),
        debt: Math.round(player.debt || 0),
        finishedGoods: Math.round(player.factory?.finishedGoods || 0),
        saleQuantity: Math.round(player.factory?.saleOffer?.quantity || 0),
        producedThisTurn: Math.round(player.producedLastTick || 0),
        soldLastTick: Math.round(player.soldLastTick || 0),
      };
    });
  const helpQueue = rows
    .filter(row => !row.readyForTurn)
    .sort((left, right) => right.priority - left.priority || left.userName.localeCompare(right.userName, 'ru'))
    .map(row => ({
      playerId: row.playerId,
      userName: row.userName,
      companyName: row.companyName,
      reason: row.reason,
      actionHint: row.actionHint,
      status: row.status,
      tab: row.tab,
      department: row.department,
      money: row.money,
      debt: row.debt,
    }));
  const total = rows.length;
  const readyCount = rows.filter(row => row.readyForTurn).length;
  const attentionCount = rows.filter(row => row.status === 'attention').length;
  const blockedCount = rows.filter(row => row.status === 'blocked').length;
  const firstHelp = helpQueue[0] || null;
  const canAdvanceTurn = total > 0 && readyCount === total;
  const briefingStatus = canAdvanceTurn ? 'ready' : blockedCount > 0 ? 'blocked' : 'attention';
  const issueCounts = [
    ['без закупки', rows.filter(row => row.noPurchase).length],
    ['без работников', rows.filter(row => row.noWorkers).length],
    ['без производства', rows.filter(row => row.noProduction).length],
    ['без заявки', rows.filter(row => row.noSaleOffer).length],
    ['риск долга', rows.filter(row => row.debtRisk).length],
    ['дилемма', rows.filter(row => row.needsDecision).length],
  ].filter(([, count]) => count > 0);
  const issueSummary = issueCounts.length
    ? issueCounts.slice(0, 3).map(([label, count]) => `${label}: ${count}`).join(' • ')
    : 'критических блокеров нет';
  const routeLabels = [
    ['purchase', 'Закупка'],
    ['personnel', 'Персонал'],
    ['assembly', 'Сборка'],
    ['market', 'Продажа'],
    ['finish', 'Завершение'],
  ];
  const stepMap = routeLabels.map(([key, label]) => {
    const stuckRows = rows.filter(row => row.routePrimaryKey === key && !row.readyForTurn);
    const readyRows = rows.filter(row => row.routePrimaryKey === key && row.readyForTurn);
    return {
      key,
      label,
      stuck: stuckRows.length,
      ready: readyRows.length,
      total: stuckRows.length + readyRows.length,
      students: stuckRows.slice(0, 4).map(row => ({
        playerId: row.playerId,
        userName: row.userName,
        companyName: row.companyName,
        actionHint: row.actionHint,
        reason: row.reason,
        progressReady: row.routeProgressReady,
        progressTotal: row.routeProgressTotal,
      })),
    };
  });
  const routeSummary = {
    title: canAdvanceTurn
      ? 'Все команды дошли до завершения хода'
      : 'Карта хода класса',
    primaryStep: stepMap
      .filter(step => step.stuck > 0)
      .sort((left, right) => right.stuck - left.stuck)[0] || null,
    stepMap,
  };
  const teacherBriefing = {
    status: briefingStatus,
    canAdvanceTurn,
    title: canAdvanceTurn
      ? 'Класс готов к пересчёту хода'
      : firstHelp
        ? `Сначала помогите: ${firstHelp.actionHint}`
        : 'Класс требует внимания',
    summary: `${readyCount}/${total || 0} компаний готовы. ${issueSummary}.`,
    recommendedAction: canAdvanceTurn
      ? 'Запустите следующий ход, затем откройте фазу разбора и обсудите прибыль, продажи и ошибки.'
      : firstHelp
        ? `Подойдите к ${firstHelp.userName}: ${firstHelp.reason}. Действие: ${firstHelp.actionHint}.`
        : 'Проверьте команды со статусом “внимание” перед пересчётом.',
    discussionPrompts: canAdvanceTurn
      ? [
          'Кто поставил цену ближе всего к рынку и почему?',
          'У кого после хода вырос капитал, а у кого деньги ушли в расходы?',
          'Какая команда лучше закрыла полный цикл: закупка, сборка, продажа?',
        ]
      : [
          'Какая часть бизнес-цикла сейчас чаще всего ломается?',
          'Что мешает командам превратить склад в продажу?',
          'Какие решения надо сделать до пересчёта хода?',
        ],
  };
  return {
    generatedAtDay: room.day,
    total,
    ready: readyCount,
    attention: attentionCount,
    blocked: blockedCount,
    noPurchase: rows.filter(row => row.noPurchase).length,
    noWorkers: rows.filter(row => row.noWorkers).length,
    noSaleOffer: rows.filter(row => row.noSaleOffer).length,
    noProduction: rows.filter(row => row.noProduction).length,
    debtRisk: rows.filter(row => row.debtRisk).length,
    needsDecision: rows.filter(row => row.needsDecision).length,
    briefing: teacherBriefing,
    routeSummary,
    stepMap,
    helpQueue,
    rows,
  };
}


function playerSummary(room, player, viewerId, forecastSegments = roomForecast(room)) {
  if (isFactoryScenario(room.settings.scenarioKey) && player.factory) {
    const config = factoryScenarioConfig(room.settings.scenarioKey);
    const workers = player.factory.workers || [];
    const avgSuitability = workers.length
      ? Math.round(workers.reduce((sum, worker) => sum + worker.suitability, 0) / workers.length)
      : 0;
    const assemblyCapacity = availableAssemblyCount(player.factory, config);
    const components = Object.entries(config.components).map(([key, component]) => ({
      key,
      label: component.label,
      quantity: player.factory.inventory[key] || 0,
      unitCost: component.unitCost,
      lotSize: component.lotSize,
      recipe: component.recipe,
    }));
    const seasonGoal = {
      key: 'factory_margin',
      label: `${config.productLabel}: выпуск сезона`,
      metric: 'finished_goods',
      target: 16,
      reward: 30000,
      progress: player.totalSalesSeason || 0,
      completed: (player.totalSalesSeason || 0) >= 16,
    };
    const netWorth = Math.round(player.money + playerAssets(player) - player.debt);
    const simulationScore = buildSimulationScore({
      netWorth,
      money: player.money,
      debt: player.debt,
      reputation: player.reputation,
      completedContracts: player.completedContracts || 0,
      completedResearch: (player.research?.completed || []).length,
      innovation: player.innovation || 0,
      soldLastTick: player.factory.soldThisTurn || 0,
      seasonGoal,
      lastTickBreakdown: player.lastTickBreakdown,
    });
    const turnChecklist = buildTurnChecklist(room, player);
    const turnReview = buildTurnReview(room, player);
    const marketHints = buildMarketHints(room, player);
    const comparisonToLeader = buildComparisonToLeader(room, player);
    const learningHints = buildLearningHints(room, player, { turnChecklist, marketHints, turnReview });
    const nextAction = buildNextAction(room, player, { turnChecklist, marketHints, turnReview });
    const assemblyHints = buildFactoryAssemblyHints(player, config);
    const unitEconomics = buildFactoryUnitEconomics(room, player, config);
    const purchaseHints = buildFactoryPurchaseHints(room, player, config);
    const personnelHints = buildFactoryPersonnelHints(room, player, config, unitEconomics);
    const turnGuide = buildFactoryTurnGuide(room, player, {
      turnChecklist,
      purchaseHints,
      personnelHints,
      assemblyHints,
      marketHints,
    });
    const playerDebrief = buildFactoryPlayerDebrief(room, player, config, {
      comparisonToLeader,
      unitEconomics,
      turnGuide,
    });
    return {
      id: player.id,
      version: Math.max(1, Number(player.version) || 1),
      name: player.name,
      userName: player.userName,
      avatar: player.avatar,
      money: Math.round(player.money),
      debt: Math.round(player.debt),
      reputation: Math.round(player.reputation),
      staff: workers.length,
      factories: 1,
      stores: 0,
      productStock: player.factory.finishedGoods,
      rawStock: components.reduce((sum, component) => sum + component.quantity, 0),
      soldLastTick: player.factory.soldThisTurn || 0,
      producedLastTick: player.factory.assembledThisTurn || 0,
      totalSalesSeason: Math.round(player.totalSalesSeason || 0),
      incomeLastTick: Math.round(player.factory.revenueThisTurn || 0),
      expensesLastTick: Math.round(player.factory.workerPayroll || 0),
      lastTickBreakdown: player.lastTickBreakdown ? { ...player.lastTickBreakdown } : null,
      marketing: player.marketing,
      automation: player.automation,
      quality: player.quality,
      innovation: player.innovation,
      researchPoints: 0,
      research: { activeKey: '', activeLabel: '', progress: 0, target: 0, completed: [] },
      researchEffects: {},
      specializationKey: 'balanced',
      specializationLabel: 'Сборочная линия',
      boardPolicyKey: 'balanced',
      boardPolicyLabel: 'Совет завода',
      strategyKey: 'balanced',
      strategyLabel: 'Ручное планирование',
      strategyDescription: 'Игроки по шагам нанимают работников, закупают детали, собирают продукцию и выставляют заявки на продажу.',
      operatingPlanPreview: null,
      activeContract: null,
      completedContracts: 0,
      seasonGoal,
      advisorAlerts: [],
      intel: { riskLevel: 'low', riskScore: 0, signals: [], recommendations: [] },
      turnChecklist,
      turnReview,
      marketHints,
      comparisonToLeader,
      learningHints,
      nextAction,
      turnGuide,
      playerDebrief,
      assemblyHints,
      unitEconomics,
      purchaseHints,
      personnelHints,
      price: player.factory.saleOffer?.price || config.basePrice,
      salary: workers.length ? Math.round(workers.reduce((sum, worker) => sum + worker.expectedSalary, 0) / workers.length) : 0,
      supplyLevel: 1,
      productKey: config.productKey,
      productLabel: config.productLabel,
      cityKey: '',
      cityLabel: '',
      focusCityKey: '',
      focusCityLabel: '',
      focusProductKey: config.productKey,
      focusProductLabel: config.productLabel,
      focusPlan: { readinessLevel: 'high', readinessScore: 100, forecastDemand: 0, missingSteps: [] },
      pivotPreview: { timing: 'hold', currentDemand: 0, targetDemand: 0, demandDelta: 0, reasons: [] },
      executionPlan: [],
      decisionRound: publicDecisionRound(player.decisionRound),
      decisionHistory: publicDecisionHistory(player.decisionHistory),
      netWorth,
      simulationScore,
      lastAction: player.lastAction,
      bankrupt: player.bankrupt,
      isBot: player.isBot,
      isTeacherHost: Boolean(player.isTeacherHost),
      ready: Boolean(player.ready),
      isHost: room.hostPlayerId === player.id,
      isViewer: viewerId === player.id,
      factory: {
        scenarioKey: config.key,
        productLabel: config.productLabel,
        productUnit: config.productUnit,
        components,
        workers,
        workerCount: workers.length,
        avgSuitability,
        assemblyCapacity,
        finishedGoods: player.factory.finishedGoods,
        saleOffer: { ...player.factory.saleOffer },
      },
    };
  }
  const effects = researchEffects(player, RESEARCH_PROJECTS);
  const seasonGoal = player.seasonGoal ? { ...player.seasonGoal, progress: computeSeasonGoalProgress(player) } : null;
  const intel = buildPlayerIntel({
    player: {
      ...player,
      seasonGoal,
    },
    room,
    availableResearchCount: Object.keys(RESEARCH_PROJECTS).filter(key => !player.research.completed.includes(key)).length,
  });
  const manufacturerMode = Boolean(player.factory);
  const focusPlan = buildFocusPlan({
    player,
    focusCityKey: manufacturerMode ? '' : (player.focusCityKey || player.cityKey),
    focusProductKey: player.focusProductKey || player.productKey,
    forecastSegments,
  });
  const availableResearchKeys = Object.keys(RESEARCH_PROJECTS).filter(key => !player.research.completed.includes(key));
  const operatingPlanPreview = buildOperatingPlanPreview({
    player,
    availableResearchKeys,
    availableContracts: room.contractBoard || [],
  });
  const pivotPreview = buildPivotPreview({
    player,
    focusPlan,
    forecastSegments,
  });
  const executionPlan = buildExecutionPlan({
    player,
    room,
    intel,
    focusPlan,
    pivotPreview,
    availableResearchKeys,
  });
  const netWorth = Math.round(player.money + playerAssets(player) - player.debt);
  const simulationScore = buildSimulationScore({
    netWorth,
    money: player.money,
    debt: player.debt,
    reputation: player.reputation,
    completedContracts: player.completedContracts,
    completedResearch: (player.research.completed || []).length,
    innovation: player.innovation,
    soldLastTick: player.soldLastTick,
    seasonGoal,
    lastTickBreakdown: player.lastTickBreakdown,
  });
  return {
    id: player.id,
    name: player.name,
    userName: player.userName,
    avatar: player.avatar,
    money: Math.round(player.money),
    debt: Math.round(player.debt),
    reputation: Math.round(player.reputation),
    staff: player.staff,
    factories: player.factories,
    stores: player.stores,
    productStock: Math.round(player.productStock),
    rawStock: Math.round(player.rawStock),
    soldLastTick: player.soldLastTick,
    producedLastTick: player.producedLastTick,
    totalSalesSeason: Math.round(player.totalSalesSeason || 0),
    incomeLastTick: Math.round(player.incomeLastTick),
    expensesLastTick: Math.round(player.expensesLastTick),
    lastTickBreakdown: player.lastTickBreakdown ? { ...player.lastTickBreakdown } : null,
    marketing: player.marketing,
    automation: player.automation,
    quality: player.quality,
    innovation: player.innovation,
    researchPoints: Math.round(player.researchPoints),
    research: {
      activeKey: player.research.activeKey,
      activeLabel: player.research.activeKey ? researchLabel(player.research.activeKey) : '',
      progress: Math.round(player.research.progress || 0),
      target: player.research.activeKey ? RESEARCH_PROJECTS[player.research.activeKey]?.cost || 0 : 0,
      completed: [...player.research.completed],
    },
    researchEffects: effects,
    specializationKey: player.specializationKey,
    specializationLabel: specializationLabel(player.specializationKey),
    boardPolicyKey: player.boardPolicyKey,
    boardPolicyLabel: boardPolicyLabel(player.boardPolicyKey),
    strategyKey: player.strategyKey || 'balanced',
    strategyLabel: strategyLabel(player.strategyKey || 'balanced'),
    strategyDescription: OPERATING_PLANS[player.strategyKey || 'balanced']?.description || '',
    operatingPlanPreview,
    activeContract: player.activeContract ? { ...player.activeContract } : null,
    completedContracts: player.completedContracts,
    seasonGoal,
    advisorAlerts: advisorAlerts(player, room),
    intel,
    turnChecklist: [],
    turnReview: null,
    marketHints: [],
    comparisonToLeader: buildComparisonToLeader(room, player),
    playerDebrief: null,
    price: player.price,
    salary: player.salary,
    supplyLevel: player.supplyLevel,
    productKey: player.productKey,
    productLabel: productLabel(player.productKey),
    cityKey: player.cityKey,
    cityLabel: manufacturerMode ? '' : cityLabel(player.cityKey),
    focusCityKey: manufacturerMode ? '' : (player.focusCityKey || player.cityKey),
    focusCityLabel: manufacturerMode ? '' : cityLabel(player.focusCityKey || player.cityKey),
    focusProductKey: player.focusProductKey || player.productKey,
    focusProductLabel: productLabel(player.focusProductKey || player.productKey),
    focusPlan,
    pivotPreview,
    executionPlan,
    decisionRound: publicDecisionRound(player.decisionRound),
    decisionHistory: publicDecisionHistory(player.decisionHistory),
    netWorth,
    simulationScore,
    lastAction: player.lastAction,
    bankrupt: player.bankrupt,
    isBot: player.isBot,
    isTeacherHost: Boolean(player.isTeacherHost),
    ready: Boolean(player.ready),
    isHost: room.hostPlayerId === player.id,
    isViewer: viewerId === player.id,
  };
}

function buildStudentPlayerSummary(room, player, viewerId, forecastSegments = roomForecast(room)) {
  const full = playerSummary(room, player, viewerId, forecastSegments);
  const personnelHints = full.personnelHints
    ? {
        ...full.personnelHints,
        candidates: (full.personnelHints.candidates || []).slice(0, 3),
      }
    : null;
  return {
    playerView: 'student',
    playerContract: 'student-player-v2',
    id: full.id,
    version: Math.max(1, Number(full.version || player.version) || 1),
    name: full.name,
    userName: full.userName,
    avatar: full.avatar,
    money: full.money,
    debt: full.debt,
    reputation: full.reputation,
    staff: full.staff,
    factories: full.factories,
    stores: full.stores,
    productStock: full.productStock,
    rawStock: full.rawStock,
    soldLastTick: full.soldLastTick,
    producedLastTick: full.producedLastTick,
    totalSalesSeason: full.totalSalesSeason,
    incomeLastTick: full.incomeLastTick,
    expensesLastTick: full.expensesLastTick,
    lastTickBreakdown: full.lastTickBreakdown,
    marketing: full.marketing,
    automation: full.automation,
    quality: full.quality,
    innovation: full.innovation,
    researchPoints: full.researchPoints || 0,
    research: full.research || { activeKey: '', activeLabel: '', progress: 0, target: 0, completed: [] },
    specializationKey: full.specializationKey,
    specializationLabel: full.specializationLabel,
    boardPolicyKey: full.boardPolicyKey,
    boardPolicyLabel: full.boardPolicyLabel,
    strategyKey: full.strategyKey,
    strategyLabel: full.strategyLabel,
    strategyDescription: full.strategyDescription,
    activeContract: full.activeContract,
    completedContracts: full.completedContracts || 0,
    seasonGoal: full.seasonGoal,
    turnChecklist: full.turnChecklist || [],
    turnReview: full.turnReview || null,
    marketHints: full.marketHints || [],
    comparisonToLeader: full.comparisonToLeader || null,
    learningHints: full.learningHints || [],
    nextAction: full.nextAction || null,
    turnGuide: full.turnGuide || null,
    playerDebrief: room.status === 'finished' ? (full.playerDebrief || null) : null,
    assemblyHints: full.assemblyHints || null,
    unitEconomics: full.unitEconomics || null,
    purchaseHints: full.purchaseHints || [],
    personnelHints,
    price: full.price,
    salary: full.salary,
    supplyLevel: full.supplyLevel,
    productKey: full.productKey,
    productLabel: full.productLabel,
    cityKey: full.cityKey,
    cityLabel: full.cityLabel,
    focusCityKey: full.focusCityKey,
    focusCityLabel: full.focusCityLabel,
    focusProductKey: full.focusProductKey,
    focusProductLabel: full.focusProductLabel,
    decisionRound: full.decisionRound || null,
    decisionHistory: full.decisionHistory || [],
    netWorth: full.netWorth,
    simulationScore: full.simulationScore,
    lastAction: full.lastAction,
    bankrupt: full.bankrupt,
    isBot: full.isBot,
    isTeacherHost: false,
    ready: full.ready,
    isHost: full.isHost,
    isViewer: full.isViewer,
    factory: full.factory || null,
  };
}

function playerStateSummary(room, player, viewerId, options = {}) {
  const forecastSegments = roomForecast(room);
  if (options.view === 'student') return buildStudentPlayerSummary(room, player, viewerId, forecastSegments);
  return playerSummary(room, player, viewerId, forecastSegments);
}

function publicPlayerShell(player) {
  return {
    id: player.id,
    version: Math.max(1, Number(player.version) || 1),
    name: player.name,
    userName: player.userName,
    avatar: player.avatar,
    money: player.money,
    netWorth: player.netWorth,
    simulationScore: player.simulationScore,
    lastAction: player.lastAction,
    bankrupt: player.bankrupt,
    isBot: player.isBot,
    isTeacherHost: Boolean(player.isTeacherHost),
    ready: Boolean(player.ready),
    isHost: Boolean(player.isHost),
    isViewer: Boolean(player.isViewer),
  };
}

function publicPlayerShellFromRaw(room, player, viewerId) {
  const netWorth = Math.round((player.money || 0) + playerAssets(player) - (player.debt || 0));
  const config = player.factory ? factoryScenarioConfig(player.factory.scenarioKey || room.settings.scenarioKey) : null;
  const seasonGoal = config
    ? {
        key: 'factory_margin',
        label: `${config.productLabel}: выпуск сезона`,
        metric: 'finished_goods',
        target: 16,
        reward: 30000,
        progress: player.totalSalesSeason || 0,
        completed: (player.totalSalesSeason || 0) >= 16,
      }
    : player.seasonGoal
      ? { ...player.seasonGoal, progress: computeSeasonGoalProgress(player) }
      : null;
  const simulationScore = buildSimulationScore({
    netWorth,
    money: player.money,
    debt: player.debt,
    reputation: player.reputation,
    completedContracts: player.completedContracts || 0,
    completedResearch: (player.research?.completed || []).length,
    innovation: player.innovation || 0,
    soldLastTick: player.factory?.soldThisTurn || 0,
    seasonGoal,
    lastTickBreakdown: player.lastTickBreakdown,
  });

  return {
    id: player.id,
    version: Math.max(1, Number(player.version) || 1),
    name: player.name,
    userName: player.userName,
    avatar: player.avatar,
    money: Math.round(player.money || 0),
    netWorth,
    simulationScore,
    lastAction: player.lastAction,
    bankrupt: player.bankrupt,
    isBot: player.isBot,
    isTeacherHost: Boolean(player.isTeacherHost),
    ready: Boolean(player.ready),
    isHost: room.hostPlayerId === player.id,
    isViewer: viewerId === player.id,
  };
}

function buildStudentFactoryScenarioSummary(room) {
  if (!room.factoryScenario) return null;
  return {
    key: room.factoryScenario.key,
    label: room.factoryScenario.label,
    description: room.factoryScenario.description,
    productLabel: room.factoryScenario.productLabel,
    productUnit: room.factoryScenario.productUnit,
    baseDemandMin: room.factoryScenario.baseDemandMin,
    baseDemandMax: room.factoryScenario.baseDemandMax,
    upkeep: room.factoryScenario.upkeep,
    roles: [...(room.factoryScenario.roles || [])],
    components: (room.factoryScenario.components || []).map(component => ({ ...component })),
    priceRange: room.factoryScenario.priceRange,
    candidates: [...(room.factoryScenario.candidates || [])],
    supplierOffers: [...(room.factoryScenario.supplierOffers || [])],
    marketBook: [...(room.factoryScenario.marketBook || [])],
  };
}

function publicHelpRequest(room, request) {
  const player = room.players.get(request.playerId);
  return {
    id: request.id,
    playerId: request.playerId,
    userName: player?.userName || 'Ученик',
    companyName: player?.name || '',
    category: request.category || 'other',
    message: request.message || '',
    status: request.status || 'open',
    createdAt: request.createdAt || '',
    updatedAt: request.updatedAt || request.createdAt || '',
    acknowledgedAt: request.acknowledgedAt || null,
    resolvedAt: request.resolvedAt || null,
  };
}

function publicPauseRequest(room, request) {
  if (!request || !request.playerId) return null;
  const player = room.players.get(request.playerId);
  return {
    id: request.id || '',
    playerId: request.playerId,
    userName: player?.userName || 'Student',
    companyName: player?.name || '',
    status: request.status || 'pending',
    requestedAt: Number(request.requestedAt) || 0,
    expiresAt: Number(request.expiresAt) || 0,
    acceptedAt: request.acceptedAt ? Number(request.acceptedAt) : null,
    updatedAt: Number(request.updatedAt) || Number(request.requestedAt) || 0,
  };
}

function buildStudentRoomSummary(room, viewerId, forecastSegments = roomForecast(room)) {
  const factoryMode = isFactoryScenario(room.settings.scenarioKey);
  const players = [...room.players.values()]
    .filter(player => !player.isTeacherHost)
    .map(player => publicPlayerShellFromRaw(room, player, viewerId));
  const leaderboard = [...players].sort((a, b) => (
    (b.simulationScore?.total || 0) - (a.simulationScore?.total || 0)
      || b.netWorth - a.netWorth
  ));
  const difficulty = difficultyConfigForRoom(room);
  const classPlayers = players.filter(isClassPlayer);
  const helpRequest = (room.helpRequests || [])
    .filter(request => request.playerId === viewerId)
    .slice(-1)
    .map(request => publicHelpRequest(room, request))[0] || null;
  const pauseRequest = room.pauseRequest?.playerId === viewerId
    ? publicPauseRequest(room, room.pauseRequest)
    : null;
  return {
    summaryView: 'student',
    summaryContract: 'student-v2',
    code: room.code,
    name: room.name,
    version: Math.max(1, Number(room.version) || 1),
    status: room.status,
    day: room.day,
    tick: room.tick,
    settings: room.settings,
    difficulty: difficulty.key,
    difficultyLabel: difficulty.label,
    difficultyRules: publicDifficultyRules(difficulty),
    visibleUiMode: difficulty.uiMode,
    scenarioLabel: scenarioLabel(room.settings.scenarioKey),
    hostPlayerId: room.hostPlayerId,
    winnerPlayerId: room.winnerPlayerId || null,
    finishReason: room.finishReason || null,
    startedAt: room.startedAt || null,
    finishedAt: room.finishedAt || null,
    playerCount: players.filter(player => !player.bankrupt).length,
    readyCount: classPlayers.filter(player => player.ready).length,
    humanCount: classPlayers.length,
    allReady: classPlayers.every(player => player.ready),
    players,
    leaderboard,
    helpRequest,
    pauseRequest,
    market: room.marketHistory.slice(-8),
    segments: room.segmentSnapshots.slice(0, 6),
    log: room.log.slice(0, 12),
    productCatalog: productCatalogForRoom(room),
    cityCatalog: factoryMode ? [] : Object.keys(CITIES).map(key => ({ key, label: CITIES[key].label })),
    scenarioCatalog: scenarioCatalogForRoom(),
    difficultyCatalog: difficultyCatalog(),
    specializationCatalog: factoryMode ? [] : Object.keys(SPECIALIZATIONS).map(key => ({ key, label: SPECIALIZATIONS[key].label, description: SPECIALIZATIONS[key].description })),
    boardPolicyCatalog: factoryMode ? [] : Object.keys(BOARD_POLICIES).map(key => ({ key, label: BOARD_POLICIES[key].label })),
    strategyCatalog: factoryMode ? [] : Object.keys(OPERATING_PLANS).map(key => ({ key, label: OPERATING_PLANS[key].label, description: OPERATING_PLANS[key].description })),
    researchCatalog: factoryMode ? [] : Object.keys(RESEARCH_PROJECTS).map(key => ({ key, label: RESEARCH_PROJECTS[key].label, cost: RESEARCH_PROJECTS[key].cost, description: RESEARCH_PROJECTS[key].description })),
    forecastSegments: forecastSegments.slice(0, 6),
    activeEvent: room.activeEvent,
    contractBoard: factoryMode ? [] : (room.contractBoard || []),
    factoryScenario: buildStudentFactoryScenarioSummary(room),
    factoryStats: factoryMode ? buildFactoryStats(room, viewerId) : null,
    lastSavedAt: room.lastSavedAt,
    serverNow: Date.now(),
    nextTickAt: room.nextTickAt || null,
    turnStartedAt: room.turnStartedAt || null,
    turnDurationMs: turnDurationMsForRoom(room),
    tickMode: room.settings.tickMode || 'manual',
    tickSpeedPreset: tickSpeedPreset(room.settings.tickIntervalMs),
  };
}

function filterRoomSummaryForView(summary, viewerId, view = 'full') {
  if (view !== 'student') return summary;
  return {
    ...summary,
    summaryView: 'student',
    summaryContract: summary.summaryContract || 'student-legacy-filter',
    teacherAccountId: '',
    players: (summary.players || []).map(publicPlayerShell),
    leaderboard: (summary.leaderboard || []).map(publicPlayerShell),
    teacherControls: { canManage: false, actions: {} },
    classSnapshot: null,
    classReadiness: null,
    classDashboard: null,
    classDebrief: null,
    scenarioLab: null,
    scenarioExperiment: null,
    saveMeta: null,
  };
}

function roomSummary(room, viewerId, options = {}) {
  const view = options.view || 'full';
  const forecastSegments = roomForecast(room);
  if (view === 'student') return buildStudentRoomSummary(room, viewerId, forecastSegments);

  const players = [...room.players.values()]
    .filter(player => !player.isTeacherHost)
    .map(player => playerSummary(room, player, viewerId, forecastSegments));
  const leaderboard = [...players].sort((a, b) => (
    (b.simulationScore?.total || 0) - (a.simulationScore?.total || 0)
      || b.netWorth - a.netWorth
  ));
  const saveMeta = state.db.savedRooms[room.code]?.meta || null;
  const difficulty = difficultyConfigForRoom(room);
  const classSnapshot = buildClassSnapshot(room, players);
  const classReadiness = buildClassReadiness(room, players);
  const classDashboard = buildClassDashboard(room, players, classReadiness);
  const classDebrief = buildClassDebrief(room, players, classSnapshot);
  const helpRequests = (room.helpRequests || [])
    .filter(request => ['open', 'acknowledged'].includes(request.status))
    .map(request => publicHelpRequest(room, request))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const pauseRequest = publicPauseRequest(room, room.pauseRequest);
  const summary = {
    code: room.code,
    name: room.name,
    version: Math.max(1, Number(room.version) || 1),
    teacherAccountId: room.teacherAccountId || '',
    lobbyVisibility: normalizeLobbyVisibility(room.lobbyVisibility),
    status: room.status,
    day: room.day,
    tick: room.tick,
    settings: room.settings,
    difficulty: difficulty.key,
    difficultyLabel: difficulty.label,
    difficultyRules: publicDifficultyRules(difficulty),
    visibleUiMode: difficulty.uiMode,
    scenarioLabel: scenarioLabel(room.settings.scenarioKey),
    lessonPlan: buildScenarioLessonPlan(room),
    scenarioLab: buildScenarioLab(room),
    scenarioExperiment: room.teacherState?.lastExperiment || null,
    hostPlayerId: room.hostPlayerId,
    winnerPlayerId: room.winnerPlayerId || null,
    finishReason: room.finishReason || null,
    playerCount: players.filter(player => !player.bankrupt).length,
    readyCount: players.filter(player => player.ready && isClassPlayer(player)).length,
    humanCount: players.filter(isClassPlayer).length,
    allReady: players.filter(isClassPlayer).every(player => player.ready),
    players,
    leaderboard,
    teacherControls: publicTeacherControls(room, viewerId, classReadiness),
    classSnapshot,
    classReadiness,
    classDashboard,
    classDebrief,
    helpRequests,
    pauseRequest,
    market: room.marketHistory.slice(-12),
    segments: room.segmentSnapshots.slice(0, 6),
    log: room.log.slice(0, 18),
    productCatalog: productCatalogForRoom(room),
    cityCatalog: Object.keys(CITIES).map(key => ({ key, label: CITIES[key].label })),
    scenarioCatalog: scenarioCatalogForRoom(),
    difficultyCatalog: difficultyCatalog(),
    specializationCatalog: Object.keys(SPECIALIZATIONS).map(key => ({ key, label: SPECIALIZATIONS[key].label, description: SPECIALIZATIONS[key].description })),
    researchCatalog: Object.keys(RESEARCH_PROJECTS).map(key => ({ key, label: RESEARCH_PROJECTS[key].label, cost: RESEARCH_PROJECTS[key].cost, description: RESEARCH_PROJECTS[key].description })),
    boardPolicyCatalog: Object.keys(BOARD_POLICIES).map(key => ({ key, label: BOARD_POLICIES[key].label })),
    strategyCatalog: Object.keys(OPERATING_PLANS).map(key => ({ key, label: OPERATING_PLANS[key].label, description: OPERATING_PLANS[key].description })),
    forecastSegments,
    activeEvent: room.activeEvent,
    contractBoard: room.contractBoard || [],
    factoryScenario: room.factoryScenario ? {
      ...room.factoryScenario,
      candidates: [...(room.factoryScenario.candidates || [])],
      supplierOffers: [...(room.factoryScenario.supplierOffers || [])],
      marketBook: [...(room.factoryScenario.marketBook || [])],
    } : null,
    factoryStats: isFactoryScenario(room.settings.scenarioKey) ? buildFactoryStats(room, viewerId) : null,
    saveMeta,
    lastSavedAt: room.lastSavedAt,
    serverNow: Date.now(),
    nextTickAt: room.nextTickAt || null,
    turnStartedAt: room.turnStartedAt || null,
    turnDurationMs: turnDurationMsForRoom(room),
    tickMode: room.settings.tickMode || 'manual',
    tickSpeedPreset: tickSpeedPreset(room.settings.tickIntervalMs),
  };
  return filterRoomSummaryForView(summary, viewerId, view);
}

function publicRoomDirectory() {
  return [...state.rooms.values()]
    .filter(room => (
      room.lobbyVisibility === 'listed'
      && room.status === 'lobby'
      && [...room.players.values()].filter(isClassPlayer).length < room.settings.maxPlayers
    ))
    .slice(0, 50)
    .map(room => ({
      directoryId: ensureRoomDirectoryId(room),
      name: room.name,
      status: 'open',
      requiresCode: true,
      playerCount: [...room.players.values()].filter(isClassPlayer).length,
      maxPlayers: room.settings.maxPlayers,
      scenarioLabel: scenarioLabel(room.settings.scenarioKey),
    }));
}

function joinRoom({ roomCode: requestedCode, directoryId, companyName, userName, avatar, sessionToken = '' }) {
  const code = normalizeRoomCode(requestedCode);
  const room = state.rooms.get(code);
  const unavailable = () => Object.assign(new Error('Комната недоступна'), { status: 404 });
  if (!room) throw unavailable();
  if (directoryId && normalizeDirectoryId(directoryId) !== room.directoryId) throw unavailable();
  const existingPlayer = findHumanPlayerByUserName(room, userName);
  if (existingPlayer) {
    const requestedCompanyName = safeName(companyName, existingPlayer.name);
    if (requestedCompanyName !== existingPlayer.name) {
      throw Object.assign(new Error(`User ${existingPlayer.userName} is already in this room as ${existingPlayer.name}`), { status: 409 });
    }
    if (!sessionToken || sessionToken !== existingPlayer.sessionToken) {
      throw Object.assign(new Error('Для повторного входа нужна действующая сессия игрока'), { status: 403 });
    }
    existingPlayer.avatar = sanitizeAvatar(avatar) || existingPlayer.avatar;
    ensurePlayerSessionToken(existingPlayer);
    updateAccountPresence(existingPlayer.userName, existingPlayer.name, room.settings.scenarioKey);
    addRoomLog(room, `${existingPlayer.userName} reconnected to the room.`);
    touchRoom(room, existingPlayer);
    persistRuntimeState();
    return { room, player: existingPlayer };
  }
  if (room.status !== 'lobby') throw unavailable();
  const classroomPlayerCount = [...room.players.values()].filter(isClassPlayer).length;
  if (classroomPlayerCount >= room.settings.maxPlayers) throw Object.assign(new Error('Комната заполнена'), { status: 400 });
  const player = createPlayer(companyName, { userName, avatar });
  ensurePlayerSessionToken(player);
  if (isFactoryScenario(room.settings.scenarioKey)) applyScenarioToPlayer(player, room.settings.scenarioKey, room.settings.difficulty);
  player.seasonGoal = createSeasonGoal();
  updateAccountPresence(player.userName, player.name, room.settings.scenarioKey);
  room.players.set(player.id, player);
  state.playerRoomIndex.set(player.id, room.code);
  addRoomLog(room, `${player.userName} joined the room with company ${player.name}.`);
  touchRoom(room, player);
  persistRuntimeState();
  return { room, player };
}

function removePlayer(playerId) {
  const room = getRoomByPlayerId(playerId);
  const player = getPlayer(room, playerId);
  room.players.delete(playerId);
  state.playerRoomIndex.delete(playerId);
  addRoomLog(room, `${player.userName} left the room.`);

  if (room.hostPlayerId === playerId) {
    const nextPlayer = [...room.players.values()][0];
    room.hostPlayerId = nextPlayer ? nextPlayer.id : null;
    if (nextPlayer) addRoomLog(room, `${nextPlayer.userName} is now the host.`);
  }
  if (room.players.size === 0) state.rooms.delete(room.code);
  touchRoom(room);
  persistRuntimeState();
}

function componentCost(config, componentKey, quantity) {
  const component = config.components[componentKey];
  if (!component) throw Object.assign(new Error(`Unknown component: ${componentKey}`), { status: 400 });
  return component.unitCost * quantity;
}

function ensureFactoryCandidates(room) {
  if (!room.factoryScenario) return;
  while ((room.factoryScenario.candidates || []).length < 6) {
    room.factoryScenario.candidates.push(makeWorkerCandidate(room.settings.scenarioKey, room.factoryScenario.candidates.length));
  }
}

function factoryWorkerHint(suitability) {
  if (suitability >= 82) return 'ready for a high-output line';
  if (suitability >= 64) return 'solid fit';
  return 'backup capacity only';
}

function buyRaw(player, room, quantity) {
  const product = PRODUCTS[player.productKey];
  const city = CITIES[player.cityKey];
  const specialization = SPECIALIZATIONS[player.specializationKey] || SPECIALIZATIONS.balanced;
  const scenario = SCENARIOS[room.settings.scenarioKey] || SCENARIOS.standard;
  const research = researchEffects(player, RESEARCH_PROJECTS);
  const eventMultiplier = eventApplies(room.activeEvent, player.cityKey, player.productKey) ? room.activeEvent.rawCostMultiplier || 1 : 1;
  const discount = 1 - player.supplyLevel * 0.06 - specialization.rawDiscount - (research.rawSave || 0);
  return Math.round(quantity * product.rawCost * scenario.rawCost * eventMultiplier * clamp(discount, 0.55, 1.1) * city.priceSensitivity);
}

function startResearch(room, player, researchKey) {
  const key = String(researchKey || '');
  const project = RESEARCH_PROJECTS[key];
  if (!project) throw Object.assign(new Error('Неизвестное исследование'), { status: 400 });
  if (player.research.completed.includes(key)) throw Object.assign(new Error('Это исследование уже завершено'), { status: 400 });
  player.research.activeKey = key;
  player.research.progress = 0;
  player.lastAction = `Запущено исследование: ${project.label}`;
  addRoomLog(room, `${player.name} started research ${project.label}.`);
}

function handleBusinessAction(room, player, body) {
  ensureNotBankrupt(player);
  const action = body.action;
  if (action === 'force-decision-round') {
    if (!['running', 'paused'].includes(room.status)) {
      throw Object.assign(new Error('Стратегический раунд доступен только во время матча'), { status: 409 });
    }
    createForcedDecisionRound(room, player, body.value?.targetPlayerId);
    return;
  }
  if (room.status !== 'running') {
    throw Object.assign(new Error('Бизнес-действия доступны только во время активного матча'), { status: 409 });
  }
  if ((room.teacherState?.phaseLock || 'open') !== 'open') {
    throw Object.assign(new Error('Преподаватель зафиксировал фазу разбора. Дождитесь открытия следующего хода.'), { status: 400 });
  }
  const factoryConfig = isFactoryScenario(room.settings.scenarioKey) ? ensureFactoryPlayer(player, room) : null;

  if (factoryConfig) {
    switch (action) {
      case 'buy-component': {
        const componentKey = String(body.value?.componentKey || '');
        const component = factoryConfig.components[componentKey];
        if (!component) throw Object.assign(new Error('Unknown component.'), { status: 400 });
        const quantity = clamp(Number(body.value?.quantity) || component.lotSize || 1, 1, 24);
        const cost = factoryComponentCost(room, factoryConfig, componentKey, quantity);
        requireFunds(player, cost);
        player.money -= cost;
        player.factory.inventory[componentKey] = (player.factory.inventory[componentKey] || 0) + quantity;
        player.lastAction = `Bought ${quantity} ${component.label.toLowerCase()}.`;
        addRoomLog(room, `${player.name} bought ${quantity} ${component.label.toLowerCase()} for ${cost}.`);
        return;
      }
      case 'buy-supplier-offer': {
        buySupplierOffer(
          room,
          player,
          String(body.value?.offerId || body.value || ''),
          body.value?.quantity
        );
        return;
      }
      case 'hire-worker': {
        const candidateId = String(body.value || '');
        const candidateIndex = room.factoryScenario?.candidates?.findIndex(candidate => candidate.id === candidateId) ?? -1;
        if (candidateIndex < 0) throw Object.assign(new Error('Candidate not found.'), { status: 404 });
        const [candidate] = room.factoryScenario.candidates.splice(candidateIndex, 1);
        const signOnCost = Math.round(candidate.expectedSalary * 1.5);
        requireFunds(player, signOnCost);
        player.money -= signOnCost;
        player.factory.workers.push(candidate);
        player.staff = player.factory.workers.length;
        player.lastAction = `Hired ${candidate.name} (${candidate.role}).`;
        addRoomLog(room, `${player.name} hired ${candidate.name} as ${candidate.role}.`);
        ensureFactoryCandidates(room);
        return;
      }
      case 'assemble-product': {
        const capacity = availableAssemblyCount(player.factory, factoryConfig);
        if (!capacity) throw Object.assign(new Error('Not enough workers or components to assemble.'), { status: 400 });
        const requested = body.value === 'max' ? capacity : clamp(Number(body.value) || 1, 1, capacity);
        Object.entries(factoryConfig.components).forEach(([componentKey, component]) => {
          player.factory.inventory[componentKey] -= component.recipe * requested;
        });
        player.factory.finishedGoods += requested;
        player.factory.assembledThisTurn += requested;
        player.productStock = player.factory.finishedGoods;
        player.lastAction = `Assembled ${requested} ${factoryConfig.productUnit}.`;
        addRoomLog(room, `${player.name} assembled ${requested} ${factoryConfig.productUnit}.`);
        return;
      }
      case 'set-sale-offer': {
        const price = clamp(Number(body.value?.price) || factoryConfig.basePrice, factoryConfig.priceRange.min, factoryConfig.priceRange.max);
        const quantity = clamp(Number(body.value?.quantity) || 0, 0, player.factory.finishedGoods);
        player.factory.saleOffer = { price, quantity };
        player.price = price;
        player.lastAction = quantity
          ? `Placed sell order: ${quantity} @ ${price}.`
          : 'Cleared sell order and held inventory.';
        addRoomLog(room, quantity
          ? `${player.name} listed ${quantity} ${factoryConfig.productUnit} at ${price}.`
          : `${player.name} cleared the sell order and held inventory.`);
        return;
      }
      case 'set-focus-segment': {
        const productKey = String(body.value?.productKey || player.focusProductKey || player.productKey);
        if (productKey !== factoryConfig.productKey) throw Object.assign(new Error('Этот производственный сценарий работает с одним товаром.'), { status: 400 });
        player.focusProductKey = productKey;
        player.focusCityKey = '';
        player.lastAction = `Фокус производства: ${productLabel(productKey)}`;
        addRoomLog(room, `${player.name} обновил производственный фокус: ${productLabel(productKey)}.`);
        return;
      }
      case 'resolve-decision-round': {
        if (room.status !== 'running') throw Object.assign(new Error('Strategic rounds can be resolved only during the match.'), { status: 400 });
        const roundId = String(body.value?.roundId || '');
        const optionKey = String(body.value?.optionKey || '');
        if (!roundId || !optionKey) throw Object.assign(new Error('roundId and optionKey are required.'), { status: 400 });
        if (!player.decisionRound || player.decisionRound.id !== roundId) {
          throw Object.assign(new Error('Strategic round does not belong to this player.'), { status: 400 });
        }
        applyDecisionRoundOption(room, player, optionKey, { resolution: 'manual' });
        return;
      }
      default:
        throw Object.assign(new Error('Action is not available in the selected factory scenario.'), { status: 400 });
    }
  }

  switch (action) {
    case 'set-price': {
      player.price = Math.round(clamp(Number(body.value) || 0, 60, 260));
      player.lastAction = `Цена установлена на ${player.price}`;
      addRoomLog(room, `${player.name} установил цену ${player.price}.`);
      return;
    }
    case 'set-product': {
      const value = String(body.value || 'food');
      if (!PRODUCTS[value]) throw Object.assign(new Error('Неизвестная категория товара'), { status: 400 });
      player.productKey = value;
      player.lastAction = `Фокус продукта: ${productLabel(value)}`;
      addRoomLog(room, `${player.name} переключился на товар ${productLabel(value)}.`);
      return;
    }
    case 'set-city': {
      const value = String(body.value || 'regional');
      if (!CITIES[value]) throw Object.assign(new Error('Неизвестный рынок'), { status: 400 });
      player.cityKey = value;
      player.lastAction = `Основной рынок: ${cityLabel(value)}`;
      addRoomLog(room, `${player.name} вышел на рынок ${cityLabel(value)}.`);
      return;
    }
    case 'set-focus-segment': {
      const cityKey = String(body.value?.cityKey || player.focusCityKey || player.cityKey);
      const productKey = String(body.value?.productKey || player.focusProductKey || player.productKey);
      if (!CITIES[cityKey]) throw Object.assign(new Error('Неизвестный целевой рынок'), { status: 400 });
      if (!PRODUCTS[productKey] && !factoryScenarioConfig(productKey)) throw Object.assign(new Error('Неизвестный целевой товар'), { status: 400 });
      player.focusCityKey = cityKey;
      player.focusProductKey = productKey;
      player.lastAction = `Фокус-план: ${cityLabel(cityKey)} • ${productLabel(productKey)}`;
      addRoomLog(room, `${player.name} обновил целевой сегмент на ${cityLabel(cityKey)} • ${productLabel(productKey)}.`);
      return;
    }
    case 'set-specialization': {
      const value = String(body.value || 'balanced');
      if (!SPECIALIZATIONS[value]) throw Object.assign(new Error('Неизвестная специализация'), { status: 400 });
      player.specializationKey = value;
      player.lastAction = `Специализация: ${specializationLabel(value)}`;
      addRoomLog(room, `${player.name} выбрал специализацию ${specializationLabel(value)}.`);
      return;
    }
    case 'set-board-policy': {
      const value = String(body.value || 'balanced');
      if (!BOARD_POLICIES[value]) throw Object.assign(new Error('Неизвестная политика совета'), { status: 400 });
      player.boardPolicyKey = value;
      player.lastAction = `Политика совета: ${boardPolicyLabel(value)}`;
      addRoomLog(room, `${player.name} переключил политику совета на ${boardPolicyLabel(value)}.`);
      return;
    }
    case 'set-strategy': {
      const value = String(body.value || 'balanced');
      if (!OPERATING_PLANS[value]) throw Object.assign(new Error('Неизвестный операционный план'), { status: 400 });
      player.strategyKey = value;
      player.lastAction = `Операционный план: ${strategyLabel(value)}`;
      addRoomLog(room, `${player.name} включил операционный план ${strategyLabel(value)}.`);
      return;
    }
    case 'start-research': {
      startResearch(room, player, body.value);
      return;
    }
    case 'accept-contract': {
      acceptContract(room, player, body.value);
      return;
    }
    case 'buy-raw': {
      const quantity = clamp(Number(body.value) || 20, 10, 80);
      const cost = buyRaw(player, room, quantity);
      requireFunds(player, cost);
      player.money -= cost;
      player.rawStock += quantity;
      player.lastAction = `Закуплено сырья: ${quantity}`;
      addRoomLog(room, `${player.name} закупил сырьё: ${quantity}.`);
      return;
    }
    case 'upgrade-supply': {
      const cost = 14000 + player.supplyLevel * 10000;
      requireFunds(player, cost);
      player.money -= cost;
      player.supplyLevel = clamp(player.supplyLevel + 1, 1, 5);
      player.lastAction = 'Улучшена цепочка поставок';
      addRoomLog(room, `${player.name} улучшил цепочку поставок.`);
      return;
    }
    case 'raise-salary': {
      player.salary = clamp(player.salary + 10, 80, 260);
      player.lastAction = `Зарплата повышена до ${player.salary}`;
      addRoomLog(room, `${player.name} повысил зарплату до ${player.salary}.`);
      return;
    }
    case 'cut-salary': {
      player.salary = clamp(player.salary - 10, 80, 260);
      player.lastAction = `Зарплата снижена до ${player.salary}`;
      addRoomLog(room, `${player.name} снизил зарплату до ${player.salary}.`);
      return;
    }
    case 'hire': {
      const amount = clamp(Number(body.value) || 1, 1, 25);
      const cost = amount * 1400;
      requireFunds(player, cost);
      player.money -= cost;
      player.staff += amount;
      player.lastAction = `Нанято ${amount} сотрудников`;
      addRoomLog(room, `${player.name} нанял ${amount} сотрудников.`);
      return;
    }
    case 'fire': {
      const amount = clamp(Number(body.value) || 1, 1, player.staff);
      player.staff = Math.max(1, player.staff - amount);
      player.lastAction = `Сокращено ${amount} сотрудников`;
      addRoomLog(room, `${player.name} сократил ${amount} сотрудников.`);
      return;
    }
    case 'build-factory': {
      const cost = 42000 + player.factories * 7000;
      requireFunds(player, cost);
      player.money -= cost;
      player.factories += 1;
      player.lastAction = 'Построена фабрика';
      addRoomLog(room, `${player.name} построил фабрику.`);
      return;
    }
    case 'build-store': {
      const cost = 28000 + player.stores * 6000;
      requireFunds(player, cost);
      player.money -= cost;
      player.stores += 1;
      player.lastAction = 'Открыт магазин';
      addRoomLog(room, `${player.name} открыл магазин.`);
      return;
    }
    case 'upgrade-quality': {
      const cost = 18000 + player.quality * 12000;
      requireFunds(player, cost);
      player.money -= cost;
      player.quality = clamp(player.quality + 1, 1, 6);
      player.lastAction = 'Повышено качество продукции';
  addRoomLog(room, `${player.name} improved product quality.`);
      return;
    }
    case 'automation': {
      const cost = 26000 + player.automation * 14000;
      requireFunds(player, cost);
      player.money -= cost;
      player.automation = clamp(player.automation + 1, 0, 5);
      player.lastAction = 'Внедрена автоматизация';
  addRoomLog(room, `${player.name} introduced automation.`);
      return;
    }
    case 'marketing': {
      const cost = 12000 + player.marketing * 5000;
      requireFunds(player, cost);
      player.money -= cost;
      player.marketing = clamp(player.marketing + 1, 1, 7);
      player.lastAction = 'Запущена маркетинговая кампания';
  addRoomLog(room, `${player.name} boosted marketing.`);
      return;
    }
    case 'take-loan': {
      const amount = clamp(Number(body.value) || 20000, 10000, 120000);
      player.money += amount;
      player.debt += Math.round(amount * 1.08);
      player.lastAction = `Получен кредит ${amount}`;
      addRoomLog(room, `${player.name} взял кредит на ${amount}.`);
      return;
    }
    case 'repay-loan': {
      const amount = clamp(Number(body.value) || 10000, 5000, player.debt);
      requireFunds(player, amount);
      player.money -= amount;
      player.debt = Math.max(0, player.debt - amount);
      player.lastAction = `Погашен кредит на ${amount}`;
      addRoomLog(room, `${player.name} погасил кредит на ${amount}.`);
      return;
    }
    default:
      throw Object.assign(new Error('Неизвестное действие'), { status: 400 });
  }
}

function addBot(room) {
  const baseNames = ['Nordex', 'DeltaCore', 'UrbanFox', 'CapitalMint', 'NovaMart', 'SteelBird'];
  const company = `${baseNames[Math.floor(Math.random() * baseNames.length)]}-${Math.floor(Math.random() * 90 + 10)}`;
  const bot = createPlayer(company, { userName: 'AI Manager', isBot: true });
  if (isFactoryScenario(room.settings.scenarioKey)) {
    applyScenarioToPlayer(bot, room.settings.scenarioKey, room.settings.difficulty);
  } else {
    bot.productKey = ['food', 'electronics', 'furniture', 'pharma'][Math.floor(Math.random() * 4)];
    bot.cityKey = ['capital', 'regional', 'industrial', 'coastal'][Math.floor(Math.random() * 4)];
    bot.specializationKey = ['balanced', 'cost', 'premium', 'logistics'][Math.floor(Math.random() * 4)];
    bot.strategyKey = ['balanced', 'growth', 'efficiency', 'contracts', 'innovation'][Math.floor(Math.random() * 5)];
  }
  room.players.set(bot.id, bot);
  state.playerRoomIndex.set(bot.id, room.code);
  addRoomLog(room, `${bot.name} joined as an AI competitor.`);
}

function resetRoom(room) {
  const existing = [...room.players.values()];
  room.day = 1;
  room.tick = 0;
  room.status = 'lobby';
  room.winnerPlayerId = null;
  room.finishReason = null;
  room.marketHistory = [];
  room.segmentSnapshots = [];
  room.teacherState = defaultTeacherState();
  room.activeEvent = null;
  room.contractBoard = [];
  room.log = ['Match reset. Update your strategy and start again.'];
  room.nextTickAt = null;
  room.pausedRemainingMs = null;
  room.pauseRequest = null;
  room.factoryScenario = isFactoryScenario(room.settings.scenarioKey) ? buildRoomFactoryState(room.settings.scenarioKey) : null;
  restockFactorySuppliers(room, { force: true });
  room.players = new Map();

  existing.forEach(existingPlayer => {
    const fresh = createPlayer(existingPlayer.name, {
      userName: existingPlayer.userName,
      avatar: existingPlayer.avatar,
      isBot: existingPlayer.isBot,
      isTeacherHost: existingPlayer.isTeacherHost,
    });
    fresh.id = existingPlayer.id;
    fresh.ready = existingPlayer.isBot || existingPlayer.isTeacherHost;
    if (isFactoryScenario(room.settings.scenarioKey) && !fresh.isTeacherHost) {
      applyScenarioToPlayer(fresh, room.settings.scenarioKey, room.settings.difficulty);
    } else {
      fresh.specializationKey = existingPlayer.specializationKey || 'balanced';
      fresh.boardPolicyKey = existingPlayer.boardPolicyKey || 'balanced';
    }
    fresh.seasonGoal = createSeasonGoal(existingPlayer.seasonGoal?.key);
    room.players.set(fresh.id, fresh);
    state.playerRoomIndex.set(fresh.id, room.code);
  });

  if (!room.players.has(room.hostPlayerId)) room.hostPlayerId = [...room.players.keys()][0] || null;
}

function updateRoomSettings(room, body) {
  const maxPlayers = clamp(Number(body.maxPlayers) || room.settings.maxPlayers, MIN_CLASSROOM_PLAYERS, MAX_CLASSROOM_PLAYERS);
  const demandProfile = ['standard', 'aggressive', 'lean'].includes(body.demandProfile) ? body.demandProfile : room.settings.demandProfile;
  const previousScenarioKey = room.settings.scenarioKey;
  const previousDifficulty = normalizeDifficulty(room.settings.difficulty, 'normal');
  const scenarioKey = SCENARIOS[body.scenarioKey] ? body.scenarioKey : room.settings.scenarioKey;
  const difficulty = normalizeDifficulty(body.difficulty, previousDifficulty);
  const dayLimit = normalizeDayLimit(body.dayLimit, room.settings.dayLimit);
  const tickIntervalMs = normalizeTickIntervalMs(body.tickIntervalMs, room.settings.tickIntervalMs);
  const turnDurationMs = normalizeManualTurnDurationMs(body.turnDurationMs, room.settings.turnDurationMs || MANUAL_TURN_MS);
  room.settings.maxPlayers = maxPlayers;
  room.settings.demandProfile = demandProfile;
  room.settings.scenarioKey = scenarioKey;
  room.settings.difficulty = difficulty;
  room.settings.dayLimit = dayLimit;
  room.settings.tickIntervalMs = tickIntervalMs;
  room.settings.turnDurationMs = turnDurationMs;
  room.lobbyVisibility = normalizeLobbyVisibility(body.lobbyVisibility || room.lobbyVisibility);
  if (previousScenarioKey !== scenarioKey || (isFactoryScenario(scenarioKey) && previousDifficulty !== difficulty)) configureRoomScenario(room);
}

function roomStartGate(room) {
  const humans = [...room.players.values()].filter(isClassPlayer);
  const practiceMode = normalizePracticeMode(room.settings?.practiceMode);
  const teacherOnlyHost = Boolean(
    room.teacherAccountId
      || room.players.get(room.hostPlayerId)?.isTeacherHost
  );
  const minimumClassPlayers = practiceMode || teacherOnlyHost ? 1 : 2;
  const readyCount = humans.filter(player => player.ready).length;
  const hasMinimumPlayers = humans.length >= minimumClassPlayers;
  const allReady = humans.length > 0 && readyCount === humans.length;
  return {
    canStart: hasMinimumPlayers && allReady,
    practiceMode,
    teacherOnlyHost,
    minimumClassPlayers,
    classPlayerCount: humans.length,
    readyCount,
    allReady,
    hasMinimumPlayers,
  };
}

function canStartMatch(room) {
  return roomStartGate(room).canStart;
}

function finalizeAccounts(room, winner) {
  room.players.forEach(player => {
    if (!isClassPlayer(player)) return;
    const account = updateAccountPresence(player.userName, player.name, room.settings.scenarioKey);
    account.gamesPlayed += 1;
    if (winner && winner.id === player.id) {
      account.wins += 1;
      completeAchievement(account, 'first_win');
    }
    account.totalRevenue += Math.max(0, player.incomeLastTick || 0);
    account.bestNetWorth = Math.max(account.bestNetWorth || 0, Math.round(player.money + playerAssets(player) - player.debt));
    account.completedContracts = (account.completedContracts || 0) + (player.completedContracts || 0);
    if (player.seasonGoal?.completed) account.goalsCompleted = (account.goalsCompleted || 0) + 1;
    if ((player.research.completed || []).length) completeAchievement(account, 'research_director');
    if ((player.completedContracts || 0) >= 2) completeAchievement(account, 'contract_hunter');
    if (player.seasonGoal?.completed) completeAchievement(account, 'goal_closer');
    if (Math.round(player.money + playerAssets(player) - player.debt) >= 300000) completeAchievement(account, 'industry_titan');
    (player.research.completed || []).forEach(key => {
      account.completedResearch[key] = true;
    });
  });
  persistDb();
}

function completedSessionStanding(player) {
  return {
    playerId: player.id,
    userName: player.userName || player.name,
    companyName: player.name,
    simulationScore: Math.round(Number(player.simulationScore?.total || 0)),
    netWorth: Math.round(Number(player.netWorth || (player.money + playerAssets(player) - player.debt) || 0)),
    money: Math.round(Number(player.money || 0)),
    debt: Math.round(Number(player.debt || 0)),
    bankrupt: Boolean(player.bankrupt),
    completedContracts: Math.round(Number(player.completedContracts || 0)),
  };
}

function archiveCompletedSession(room) {
  state.db.completedSessions = state.db.completedSessions || {};
  if (room.completedSessionId && state.db.completedSessions[room.completedSessionId]) {
    return state.db.completedSessions[room.completedSessionId];
  }
  const finishedAt = room.finishedAt || new Date().toISOString();
  const sessionId = `session_${room.code.toLowerCase()}_${Date.parse(finishedAt).toString(36)}`;
  const standings = [...room.players.values()]
    .filter(isClassPlayer)
    .map(completedSessionStanding)
    .sort((left, right) => right.simulationScore - left.simulationScore || right.netWorth - left.netWorth)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const record = {
    id: sessionId,
    teacherAccountId: room.teacherAccountId || '',
    roomCode: room.code,
    roomName: room.name,
    scenarioKey: room.settings?.scenarioKey || '',
    scenarioLabel: scenarioLabel(room.settings?.scenarioKey),
    difficulty: room.settings?.difficulty || 'normal',
    startedAt: room.startedAt || null,
    finishedAt,
    finishReason: room.finishReason || 'completed',
    day: Math.max(1, Number(room.day) || 1),
    tick: Math.max(0, Number(room.tick) || 0),
    winnerPlayerId: room.winnerPlayerId || null,
    standings,
    turnReplay: (room.adminSnapshots || []).map(snapshot => ({
      day: snapshot.day,
      tick: snapshot.tick,
      generatedAt: snapshot.generatedAt,
      classStats: snapshot.classStats ? {
        totalMoney: snapshot.classStats.totalMoney,
        totalCapital: snapshot.classStats.totalCapital,
        totalDebt: snapshot.classStats.totalDebt,
        totalFinishedGoods: snapshot.classStats.totalFinishedGoods,
        totalSoldLastTurn: snapshot.classStats.totalSoldLastTurn,
        readyCount: snapshot.classStats.readyCount,
      } : {},
    })),
    marketTimeline: (room.marketHistory || []).map(entry => ({
      day: entry.day,
      tick: entry.tick,
      demand: entry.demand,
      totalSales: entry.totalSales,
      avgPrice: entry.avgPrice,
    })),
    events: (room.log || []).filter(entry => /событ|кризис|event|спрос|постав|зарплат/i.test(entry)).slice(0, 40),
  };
  state.db.completedSessions[sessionId] = record;
  room.completedSessionId = sessionId;
  room.finishedAt = finishedAt;

  const ownerKey = room.teacherAccountId || '__local__';
  Object.values(state.db.completedSessions)
    .filter(session => (session.teacherAccountId || '__local__') === ownerKey)
    .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))
    .slice(100)
    .forEach(session => { delete state.db.completedSessions[session.id]; });
  return record;
}

function listCompletedSessions({ teacherAccountId = null } = {}) {
  return Object.values(state.db.completedSessions || {})
    .filter(session => teacherAccountId === null || session.teacherAccountId === teacherAccountId)
    .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
}

function getCompletedSession(sessionId, { teacherAccountId = null } = {}) {
  const session = state.db.completedSessions?.[sessionId] || null;
  if (!session || (teacherAccountId !== null && session.teacherAccountId !== teacherAccountId)) {
    throw Object.assign(new Error('Завершенное занятие не найдено.'), { status: 404 });
  }
  return session;
}

function completedSessionCsv(session) {
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [['Место', 'Ученик', 'Компания', 'Баллы', 'Капитал', 'Деньги', 'Долг', 'Банкротство']];
  session.standings.forEach(entry => rows.push([
    entry.rank, entry.userName, entry.companyName, entry.simulationScore,
    entry.netWorth, entry.money, entry.debt, entry.bankrupt ? 'да' : 'нет',
  ]));
  return `\uFEFF${rows.map(row => row.map(quote).join(';')).join('\r\n')}`;
}

function finishRoom(room, winner, reason = 'completed') {
  room.status = 'finished';
  room.nextTickAt = null;
  room.turnStartedAt = null;
  room.pausedRemainingMs = null;
  room.winnerPlayerId = winner?.id || null;
  room.finishReason = reason;
  room.finishedAt = new Date().toISOString();
  finalizeAccounts(room, winner || null);
  const reasonText = reason === 'turn_limit'
    ? 'достигнут лимит ходов'
    : reason === 'last_company_standing'
      ? 'осталась одна активная компания'
      : reason === 'no_active_players'
        ? 'активных компаний не осталось'
        : 'матч завершён';
  addRoomLog(room, winner ? `${winner.userName} выиграл матч: ${reasonText}.` : `Матч завершён без победителя: ${reasonText}.`);
  archiveCompletedSession(room);
  persistDb();
}

function roomWinner(room) {
  return [...room.players.values()]
    .filter(player => !player.bankrupt)
    .sort((left, right) => (
      (right.simulationScore?.total || 0) - (left.simulationScore?.total || 0)
        || (right.netWorth || right.money || 0) - (left.netWorth || left.money || 0)
    ))[0] || null;
}

function closeRoom(room, { finishActive = false, reason = 'closed_by_teacher' } = {}) {
  if (!room || !state.rooms.has(room.code)) {
    throw Object.assign(new Error('Комната не найдена'), { status: 404 });
  }
  if (['running', 'paused'].includes(room.status)) {
    if (!finishActive) {
      throw Object.assign(new Error('Сначала завершите активный матч или выберите «Завершить и закрыть».'), { status: 409 });
    }
    finishRoom(room, roomWinner(room), 'teacher_stopped');
  }
  if (!['lobby', 'finished'].includes(room.status)) {
    throw Object.assign(new Error('Эту комнату сейчас нельзя закрыть.'), { status: 409 });
  }
  const result = {
    roomCode: room.code,
    teacherAccountId: room.teacherAccountId || '',
    completedSessionId: room.completedSessionId || '',
    action: finishActive ? 'finish-and-close-room' : 'close-room',
    status: 'closed',
    reason,
  };
  room.players.forEach(player => state.playerRoomIndex.delete(player.id));
  state.rooms.delete(room.code);
  delete state.db.activeRooms[room.code];
  delete state.db.savedRooms[room.code];
  persistRuntimeState({ immediate: true });
  return result;
}

function serializeRoom(room) {
  return JSON.parse(JSON.stringify({
    schemaVersion: ROOM_SNAPSHOT_SCHEMA_VERSION,
    code: room.code,
    name: room.name,
    hostPlayerId: room.hostPlayerId,
    teacherAccountId: room.teacherAccountId || '',
    directoryId: ensureRoomDirectoryId(room),
    lobbyVisibility: normalizeLobbyVisibility(room.lobbyVisibility),
    version: Math.max(1, Number(room.version) || 1),
    createdAt: Number(room.createdAt) || Date.now(),
    lastActivityAt: Number(room.lastActivityAt) || Date.now(),
    status: room.status,
    day: room.day,
    tick: room.tick,
    winnerPlayerId: room.winnerPlayerId || null,
    finishReason: room.finishReason || null,
    startedAt: room.startedAt || null,
    finishedAt: room.finishedAt || null,
    completedSessionId: room.completedSessionId || '',
    log: room.log,
    adminSnapshots: room.adminSnapshots || [],
    helpRequests: room.helpRequests || [],
    pauseRequest: room.pauseRequest || null,
    marketHistory: room.marketHistory,
    segmentSnapshots: room.segmentSnapshots,
    settings: room.settings,
    teacherState: ensureTeacherState(room.teacherState),
    activeEvent: room.activeEvent,
    contractBoard: room.contractBoard,
    factoryScenario: room.factoryScenario,
    lastSavedAt: room.lastSavedAt,
    turnStartedAt: room.turnStartedAt || null,
    pausedRemainingMs: room.pausedRemainingMs ?? null,
    players: [...room.players.values()],
  }));
}

function hydrateRoom(snapshot) {
  const normalizedSnapshot = migrateRoomSnapshot(snapshot);
  const settings = ensureSnapshotSettings(normalizedSnapshot.settings);
  const hydratedRoom = {
    ...normalizedSnapshot,
    settings,
    teacherState: ensureTeacherState(normalizedSnapshot.teacherState),
    helpRequests: Array.isArray(normalizedSnapshot.helpRequests) ? normalizedSnapshot.helpRequests : [],
    pauseRequest: isPlainObject(normalizedSnapshot.pauseRequest) ? normalizedSnapshot.pauseRequest : null,
    nextTickAt: normalizedSnapshot.status === 'running'
      ? Date.now() + (settings.tickMode === 'manual' ? (settings.turnDurationMs || MANUAL_TURN_MS) : normalizeTickIntervalMs(settings.tickIntervalMs))
      : null,
    turnStartedAt: normalizedSnapshot.status === 'running' ? Date.now() : null,
    pausedRemainingMs: normalizedSnapshot.status === 'paused' ? (normalizedSnapshot.pausedRemainingMs ?? null) : null,
    factoryScenario: normalizedSnapshot.factoryScenario || null,
    players: new Map((normalizedSnapshot.players || []).map(player => [player.id, {
      ...createPlayer(player.name, {
        userName: player.userName,
        avatar: player.avatar,
        isBot: player.isBot,
        isTeacherHost: player.isTeacherHost,
      }),
      ...player,
      research: {
        activeKey: player.research?.activeKey || '',
        progress: player.research?.progress || 0,
        completed: [...(player.research?.completed || [])],
      },
    }])),
  };
  if (hydratedRoom.factoryScenario) restockFactorySuppliers(hydratedRoom);
  hydratedRoom.players.forEach(player => ensurePlayerSessionToken(player));
  return hydratedRoom;
}

function saveRoomSnapshot(room, actor) {
  const savedAt = new Date().toISOString();
  room.lastSavedAt = savedAt;
  const previousEntry = state.db.savedRooms[room.code];
  const snapshot = serializeRoom(room);
  state.db.savedRooms[room.code] = {
    meta: {
      schemaVersion: ROOM_SNAPSHOT_SCHEMA_VERSION,
      roomCode: room.code,
      roomName: room.name,
      savedAt,
      day: room.day,
      tick: room.tick,
      scenarioKey: room.settings.scenarioKey,
      scenarioLabel: scenarioLabel(room.settings.scenarioKey),
      hostUserName: actor.userName,
    },
    snapshot,
    previousSnapshot: previousEntry?.snapshot || null,
  };
  persistRuntimeState({ immediate: true });
}

function loadRoomSnapshot(room) {
  const entry = state.db.savedRooms[room.code];
  if (!entry) throw Object.assign(new Error('Для этой комнаты нет сохранения'), { status: 404 });
  let snapshot = null;
  try {
    snapshot = migrateRoomSnapshot(entry.snapshot);
  } catch (primaryError) {
    if (isSchemaMigrationError(primaryError)) throw primaryError;
    if (!entry.previousSnapshot) throw primaryError;
    snapshot = migrateRoomSnapshot(entry.previousSnapshot);
  }
  const hydrated = hydrateRoom(snapshot);
  state.rooms.set(room.code, hydrated);
  hydrated.players.forEach(player => {
    state.playerRoomIndex.set(player.id, hydrated.code);
  });
  touchRoom(hydrated);
  persistRuntimeState({ immediate: true });
  return hydrated;
}

restoreActiveRoomsFromDb();

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateActiveEvent(room, forcedKey = '') {
  const availableKeys = Object.keys(EVENT_TEMPLATES);
  const eventKey = availableKeys.includes(forcedKey) ? forcedKey : randomItem(availableKeys);
  const template = EVENT_TEMPLATES[eventKey];
  const cityKey = eventKey === 'city_festival' || eventKey === 'port_strike' ? randomItem(Object.keys(CITIES)) : null;
  const productKey = eventKey === 'premium_wave' ? randomItem(Object.keys(PRODUCTS)) : null;
  const cityLabel = cityKey ? cityLabelForKey(cityKey) : '';
  const productLabel = productKey ? productLabelForKey(productKey) : '';
  const title = cityKey ? `${template.label}: ${cityLabel}` : productKey ? `${template.label}: ${productLabel}` : template.label;
  return {
    id: uid('event'),
    key: eventKey,
    label: template.label,
    title,
    description: template.description,
    cityKey,
    productKey,
    demandMultiplier: template.demandMultiplier || 1,
    rawCostMultiplier: template.rawCostMultiplier || 1,
    researchMultiplier: template.researchMultiplier || 1,
    expiresDay: room.day + template.duration,
  };
}

function generateFactoryEvent(room, forcedKey = '') {
  const availableKeys = Object.keys(FACTORY_EVENT_TEMPLATES);
  const eventKey = FACTORY_EVENT_TEMPLATES[forcedKey] ? forcedKey : randomItem(availableKeys);
  const template = FACTORY_EVENT_TEMPLATES[eventKey];
  const config = factoryScenarioConfig(room.settings.scenarioKey);
  const productLabel = config?.productLabel || room.factoryScenario?.productLabel || 'Factory market';
  return {
    id: uid('event'),
    key: eventKey,
    label: template.label,
    title: `${template.label}: ${productLabel}`,
    description: template.description,
    cityKey: 'factory',
    productKey: config?.productKey || room.settings.scenarioKey,
    demandMultiplier: template.demandMultiplier || 1,
    rawCostMultiplier: template.rawCostMultiplier || 1,
    payrollMultiplier: template.payrollMultiplier || 1,
    upkeepMultiplier: template.upkeepMultiplier || 1,
    qualityMultiplier: template.qualityMultiplier || 1,
    pricePressureMultiplier: template.pricePressureMultiplier || 1,
    researchMultiplier: template.researchMultiplier || 1,
    scope: 'factory',
    expiresDay: room.day + template.duration - 1,
  };
}

function roomEventCatalog(room) {
  const source = isFactoryScenario(room.settings.scenarioKey) ? FACTORY_EVENT_TEMPLATES : EVENT_TEMPLATES;
  return Object.entries(source).map(([key, config]) => ({
    key,
    label: config.label,
    description: config.description,
  }));
}

function teacherLifecycleContract(room, isHost, startGate, classReadiness = null) {
  const phaseLock = normalizeTeacherPhaseLock(room.teacherState?.phaseLock);
  const phase = ['lobby', 'running', 'paused', 'finished'].includes(room.status)
    ? room.status
    : 'unknown';
  const canStart = isHost && phase === 'lobby' && startGate.canStart;
  const canPause = isHost && phase === 'running';
  const canResume = isHost && phase === 'paused' && room.pauseRequest?.status !== 'pending';
  const canAdvance = isHost && phase === 'running' && (
    (room.settings?.tickMode || 'manual') !== 'manual'
      || phaseLock === 'open'
  );
  const canFinish = isHost && ['running', 'paused'].includes(phase);
  const readinessKnown = Number(classReadiness?.total || 0) > 0;
  const classReadyForTurn = readinessKnown && Boolean(
    classReadiness?.canAdvanceTurn
      ?? classReadiness?.briefing?.canAdvanceTurn
  );
  let primaryAction = '';
  if (canStart) primaryAction = 'start-game';
  else if (canResume) primaryAction = 'resume-game';
  else if (canAdvance && classReadyForTurn) primaryAction = 'next-turn';
  else if (canPause) primaryAction = 'pause-game';
  else if (canAdvance) primaryAction = 'next-turn';

  const nextExpectedPhase = {
    'start-game': 'running',
    'pause-game': 'paused',
    'resume-game': 'running',
    'next-turn': 'running',
  }[primaryAction] || (phase === 'finished' ? 'debrief' : phase);

  return {
    contract: 'teacher-lifecycle-v1',
    phase,
    phaseLock,
    primaryAction,
    nextExpectedPhase,
    canStart,
    canPause,
    canResume,
    canAdvance,
    canFinish,
    canOpenDebrief: phase === 'finished',
    finishReason: room.finishReason || null,
    day: Math.max(1, Number(room.day) || 1),
    dayLimit: Math.max(1, Number(room.settings?.dayLimit) || MAX_TURN_COUNT),
    readiness: classReadiness ? {
      ready: Math.max(0, Number(classReadiness.ready || 0)),
      total: Math.max(0, Number(classReadiness.total || 0)),
      blocked: Math.max(0, Number(classReadiness.blocked || 0)),
      canAdvanceTurn: Boolean(
        classReadiness.canAdvanceTurn
          ?? classReadiness.briefing?.canAdvanceTurn
      ),
    } : null,
  };
}

function publicTeacherControls(room, viewerId, classReadiness = null) {
  const isHost = room.hostPlayerId === viewerId;
  const phaseLock = normalizeTeacherPhaseLock(room.teacherState?.phaseLock);
  const startGate = roomStartGate(room);
  const lifecycle = teacherLifecycleContract(room, isHost, startGate, classReadiness);
  return {
    canManage: isHost,
    phaseLock,
    startGate,
    lifecycle,
    phaseOptions: Object.entries(TEACHER_PHASE_LOCKS).map(([key, config]) => ({
      key,
      label: config.label,
      description: config.description,
    })),
    eventCatalog: roomEventCatalog(room),
    actions: {
      startGame: lifecycle.canStart,
      nextTurn: lifecycle.canAdvance,
      pause: lifecycle.canPause,
      resume: lifecycle.canResume,
      acceptPauseRequest: isHost && room.status === 'paused' && room.pauseRequest?.status === 'pending',
      finish: lifecycle.canFinish,
      closeRoom: isHost && ['lobby', 'finished'].includes(room.status),
      finishAndCloseRoom: isHost && ['running', 'paused'].includes(room.status),
      forceEvent: isHost && ['running', 'paused'].includes(room.status),
      forceDecisionRound: isHost && ['running', 'paused'].includes(room.status),
      setPhaseLock: isHost && (room.settings.tickMode || 'manual') === 'manual',
      runExperiment: isHost && isFactoryScenario(room.settings.scenarioKey),
    },
  };
}

function buildClassSnapshot(room, players) {
  const leaderboard = [...players].sort((a, b) => (
    (b.simulationScore?.total || 0) - (a.simulationScore?.total || 0)
      || b.netWorth - a.netWorth
  ));
  const ranking = new Map(leaderboard.map((player, index) => [player.id, index + 1]));
  return {
    generatedAtDay: room.day,
    generatedAtTick: room.tick,
    phaseLock: normalizeTeacherPhaseLock(room.teacherState?.phaseLock),
    rows: leaderboard.map(player => ({
      playerId: player.id,
      rank: ranking.get(player.id) || 0,
      userName: player.userName,
      companyName: player.name,
      isBot: Boolean(player.isBot),
      isTeacherHost: Boolean(player.isTeacherHost),
      bankrupt: Boolean(player.bankrupt),
      ready: Boolean(player.ready),
      simulationScore: Math.round(player.simulationScore?.total || 0),
      netWorth: Math.round(player.netWorth || 0),
      money: Math.round(player.money || 0),
      debt: Math.round(player.debt || 0),
      completedContracts: Math.round(player.completedContracts || 0),
      activeContractTitle: player.activeContract?.title || '',
      completedResearch: Array.isArray(player.research?.completed) ? player.research.completed.length : 0,
      riskLevel: player.intel?.riskLevel || 'low',
      lastAction: player.lastAction || '',
    })),
  };
}

function buildClassDashboard(room, players, classReadiness) {
  const readinessByPlayerId = new Map((classReadiness?.rows || []).map(row => [row.playerId, row]));
  const rows = players.map(player => {
    const readiness = readinessByPlayerId.get(player.id) || null;
    const lastBreakdown = player.lastTickBreakdown || {};
    const lastProfit = Math.round(Number(lastBreakdown.profit || 0));
    const lastRevenue = Math.round(Number(lastBreakdown.revenue || player.incomeLastTick || 0));
    const expenses = Math.round(Number(lastBreakdown.expenses || 0));
    const margin = lastRevenue > 0 ? Math.round((lastProfit / lastRevenue) * 100) : 0;
    const readyForTurn = readiness ? Boolean(readiness.readyForTurn) : Boolean(player.ready);
    return {
      playerId: player.id,
      userName: player.userName,
      companyName: player.name,
      isBot: Boolean(player.isBot),
      isTeacherHost: Boolean(player.isTeacherHost),
      isHost: room.hostPlayerId === player.id,
      bankrupt: Boolean(player.bankrupt),
      ready: Boolean(player.ready),
      readyForTurn,
      status: readiness?.status || (readyForTurn ? 'ready' : 'attention'),
      issue: readiness?.reason || (readyForTurn ? 'готов' : 'требует внимания'),
      nextAction: readiness?.actionHint || (readyForTurn ? 'Готов к ходу' : 'Проверить команду'),
      rankScore: Math.round(player.simulationScore?.total || 0),
      netWorth: Math.round(player.netWorth || 0),
      money: Math.round(player.money || 0),
      debt: Math.round(player.debt || 0),
      lastProfit,
      lastRevenue,
      expenses,
      margin,
      producedLastTick: Math.round(player.producedLastTick || 0),
      soldLastTick: Math.round(player.soldLastTick || 0),
      totalSalesSeason: Math.round(player.totalSalesSeason || 0),
      finishedGoods: Math.round(player.productStock || 0),
      saleQuantity: Math.round(player.factory?.saleOffer?.quantity || 0),
      workerCount: Math.round(player.staff || 0),
      completedContracts: Math.round(player.completedContracts || 0),
      riskLevel: player.intel?.riskLevel || 'low',
      lastAction: player.lastAction || '',
    };
  });
  const humanRows = rows.filter(isClassPlayer);
  const activeRows = humanRows.length ? humanRows : rows;
  const sortedByScore = [...rows].sort((a, b) => b.rankScore - a.rankScore || b.netWorth - a.netWorth);
  const topProfit = [...activeRows].sort((a, b) => b.lastProfit - a.lastProfit)[0] || null;
  const needsHelp = activeRows.filter(row => !row.readyForTurn).length;
  const profitable = activeRows.filter(row => row.lastProfit >= 0).length;
  const debtRisk = activeRows.filter(row => row.debt > Math.max(row.money, 1) * 0.35 || row.debt > 50000).length;
  return {
    generatedAtDay: room.day,
    generatedAtTick: room.tick,
    sortOptions: [
      { key: 'rankScore', label: 'Общий балл' },
      { key: 'netWorth', label: 'Капитал' },
      { key: 'lastProfit', label: 'Прибыль за ход' },
      { key: 'lastRevenue', label: 'Выручка за ход' },
      { key: 'totalSalesSeason', label: 'Продажи всего' },
      { key: 'debt', label: 'Долг' },
      { key: 'readyForTurn', label: 'Готовность' },
    ],
    metrics: [
      { key: 'teams', label: 'Команд', value: activeRows.length, hint: 'активных участников' },
      { key: 'ready', label: 'Готовы', value: `${activeRows.length - needsHelp}/${activeRows.length}`, hint: 'к пересчету хода' },
      { key: 'profitable', label: 'Плюсовой ход', value: `${profitable}/${activeRows.length}`, hint: 'не ушли в минус' },
      { key: 'debtRisk', label: 'Риск долга', value: debtRisk, hint: 'нужен контроль финансов' },
    ],
    leader: sortedByScore[0] || null,
    topProfit,
    needsHelp,
    rows,
  };
}

function buildClassDebrief(room, players, classSnapshot) {
  const rows = classSnapshot?.rows || [];
  const humanPlayers = players.filter(isClassPlayer);
  const activePlayers = humanPlayers.length ? humanPlayers : players;
  const leader = rows[0] || null;
  const leaderPlayer = leader ? players.find(player => player.id === leader.playerId) : null;
  const salesTotal = activePlayers.reduce((sum, player) => sum + Math.max(0, Number(player.totalSalesSeason || 0)), 0);
  const netWorthTotal = activePlayers.reduce((sum, player) => sum + Math.round(player.netWorth || 0), 0);
  const scoreTotal = activePlayers.reduce((sum, player) => sum + Math.round(player.simulationScore?.total || 0), 0);
  const profitableCount = activePlayers.filter(player => Number(player.lastTickBreakdown?.profit || 0) >= 0).length;
  const noSalesCount = activePlayers.filter(player => Number(player.totalSalesSeason || 0) <= 0).length;
  const negativeProfitCount = activePlayers.filter(player => Number(player.lastTickBreakdown?.profit || 0) < 0).length;
  const debtRiskCount = activePlayers.filter(player => player.debt > Math.max(player.money, 1) * 0.35 || player.debt > 50000).length;
  const unsoldStockCount = activePlayers.filter(player => player.factory && Number(player.factory.finishedGoods || 0) > 0 && Number(player.factory.saleOffer?.quantity || 0) <= 0).length;
  const completedContracts = activePlayers.reduce((sum, player) => sum + Number(player.completedContracts || 0), 0);
  const averageScore = activePlayers.length ? Math.round(scoreTotal / activePlayers.length) : 0;
  const averageNetWorth = activePlayers.length ? Math.round(netWorthTotal / activePlayers.length) : 0;

  const commonIssues = [
    {
      key: 'no_sales',
      label: 'Без продаж',
      count: noSalesCount,
      recommendation: 'Разберите книгу заявок: товар должен быть собран и выставлен по конкурентной цене.',
    },
    {
      key: 'negative_profit',
      label: 'Минусовая прибыль',
      count: negativeProfitCount,
      recommendation: 'Покажите связь закупки, зарплат, цены и результата хода.',
    },
    {
      key: 'debt_risk',
      label: 'Долговой риск',
      count: debtRiskCount,
      recommendation: 'Обсудите, когда рост через долг помогает, а когда ломает ликвидность.',
    },
    {
      key: 'unsold_stock',
      label: 'Товар без заявки',
      count: unsoldStockCount,
      recommendation: 'Напомните: производство не становится выручкой без продажи на рынке.',
    },
  ].filter(issue => issue.count > 0);

  const leaderReasons = [];
  if (leaderPlayer) {
    if (Number(leaderPlayer.totalSalesSeason || 0) > 0) leaderReasons.push('регулярно превращал выпуск в продажи');
    if (Number(leaderPlayer.debt || 0) <= Math.max(Number(leaderPlayer.money || 1) * 0.25, 1)) leaderReasons.push('держал долг под контролем');
    if (Number(leaderPlayer.lastTickBreakdown?.profit || 0) >= 0) leaderReasons.push('последний ход закончил с положительным денежным результатом');
    if (Number(leaderPlayer.completedContracts || 0) > 0) leaderReasons.push('закрывал контракты и получал дополнительные очки');
  }
  if (!leaderReasons.length) leaderReasons.push('набрал лучший общий балл по капиталу, устойчивости и выполненным решениям');

  const status = room.status === 'finished' ? 'final' : 'in_progress';
  const issueText = commonIssues.length
    ? `Главная зона роста: ${commonIssues[0].label.toLowerCase()} (${commonIssues[0].count}).`
    : 'Класс прошёл цикл без повторяющихся критических ошибок.';
  return {
    status,
    title: status === 'final' ? 'Разбор занятия' : 'Текущий разбор класса',
    summary: `${activePlayers.length} команд, средний балл ${averageScore}, средний капитал ${averageNetWorth.toLocaleString('ru-RU')} ₽. ${issueText}`,
    winnerReason: leader
      ? `${leader.companyName} лидирует: ${leaderReasons.join(', ')}.`
      : 'Лидер ещё не определён.',
    classMetrics: [
      { key: 'sales', label: 'Продано за матч', value: salesTotal, hint: 'единиц продукции' },
      { key: 'profitable', label: 'Плюсовой ход', value: `${profitableCount}/${activePlayers.length}`, hint: 'команд с неотрицательной прибылью' },
      { key: 'contracts', label: 'Контракты', value: completedContracts, hint: 'выполнено командами' },
      { key: 'avg_score', label: 'Средний индекс', value: averageScore, hint: 'балл симуляции' },
    ],
    commonIssues,
    discussionPrompts: commonIssues.length
      ? [
          `Почему возникла проблема "${commonIssues[0].label}" и какое решение исправит её за один ход?`,
          'Какая команда лучше всего связала закупку, сборку и продажу?',
          'Где была главная развилка: цена, объём, персонал или долг?',
        ]
      : [
          'Какая стратегия дала лучший результат и почему?',
          'Какой риск команды контролировали лучше всего?',
          'Что бы команды изменили, если бы был ещё один ход?',
        ],
    nextLessonFocus: commonIssues[0]?.recommendation || 'Следующее занятие можно усложнить сценарием с дефицитом поставщиков или более быстрым рынком.',
  };
}

function setPhaseLock(room, actorPlayer, requestedValue) {
  if ((room.settings?.tickMode || 'manual') !== 'manual') {
    throw Object.assign(new Error('Блокировка фаз доступна только в пошаговом режиме.'), { status: 400 });
  }
  const nextValue = normalizeTeacherPhaseLock(String(requestedValue || 'open'));
  room.teacherState = ensureTeacherState(room.teacherState);
  room.teacherState.phaseLock = nextValue;
  room.teacherState.updatedAt = Date.now();
  room.teacherState.actorPlayerId = actorPlayer.id;
  addRoomLog(
    room,
    nextValue === 'open'
      ? `${actorPlayer.userName} открыл фазу решений для следующего хода.`
      : `${actorPlayer.userName} перевёл матч в фазу разбора и зафиксировал решения.`
  );
}

function forceRoomEvent(room, actorPlayer, requestedEventKey) {
  if (!['running', 'paused'].includes(room.status)) {
    throw Object.assign(new Error('Учебное событие можно запускать только во время матча или паузы.'), { status: 400 });
  }
  const event = isFactoryScenario(room.settings.scenarioKey)
    ? generateFactoryEvent(room, String(requestedEventKey || 'factory_demand_surge'))
    : generateActiveEvent(room, String(requestedEventKey || ''));
  room.activeEvent = event;
  const crisisCardLabel = CRISIS_CARD_LABELS[event.key] || '';
  addRoomLog(
    room,
    crisisCardLabel
      ? `${actorPlayer.userName} запустил Crisis Card «${crisisCardLabel}»: ${event.title}.`
      : `${actorPlayer.userName} запустил учебное событие: ${event.title}.`
  );
  return event;
}

function parseExperimentValues(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,\s;]+/);
  return source
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
}

function runRoomExperiment(room, actorPlayer, payload = {}) {
  if (!isFactoryScenario(room.settings.scenarioKey)) {
    throw Object.assign(new Error('Эксперименты доступны только для производственных сценариев.'), { status: 400 });
  }
  const config = factoryScenarioConfig(room.settings.scenarioKey);
  const definition = buildScenarioDefinitionFromFactoryConfig(config, {
    difficultyLabel: difficultyConfigForRoom(room).label,
    dayLimit: room.settings?.dayLimit || MAX_TURN_COUNT,
    turnMinutes: Math.round(turnDurationMsForRoom(room) / 60000),
  });
  if (!definition?.validation?.valid) {
    throw Object.assign(new Error('Сценарий не прошел проверку параметров.'), { status: 400 });
  }
  const parameter = String(payload.parameter || 'basePrice');
  const values = parseExperimentValues(payload.values);
  if (!values.length) {
    throw Object.assign(new Error('Укажите хотя бы одно числовое значение эксперимента.'), { status: 400 });
  }
  const turns = clamp(Math.round(Number(payload.turns || 8)), 1, MAX_TURN_COUNT);
  const seed = Math.round(Number(payload.seed || 42));
  const rows = runParameterSweep({
    scenario: definition,
    parameter,
    values,
    turns,
    seed,
  });
  const best = [...rows].sort((left, right) => (
    right.finalScore - left.finalScore
      || right.totalSales - left.totalSales
      || right.finalNetWorth - left.finalNetWorth
  ))[0] || null;

  room.teacherState = ensureTeacherState(room.teacherState);
  room.teacherState.lastExperiment = {
    generatedAt: new Date().toISOString(),
    actorPlayerId: actorPlayer.id,
    scenarioKey: room.settings.scenarioKey,
    scenarioLabel: scenarioLabel(room.settings.scenarioKey),
    parameter,
    values,
    turns,
    seed,
    best,
    rows,
  };
  addRoomLog(room, `${actorPlayer.userName} запустил эксперимент: ${parameter} (${values.join(', ')}).`);
  return room.teacherState.lastExperiment;
}

function productLabelForKey(productKey) {
  return PRODUCTS[productKey]?.label || productKey;
}

function cityLabelForKey(cityKey) {
  return CITIES[cityKey]?.label || cityKey;
}

function makeContract(room) {
  const productKey = randomItem(Object.keys(PRODUCTS));
  const cityKey = randomItem(Object.keys(CITIES));
  const targetSales = 45 + Math.floor(Math.random() * 50);
  const reward = 18000 + targetSales * 220;
  return {
    id: uid('contract'),
    title: `${productLabelForKey(productKey)} - ${cityLabelForKey(cityKey)}`,
    productKey,
    productLabel: productLabelForKey(productKey),
    cityKey,
    cityLabel: cityLabelForKey(cityKey),
    targetSales,
    progress: 0,
    reward,
    reputationReward: 4,
    expiresDay: room.day + 4,
    assignedPlayerId: null,
    assignedPlayerName: '',
    completed: false,
  };
}

function refreshContracts(room, force = false) {
  const currentDay = room.day;
  room.contractBoard = (room.contractBoard || []).filter(contract => !contract.completed && contract.expiresDay >= currentDay);
  if (!force && room.contractBoard.length >= 3) return;
  while (room.contractBoard.length < 3) room.contractBoard.push(makeContract(room));
}

function refreshContractsForRoom(room, force = false) {
  if (isFactoryScenario(room.settings.scenarioKey)) {
    room.contractBoard = [];
    return;
  }
  refreshContracts(room, force);
}

function refreshWorldState(room) {
  if (room.activeEvent && room.day > room.activeEvent.expiresDay) room.activeEvent = null;
  if (!room.activeEvent && room.tick >= 3 && room.tick % 3 === 0) {
    room.activeEvent = generateActiveEvent(room);
    addRoomLog(room, `Market event started: ${room.activeEvent.title}.`);
  }
  if (room.tick === 1 || room.tick % 4 === 0) refreshContracts(room, true);
  else refreshContracts(room, false);
}

function refreshFactoryMarketEvent(room) {
  refreshContractsForRoom(room);
  if (room.activeEvent && room.day > room.activeEvent.expiresDay) room.activeEvent = null;
  if (!room.activeEvent && room.tick >= 3 && room.tick % 3 === 0) {
    room.activeEvent = generateFactoryEvent(room);
    addRoomLog(room, `Factory market event started: ${room.activeEvent.title}.`);
  }
}


function completeAchievement(account, key) {
  if (ACHIEVEMENTS[key]) account.achievements[key] = true;
}

function acceptContract(room, player, contractId) {
  if (room.status !== 'running') throw Object.assign(new Error('Контракты доступны только во время матча'), { status: 400 });
  if (player.activeContract) throw Object.assign(new Error('Сначала завершите или потеряйте текущий контракт'), { status: 400 });
  const contract = (room.contractBoard || []).find(item => item.id === contractId && !item.assignedPlayerId && !item.completed);
  if (!contract) throw Object.assign(new Error('Контракт недоступен'), { status: 404 });
  contract.assignedPlayerId = player.id;
  contract.assignedPlayerName = player.userName;
  player.activeContract = { ...contract };
  player.lastAction = `Принят контракт ${contract.title}`;
  addRoomLog(room, `${player.name} accepted contract ${contract.title}.`);
}

function updateContractProgress(room, player, sold, cityKey, productKey) {
  if (!player.activeContract) return;
  const contract = player.activeContract;
  if (contract.cityKey !== cityKey || contract.productKey !== productKey) return;
  contract.progress += sold;
  const boardEntry = room.contractBoard.find(item => item.id === contract.id);
  if (boardEntry) boardEntry.progress = contract.progress;
  if (contract.progress >= contract.targetSales) {
    const policy = BOARD_POLICIES[player.boardPolicyKey] || BOARD_POLICIES.balanced;
    player.money += Math.round(contract.reward * policy.contractRewardMultiplier);
    player.reputation = clamp(player.reputation + contract.reputationReward, 5, 95);
    player.completedContracts += 1;
    player.lastAction = `Контракт выполнен: ${contract.title}`;
    if (boardEntry) boardEntry.completed = true;
    addRoomLog(room, `${player.name} completed contract ${contract.title} and earned ${Math.round(contract.reward * policy.contractRewardMultiplier)}.`);
    player.activeContract = null;
  }
}

function expirePlayerContract(room, player) {
  if (!player.activeContract) return;
  if (player.activeContract.expiresDay < room.day) {
    addRoomLog(room, `${player.name} lost contract ${player.activeContract.title}.`);
    player.activeContract = null;
  }
}


function updateSeasonGoal(room, player) {
  ensureSeasonGoal(player);
  player.seasonGoal.progress = computeSeasonGoalProgress(player);
  if (!player.seasonGoal.completed && player.seasonGoal.progress >= player.seasonGoal.target) {
    player.seasonGoal.completed = true;
    player.money += player.seasonGoal.reward;
    player.reputation = clamp(player.reputation + 5, 5, 95);
    addRoomLog(room, `${player.name} completed the season goal ${player.seasonGoal.label}.`);
  }
}

const handleRoomAction = createRoomActionHandler({
  ensureLobby,
  ensureHost,
  canStartMatch,
  refreshContracts: refreshContractsForRoom,
  ensureSeasonGoal,
  addRoomLog,
  resetRoom,
  addBot,
  saveRoomSnapshot,
  ensureLoadable,
  loadRoomSnapshot,
  removePlayer,
  updateRoomSettings,
  handleBusinessAction,
  advanceRoom,
  forceRoomEvent,
  setPhaseLock,
  runScenarioExperiment: runRoomExperiment,
  finishRoom,
});

function factoryBotTurn(room, bot) {
  const config = ensureFactoryPlayer(bot, room);
  ensureFactoryCandidates(room);
  const factory = bot.factory;
  const capacity = availableAssemblyCount(factory, config);

  const desiredWorkers = Math.min(4, Math.max(2, Math.ceil((room.day || 1) / 3) + 1));
  if (factory.workers.length < desiredWorkers && room.factoryScenario.candidates.length) {
    const bestCandidate = [...room.factoryScenario.candidates]
      .filter(candidate => bot.money > candidate.expectedSalary * 1.7)
      .sort((left, right) => (
        (right.suitability / Math.max(right.expectedSalary, 1))
          - (left.suitability / Math.max(left.expectedSalary, 1))
      ))[0];
    if (bestCandidate) {
    handleBusinessAction(room, bot, { action: 'hire-worker', value: bestCandidate.id });
    }
  }

  const targetAssembly = Math.max(2, Math.min(5, capacity + 2));
  Object.entries(config.components)
    .map(([componentKey, component]) => ({
      componentKey,
      component,
      shortage: Math.max(0, component.recipe * targetAssembly - (factory.inventory[componentKey] || 0)),
    }))
    .filter(item => item.shortage > 0)
    .sort((left, right) => right.shortage - left.shortage)
    .forEach(({ componentKey, shortage }) => {
      const offer = [...(room.factoryScenario.supplierOffers || [])]
        .filter(item => item.componentKey === componentKey)
        .sort((left, right) => (
          (Number(right.score || 0) - Number(left.score || 0))
            || Number(left.unitPrice || 0) - Number(right.unitPrice || 0)
            || Number(right.quantity || 0) - Number(left.quantity || 0)
        ))[0];
      if (offer) {
        const wantedQuantity = Math.min(Number(offer.quantity || 0), Math.max(shortage, Math.ceil(Number(offer.quantity || 0) / 2)));
        const expectedCost = Number(offer.unitPrice || 0) * wantedQuantity;
        if (bot.money > expectedCost + config.upkeep * 1.3) {
        handleBusinessAction(room, bot, {
          action: 'buy-supplier-offer',
          value: { offerId: offer.id, quantity: wantedQuantity },
        });
      }
    }
    });

  const assembleCount = availableAssemblyCount(factory, config);
  if (assembleCount > 0) {
    handleBusinessAction(room, bot, { action: 'assemble-product', value: Math.min(assembleCount, Math.max(2, desiredWorkers)) });
  }

  const recentClearingPrice = room.marketHistory?.length
    ? Number(room.marketHistory[room.marketHistory.length - 1].avgPrice || config.basePrice)
    : config.basePrice;
  const competitorFloor = (room.factoryScenario.marketBook || [])
    .filter(entry => entry.playerId !== bot.id)
    .sort((left, right) => Number(left.price || 0) - Number(right.price || 0))[0]?.price;
  const anchorPrice = competitorFloor || recentClearingPrice || config.basePrice;
  const quantity = Math.min(factory.finishedGoods, Math.max(0, factory.finishedGoods - (room.day > 2 ? 0 : 1)) || factory.finishedGoods);
  const price = clamp(
    Math.round(anchorPrice * (0.94 + Math.random() * 0.08)) - factory.workers.length * 12,
    config.priceRange.min,
    config.priceRange.max
  );
  handleBusinessAction(room, bot, { action: 'set-sale-offer', value: { price, quantity } });
}

function botTurn(room, bot) {
  if (bot.bankrupt || room.status !== 'running') return;
  if (isFactoryScenario(room.settings.scenarioKey)) {
    factoryBotTurn(room, bot);
    return;
  }
  const actions = [];
  if (bot.rawStock < 14 && bot.money > 12000) actions.push(['buy-raw', 20]);
  if (bot.money > 65000 && bot.factories < 3 && Math.random() > 0.55) actions.push(['build-factory']);
  if (bot.money > 45000 && bot.stores < 4 && Math.random() > 0.45) actions.push(['build-store']);
  if (bot.money > 30000 && bot.supplyLevel < 4 && Math.random() > 0.45) actions.push(['upgrade-supply']);
  if (bot.money > 32000 && bot.marketing < 4 && Math.random() > 0.4) actions.push(['marketing']);
  if (bot.money > 28000 && bot.quality < 4 && Math.random() > 0.55) actions.push(['upgrade-quality']);
  if (bot.staff < bot.factories * 12 && bot.money > 12000 && Math.random() > 0.35) actions.push(['hire', 2]);
  if (!bot.research.activeKey && Math.random() > 0.62) {
    const options = Object.keys(RESEARCH_PROJECTS).filter(key => !bot.research.completed.includes(key));
    if (options.length) actions.push(['start-research', options[Math.floor(Math.random() * options.length)]]);
  }
  if (Math.random() > 0.7) actions.push(['set-product', ['food', 'electronics', 'furniture', 'pharma'][Math.floor(Math.random() * 4)]]);
  if (Math.random() > 0.72) actions.push(['set-city', ['capital', 'regional', 'industrial', 'coastal'][Math.floor(Math.random() * 4)]]);
  if (actions.length > 0) {
    const [action, value] = actions[Math.floor(Math.random() * actions.length)];
    handleBusinessAction(room, bot, { action, value });
  }
  bot.price = clamp(128 + bot.quality * 10 + (bot.productKey === 'electronics' || bot.productKey === 'pharma' ? 18 : 0) - bot.marketing * 3 + Math.round(Math.random() * 12 - 6), 90, 240);
}


function progressResearch(room, player) {
  const scenario = SCENARIOS[room.settings.scenarioKey] || SCENARIOS.standard;
  const activeKey = player.research.activeKey;
  if (!activeKey) return;
  const project = RESEARCH_PROJECTS[activeKey];
  if (!project) return;
  const policy = BOARD_POLICIES[player.boardPolicyKey] || BOARD_POLICIES.balanced;
  const eventMultiplier = eventApplies(room.activeEvent, player.cityKey, player.productKey) ? room.activeEvent.researchMultiplier || 1 : 1;
  const gain = Math.max(1, Math.round((1 + player.automation * 0.8 + player.quality * 0.6 + player.staff / 10) * scenario.research * eventMultiplier * policy.researchMultiplier));
  player.researchPoints += gain;
  player.research.progress += gain;
  if (player.research.progress >= project.cost) {
    player.research.completed.push(activeKey);
    player.research.activeKey = '';
    player.research.progress = 0;
    player.innovation += 1;
    addRoomLog(room, `${player.name} completed research ${project.label}.`);
    const account = ensureAccount(player.userName);
    account.completedResearch[activeKey] = true;
    account.lastActiveAt = Date.now();
    persistDb();
  }
}

function applyOperatingPlan(room, player) {
  if (player.bankrupt || player.isBot) return;
  if (isFactoryScenario(room.settings.scenarioKey)) return;
  const action = pickOperatingPlanAction({
    player,
    availableResearchKeys: Object.keys(RESEARCH_PROJECTS).filter(key => !player.research.completed.includes(key)),
    availableContracts: room.contractBoard || [],
  });
  if (!action) return;
  try {
    handleBusinessAction(room, player, action);
    player.lastAction = `Автоплан: ${player.lastAction}`;
  } catch {
    // Автоплан должен быть мягким и не останавливать игровой тик.
  }
}

function advanceFactoryRoom(room) {
  const config = factoryScenarioConfig(room.settings.scenarioKey);
  const difficulty = difficultyConfigForRoom(room);
  room.tick += 1;
  room.day = Math.min(room.tick + 1, room.settings.dayLimit);
  ensureFactoryCandidates(room);
  restockFactorySuppliers(room);
  refreshFactoryMarketEvent(room);

  const activePlayers = [...room.players.values()].filter(isActiveCompetitor);
  runFactoryDecisionLifecycle(room, activePlayers);
  activePlayers.filter(player => player.isBot).forEach(player => botTurn(room, player));
  if (!activePlayers.length) {
    finishRoom(room, null, 'no_active_players');
    return;
  }

  const baseDemand = randomBetween(config.baseDemandMin, config.baseDemandMax) + Math.round(activePlayers.length * 2.5);
  const eventDemandMultiplier = room.activeEvent?.scope === 'factory' ? room.activeEvent.demandMultiplier || 1 : 1;
  const eventQualityMultiplier = factoryEventMultiplier(room, 'qualityMultiplier');
  const eventPayrollMultiplier = factoryEventMultiplier(room, 'payrollMultiplier');
  const eventUpkeepMultiplier = factoryEventMultiplier(room, 'upkeepMultiplier');
  const eventPricePressureMultiplier = factoryEventMultiplier(room, 'pricePressureMultiplier');

  const offers = activePlayers
    .map(player => {
      const factory = player.factory;
      const workers = factory.workers || [];
      const avgSuitability = workers.length
        ? workers.reduce((sum, worker) => sum + worker.suitability, 0) / workers.length
        : 0;
      const sellQuantity = Math.min(factory.saleOffer?.quantity || 0, factory.finishedGoods);
      return {
        player,
        price: factory.saleOffer?.price || config.basePrice,
        quantity: sellQuantity,
        suitability: avgSuitability * eventQualityMultiplier,
      };
    })
    .filter(offer => offer.quantity > 0)
    .sort((left, right) => left.price - right.price || right.suitability - left.suitability || right.quantity - left.quantity);

  const totalOffered = offers.reduce((sum, offer) => sum + offer.quantity, 0);
  const avgOfferPrice = totalOffered
    ? offers.reduce((sum, offer) => sum + offer.price * offer.quantity, 0) / totalOffered
    : config.basePrice;
  const pricePressure = totalOffered
    ? clamp(1 - ((avgOfferPrice - config.basePrice) / Math.max(config.basePrice, 1)) * 0.35 * difficulty.pricePressure * eventPricePressureMultiplier, 0.55, 1.15)
    : 1;
  const eventDifficultyMultiplier = eventDemandMultiplier > 1 ? difficulty.eventDemandMultiplier : 1;
  const demandMultiplier = Number((eventDemandMultiplier * eventDifficultyMultiplier * difficulty.demandMultiplier * pricePressure).toFixed(4));
  const demand = Math.max(0, Math.round(baseDemand * demandMultiplier));
  let remainingDemand = demand;
  let totalSales = 0;
  let weightedPrice = 0;

  const marketBook = [];

  activePlayers.forEach(player => {
    const factory = player.factory;
    // Новый ход: сборка этого хода обнуляется, иначе дым на карте и блокер
    // «Не собрали продукт» залипали бы после первой же успешной сборки.
    factory.assembledThisTurn = 0;
    player.producedLastTick = 0;
    const payroll = (factory.workers || []).reduce((sum, worker) => sum + worker.expectedSalary, 0);
    const upkeep = Math.round(config.upkeep * difficulty.costMultiplier * eventUpkeepMultiplier);
    const adjustedPayroll = Math.round(payroll * difficulty.costMultiplier * eventPayrollMultiplier);
    player.money -= adjustedPayroll + upkeep;
    factory.workerPayroll = adjustedPayroll + upkeep;
    factory.soldThisTurn = 0;
    factory.revenueThisTurn = 0;
    factory.lastSuitability = factory.workers.length
      ? Math.round(factory.workers.reduce((sum, worker) => sum + worker.suitability, 0) / factory.workers.length)
      : 0;
    player.staff = factory.workers.length;
    player.salary = factory.workers.length ? Math.round(adjustedPayroll / factory.workers.length) : 0;
  });

  offers.forEach(offer => {
    const sold = Math.min(remainingDemand, offer.quantity);
    const factory = offer.player.factory;
    const revenue = sold * offer.price;
    factory.finishedGoods -= sold;
    factory.soldThisTurn = sold;
    factory.revenueThisTurn = revenue;
    factory.saleOffer = { price: offer.price, quantity: 0 };
    offer.player.productStock = factory.finishedGoods;
    offer.player.money += revenue;
    offer.player.totalSalesSeason += sold;
    offer.player.incomeLastTick = revenue;
    offer.player.expensesLastTick = factory.workerPayroll;
    offer.player.lastTickBreakdown = {
      revenue,
      expenses: factory.workerPayroll,
      profit: revenue - factory.workerPayroll,
      salary: factory.workerPayroll,
      upkeep: 0,
      debt: 0,
      technology: 0,
      sold,
      cityLabel: 'Order book',
      productLabel: config.productLabel,
      policyLabel: 'Factory pricing',
    };
    offer.player.reputation = clamp(offer.player.reputation + (sold > 0 ? 1 : -1), 5, 95);
    offer.player.lastAction = sold
      ? `Sold ${sold} ${config.productUnit} at ${offer.price}.`
      : `Offer at ${offer.price} found no buyers.`;
    marketBook.push({
      playerId: offer.player.id,
      playerName: offer.player.name,
      price: offer.price,
      quantity: offer.quantity,
      sold,
      remaining: offer.quantity - sold,
      suitability: Math.round(offer.suitability),
    });
    remainingDemand -= sold;
    totalSales += sold;
    weightedPrice += sold * offer.price;
  });

  activePlayers.forEach(player => {
    if (player.factory.soldThisTurn) return;
    player.incomeLastTick = 0;
    player.expensesLastTick = player.factory.workerPayroll;
    player.lastTickBreakdown = {
      revenue: 0,
      expenses: player.factory.workerPayroll,
      profit: -player.factory.workerPayroll,
      salary: player.factory.workerPayroll,
      upkeep: 0,
      debt: 0,
      technology: 0,
      sold: 0,
      cityLabel: 'Order book',
      productLabel: config.productLabel,
      policyLabel: 'Factory pricing',
    };
    player.lastAction = player.factory.saleOffer?.quantity
      ? `Offer at ${player.factory.saleOffer.price} was left unmatched.`
      : 'Held inventory and waited for the next turn.';
  });

  room.factoryScenario.marketBook = marketBook;
  room.segmentSnapshots = [{
    cityKey: 'factory',
    cityLabel: 'Order book',
    productKey: config.productKey,
    productLabel: config.productLabel,
    baseDemand,
    demandMultiplier,
    demand,
    totalSales,
    avgPrice: totalSales ? Math.round(weightedPrice / totalSales) : 0,
  }];
  room.marketHistory.push({
    day: room.day,
    baseDemand,
    demandMultiplier,
    demand,
    avgPrice: totalSales ? Math.round(weightedPrice / totalSales) : 0,
    totalSales,
    unmatchedDemand: Math.max(0, demand - totalSales),
  });
  room.marketHistory = room.marketHistory.slice(-MAX_MARKET_HISTORY);

  activePlayers.forEach(player => {
    if (player.money < difficulty.bankruptcyBuffer) {
      player.bankrupt = true;
      player.lastAction = 'Plant went bankrupt.';
      addRoomLog(room, `${player.name} went bankrupt and left the order book.`);
    }
  });

  recordServerAdminSnapshot(room);

  const survivors = activePlayers.filter(player => !player.bankrupt);
  if (survivors.length <= 1) finishRoom(room, survivors[0] || null, survivors[0] ? 'last_company_standing' : 'no_active_players');
  if (room.status === 'running' && room.tick >= room.settings.dayLimit) {
    const winner = [...survivors].sort((a, b) => (b.money + playerAssets(b) - b.debt) - (a.money + playerAssets(a) - a.debt))[0] || null;
    finishRoom(room, winner, 'turn_limit');
  }
}

function advanceRoom(room) {
  if (room.status !== 'running') return;
  if (isFactoryScenario(room.settings.scenarioKey)) {
    advanceFactoryRoom(room);
    if (room.status === 'running') room.turnStartedAt = Date.now();
    return;
  }

  room.tick += 1;
  room.day = Math.min(room.tick + 1, room.settings.dayLimit);
  refreshWorldState(room);

  const activePlayers = [...room.players.values()].filter(isActiveCompetitor);
  activePlayers.forEach(player => expirePlayerContract(room, player));
  activePlayers.forEach(player => applyOperatingPlan(room, player));
  activePlayers.filter(player => player.isBot).forEach(player => botTurn(room, player));
  if (activePlayers.length === 0) {
    finishRoom(room, null, 'no_active_players');
    return;
  }

  const scenario = SCENARIOS[room.settings.scenarioKey] || SCENARIOS.standard;
  const difficulty = difficultyConfigForRoom(room);
  const segments = new Map();
  activePlayers.forEach(player => {
    const key = `${player.cityKey}:${player.productKey}`;
    if (!segments.has(key)) segments.set(key, []);
    segments.get(key).push(player);
  });

  let totalDemand = 0;
  let soldTotal = 0;
  let weightedPrice = 0;
  const segmentSnapshots = [];

  segments.forEach((segmentPlayers, key) => {
    const [cityKey, productKey] = key.split(':');
    const city = CITIES[cityKey];
    const product = PRODUCTS[productKey];
    const eventDemand = eventApplies(room.activeEvent, cityKey, productKey) ? room.activeEvent.demandMultiplier || 1 : 1;
    const segmentDemand = Math.round((65 + segmentPlayers.length * 28 + Math.random() * 35) * city.demand * product.demand * demandMultiplier(room.settings.demandProfile) * scenario.demand * eventDemand * difficulty.demandMultiplier);
    totalDemand += segmentDemand;

    const offers = segmentPlayers.map(player => {
      const specialization = SPECIALIZATIONS[player.specializationKey] || SPECIALIZATIONS.balanced;
      const policy = BOARD_POLICIES[player.boardPolicyKey] || BOARD_POLICIES.balanced;
      const research = researchEffects(player, RESEARCH_PROJECTS);
      const potentialProduced = Math.round(player.factories * (4 + player.automation * 2) + player.staff * 0.6 + player.quality * 2 + specialization.productionBonus + (research.production || 0));
      const produced = Math.min(potentialProduced, Math.round(player.rawStock));
      player.rawStock = Math.max(0, player.rawStock - produced);
      player.productStock += produced;
      player.producedLastTick = produced;
      progressResearch(room, player);

      const priceFactor = clamp(((250 - player.price) / 180) * city.priceSensitivity * product.marginWeight, 0.15, 1.35);
      const marketingFactor = 1 + player.marketing * (0.18 + (research.marketing || 0));
      const qualityFactor = 0.82 + player.quality * 0.15 * product.qualityWeight + (research.quality || 0);
      const retailFactor = 0.8 + player.stores * (0.18 + (research.retail || 0));
      const repFactor = 0.6 + player.reputation / 100 + (research.reputation || 0);
      return { player, score: priceFactor * marketingFactor * qualityFactor * retailFactor * repFactor * specialization.demandScore * policy.demandScore };
    });

    const totalScore = offers.reduce((sum, item) => sum + item.score, 0) || 1;
    let segmentSold = 0;
    let segmentWeightedPrice = 0;

    offers.forEach(({ player, score }) => {
      const research = researchEffects(player, RESEARCH_PROJECTS);
      const specialization = SPECIALIZATIONS[player.specializationKey] || SPECIALIZATIONS.balanced;
      const policy = BOARD_POLICIES[player.boardPolicyKey] || BOARD_POLICIES.balanced;
      const targetSales = Math.round((segmentDemand * score) / totalScore);
      const sold = Math.min(targetSales, Math.round(player.productStock));
      player.productStock -= sold;
      player.soldLastTick = sold;
      updateContractProgress(room, player, sold, cityKey, productKey);

      const rawBreakdown = buildFinancialBreakdown({
        player,
        city,
        scenario,
        specialization,
        policy,
        research,
        sold,
      });
      const adjustedCostMultiplier = difficulty.costMultiplier;
      const adjustedSalary = Math.round(rawBreakdown.salary * adjustedCostMultiplier);
      const adjustedUpkeep = Math.round(rawBreakdown.upkeep * adjustedCostMultiplier);
      const adjustedTechnology = Math.round(rawBreakdown.technology * adjustedCostMultiplier);
      const adjustedExpenses = adjustedSalary + adjustedUpkeep + rawBreakdown.debt + adjustedTechnology;
      const breakdown = {
        ...rawBreakdown,
        salary: adjustedSalary,
        upkeep: adjustedUpkeep,
        technology: adjustedTechnology,
        expenses: adjustedExpenses,
        profit: rawBreakdown.revenue - adjustedExpenses,
      };

      player.money += breakdown.profit;
      player.totalSalesSeason += sold;
      player.incomeLastTick = breakdown.revenue;
      player.expensesLastTick = breakdown.expenses;
      player.lastTickBreakdown = {
        ...breakdown,
        cityLabel: city.label,
        productLabel: product.label,
        policyLabel: policy.label,
      };
      player.reputation = clamp(player.reputation + ((sold > 0 ? 2 : -2) + (player.salary >= 130 ? 1 : -1) + (player.rawStock > 10 ? 1 : -1)) * specialization.reputationGain, 5, 95);
      updateSeasonGoal(room, player);

      if (player.money < difficulty.legacyBankruptcyBuffer || (player.debt > difficulty.debtLimit && player.money < 1000)) {
        player.bankrupt = true;
        player.lastAction = 'Компания обанкротилась';
        addRoomLog(room, `${player.name} left the match due to bankruptcy.`);
      }

      soldTotal += sold;
      weightedPrice += sold * player.price;
      segmentSold += sold;
      segmentWeightedPrice += sold * player.price;
    });

    segmentSnapshots.push({
      cityKey,
      cityLabel: city.label,
      productKey,
      productLabel: product.label,
      demand: segmentDemand,
      totalSales: segmentSold,
      avgPrice: segmentSold ? Math.round(segmentWeightedPrice / segmentSold) : 0,
    });
  });

  room.segmentSnapshots = segmentSnapshots.sort((a, b) => b.totalSales - a.totalSales);
  room.marketHistory.push({
    day: room.day,
    demand: totalDemand,
    avgPrice: soldTotal ? Math.round(weightedPrice / soldTotal) : 0,
    totalSales: soldTotal,
  });
  room.marketHistory = room.marketHistory.slice(-MAX_MARKET_HISTORY);

  recordServerAdminSnapshot(room);

  const survivors = [...room.players.values()].filter(isActiveCompetitor);
  if (survivors.length <= 1) finishRoom(room, survivors[0] || null, survivors[0] ? 'last_company_standing' : 'no_active_players');
  if (room.status === 'running' && room.tick >= room.settings.dayLimit) {
    const winner = [...survivors].sort((a, b) => (b.money + playerAssets(b) - b.debt) - (a.money + playerAssets(a) - a.debt))[0] || null;
    finishRoom(room, winner, 'turn_limit');
  }
  if (room.status === 'running') room.turnStartedAt = Date.now();
}

function serveStatic(res, pathname) {
  const targetPath = ['/', '/server', '/client'].includes(pathname) ? '/index.html' : pathname;
  const normalized = path.normalize(targetPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const routeApiRequest = createApiRouter({
  sendJson,
  parseBody,
  state,
  getRoomByPlayerId,
  getPlayer,
  ensureAccount,
  accountSummary,
  getRuntimeMeta,
  getRuntimeHealth,
  serverOverview,
  createRoom,
  joinRoom,
  publicRoomDirectory,
  roomStartGate,
  canStartMatch,
  roomSummary,
  playerSummary,
  playerStateSummary,
  handleRoomAction,
  handleServerAdminAction,
  createTeacherAccount,
  loginTeacher,
  createTeacherSession,
  resolveTeacherSessionToken,
  resolveTeacherRequest,
  publicTeacherAccount,
  cloudTeacherOverview,
  handleTeacherAction,
  archiveCompletedSession,
  listCompletedSessions,
  getCompletedSession,
  completedSessionCsv,
  issueRealtimeTicket: identity => realtimeTicketStore.issue(identity),
  persistRuntimeState,
  flushRuntimeState,
  restoreActiveRoomsFromDb,
  getRuntimeMeta,
  requirePlayerSession,
  resolvePlayerSession,
  verifyClientActionEnvelope,
  registerTeacher: body => {
    const account = createTeacherAccount(body);
    const sessionToken = createTeacherSession(account);
    return { account, sessionToken };
  },
  loginTeacher,
  teacherSummary: publicTeacherAccount,
  teacherOverview: cloudTeacherOverview,
  resolveTeacherRequest,
  handleTeacherAction,
  onRoomMutation: (room, context = {}) => {
    if (!room) return;
    touchRoom(room, context.player);
    persistRuntimeState();
    broadcastRoomUpdate(room, context);
  },
  createQrSvg,
  checkNetworkHealthUrl,
  serveStatic,
});

const server = http.createServer(async (req, res) => {
  applyResponseSecurityHeaders(req, res);
  corsPolicy.applyHttpHeaders(req, res);
  if (corsPolicy.handlePreflight(req, res)) return;
  const startedAt = Date.now();
  let url = null;
  try {
    url = parseRequestUrl(req);
    const handled = await routeApiRequest(req, res, url);
    if (!handled) sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error.retryAfterSeconds && !res.headersSent) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    operationalLog(error.status >= 500 || !error.status ? 'error' : 'warn', 'request-error', {
      method: req.method,
      pathname: url?.pathname || String(req.url || ''),
      status: error.status || 500,
      message: error.message || 'Server error',
    });
    sendJson(res, error.status || 500, { error: error.message || 'Server error' });
  } finally {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 500) {
      operationalLog('warn', 'slow-request', {
        method: req.method,
        pathname: url?.pathname || String(req.url || ''),
        elapsedMs,
      });
    }
  }
});

const wsServer = new WebSocketServer({ noServer: true, maxPayload: MAX_WEBSOCKET_PAYLOAD_BYTES });
const wsClients = new Set();
let wsHeartbeat = null;

function getRuntimeHealth() {
  const memory = process.memoryUsage();
  const rooms = [...state.rooms.values()];
  const storage = storageInfo();
  const humanPlayers = rooms.reduce((sum, room) => (
    sum + [...room.players.values()].filter(isClassPlayer).length
  ), 0);
  return {
    ok: true,
    status: storage.warning ? 'degraded' : 'healthy',
    checkedAt: new Date().toISOString(),
    meta: getRuntimeMeta(),
    diagnostics: {
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      },
      rooms: {
        total: rooms.length,
        running: rooms.filter(room => room.status === 'running').length,
        players: humanPlayers,
      },
      websocketConnections: wsClients.size,
      storage: {
        backend: storage.backend,
        durable: storage.durable,
        warning: storage.warning || '',
      },
      teacherRegistrationOpen: ALLOW_REGISTRATION,
    },
  };
}

function safeWsSend(client, payload) {
  if (!client || client.readyState !== 1) return;
  client.send(JSON.stringify(payload));
}

function broadcastTeacherOverviewUpdate(teacherAccountId = '') {
  wsClients.forEach(client => {
    if (client.teacherAccountId && (!teacherAccountId || client.teacherAccountId === teacherAccountId)) {
      safeWsSend(client, {
        type: 'teacher-overview-updated',
        generatedAt: Date.now(),
      });
    }
  });
}

function broadcastRoomUpdate(room, context = {}) {
  if (!room) return;
  const payload = {
    type: 'room-updated',
    roomCode: room.code,
    roomVersion: Math.max(1, Number(room.version) || 1),
    reason: context.action || context.source || 'updated',
    generatedAt: Date.now(),
  };
  wsClients.forEach(client => {
    if (client.roomCode === room.code || (client.teacherAccountId && client.teacherAccountId === room.teacherAccountId)) {
      safeWsSend(client, payload);
    }
  });
  broadcastTeacherOverviewUpdate(room.teacherAccountId || '');
}

function attachWebSocketClient(ws, req, url) {
  const client = ws;
  client.roomCode = '';
  client.playerId = '';
  client.teacherAccountId = '';
  client.on('close', () => wsClients.delete(client));
  client.on('error', () => wsClients.delete(client));
  try {
    const identity = realtimeTicketStore.consume(url.searchParams.get('ticket') || '');
    client.teacherAccountId = identity.teacherAccountId || '';
    client.roomCode = identity.roomCode || '';
    client.playerId = identity.playerId || '';
  } catch (error) {
    safeWsSend(client, { type: 'error', error: error.message || 'WebSocket auth failed' });
    client.close();
    return;
  }
  const identityKey = client.teacherAccountId
    ? `teacher:${client.teacherAccountId}`
    : `player:${client.roomCode}:${client.playerId}`;
  const identityConnectionCount = [...wsClients]
    .filter(existing => existing.identityKey === identityKey)
    .length;
  if (wsClients.size >= MAX_WEBSOCKET_CONNECTIONS || identityConnectionCount >= MAX_WEBSOCKET_CONNECTIONS_PER_IDENTITY) {
    safeWsSend(client, { type: 'error', error: 'Realtime connection limit reached' });
    client.close(1013, 'Realtime connection limit reached');
    return;
  }
  client.identityKey = identityKey;
  client.clientAddress = forwardedClientAddress(req);
  client.isAlive = true;
  client.on('pong', () => { client.isAlive = true; });
  wsClients.add(client);
  safeWsSend(client, {
    type: 'connected',
    roomCode: client.roomCode,
    teacher: Boolean(client.teacherAccountId),
    generatedAt: Date.now(),
  });
}

function startWebSocketHeartbeat() {
  if (wsHeartbeat) return wsHeartbeat;
  wsHeartbeat = setInterval(() => {
    wsClients.forEach(client => {
      if (client.readyState !== 1) {
        wsClients.delete(client);
        return;
      }
      if (!client.isAlive) {
        client.terminate();
        wsClients.delete(client);
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, WEBSOCKET_HEARTBEAT_MS);
  return wsHeartbeat;
}

function stopWebSocketHeartbeat() {
  if (!wsHeartbeat) return;
  clearInterval(wsHeartbeat);
  wsHeartbeat = null;
}

server.on('upgrade', (req, socket, head) => {
  let url;
  try {
    url = parseRequestUrl(req);
  } catch (_error) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return;
  }
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  if (!corsPolicy.allowsWebSocket(req)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  wsServer.handleUpgrade(req, socket, head, ws => {
    attachWebSocketClient(ws, req, url);
  });
});

let roomTicker = null;

function cleanupExpiredRooms(now = Date.now()) {
  const expired = [];
  state.rooms.forEach(room => {
    const lastActivityAt = Number(room.lastActivityAt) || Number(room.createdAt) || now;
    const ageMs = Math.max(0, now - lastActivityAt);
    if (room.status === 'finished' && ageMs >= FINISHED_ROOM_TTL_MS) {
      expired.push(room);
      return;
    }
    if (room.status !== 'lobby') return;
    const studentCount = [...room.players.values()].filter(isClassPlayer).length;
    if (studentCount > 0) return;
    const ttlMs = room.teacherAccountId ? CLOUD_EMPTY_LOBBY_TTL_MS : LOCAL_EMPTY_LOBBY_TTL_MS;
    if (ageMs >= ttlMs) expired.push(room);
  });
  return expired.map(room => closeRoom(room, { reason: 'expired' }));
}

function processRoomTimers(now = Date.now()) {
  cleanupExpiredRooms(now);
  state.rooms.forEach(room => {
    if (room.status === 'paused' && room.pauseRequest?.status === 'pending' && Number(room.pauseRequest.expiresAt) <= now) {
      const request = room.pauseRequest;
      const resumeDurationMs = turnDurationMsForRoom(room);
      const remainingMs = Math.max(1000, Math.min(resumeDurationMs, Number(room.pausedRemainingMs) || resumeDurationMs));
      room.status = 'running';
      room.turnStartedAt = now - (resumeDurationMs - remainingMs);
      room.nextTickAt = now + remainingMs;
      room.pausedRemainingMs = null;
      room.pauseRequest = null;
      if ((room.settings?.tickMode || 'manual') === 'manual') {
        room.teacherState = ensureTeacherState(room.teacherState);
        room.teacherState.phaseLock = 'open';
        room.teacherState.updatedAt = now;
      }
      const requester = room.players.get(request.playerId);
      addRoomLog(room, `Pause request from ${requester?.userName || 'a student'} expired. The match resumed automatically.`);
      touchRoom(room);
      persistRuntimeState();
      broadcastRoomUpdate(room, { source: 'timer', action: 'pause-request-expired' });
      return;
    }
    if (room.status !== 'running') return;
    const tickMode = room.settings?.tickMode || 'manual';
    const durationMs = turnDurationMsForRoom(room);
    if (!room.nextTickAt) room.nextTickAt = now + durationMs;
    if (now < room.nextTickAt) return;

    if (tickMode === 'manual') {
      room.status = 'paused';
      room.pausedRemainingMs = 0;
      room.nextTickAt = null;
      room.teacherState = ensureTeacherState(room.teacherState);
      room.teacherState.phaseLock = 'review';
      room.teacherState.updatedAt = now;
      addRoomLog(room, 'Время хода истекло. Матч поставлен на паузу для всех участников.');
      touchRoom(room);
      persistRuntimeState();
      broadcastRoomUpdate(room, { source: 'timer', action: 'manual-timeout' });
      return;
    }

    advanceRoom(room);
    room.nextTickAt = room.status === 'running' ? Date.now() + durationMs : null;
    touchRoom(room);
    persistRuntimeState();
    broadcastRoomUpdate(room, { source: 'timer', action: 'advance-room' });
  });
}

function startRoomTicker(intervalMs = HEARTBEAT_MS) {
  if (roomTicker) return roomTicker;
  roomTicker = setInterval(() => {
    processRoomTimers(Date.now());
  }, intervalMs);
  return roomTicker;
}

function stopRoomTicker() {
  if (!roomTicker) return;
  clearInterval(roomTicker);
  roomTicker = null;
}

function startServer(port = PORT, host = HOST) {
  startRoomTicker();
  startWebSocketHeartbeat();
  return server.listen(port, host, () => {
    operationalLog('info', 'server-started', {
      host,
      port: Number(port),
      deployment: DEPLOYMENT_MODE,
      appMode: APP_MODE,
      storageBackend: STORAGE_BACKEND,
    });
  });
}

server.on('close', () => {
  stopRoomTicker();
  stopWebSocketHeartbeat();
});

if (require.main === module) {
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      try {
        operationalLog('info', 'server-stopping', { signal });
        flushRuntimeState();
      } finally {
        process.exit(0);
      }
    });
  });
  startServer();
}

module.exports = {
  state,
  server,
  startServer,
  startRoomTicker,
  stopRoomTicker,
  processRoomTimers,
  cleanupExpiredRooms,
  createRoom,
  joinRoom,
  publicRoomDirectory,
  roomStartGate,
  canStartMatch,
  roomSummary,
  playerSummary,
  playerStateSummary,
  handleRoomAction,
  handleServerAdminAction,
  createTeacherAccount,
  loginTeacher,
  createTeacherSession,
  resolveTeacherSessionToken,
  resolveTeacherRequest,
  publicTeacherAccount,
  cloudTeacherOverview,
  handleTeacherAction,
  closeRoom,
  archiveCompletedSession,
  listCompletedSessions,
  getCompletedSession,
  completedSessionCsv,
  persistRuntimeState,
  flushRuntimeState,
  restoreActiveRoomsFromDb,
  getRuntimeMeta,
  requirePlayerSession,
  resolvePlayerSession,
  verifyClientActionEnvelope,
  serverOverview,
  handleBusinessAction,
  advanceRoom,
  saveRoomSnapshot,
  loadRoomSnapshot,
  serializeRoom,
  hydrateRoom,
  migrateRoomSnapshot,
  validateRoomSnapshot,
  createEmptyDb,
  normalizeDb,
  storageInfo,
  readJsonWithRecovery,
  atomicWriteJson,
  loadDbFromDisk,
  persistDbToDisk,
  loadDbFromSqlite,
  persistDbToSqlite,
};
