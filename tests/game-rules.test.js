const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOARD_POLICIES,
  OPERATING_PLANS,
  buildOperatingPlanPreview,
  buildExecutionAction,
  buildExecutionPlan,
  buildForecastSegments,
  buildFocusPlan,
  buildPlayerIntel,
  buildPivotPreview,
  buildFinancialBreakdown,
  buildSimulationScore,
  computeSeasonGoalProgress,
  pickOperatingPlanAction,
  researchEffects,
} = require('../server/game-rules');

const RESEARCH_PROJECTS = {
  retail_ai: { effects: { marketing: 0.16, retail: 0.1 } },
  finance_stack: { effects: { debtCost: 0.35, upkeep: 0.06 } },
};

test('researchEffects merges completed research bonuses', () => {
  const player = { research: { completed: ['retail_ai', 'finance_stack'] } };

  assert.deepEqual(researchEffects(player, RESEARCH_PROJECTS), {
    marketing: 0.16,
    retail: 0.1,
    debtCost: 0.35,
    upkeep: 0.06,
  });
});

test('computeSeasonGoalProgress supports each tracked metric', () => {
  assert.equal(computeSeasonGoalProgress({ seasonGoal: { metric: 'sales' }, totalSalesSeason: 175 }), 175);
  assert.equal(computeSeasonGoalProgress({ seasonGoal: { metric: 'innovation' }, innovation: 3 }), 3);
  assert.equal(computeSeasonGoalProgress({ seasonGoal: { metric: 'contracts' }, completedContracts: 2 }), 2);
  assert.equal(computeSeasonGoalProgress({ seasonGoal: { metric: 'cash' }, money: 183499.6 }), 183500);
});

test('buildFinancialBreakdown returns detailed tick ledger with policy and research modifiers', () => {
  const player = {
    price: 155,
    staff: 10,
    salary: 120,
    factories: 2,
    stores: 3,
    marketing: 2,
    debt: 50000,
    automation: 2,
    quality: 3,
    supplyLevel: 2,
    innovation: 1,
  };

  const breakdown = buildFinancialBreakdown({
    player,
    city: { salary: 1.14 },
    scenario: { salary: 1.08 },
    specialization: { salaryMultiplier: 0.96 },
    policy: BOARD_POLICIES.cash_guard,
    research: { upkeep: 0.06, debtCost: 0.35 },
    sold: 40,
  });

  assert.deepEqual(breakdown, {
    revenue: 6200,
    expenses: 29536,
    profit: -23336,
    sold: 40,
    salary: 1390,
    upkeep: 19458,
    debt: 488,
    technology: 8200,
  });
});

test('pickOperatingPlanAction assigns a matching contract for contract autopilot', () => {
  const action = pickOperatingPlanAction({
    player: {
      strategyKey: 'contracts',
      activeContract: null,
      cityKey: 'capital',
      productKey: 'electronics',
      rawStock: 24,
      money: 60000,
      price: 170,
    },
    availableContracts: [
      { id: 'contract_1', cityKey: 'regional', productKey: 'food', completed: false, assignedPlayerId: null },
      { id: 'contract_2', cityKey: 'capital', productKey: 'electronics', completed: false, assignedPlayerId: null },
    ],
  });

  assert.deepEqual(action, { action: 'accept-contract', value: 'contract_2' });
});

test('pickOperatingPlanAction starts research for innovation autopilot before spending on upgrades', () => {
  const action = pickOperatingPlanAction({
    player: {
      strategyKey: 'innovation',
      money: 80000,
      automation: 1,
      quality: 1,
      rawStock: 20,
      research: { activeKey: '', completed: [] },
    },
    availableResearchKeys: ['retail_ai', 'finance_stack'],
  });

  assert.equal(OPERATING_PLANS.innovation.label, 'Innovation autopilot');
  assert.deepEqual(action, { action: 'start-research', value: 'retail_ai' });
});

test('buildOperatingPlanPreview exposes the next contracts autopilot step', () => {
  const preview = buildOperatingPlanPreview({
    player: {
      strategyKey: 'contracts',
      activeContract: null,
      cityKey: 'capital',
      productKey: 'electronics',
      rawStock: 24,
      money: 60000,
      price: 170,
    },
    availableContracts: [
      { id: 'contract_1', cityKey: 'regional', productKey: 'food', completed: false, assignedPlayerId: null },
      { id: 'contract_2', cityKey: 'capital', productKey: 'electronics', completed: false, assignedPlayerId: null },
    ],
  });

  assert.deepEqual(preview, {
    status: 'ready',
    action: 'accept-contract',
    value: 'contract_2',
    actionLabelKey: 'accept_contract',
  });
});

