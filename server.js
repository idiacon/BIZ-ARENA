const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');
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
} = require('./server/game-rules');
const { createApiRouter } = require('./server/http/routes');
const { createRoomActionHandler } = require('./server/room/actions');

const APP_VERSION = require('./package.json').version;
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.BIZ_ARENA_DATA_DIR
  ? path.resolve(process.env.BIZ_ARENA_DATA_DIR)
  : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'biz-arena-db.json');
const DB_BACKUP_PATH = `${DB_PATH}.bak`;
const DB_TEMP_PATH = `${DB_PATH}.tmp`;
const TICK_MS = 4000;
const MAX_LOG = 120;
const MAX_MARKET_HISTORY = 40;
const MAX_AVATAR_LENGTH = 250_000;
const DB_SCHEMA_VERSION = 2;
const ROOM_SNAPSHOT_SCHEMA_VERSION = 2;

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
};

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

const state = {
  rooms: new Map(),
  playerRoomIndex: new Map(),
  db: loadDb(),
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 5; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return state.rooms.has(code) ? roomCode() : code;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyDb() {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    accounts: {},
    savedRooms: {},
  };
}

function ensureSnapshotSettings(settings) {
  const defaults = defaultRoomSettings();
  return {
    ...defaults,
    ...(isPlainObject(settings) ? settings : {}),
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

  const migrated = {
    ...rawSnapshot,
    schemaVersion: Number(rawSnapshot.schemaVersion) || ROOM_SNAPSHOT_SCHEMA_VERSION,
    status: typeof rawSnapshot.status === 'string' ? rawSnapshot.status : 'lobby',
    day: Math.max(1, Number(rawSnapshot.day) || 1),
    tick: Math.max(0, Number(rawSnapshot.tick) || 0),
    winnerPlayerId: rawSnapshot.winnerPlayerId || null,
    log: Array.isArray(rawSnapshot.log) ? rawSnapshot.log : [],
    marketHistory: Array.isArray(rawSnapshot.marketHistory) ? rawSnapshot.marketHistory : [],
    segmentSnapshots: Array.isArray(rawSnapshot.segmentSnapshots) ? rawSnapshot.segmentSnapshots : [],
    settings: ensureSnapshotSettings(rawSnapshot.settings),
    activeEvent: isPlainObject(rawSnapshot.activeEvent) ? rawSnapshot.activeEvent : null,
    contractBoard: Array.isArray(rawSnapshot.contractBoard) ? rawSnapshot.contractBoard : [],
    lastSavedAt: rawSnapshot.lastSavedAt || null,
    players: Array.isArray(rawSnapshot.players) ? rawSnapshot.players : [],
  };

  validateRoomSnapshot(migrated);
  migrated.schemaVersion = ROOM_SNAPSHOT_SCHEMA_VERSION;
  return migrated;
}

function migrateSavedRoomEntry(entry) {
  if (!isPlainObject(entry)) return null;

  const migrated = {
    meta: isPlainObject(entry.meta) ? { ...entry.meta } : {},
    snapshot: migrateRoomSnapshot(entry.snapshot),
  };

  if (entry.previousSnapshot) {
    migrated.previousSnapshot = migrateRoomSnapshot(entry.previousSnapshot);
  }

  migrated.meta.schemaVersion = ROOM_SNAPSHOT_SCHEMA_VERSION;
  return migrated;
}

function normalizeDb(raw) {
  if (!isPlainObject(raw)) throw new Error('DB root must be an object');

  const normalized = {
    schemaVersion: Number(raw.schemaVersion) || DB_SCHEMA_VERSION,
    accounts: isPlainObject(raw.accounts) ? raw.accounts : {},
    savedRooms: {},
  };

  Object.entries(isPlainObject(raw.savedRooms) ? raw.savedRooms : {}).forEach(([roomCodeKey, entry]) => {
    const migrated = migrateSavedRoomEntry(entry);
    if (migrated) normalized.savedRooms[roomCodeKey] = migrated;
  });

  normalized.schemaVersion = DB_SCHEMA_VERSION;
  return normalized;
}

function atomicWriteJson(filePath, payload, { backupPath = `${filePath}.bak`, tempPath = `${filePath}.tmp` } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    fs.unlinkSync(filePath);
  }
  fs.renameSync(tempPath, filePath);
}

