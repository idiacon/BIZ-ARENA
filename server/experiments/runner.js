const DEFAULT_SCENARIOS = {
  motorcycles: {
    key: 'motorcycles',
    label: 'Завод мотоциклов',
    productLabel: 'Мотоциклы',
    productUnit: 'шт.',
    demand: { min: 7, max: 14 },
    priceRange: { min: 4800, max: 9000, base: 6400 },
    economics: { upkeep: 7000, starterCash: 180000, dayLimit: 30, turnMinutes: 30 },
    components: {
      frames: { label: 'Рамы', unitCost: 950, lotSize: 2, recipe: 1 },
      engines: { label: 'Двигатели', unitCost: 1600, lotSize: 2, recipe: 1 },
      wheels: { label: 'Колёса', unitCost: 420, lotSize: 4, recipe: 2 },
      electronics: { label: 'Электроника', unitCost: 600, lotSize: 2, recipe: 1 },
    },
  },
  drones: {
    key: 'drones',
    label: 'Фабрика дронов',
    productLabel: 'Дроны',
    productUnit: 'компл.',
    demand: { min: 10, max: 18 },
    priceRange: { min: 2400, max: 5200, base: 3600 },
    economics: { upkeep: 5500, starterCash: 170000, dayLimit: 30, turnMinutes: 30 },
    components: {
      motors: { label: 'Моторы', unitCost: 320, lotSize: 4, recipe: 4 },
      batteries: { label: 'Батареи', unitCost: 680, lotSize: 2, recipe: 1 },
      controllers: { label: 'Контроллеры', unitCost: 560, lotSize: 2, recipe: 1 },
      cameras: { label: 'Камеры', unitCost: 420, lotSize: 2, recipe: 1 },
      frames: { label: 'Рамы', unitCost: 260, lotSize: 2, recipe: 1 },
    },
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createSeededRandom(seed = 1) {
  let state = Math.abs(Math.floor(Number(seed) || 1)) % 2147483647;
  if (state === 0) state = 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function recipeUnitCost(scenario) {
  return Object.values(scenario.components || {}).reduce((sum, component) => (
    sum + Number(component.unitCost || 0) * Number(component.recipe || 0)
  ), 0);
}

function normalizeScenario({ baseScenarioKey = 'motorcycles', scenario = null } = {}) {
  const source = scenario || DEFAULT_SCENARIOS[baseScenarioKey];
  if (!source) throw new Error(`Unknown experiment scenario: ${baseScenarioKey}`);
  return {
    ...source,
    demand: { ...(source.demand || {}) },
    priceRange: { ...(source.priceRange || {}) },
    economics: { ...(source.economics || {}) },
    components: { ...(source.components || {}) },
  };
}

function applyParameterValue(scenario, parameter, value) {
  const next = normalizeScenario({ scenario });
  const numericValue = Number(value);
  switch (parameter) {
    case 'basePrice':
    case 'price':
      next.priceRange.base = numericValue;
      break;
    case 'demandMultiplier':
      next.demand.min = Math.max(1, Math.round(Number(next.demand.min || 0) * numericValue));
      next.demand.max = Math.max(next.demand.min, Math.round(Number(next.demand.max || 0) * numericValue));
      break;
    case 'upkeep':
      next.economics.upkeep = numericValue;
      break;
    case 'starterCash':
      next.economics.starterCash = numericValue;
      break;
    case 'supplyCoverage':
      next.supplyCoverage = clamp(numericValue, 0.1, 1.5);
      break;
    case 'salaryMultiplier':
      next.salaryMultiplier = clamp(numericValue, 0.4, 2.2);
      break;
    default:
      throw new Error(`Unsupported experiment parameter: ${parameter}`);
  }
  return next;
}

function simulateScenarioRun({
  scenario,
  turns = 10,
  seed = 1,
  strategy = 'balanced',
} = {}) {
  const normalized = normalizeScenario({ scenario });
  const random = createSeededRandom(seed);
  const runTurns = clamp(Math.round(Number(turns || 10)), 1, 120);
  const materialCost = recipeUnitCost(normalized);
  const basePrice = Number(normalized.priceRange?.base || normalized.priceRange?.min || materialCost * 1.5);
  const salePrice = clamp(
    basePrice,
    Number(normalized.priceRange?.min || 1),
    Number(normalized.priceRange?.max || basePrice)
  );
  const upkeep = Number(normalized.economics?.upkeep || 0);
  const starterCash = Number(normalized.economics?.starterCash || 0);
  const supplyCoverage = Number(normalized.supplyCoverage || 1);
  const salaryMultiplier = Number(normalized.salaryMultiplier || 1);
  const demandMin = Number(normalized.demand?.min || 1);
  const demandMax = Math.max(demandMin, Number(normalized.demand?.max || demandMin));
  const priceCenter = (Number(normalized.priceRange?.min || salePrice) + Number(normalized.priceRange?.max || salePrice)) / 2;
  const capacityBias = strategy === 'aggressive' ? 1.12 : strategy === 'lean' ? 0.78 : 0.92;
  const plannedCapacity = Math.max(1, Math.round(demandMax * capacityBias * supplyCoverage));
  const payroll = Math.round(plannedCapacity * 360 * salaryMultiplier);
  const bankruptcyLimit = Math.max(starterCash * 0.55, upkeep * 4);

  let cash = starterCash;
  let debt = 0;
  let stock = 0;
  let totalSales = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let bankruptcyCount = 0;

  for (let turn = 1; turn <= runTurns; turn += 1) {
    const demandNoise = 0.9 + random() * 0.22;
    const demand = Math.max(0, Math.round((demandMin + (demandMax - demandMin) * random()) * demandNoise));
    const pricePremium = (salePrice - priceCenter) / Math.max(priceCenter, 1);
    const demandPriceEffect = clamp(1 - pricePremium * 1.35, 0.18, 1.28);
    const produced = Math.max(0, Math.round(plannedCapacity * (0.88 + random() * 0.18)));
    stock += produced;
    const expectedDemand = Math.round(demand * demandPriceEffect);
    const sold = Math.min(stock, expectedDemand);
    stock -= sold;

    const revenue = sold * salePrice;
    const expenses = produced * materialCost + upkeep + payroll;
    const profit = revenue - expenses;

    cash += profit;
    if (cash < 0) {
      debt += Math.abs(cash);
      cash = 0;
    }
    if (debt > bankruptcyLimit && bankruptcyCount === 0) bankruptcyCount = 1;

    totalSales += sold;
    totalRevenue += revenue;
    totalProfit += profit;
  }

  const inventoryValue = Math.round(stock * materialCost * 0.55);
  const finalNetWorth = Math.round(cash + inventoryValue - debt);
  const avgPrice = totalSales ? Math.round(totalRevenue / totalSales) : salePrice;
  const marginPerUnit = salePrice - materialCost - Math.round((upkeep + payroll) / Math.max(plannedCapacity, 1));
  const finalScore = Math.round(finalNetWorth / 1000 + totalSales * 3 + Math.max(0, totalProfit) / 1200 - debt / 1400);
  const notes = [
    marginPerUnit < 0 ? 'Цена ниже полной себестоимости' : 'Цена покрывает полный цикл',
    bankruptcyCount ? 'Есть риск банкротства' : 'Долг в допустимых пределах',
    totalSales <= runTurns ? 'Слабые продажи' : 'Есть устойчивый спрос',
  ];

  return {
    finalScore,
    finalNetWorth,
    totalSales,
    avgPrice,
    totalRevenue: Math.round(totalRevenue),
    totalProfit: Math.round(totalProfit),
    bankruptcyCount,
    notes,
  };
}

function runParameterSweep({
  baseScenarioKey = 'motorcycles',
  scenario = null,
  parameter = 'basePrice',
  values = [],
  turns = 10,
  seed = 1,
  strategy = 'balanced',
} = {}) {
  if (!Array.isArray(values) || !values.length) {
    throw new Error('Experiment values must be a non-empty array');
  }
  const baseScenario = normalizeScenario({ baseScenarioKey, scenario });
  return values.map((value, index) => {
    const nextScenario = applyParameterValue(baseScenario, parameter, value);
    const result = simulateScenarioRun({
      scenario: nextScenario,
      turns,
      seed: Number(seed || 1),
      strategy,
    });
    return {
      parameter,
      value,
      scenarioKey: nextScenario.key,
      ...result,
    };
  });
}

module.exports = {
  runParameterSweep,
  simulateScenarioRun,
  applyParameterValue,
  normalizeScenario,
  recipeUnitCost,
};