test('buildOperatingPlanPreview reports idle when balanced autopilot has nothing to do', () => {
  const preview = buildOperatingPlanPreview({
    player: {
      strategyKey: 'balanced',
      rawStock: 20,
      debt: 10000,
      money: 12000,
    },
  });

  assert.deepEqual(preview, {
    status: 'idle',
    action: '',
    value: '',
    actionLabelKey: '',
  });
});

test('buildForecastSegments ranks boosted event segments first', () => {
  const forecast = buildForecastSegments({
    cities: [
      { key: 'capital', label: 'Capital', demand: 1.2, priceSensitivity: 0.95 },
      { key: 'regional', label: 'Regional', demand: 1.0, priceSensitivity: 1.0 },
    ],
    products: [
      { key: 'food', label: 'Food', demand: 1.18, marginWeight: 1.02, qualityWeight: 0.9 },
      { key: 'electronics', label: 'Electronics', demand: 0.88, marginWeight: 1.14, qualityWeight: 1.28 },
    ],
    scenario: { demand: 1.1 },
    demandProfileKey: 'standard',
    activeEvent: { cityKey: 'capital', productKey: 'electronics', demandMultiplier: 1.45 },
  });

  assert.equal(forecast[0].cityKey, 'capital');
  assert.equal(forecast[0].productKey, 'electronics');
  assert.ok(forecast[0].forecastDemand > forecast[1].forecastDemand);
});

test('buildPlayerIntel highlights debt, low raw stock, and idle research', () => {
  const intel = buildPlayerIntel({
    player: {
      rawStock: 6,
      debt: 120000,
      activeContract: null,
      cityKey: 'capital',
      productKey: 'electronics',
      research: { activeKey: '', completed: [] },
      marketing: 1,
      money: 40000,
      factories: 1,
      soldLastTick: 0,
      price: 190,
      seasonGoal: { progress: 1, target: 10 },
    },
    room: {
      day: 8,
      settings: { dayLimit: 12 },
      contractBoard: [{ cityKey: 'capital', productKey: 'electronics', completed: false, assignedPlayerId: null }],
    },
    availableResearchCount: 2,
  });

  assert.equal(intel.riskLevel, 'high');
  assert.equal(intel.primarySignalKey, 'raw_low');
  assert.equal(intel.primaryRecommendationKey, 'buy_raw');
  assert.ok(intel.signals.includes('raw_low'));
  assert.ok(intel.signals.includes('debt_high'));
  assert.ok(intel.recommendations.includes('buy_raw'));
  assert.ok(intel.recommendations.includes('repay_debt'));
});

test('buildFocusPlan returns readiness score and missing steps for a pivot target', () => {
  const plan = buildFocusPlan({
    player: {
      cityKey: 'regional',
      productKey: 'food',
      rawStock: 8,
      supplyLevel: 1,
      marketing: 1,
      quality: 1,
      stores: 1,
      money: 12000,
    },
    focusCityKey: 'capital',
    focusProductKey: 'electronics',
    forecastSegments: [
      { cityKey: 'capital', productKey: 'electronics', forecastDemand: 150 },
      { cityKey: 'regional', productKey: 'food', forecastDemand: 110 },
    ],
  });

  assert.equal(plan.readinessLevel, 'low');
  assert.equal(plan.forecastDemand, 150);
  assert.ok(plan.missingSteps.includes('switch_city'));
  assert.ok(plan.missingSteps.includes('switch_product'));
  assert.ok(plan.missingSteps.includes('upgrade_supply'));
});

test('buildFocusPlan ignores city switching for manufacturer scenarios', () => {
  const plan = buildFocusPlan({
    player: {
      cityKey: 'regional',
      productKey: 'motorcycle',
      focusCityKey: '',
      focusProductKey: 'motorcycle',
      money: 42000,
      quality: 2,
      factory: {
        inventory: { frame: 5, engine: 5 },
        workers: [{ id: 'worker_1' }],
        finishedGoods: 0,
      },
    },
    focusCityKey: '',
    focusProductKey: 'motorcycle',
    forecastSegments: [
      { cityKey: 'capital', productKey: 'motorcycle', forecastDemand: 150 },
    ],
  });

  assert.equal(plan.forecastDemand, 0);
  assert.equal(plan.missingSteps.includes('switch_city'), false);
  assert.equal(plan.missingSteps.includes('expand_retail'), false);
});

