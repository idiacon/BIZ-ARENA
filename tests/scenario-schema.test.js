const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateScenarioDefinition,
  buildScenarioDefinitionFromFactoryConfig,
  buildScenarioLabSummary,
} = require('../server/scenarios/schema');

test('scenario definition validates demand, price range, economics, and components', () => {
  const result = validateScenarioDefinition({
    key: 'custom_factory',
    label: 'Custom factory',
    productLabel: 'Учебный товар',
    demand: { min: 4, max: 12 },
    priceRange: { min: 1200, max: 3200, base: 2100 },
    economics: { upkeep: 5000, starterCash: 150000 },
    components: {
      frame: { label: 'Рама', unitCost: 500, lotSize: 2, recipe: 1 },
      motor: { label: 'Мотор', unitCost: 800, lotSize: 2, recipe: 1 },
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('scenario definition rejects broken ranges and missing components', () => {
  const result = validateScenarioDefinition({
    key: 'broken',
    label: 'Broken',
    productLabel: 'Broken product',
    demand: { min: 10, max: 3 },
    priceRange: { min: 5000, max: 4000 },
    economics: { upkeep: -1, starterCash: 0 },
    components: {},
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('demand.min must be less than or equal to demand.max'));
  assert.ok(result.errors.includes('priceRange.min must be less than priceRange.max'));
  assert.ok(result.errors.includes('components must contain at least one component'));
});

test('factory config can be converted into a scenario lab summary', () => {
  const definition = buildScenarioDefinitionFromFactoryConfig({
    key: 'motorcycles',
    productKey: 'motorcycles',
    productLabel: 'Мотоциклы',
    productUnit: 'шт.',
    baseDemandMin: 7,
    baseDemandMax: 14,
    priceRange: { min: 4800, max: 9000 },
    basePrice: 6400,
    upkeep: 7000,
    starterCash: 180000,
    components: {
      frames: { label: 'Рамы', unitCost: 950, lotSize: 2, recipe: 1 },
      engines: { label: 'Двигатели', unitCost: 1600, lotSize: 2, recipe: 1 },
    },
    roles: ['Сборщик'],
  }, {
    difficultyLabel: 'Учебная',
    dayLimit: 30,
    turnMinutes: 30,
  });

  const summary = buildScenarioLabSummary(definition);

  assert.equal(definition.validation.valid, true);
  assert.equal(summary.key, 'motorcycles');
  assert.ok(summary.parameters.some(item => item.key === 'demand' && item.value.includes('7-14')));
  assert.ok(summary.parameters.some(item => item.key === 'recipe_cost' && item.value.includes('2550')));
  assert.ok(summary.experimentAxes.some(item => item.key === 'supplier_scarcity'));
});