function readJsonWithRecovery(filePath, { backupPath = `${filePath}.bak` } = {}) {
  const candidates = [
    { path: filePath, recoveredFromBackup: false },
    { path: backupPath, recoveredFromBackup: true },
  ];

  let lastError = null;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.path)) continue;
    try {
      return {
        raw: JSON.parse(fs.readFileSync(candidate.path, 'utf8')),
        recoveredFromBackup: candidate.recoveredFromBackup,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return null;
}

function loadDbFromDisk(filePath = DB_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const loaded = readJsonWithRecovery(filePath, { backupPath: `${filePath}.bak` });
  if (!loaded) {
    const initial = createEmptyDb();
    atomicWriteJson(filePath, initial, { backupPath: `${filePath}.bak`, tempPath: `${filePath}.tmp` });
    return initial;
  }

  const normalized = normalizeDb(loaded.raw);
  if (loaded.recoveredFromBackup) {
    atomicWriteJson(filePath, normalized, { backupPath: `${filePath}.bak`, tempPath: `${filePath}.tmp` });
  }
  return normalized;
}

function persistDbToDisk(db, filePath = DB_PATH) {
  const normalized = normalizeDb(db);
  atomicWriteJson(filePath, normalized, { backupPath: `${filePath}.bak`, tempPath: `${filePath}.tmp` });
  return normalized;
}

function safeName(input, fallback = 'РРіСЂРѕРє') {
  return String(input || fallback).trim().slice(0, 24) || fallback;
}

function sanitizeAvatar(avatar) {
  if (typeof avatar !== 'string') return '';
  if (!avatar.startsWith('data:image/')) return '';
  return avatar.slice(0, MAX_AVATAR_LENGTH);
}

function normalizeAccountKey(userName) {
  return safeName(userName, 'Player').toLowerCase().replace(/\s+/g, '-');
}

function loadDb() {
  try {
    return loadDbFromDisk(DB_PATH);
  } catch (error) {
    return createEmptyDb();
  }
}

function persistDb() {
  state.db = persistDbToDisk(state.db, DB_PATH);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
  return {
    version: APP_VERSION,
    desktopShell: process.env.BIZ_ARENA_DESKTOP === '1',
    port,
    localUrls: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
    lanUrls: detectLanUrls(port),
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
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
    lastCompany: account.lastCompany || 'вЂ”',
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

function createPlayer(companyName, { userName, avatar, isBot = false } = {}) {
  return {
    id: uid(isBot ? 'bot' : 'player'),
    name: safeName(companyName, isBot ? 'Bot Corp' : 'Company'),
    userName: safeName(userName, isBot ? 'AI Manager' : 'Player'),
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
    seasonGoal: null,
    price: 140,
    salary: 110,
    supplyLevel: 1,
    productKey: 'food',
    cityKey: 'regional',
    focusProductKey: 'food',
    focusCityKey: 'regional',
    lastAction: 'РљРѕРјРїР°РЅРёСЏ СЃРѕР·РґР°РЅР°',
    bankrupt: false,
    isBot,
    ready: isBot,
    createdAt: Date.now(),
  };
}

function defaultRoomSettings() {
  return {
    maxPlayers: 8,
    demandProfile: 'standard',
    scenarioKey: 'standard',
    dayLimit: 14,
  };
}

function createRoom({ roomName, companyName, userName, avatar, scenarioKey }) {
  const code = roomCode();
  const host = createPlayer(companyName, { userName, avatar });
  const settings = defaultRoomSettings();
  if (SCENARIOS[scenarioKey]) settings.scenarioKey = scenarioKey;
  updateAccountPresence(host.userName, host.name, settings.scenarioKey);
  host.seasonGoal = createSeasonGoal();
  const room = {
    code,
    name: safeName(roomName, `РљРѕРјРЅР°С‚Р° ${code}`),
    hostPlayerId: host.id,
    status: 'lobby',
    day: 1,
    tick: 0,
    players: new Map([[host.id, host]]),
    log: ['РљРѕРјРЅР°С‚Р° СЃРѕР·РґР°РЅР°. РџРѕРґРєР»СЋС‡Р°Р№С‚Рµ РґСЂСѓР·РµР№ Рё Р·Р°РїСѓСЃРєР°Р№С‚Рµ РјР°С‚С‡.'],
    marketHistory: [],
    segmentSnapshots: [],
    settings,
    activeEvent: null,
    contractBoard: [],
    lastSavedAt: null,
  };
  state.rooms.set(code, room);
  state.playerRoomIndex.set(host.id, code);
  addRoomLog(room, `${host.userName} СЃРѕР·РґР°Р» РєРѕРјРЅР°С‚Сѓ ${room.name} РґР»СЏ РєРѕРјРїР°РЅРёРё ${host.name}.`);
  return { room, player: host };
}

function getRoomByPlayerId(playerId) {
  const code = state.playerRoomIndex.get(playerId);
  if (!code) throw Object.assign(new Error('РЎРµСЃСЃРёСЏ РёРіСЂРѕРєР° РЅРµ РЅР°Р№РґРµРЅР°'), { status: 404 });
  const room = state.rooms.get(code);
  if (!room) throw Object.assign(new Error('РљРѕРјРЅР°С‚Р° РЅРµ РЅР°Р№РґРµРЅР°'), { status: 404 });
  return room;
}

function getPlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) throw Object.assign(new Error('РРіСЂРѕРє РЅРµ РЅР°Р№РґРµРЅ'), { status: 404 });
  return player;
}

function requireFunds(player, amount) {
  if (player.money < amount) throw Object.assign(new Error('РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЃСЂРµРґСЃС‚РІ'), { status: 400 });
}

function ensureNotBankrupt(player) {
  if (player.bankrupt) throw Object.assign(new Error('РљРѕРјРїР°РЅРёСЏ РѕР±Р°РЅРєСЂРѕС‚РёР»Р°СЃСЊ. РЎРѕР·РґР°Р№С‚Рµ РЅРѕРІСѓСЋ СЃРµСЃСЃРёСЋ.'), { status: 400 });
}

function ensureHost(room, playerId) {
  if (room.hostPlayerId !== playerId) throw Object.assign(new Error('РўРѕР»СЊРєРѕ С…РѕСЃС‚ РєРѕРјРЅР°С‚С‹ РјРѕР¶РµС‚ РІС‹РїРѕР»РЅСЏС‚СЊ СЌС‚Рѕ РґРµР№СЃС‚РІРёРµ'), { status: 403 });
}

function ensureLobby(room) {
  if (room.status !== 'lobby') throw Object.assign(new Error('Р”РµР№СЃС‚РІРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РІ Р»РѕР±Р±Рё'), { status: 400 });
}

function ensureLoadable(room) {
  if (!['lobby', 'paused', 'finished'].includes(room.status)) {
    throw Object.assign(new Error('Р—Р°РіСЂСѓР·РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ РёР· Р»РѕР±Р±Рё, РїР°СѓР·С‹ РёР»Рё РїРѕСЃР»Рµ РјР°С‚С‡Р°'), { status: 400 });
  }
}

function playerAssets(player) {
  return player.factories * 45000 + player.stores * 30000 + player.staff * 2500 + player.productStock * 70 + player.rawStock * 30 + player.innovation * 9000;
}

function productLabel(productKey) {
  return PRODUCTS[productKey]?.label || productKey;
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
  if ((room.settings.dayLimit - room.day) <= 2) alerts.push('season_ending');
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
  const scenario = SCENARIOS[room.settings.scenarioKey] || SCENARIOS.standard;
  return buildForecastSegments({
    cities: Object.entries(CITIES).map(([key, city]) => ({ key, label: city.label, ...city })),
    products: Object.entries(PRODUCTS).map(([key, product]) => ({ key, label: product.label, ...product })),
    scenario,
    demandProfileKey: room.settings.demandProfile,
    activeEvent: room.activeEvent,
  });
}


function playerSummary(room, player, viewerId, forecastSegments = roomForecast(room)) {
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
  const focusPlan = buildFocusPlan({
    player,
    focusCityKey: player.focusCityKey || player.cityKey,
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
    price: player.price,
    salary: player.salary,
    supplyLevel: player.supplyLevel,
    productKey: player.productKey,
    productLabel: productLabel(player.productKey),
    cityKey: player.cityKey,
    cityLabel: cityLabel(player.cityKey),
    focusCityKey: player.focusCityKey || player.cityKey,
    focusCityLabel: cityLabel(player.focusCityKey || player.cityKey),
    focusProductKey: player.focusProductKey || player.productKey,
    focusProductLabel: productLabel(player.focusProductKey || player.productKey),
    focusPlan,
    pivotPreview,
    executionPlan,
    netWorth: Math.round(player.money + playerAssets(player) - player.debt),
    lastAction: player.lastAction,
    bankrupt: player.bankrupt,
    isBot: player.isBot,
    ready: Boolean(player.ready),
    isHost: room.hostPlayerId === player.id,
    isViewer: viewerId === player.id,
  };
}

function roomSummary(room, viewerId) {
  const forecastSegments = roomForecast(room);
  const players = [...room.players.values()].map(player => playerSummary(room, player, viewerId, forecastSegments));
  const leaderboard = [...players].sort((a, b) => b.netWorth - a.netWorth);
  const saveMeta = state.db.savedRooms[room.code]?.meta || null;
  return {
    code: room.code,
    name: room.name,
    status: room.status,
    day: room.day,
    tick: room.tick,
    settings: room.settings,
    scenarioLabel: scenarioLabel(room.settings.scenarioKey),
    hostPlayerId: room.hostPlayerId,
    winnerPlayerId: room.winnerPlayerId || null,
    playerCount: players.filter(player => !player.bankrupt).length,
    readyCount: players.filter(player => player.ready && !player.isBot).length,
    humanCount: players.filter(player => !player.isBot).length,
    allReady: players.filter(player => !player.isBot).every(player => player.ready),
    players,
    leaderboard,
    market: room.marketHistory.slice(-12),
    segments: room.segmentSnapshots.slice(0, 6),
    log: room.log.slice(0, 18),
    productCatalog: Object.keys(PRODUCTS).map(key => ({ key, label: PRODUCTS[key].label })),
    cityCatalog: Object.keys(CITIES).map(key => ({ key, label: CITIES[key].label })),
    scenarioCatalog: Object.keys(SCENARIOS).map(key => ({ key, label: SCENARIOS[key].label, description: SCENARIOS[key].description })),
    specializationCatalog: Object.keys(SPECIALIZATIONS).map(key => ({ key, label: SPECIALIZATIONS[key].label, description: SPECIALIZATIONS[key].description })),
    researchCatalog: Object.keys(RESEARCH_PROJECTS).map(key => ({ key, label: RESEARCH_PROJECTS[key].label, cost: RESEARCH_PROJECTS[key].cost, description: RESEARCH_PROJECTS[key].description })),
    boardPolicyCatalog: Object.keys(BOARD_POLICIES).map(key => ({ key, label: BOARD_POLICIES[key].label })),
    strategyCatalog: Object.keys(OPERATING_PLANS).map(key => ({ key, label: OPERATING_PLANS[key].label, description: OPERATING_PLANS[key].description })),
    forecastSegments,
    activeEvent: room.activeEvent,
    contractBoard: room.contractBoard || [],
    saveMeta,
    lastSavedAt: room.lastSavedAt,
  };
}

function joinRoom({ roomCode: requestedCode, companyName, userName, avatar }) {
  const code = String(requestedCode || '').trim().toUpperCase();
  const room = state.rooms.get(code);
  if (!room) throw Object.assign(new Error('РљРѕРјРЅР°С‚Р° РЅРµ РЅР°Р№РґРµРЅР°'), { status: 404 });
  if (room.players.size >= room.settings.maxPlayers) throw Object.assign(new Error('РљРѕРјРЅР°С‚Р° Р·Р°РїРѕР»РЅРµРЅР°'), { status: 400 });
  const player = createPlayer(companyName, { userName, avatar });
  player.seasonGoal = createSeasonGoal();
  updateAccountPresence(player.userName, player.name, room.settings.scenarioKey);
  room.players.set(player.id, player);
  state.playerRoomIndex.set(player.id, room.code);
  addRoomLog(room, `${player.userName} РїСЂРёСЃРѕРµРґРёРЅРёР»СЃСЏ СЃ РєРѕРјРїР°РЅРёРµР№ ${player.name}.`);
  return { room, player };
}

function removePlayer(playerId) {
  const room = getRoomByPlayerId(playerId);
  const player = getPlayer(room, playerId);
  room.players.delete(playerId);
  state.playerRoomIndex.delete(playerId);
  addRoomLog(room, `${player.userName} РїРѕРєРёРЅСѓР» РєРѕРјРЅР°С‚Сѓ.`);

  if (room.hostPlayerId === playerId) {
    const nextPlayer = [...room.players.values()][0];
    room.hostPlayerId = nextPlayer ? nextPlayer.id : null;
    if (nextPlayer) addRoomLog(room, `${nextPlayer.userName} СЃС‚Р°Р» РЅРѕРІС‹Рј С…РѕСЃС‚РѕРј.`);
  }
  if (room.players.size === 0) state.rooms.delete(room.code);
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
  if (!project) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅРѕРµ РёСЃСЃР»РµРґРѕРІР°РЅРёРµ'), { status: 400 });
  if (player.research.completed.includes(key)) throw Object.assign(new Error('Р­С‚Рѕ РёСЃСЃР»РµРґРѕРІР°РЅРёРµ СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅРѕ'), { status: 400 });
  player.research.activeKey = key;
  player.research.progress = 0;
  player.lastAction = `Р—Р°РїСѓС‰РµРЅРѕ РёСЃСЃР»РµРґРѕРІР°РЅРёРµ: ${project.label}`;
  addRoomLog(room, `${player.name} РЅР°С‡Р°Р» РёСЃСЃР»РµРґРѕРІР°РЅРёРµ ${project.label}.`);
}

function handleBusinessAction(room, player, body) {
  ensureNotBankrupt(player);
  const action = body.action;

  switch (action) {
    case 'set-price': {
      player.price = Math.round(clamp(Number(body.value) || 0, 60, 260));
      player.lastAction = `Р¦РµРЅР° СѓСЃС‚Р°РЅРѕРІР»РµРЅР° РЅР° ${player.price}`;
      addRoomLog(room, `${player.userName} СЃРјРµРЅРёР» С†РµРЅСѓ РєРѕРјРїР°РЅРёРё ${player.name} РЅР° ${player.price}.`);
      return;
    }
    case 'set-product': {
      const value = String(body.value || 'food');
      if (!PRODUCTS[value]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅР°СЏ РєР°С‚РµРіРѕСЂРёСЏ С‚РѕРІР°СЂР°'), { status: 400 });
      player.productKey = value;
      player.lastAction = `Р¤РѕРєСѓСЃ РїСЂРѕРґСѓРєС‚Р°: ${productLabel(value)}`;
      addRoomLog(room, `${player.name} РїРµСЂРµРєР»СЋС‡РёР»СЃСЏ РЅР° С‚РѕРІР°СЂ ${productLabel(value)}.`);
      return;
    }
    case 'set-city': {
      const value = String(body.value || 'regional');
      if (!CITIES[value]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЂС‹РЅРѕРє'), { status: 400 });
      player.cityKey = value;
      player.lastAction = `РћСЃРЅРѕРІРЅРѕР№ СЂС‹РЅРѕРє: ${cityLabel(value)}`;
      addRoomLog(room, `${player.name} РІС‹С€РµР» РЅР° СЂС‹РЅРѕРє ${cityLabel(value)}.`);
      return;
    }
    case 'set-focus-segment': {
      const cityKey = String(body.value?.cityKey || player.focusCityKey || player.cityKey);
      const productKey = String(body.value?.productKey || player.focusProductKey || player.productKey);
      if (!CITIES[cityKey]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅС‹Р№ С†РµР»РµРІРѕР№ СЂС‹РЅРѕРє'), { status: 400 });
      if (!PRODUCTS[productKey]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅС‹Р№ С†РµР»РµРІРѕР№ С‚РѕРІР°СЂ'), { status: 400 });
      player.focusCityKey = cityKey;
      player.focusProductKey = productKey;
      player.lastAction = `Р¤РѕРєСѓСЃ-РїР»Р°РЅ: ${cityLabel(cityKey)} вЂў ${productLabel(productKey)}`;
      addRoomLog(room, `${player.name} РѕР±РЅРѕРІРёР» С†РµР»РµРІРѕР№ СЃРµРіРјРµРЅС‚ РЅР° ${cityLabel(cityKey)} вЂў ${productLabel(productKey)}.`);
      return;
    }
    case 'set-specialization': {
      const value = String(body.value || 'balanced');
      if (!SPECIALIZATIONS[value]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅР°СЏ СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏ'), { status: 400 });
      player.specializationKey = value;
      player.lastAction = `РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ: ${specializationLabel(value)}`;
      addRoomLog(room, `${player.name} РІС‹Р±СЂР°Р» СЃРїРµС†РёР°Р»РёР·Р°С†РёСЋ ${specializationLabel(value)}.`);
      return;
    }
    case 'set-board-policy': {
      const value = String(body.value || 'balanced');
      if (!BOARD_POLICIES[value]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅР°СЏ РїРѕР»РёС‚РёРєР° СЃРѕРІРµС‚Р°'), { status: 400 });
      player.boardPolicyKey = value;
      player.lastAction = `РџРѕР»РёС‚РёРєР° СЃРѕРІРµС‚Р°: ${boardPolicyLabel(value)}`;
      addRoomLog(room, `${player.name} РїРµСЂРµРєР»СЋС‡РёР» РїРѕР»РёС‚РёРєСѓ СЃРѕРІРµС‚Р° РЅР° ${boardPolicyLabel(value)}.`);
      return;
    }
    case 'set-strategy': {
      const value = String(body.value || 'balanced');
      if (!OPERATING_PLANS[value]) throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅС‹Р№ РѕРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РїР»Р°РЅ'), { status: 400 });
      player.strategyKey = value;
      player.lastAction = `РћРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РїР»Р°РЅ: ${strategyLabel(value)}`;
      addRoomLog(room, `${player.name} РІРєР»СЋС‡РёР» РѕРїРµСЂР°С†РёРѕРЅРЅС‹Р№ РїР»Р°РЅ ${strategyLabel(value)}.`);
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
      player.lastAction = `Р—Р°РєСѓРїР»РµРЅРѕ СЃС‹СЂСЊСЏ: ${quantity}`;
      addRoomLog(room, `${player.name} Р·Р°РєСѓРїРёР» ${quantity} РµРґ. СЃС‹СЂСЊСЏ.`);
      return;
    }
    case 'upgrade-supply': {
      const cost = 14000 + player.supplyLevel * 10000;
      requireFunds(player, cost);
      player.money -= cost;
      player.supplyLevel = clamp(player.supplyLevel + 1, 1, 5);
      player.lastAction = 'РЈР»СѓС‡С€РµРЅР° С†РµРїРѕС‡РєР° РїРѕСЃС‚Р°РІРѕРє';
      addRoomLog(room, `${player.name} СѓР»СѓС‡С€РёР» Р»РѕРіРёСЃС‚РёРєСѓ РїРѕСЃС‚Р°РІРѕРє.`);
      return;
    }
    case 'raise-salary': {
      player.salary = clamp(player.salary + 10, 80, 260);
      player.lastAction = `Р—Р°СЂРїР»Р°С‚Р° РїРѕРІС‹С€РµРЅР° РґРѕ ${player.salary}`;
      addRoomLog(room, `${player.name} РїРѕРґРЅСЏР» Р·Р°СЂРїР»Р°С‚С‹ РґРѕ ${player.salary}.`);
      return;
    }
    case 'cut-salary': {
      player.salary = clamp(player.salary - 10, 80, 260);
      player.lastAction = `Р—Р°СЂРїР»Р°С‚Р° СЃРЅРёР¶РµРЅР° РґРѕ ${player.salary}`;
      addRoomLog(room, `${player.name} СЃРЅРёР·РёР» Р·Р°СЂРїР»Р°С‚С‹ РґРѕ ${player.salary}.`);
      return;
    }
    case 'hire': {
      const amount = clamp(Number(body.value) || 1, 1, 25);
      const cost = amount * 1400;
      requireFunds(player, cost);
      player.money -= cost;
      player.staff += amount;
      player.lastAction = `РќР°РЅСЏС‚Рѕ ${amount} СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ`;
      addRoomLog(room, `${player.name} РЅР°РЅСЏР» ${amount} СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.`);
      return;
    }
    case 'fire': {
      const amount = clamp(Number(body.value) || 1, 1, player.staff);
      player.staff = Math.max(1, player.staff - amount);
      player.lastAction = `РЎРѕРєСЂР°С‰РµРЅРѕ ${amount} СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ`;
      addRoomLog(room, `${player.name} СЃРѕРєСЂР°С‚РёР» ${amount} СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.`);
      return;
    }
    case 'build-factory': {
      const cost = 42000 + player.factories * 7000;
      requireFunds(player, cost);
      player.money -= cost;
      player.factories += 1;
      player.lastAction = 'РџРѕСЃС‚СЂРѕРµРЅР° С„Р°Р±СЂРёРєР°';
      addRoomLog(room, `${player.name} РїРѕСЃС‚СЂРѕРёР» С„Р°Р±СЂРёРєСѓ.`);
      return;
    }
    case 'build-store': {
      const cost = 28000 + player.stores * 6000;
      requireFunds(player, cost);
      player.money -= cost;
      player.stores += 1;
      player.lastAction = 'РћС‚РєСЂС‹С‚ РјР°РіР°Р·РёРЅ';
      addRoomLog(room, `${player.name} РѕС‚РєСЂС‹Р» РЅРѕРІС‹Р№ РјР°РіР°Р·РёРЅ.`);
      return;
    }
    case 'upgrade-quality': {
      const cost = 18000 + player.quality * 12000;
      requireFunds(player, cost);
      player.money -= cost;
      player.quality = clamp(player.quality + 1, 1, 6);
      player.lastAction = 'РџРѕРІС‹С€РµРЅРѕ РєР°С‡РµСЃС‚РІРѕ РїСЂРѕРґСѓРєС†РёРё';
      addRoomLog(room, `${player.name} СѓР»СѓС‡С€РёР» РєР°С‡РµСЃС‚РІРѕ РїСЂРѕРґСѓРєС†РёРё.`);
      return;
    }
    case 'automation': {
      const cost = 26000 + player.automation * 14000;
      requireFunds(player, cost);
      player.money -= cost;
      player.automation = clamp(player.automation + 1, 0, 5);
      player.lastAction = 'Р’РЅРµРґСЂРµРЅР° Р°РІС‚РѕРјР°С‚РёР·Р°С†РёСЏ';
      addRoomLog(room, `${player.name} РІРЅРµРґСЂРёР» Р°РІС‚РѕРјР°С‚РёР·Р°С†РёСЋ.`);
      return;
    }
    case 'marketing': {
      const cost = 12000 + player.marketing * 5000;
      requireFunds(player, cost);
      player.money -= cost;
      player.marketing = clamp(player.marketing + 1, 1, 7);
      player.lastAction = 'Р—Р°РїСѓС‰РµРЅР° РјР°СЂРєРµС‚РёРЅРіРѕРІР°СЏ РєР°РјРїР°РЅРёСЏ';
      addRoomLog(room, `${player.name} СѓСЃРёР»РёР» РјР°СЂРєРµС‚РёРЅРі.`);
      return;
    }
    case 'take-loan': {
      const amount = clamp(Number(body.value) || 20000, 10000, 120000);
      player.money += amount;
      player.debt += Math.round(amount * 1.08);
      player.lastAction = `РџРѕР»СѓС‡РµРЅ РєСЂРµРґРёС‚ ${amount}`;
      addRoomLog(room, `${player.name} РїСЂРёРІР»РµРє РєСЂРµРґРёС‚ РЅР° ${amount}.`);
      return;
    }
    case 'repay-loan': {
      const amount = clamp(Number(body.value) || 10000, 5000, player.debt);
      requireFunds(player, amount);
      player.money -= amount;
      player.debt = Math.max(0, player.debt - amount);
      player.lastAction = `РџРѕРіР°С€РµРЅ РєСЂРµРґРёС‚ РЅР° ${amount}`;
      addRoomLog(room, `${player.name} РїРѕРіР°СЃРёР» РєСЂРµРґРёС‚ РЅР° ${amount}.`);
      return;
    }
    default:
      throw Object.assign(new Error('РќРµРёР·РІРµСЃС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ'), { status: 400 });
  }
}

function addBot(room) {
  const baseNames = ['Nordex', 'DeltaCore', 'UrbanFox', 'CapitalMint', 'NovaMart', 'SteelBird'];
  const company = `${baseNames[Math.floor(Math.random() * baseNames.length)]}-${Math.floor(Math.random() * 90 + 10)}`;
  const bot = createPlayer(company, { userName: 'AI Manager', isBot: true });
  bot.productKey = ['food', 'electronics', 'furniture', 'pharma'][Math.floor(Math.random() * 4)];
  bot.cityKey = ['capital', 'regional', 'industrial', 'coastal'][Math.floor(Math.random() * 4)];
  bot.specializationKey = ['balanced', 'cost', 'premium', 'logistics'][Math.floor(Math.random() * 4)];
  bot.strategyKey = ['balanced', 'growth', 'efficiency', 'contracts', 'innovation'][Math.floor(Math.random() * 5)];
  room.players.set(bot.id, bot);
  state.playerRoomIndex.set(bot.id, room.code);
  addRoomLog(room, `${bot.name} РІРѕС€С‘Р» РєР°Рє РР-РєРѕРЅРєСѓСЂРµРЅС‚.`);
}

function resetRoom(room) {
  const existing = [...room.players.values()];
  room.day = 1;
  room.tick = 0;
  room.status = 'lobby';
  room.winnerPlayerId = null;
  room.marketHistory = [];
  room.segmentSnapshots = [];
  room.activeEvent = null;
  room.contractBoard = [];
  room.log = ['РњР°С‚С‡ СЃР±СЂРѕС€РµРЅ. РџРѕРґРіРѕС‚РѕРІСЊС‚Рµ СЃС‚СЂР°С‚РµРіРёРё Рё Р·Р°РїСѓСЃРєР°Р№С‚Рµ Р·Р°РЅРѕРІРѕ.'];
  room.players = new Map();

  existing.forEach(existingPlayer => {
    const fresh = createPlayer(existingPlayer.name, {
      userName: existingPlayer.userName,
      avatar: existingPlayer.avatar,
      isBot: existingPlayer.isBot,
    });
    fresh.id = existingPlayer.id;
    fresh.ready = existingPlayer.isBot;
    fresh.specializationKey = existingPlayer.specializationKey || 'balanced';
    fresh.boardPolicyKey = existingPlayer.boardPolicyKey || 'balanced';
    fresh.seasonGoal = createSeasonGoal(existingPlayer.seasonGoal?.key);
    room.players.set(fresh.id, fresh);
    state.playerRoomIndex.set(fresh.id, room.code);
  });

  if (!room.players.has(room.hostPlayerId)) room.hostPlayerId = [...room.players.keys()][0] || null;
}

function updateRoomSettings(room, body) {
  const maxPlayers = clamp(Number(body.maxPlayers) || room.settings.maxPlayers, 2, 8);
  const demandProfile = ['standard', 'aggressive', 'lean'].includes(body.demandProfile) ? body.demandProfile : room.settings.demandProfile;
  const scenarioKey = SCENARIOS[body.scenarioKey] ? body.scenarioKey : room.settings.scenarioKey;
  const dayLimit = clamp(Number(body.dayLimit) || room.settings.dayLimit, 10, 24);
  room.settings.maxPlayers = maxPlayers;
  room.settings.demandProfile = demandProfile;
  room.settings.scenarioKey = scenarioKey;
  room.settings.dayLimit = dayLimit;
}

function canStartMatch(room) {
  const humans = [...room.players.values()].filter(player => !player.isBot);
  return humans.length > 0 && humans.every(player => player.ready);
}

function finalizeAccounts(room, winner) {
  room.players.forEach(player => {
    if (player.isBot) return;
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

function finishRoom(room, winner) {
  room.status = 'finished';
  room.winnerPlayerId = winner?.id || null;
  finalizeAccounts(room, winner || null);
  addRoomLog(room, winner ? `${winner.userName} РїРѕР±РµРґРёР» РІ РјР°С‚С‡Рµ.` : 'РњР°С‚С‡ Р·Р°РІРµСЂС€С‘РЅ Р±РµР· РїРѕР±РµРґРёС‚РµР»СЏ.');
}

function serializeRoom(room) {
  return JSON.parse(JSON.stringify({
    schemaVersion: ROOM_SNAPSHOT_SCHEMA_VERSION,
    code: room.code,
    name: room.name,
    hostPlayerId: room.hostPlayerId,
    status: room.status,
    day: room.day,
    tick: room.tick,
    winnerPlayerId: room.winnerPlayerId || null,
    log: room.log,
    marketHistory: room.marketHistory,
    segmentSnapshots: room.segmentSnapshots,
    settings: room.settings,
    activeEvent: room.activeEvent,
    contractBoard: room.contractBoard,
    lastSavedAt: room.lastSavedAt,
    players: [...room.players.values()],
  }));
}

function hydrateRoom(snapshot) {
  const normalizedSnapshot = migrateRoomSnapshot(snapshot);
  return {
    ...normalizedSnapshot,
    settings: ensureSnapshotSettings(normalizedSnapshot.settings),
    players: new Map((normalizedSnapshot.players || []).map(player => [player.id, {
      ...createPlayer(player.name, { userName: player.userName, avatar: player.avatar, isBot: player.isBot }),
      ...player,
      research: {
        activeKey: player.research?.activeKey || '',
        progress: player.research?.progress || 0,
        completed: [...(player.research?.completed || [])],
      },
    }])),
  };
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
  persistDb();
}

function loadRoomSnapshot(room) {
  const entry = state.db.savedRooms[room.code];
  if (!entry) throw Object.assign(new Error('Р”Р»СЏ СЌС‚РѕР№ РєРѕРјРЅР°С‚С‹ РЅРµС‚ СЃРѕС…СЂР°РЅРµРЅРёСЏ'), { status: 404 });
  let snapshot = null;
  try {
    snapshot = migrateRoomSnapshot(entry.snapshot);
  } catch (primaryError) {
    if (!entry.previousSnapshot) throw primaryError;
    snapshot = migrateRoomSnapshot(entry.previousSnapshot);
  }
  const hydrated = hydrateRoom(snapshot);
  state.rooms.set(room.code, hydrated);
  hydrated.players.forEach(player => {
    state.playerRoomIndex.set(player.id, hydrated.code);
  });
  return hydrated;
}


function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateActiveEvent(room) {
  const eventKey = randomItem(Object.keys(EVENT_TEMPLATES));
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
    title: `${productLabelForKey(productKey)} вЂў ${cityLabelForKey(cityKey)}`,
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

function refreshWorldState(room) {
  if (room.activeEvent && room.day > room.activeEvent.expiresDay) room.activeEvent = null;
  if (!room.activeEvent && room.day >= 3 && room.day % 3 === 0) {
    room.activeEvent = generateActiveEvent(room);
    addRoomLog(room, `РќР° СЂС‹РЅРєРµ РЅР°С‡Р°Р»РѕСЃСЊ СЃРѕР±С‹С‚РёРµ: ${room.activeEvent.title}.`);
  }
  if (room.tick === 1 || room.day % 4 === 0) refreshContracts(room, true);
  else refreshContracts(room, false);
}


function completeAchievement(account, key) {
  if (ACHIEVEMENTS[key]) account.achievements[key] = true;
}

function acceptContract(room, player, contractId) {
  if (room.status !== 'running') throw Object.assign(new Error('РљРѕРЅС‚СЂР°РєС‚С‹ РґРѕСЃС‚СѓРїРЅС‹ С‚РѕР»СЊРєРѕ РІРѕ РІСЂРµРјСЏ РјР°С‚С‡Р°'), { status: 400 });
  if (player.activeContract) throw Object.assign(new Error('РЎРЅР°С‡Р°Р»Р° Р·Р°РІРµСЂС€РёС‚Рµ РёР»Рё РїРѕС‚РµСЂСЏР№С‚Рµ С‚РµРєСѓС‰РёР№ РєРѕРЅС‚СЂР°РєС‚'), { status: 400 });
  const contract = (room.contractBoard || []).find(item => item.id === contractId && !item.assignedPlayerId && !item.completed);
  if (!contract) throw Object.assign(new Error('РљРѕРЅС‚СЂР°РєС‚ РЅРµРґРѕСЃС‚СѓРїРµРЅ'), { status: 404 });
  contract.assignedPlayerId = player.id;
  contract.assignedPlayerName = player.userName;
  player.activeContract = { ...contract };
  player.lastAction = `РџСЂРёРЅСЏС‚ РєРѕРЅС‚СЂР°РєС‚ ${contract.title}`;
  addRoomLog(room, `${player.name} РІР·СЏР» РєРѕРЅС‚СЂР°РєС‚ ${contract.title}.`);
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
    player.lastAction = `РљРѕРЅС‚СЂР°РєС‚ РІС‹РїРѕР»РЅРµРЅ: ${contract.title}`;
    if (boardEntry) boardEntry.completed = true;
    addRoomLog(room, `${player.name} РІС‹РїРѕР»РЅРёР» РєРѕРЅС‚СЂР°РєС‚ ${contract.title} Рё РїРѕР»СѓС‡РёР» ${Math.round(contract.reward * policy.contractRewardMultiplier)}.`);
    player.activeContract = null;
  }
}

function expirePlayerContract(room, player) {
  if (!player.activeContract) return;
  if (player.activeContract.expiresDay < room.day) {
    addRoomLog(room, `${player.name} РїРѕС‚РµСЂСЏР» РєРѕРЅС‚СЂР°РєС‚ ${player.activeContract.title}.`);
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
    addRoomLog(room, `${player.name} РІС‹РїРѕР»РЅРёР» СЃРµР·РѕРЅРЅСѓСЋ С†РµР»СЊ ${player.seasonGoal.label}.`);
  }
}

const handleRoomAction = createRoomActionHandler({
  ensureLobby,
  ensureHost,
  canStartMatch,
  refreshContracts,
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
});

function botTurn(room, bot) {
  if (bot.bankrupt || room.status !== 'running') return;
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
    addRoomLog(room, `${player.name} Р·Р°РІРµСЂС€РёР» РёСЃСЃР»РµРґРѕРІР°РЅРёРµ ${project.label}.`);
    const account = ensureAccount(player.userName);
    account.completedResearch[activeKey] = true;
    account.lastActiveAt = Date.now();
    persistDb();
  }
}

function applyOperatingPlan(room, player) {
  if (player.bankrupt || player.isBot) return;
  const action = pickOperatingPlanAction({
    player,
    availableResearchKeys: Object.keys(RESEARCH_PROJECTS).filter(key => !player.research.completed.includes(key)),
    availableContracts: room.contractBoard || [],
  });
  if (!action) return;
  try {
    handleBusinessAction(room, player, action);
    player.lastAction = `РђРІС‚РѕРїР»Р°РЅ: ${player.lastAction}`;
  } catch {
    // РђРІС‚РѕРїР»Р°РЅ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РјСЏРіРєРёРј Рё РЅРµ РѕСЃС‚Р°РЅР°РІР»РёРІР°С‚СЊ РёРіСЂРѕРІРѕР№ С‚РёРє.
  }
}

function advanceRoom(room) {
  if (room.status !== 'running') return;

  room.tick += 1;
  room.day += 1;
  refreshWorldState(room);

  const activePlayers = [...room.players.values()].filter(player => !player.bankrupt);
  activePlayers.forEach(player => expirePlayerContract(room, player));
  activePlayers.forEach(player => applyOperatingPlan(room, player));
  activePlayers.filter(player => player.isBot).forEach(player => botTurn(room, player));
  if (activePlayers.length === 0) {
    finishRoom(room, null);
    return;
  }

  const scenario = SCENARIOS[room.settings.scenarioKey] || SCENARIOS.standard;
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
    const segmentDemand = Math.round((65 + segmentPlayers.length * 28 + Math.random() * 35) * city.demand * product.demand * demandMultiplier(room.settings.demandProfile) * scenario.demand * eventDemand);
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

      const breakdown = buildFinancialBreakdown({
        player,
        city,
        scenario,
        specialization,
        policy,
        research,
        sold,
      });

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

      if (player.money < -30000 || (player.debt > 150000 && player.money < 1000)) {
        player.bankrupt = true;
        player.lastAction = 'РљРѕРјРїР°РЅРёСЏ РѕР±Р°РЅРєСЂРѕС‚РёР»Р°СЃСЊ';
        addRoomLog(room, `${player.name} РІС‹Р±С‹Р» РёР· РјР°С‚С‡Р° РёР·-Р·Р° Р±Р°РЅРєСЂРѕС‚СЃС‚РІР°.`);
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

  const survivors = [...room.players.values()].filter(player => !player.bankrupt);
  if (survivors.length <= 1) finishRoom(room, survivors[0] || null);
  if (room.status === 'running' && room.day >= room.settings.dayLimit) {
    const winner = [...survivors].sort((a, b) => (b.money + playerAssets(b) - b.debt) - (a.money + playerAssets(a) - a.debt))[0] || null;
    finishRoom(room, winner);
  }
}

function serveStatic(res, pathname) {
  const targetPath = pathname === '/' ? '/index.html' : pathname;
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
  createRoom,
  joinRoom,
  roomSummary,
  playerSummary,
  handleRoomAction,
  serveStatic,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const handled = await routeApiRequest(req, res, url);
    if (handled) return;
    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || 'Server error' });
  }
});

let roomTicker = null;

function startRoomTicker(intervalMs = TICK_MS) {
  if (roomTicker) return roomTicker;
  roomTicker = setInterval(() => {
    state.rooms.forEach(room => advanceRoom(room));
  }, intervalMs);
  return roomTicker;
}

function stopRoomTicker() {
  if (!roomTicker) return;
  clearInterval(roomTicker);
  roomTicker = null;
}

function startServer(port = PORT, host = '0.0.0.0') {
  startRoomTicker();
  return server.listen(port, host, () => {
    console.log(`Biz Arena Р В·Р В°Р С—РЎС“РЎвЂ°Р ВµР Р…Р В° Р Р…Р В° http://${host}:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  state,
  server,
  startServer,
  startRoomTicker,
  stopRoomTicker,
  createRoom,
  joinRoom,
  roomSummary,
  playerSummary,
  handleRoomAction,
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
  readJsonWithRecovery,
  atomicWriteJson,
  loadDbFromDisk,
  persistDbToDisk,
};