test('buildPivotPreview recommends pivoting now when target demand is higher and readiness is high', () => {
  const preview = buildPivotPreview({
    player: {
      cityKey: 'regional',
      productKey: 'food',
      focusCityKey: 'capital',
      focusProductKey: 'electronics',
    },
    focusPlan: { readinessLevel: 'high' },
    forecastSegments: [
      { cityKey: 'regional', productKey: 'food', forecastDemand: 100 },
      { cityKey: 'capital', productKey: 'electronics', forecastDemand: 145 },
    ],
  });

  assert.equal(preview.timing, 'pivot_now');
  assert.equal(preview.demandDelta, 45);
  assert.ok(preview.reasons.includes('higher_demand'));
  assert.ok(preview.reasons.includes('ready_now'));
});

test('buildExecutionAction keeps manufacturer queue away from city actions', () => {
  const action = buildExecutionAction({
    key: 'switch_city',
    player: {
      cityKey: 'regional',
      focusCityKey: 'capital',
      factory: { inventory: {}, workers: [] },
    },
  });

  assert.equal(action.mode, 'blocked');
  assert.equal(action.action, '');
  assert.equal(action.blockedReason, 'already_aligned');
});

test('buildExecutionAction maps queue steps to direct business actions when possible', () => {
  assert.deepEqual(buildExecutionAction({
    key: 'switch_city',
    player: { cityKey: 'regional', focusCityKey: 'capital' },
  }), {
    mode: 'actionable',
    action: 'set-city',
    value: 'capital',
    blockedReason: '',
    requiredMoney: 0,
  });

  assert.deepEqual(buildExecutionAction({
    key: 'accept_contract',
    player: {
      cityKey: 'regional',
      productKey: 'food',
      focusCityKey: 'capital',
      focusProductKey: 'electronics',
    },
    room: {
      contractBoard: [
        { id: 'wrong', cityKey: 'regional', productKey: 'food', completed: false, assignedPlayerId: null },
        { id: 'focus', cityKey: 'capital', productKey: 'electronics', completed: false, assignedPlayerId: null },
      ],
    },
  }), {
    mode: 'actionable',
    action: 'accept-contract',
    value: 'focus',
    blockedReason: '',
    requiredMoney: 0,
  });

  assert.equal(buildExecutionAction({
    key: 'hold_course',
    player: { cityKey: 'regional', focusCityKey: 'regional' },
  }).mode, 'manual');
});

test('buildExecutionAction exposes blocked reasons for Sprint 1 queue UX', () => {
  assert.deepEqual(buildExecutionAction({
    key: 'upgrade_supply',
    player: { supplyLevel: 2, money: 1000 },
  }), {
    mode: 'blocked',
    action: '',
    value: '',
    blockedReason: 'insufficient_cash',
    requiredMoney: 34000,
  });

  assert.deepEqual(buildExecutionAction({
    key: 'accept_contract',
    player: { cityKey: 'regional', productKey: 'food', focusCityKey: 'regional', focusProductKey: 'food' },
    room: { contractBoard: [] },
  }), {
    mode: 'blocked',
    action: '',
    value: '',
    blockedReason: 'no_matching_contract',
    requiredMoney: 0,
  });
});

test('buildExecutionPlan returns actionable queue metadata for Milestone 11 controls', () => {
  const plan = buildExecutionPlan({
    player: {
      cityKey: 'regional',
      productKey: 'food',
      focusCityKey: 'capital',
      focusProductKey: 'electronics',
      rawStock: 8,
      supplyLevel: 1,
      marketing: 1,
      quality: 1,
      stores: 1,
      money: 12000,
      debt: 16000,
      price: 180,
    },
    room: {
      contractBoard: [
        { id: 'contract_1', cityKey: 'capital', productKey: 'electronics', completed: false, assignedPlayerId: null },
      ],
    },
    intel: { recommendations: ['accept_contract', 'repay_debt'] },
    focusPlan: { missingSteps: ['switch_city', 'upgrade_supply'] },
    pivotPreview: { timing: 'prepare_then_pivot' },
    availableResearchKeys: ['retail_ai'],
  });

  assert.deepEqual(plan.slice(0, 4), [
    { key: 'switch_city', priority: 'high', reasonKey: 'prepare_then_pivot', mode: 'actionable', actionable: true, action: 'set-city', value: 'capital', blockedReason: '', requiredMoney: 0, whyNowKey: 'prep_target_segment', outcomeKey: 'target_alignment' },
    { key: 'upgrade_supply', priority: 'high', reasonKey: 'prepare_then_pivot', mode: 'blocked', actionable: false, action: '', value: '', blockedReason: 'insufficient_cash', requiredMoney: 24000, whyNowKey: 'supply_gap', outcomeKey: 'production_ready' },
    { key: 'accept_contract', priority: 'medium', reasonKey: 'intel', mode: 'actionable', actionable: true, action: 'accept-contract', value: 'contract_1', blockedReason: '', requiredMoney: 0, whyNowKey: 'contract_window', outcomeKey: 'contract_reward' },
    { key: 'repay_debt', priority: 'medium', reasonKey: 'intel', mode: 'actionable', actionable: true, action: 'repay-loan', value: 10000, blockedReason: '', requiredMoney: 0, whyNowKey: 'risk_pressure', outcomeKey: 'lower_risk' },
  ]);
});

