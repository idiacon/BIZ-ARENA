const test = require('node:test');
const assert = require('node:assert/strict');
const { createFactorySummaryHelpers } = require('../server/factory/summary');

const config = {
  productUnit: 'ед.',
  basePrice: 100,
  baseDemandMax: 100,
  priceRange: { min: 80, max: 150 },
  components: {
    frame: { recipe: 1 },
    engine: { recipe: 1 },
  },
};

function makeHelpers() {
  return createFactorySummaryHelpers({
    isFactoryScenario: key => key === 'factory',
    factoryScenarioConfig: () => config,
    availableAssemblyCount: factory => Math.min(factory.inventory.frame || 0, factory.inventory.engine || 0),
    factoryEventMultiplier: (room, key) => Number(room.activeEvent?.[key] || 1),
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    buildFactoryStats: () => ({ topSeller: { playerName: 'Команда Бета', sold: 9, price: 97 } }),
    buildSimulationScore: ({ netWorth }) => ({ total: Math.round(netWorth / 1000) }),
    playerAssets: player => Number(player.factory?.finishedGoods || 0) * config.basePrice,
  });
}

function makeRoom(overrides = {}) {
  return {
    settings: { scenarioKey: 'factory' },
    day: 2,
    contractBoard: [],
    marketHistory: [],
    factoryScenario: { baseDemandMax: 100, marketBook: [] },
    players: new Map(),
    ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    id: 'p1',
    name: 'Команда Альфа',
    userName: 'Player',
    money: 100000,
    debt: 0,
    reputation: 50,
    completedContracts: 0,
    innovation: 0,
    research: { completed: [] },
    factory: {
      inventory: { frame: 0, engine: 0 },
      workers: [],
      finishedGoods: 0,
      assembledThisTurn: 0,
      soldThisTurn: 0,
      saleOffer: { price: 100, quantity: 0 },
      ...overrides.factory,
    },
    ...overrides,
  };
}

test('factory summary checklist reflects warehouse, workforce, assembly, and sale readiness', () => {
  const { buildTurnChecklist, buildNextAction } = makeHelpers();
  const room = makeRoom({ hostPlayerId: 'p1' });
  const blocked = makePlayer();

  const initial = buildTurnChecklist(room, blocked);
  assert.equal(initial.find(item => item.key === 'warehouse').status, 'blocked');
  assert.equal(initial.find(item => item.key === 'workforce').status, 'attention');
  assert.equal(initial.find(item => item.key === 'sale').status, 'blocked');
  const nextAction = buildNextAction(room, blocked, { turnChecklist: initial });
  assert.equal(nextAction.key, 'warehouse');
  assert.equal(nextAction.tab, 'purchase');
  assert.equal(nextAction.progress.ready, 0);

  const ready = makePlayer({
    factory: {
      inventory: { frame: 3, engine: 3 },
      workers: [{ id: 'w1' }],
      finishedGoods: 2,
      saleOffer: { price: 98, quantity: 2 },
    },
  });
  const checklist = buildTurnChecklist(room, ready);
  assert.equal(checklist.find(item => item.key === 'warehouse').status, 'ready');
  assert.equal(checklist.find(item => item.key === 'workforce').status, 'ready');
  assert.equal(checklist.find(item => item.key === 'assembly').status, 'ready');
  assert.equal(checklist.find(item => item.key === 'sale').status, 'ready');
  const readyAction = buildNextAction(room, ready, { turnChecklist: checklist });
  assert.equal(readyAction.key, 'next_turn');
  assert.equal(readyAction.action, 'next-turn');

  const student = makePlayer({
    id: 'p2',
    factory: ready.factory,
  });
  const studentAction = buildNextAction(room, student, { turnChecklist: checklist });
  assert.equal(studentAction.key, 'wait_for_host');
  assert.equal(studentAction.action, '');
  assert.equal(studentAction.tab, 'events');
  assert.match(studentAction.body, /дождитесь/i);
});

test('factory summary market hints expose recommendation and high risk for overpriced offers', () => {
  const { buildMarketHints } = makeHelpers();
  const room = makeRoom({
    marketHistory: [{ day: 1, demand: 100, avgPrice: 100, totalSales: 25 }],
    factoryScenario: {
      baseDemandMax: 100,
      marketBook: [{ playerId: 'bot', price: 100, quantity: 10, sold: 10 }],
    },
  });
  const player = makePlayer({
    factory: {
      inventory: { frame: 1, engine: 1 },
      finishedGoods: 10,
      saleOffer: { price: 150, quantity: 10 },
    },
  });

  const decision = buildMarketHints(room, player).find(hint => hint.kind === 'decision');
  assert.equal(decision.saleRisk, 'high');
  assert.equal(decision.currentPrice, 150);
  assert.equal(decision.bestPrice, 100);
  assert.equal(decision.recommendedPrice, 99);
  assert.equal(decision.reasonKey, 'price_above_market');
});

test('factory summary market hints mark competitive sale offers as low risk', () => {
  const { buildMarketHints } = makeHelpers();
  const room = makeRoom({
    marketHistory: [{ day: 1, demand: 100, avgPrice: 100, totalSales: 30 }],
    factoryScenario: {
      baseDemandMax: 100,
      marketBook: [{ playerId: 'bot', price: 100, quantity: 10, sold: 10 }],
    },
  });
  const player = makePlayer({
    factory: {
      inventory: { frame: 1, engine: 1 },
      finishedGoods: 10,
      saleOffer: { price: 99, quantity: 5 },
    },
  });

  const decision = buildMarketHints(room, player).find(hint => hint.kind === 'decision');
  assert.equal(decision.saleRisk, 'low');
  assert.equal(decision.expectedUnits, 5);
  assert.equal(decision.reasonKey, 'competitive');
});

test('factory summary turn review and leader comparison are generated from read models', () => {
  const { buildTurnReview, buildComparisonToLeader } = makeHelpers();
  const player = makePlayer({
    lastTickBreakdown: { profit: 1200, revenue: 6000, expenses: 4800 },
    totalSalesSeason: 3,
    factory: {
      inventory: { frame: 1, engine: 1 },
      finishedGoods: 2,
      soldThisTurn: 3,
      assembledThisTurn: 3,
      saleOffer: { price: 99, quantity: 3 },
    },
  });
  const leader = makePlayer({
    id: 'p2',
    name: 'Команда Бета',
    money: 150000,
    totalSalesSeason: 8,
    factory: { inventory: { frame: 0, engine: 0 }, finishedGoods: 4, saleOffer: { price: 97, quantity: 4 } },
  });
  const room = makeRoom({
    marketHistory: [{ day: 2, demand: 80, avgPrice: 98, totalSales: 50, unmatchedDemand: 30 }],
    factoryScenario: {
      baseDemandMax: 100,
      marketBook: [{ playerId: player.id, price: 99, quantity: 3, sold: 3, remaining: 0 }],
    },
    players: new Map([[player.id, player], [leader.id, leader]]),
  });

  const review = buildTurnReview(room, player);
  assert.equal(review.state, 'resolved');
  assert.match(review.highlights.join(' '), /Продано 3/);
  assert.deepEqual(review.outcomes, review.highlights);
  assert.ok(review.reasons.some(item => /заявк.*исполнена полностью/i.test(item)));
  assert.ok(review.checks.some(item => /склад.*2 ед/i.test(item)));

  const comparison = buildComparisonToLeader(room, player);
  assert.equal(comparison.rank, 2);
  assert.equal(comparison.leaderPlayerId, 'p2');
  assert.ok(comparison.scoreGap > 0);
});