test('buildExecutionPlan expands secure_contract into concrete rescue steps', () => {
  const plan = buildExecutionPlan({
    player: {
      cityKey: 'capital',
      productKey: 'electronics',
      focusCityKey: 'capital',
      focusProductKey: 'electronics',
      rawStock: 4,
      supplyLevel: 2,
      marketing: 1,
      quality: 2,
      stores: 1,
      money: 50000,
      debt: 0,
      price: 190,
      soldLastTick: 0,
      activeContract: { expiresDay: 9 },
    },
    room: {
      day: 8,
      contractBoard: [],
    },
    intel: { recommendations: ['secure_contract'] },
    focusPlan: { missingSteps: [] },
    pivotPreview: { timing: 'hold' },
    availableResearchKeys: [],
  });

  assert.deepEqual(plan.slice(0, 4).map(item => item.key), [
    'buy_raw',
    'lower_price',
    'boost_marketing',
    'expand_retail',
  ]);
});

test('buildExecutionPlan expands focus_goal and build_cash into smarter concrete steps', () => {
  const plan = buildExecutionPlan({
    player: {
      cityKey: 'regional',
      productKey: 'food',
      focusCityKey: 'regional',
      focusProductKey: 'food',
      rawStock: 18,
      supplyLevel: 2,
      marketing: 1,
      quality: 1,
      stores: 1,
      factories: 1,
      money: 45000,
      debt: 110000,
      price: 185,
      soldLastTick: 0,
      activeContract: null,
      seasonGoal: { metric: 'cash' },
    },
    room: {
      day: 5,
      contractBoard: [
        { id: 'cash_contract', cityKey: 'regional', productKey: 'food', completed: false, assignedPlayerId: null },
      ],
    },
    intel: { recommendations: ['focus_goal', 'build_cash'] },
    focusPlan: { missingSteps: [] },
    pivotPreview: { timing: 'hold' },
    availableResearchKeys: [],
  });

  assert.equal(plan[0].key, 'repay_debt');
  assert.equal(plan[0].actionable, true);
});

test('buildSimulationScore rewards balanced execution across finance, contracts, and innovation', () => {
  const score = buildSimulationScore({
    netWorth: 240000,
    money: 90000,
    debt: 40000,
    reputation: 68,
    completedContracts: 2,
    completedResearch: 2,
    innovation: 3,
    soldLastTick: 18,
    seasonGoal: { progress: 9, target: 12 },
    lastTickBreakdown: { profit: 12000 },
  });

  assert.equal(score.total, 249);
  assert.deepEqual(score.components, {
    financial: 80,
    liquidity: 18,
    contracts: 36,
    innovation: 54,
    execution: 53,
    discipline: 8,
    debtPenalty: 0,
  });
});

test('buildSimulationScore penalizes debt-heavy unstable runs', () => {
  const score = buildSimulationScore({
    netWorth: 80000,
    money: 15000,
    debt: 180000,
    reputation: 22,
    completedContracts: 0,
    completedResearch: 0,
    innovation: 0,
    soldLastTick: 1,
    seasonGoal: { progress: 1, target: 12 },
    lastTickBreakdown: { profit: -9000 },
  });

  assert.equal(score.total, 27);
  assert.deepEqual(score.components, {
    financial: 27,
    liquidity: 3,
    contracts: 0,
    innovation: 0,
    execution: 5,
    discipline: 0,
    debtPenalty: 8,
  });
});
