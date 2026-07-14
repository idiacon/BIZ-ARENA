const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runParameterSweep,
  simulateScenarioRun,
  recipeUnitCost,
} = require('../server/experiments/runner');

test('parameter sweep returns one result per parameter value', () => {
  const results = runParameterSweep({
    baseScenarioKey: 'motorcycles',
    parameter: 'basePrice',
    values: [6000, 6500, 7000],
    turns: 5,
    seed: 42,
  });

  assert.equal(results.length, 3);
  assert.deepEqual(results.map(item => item.value), [6000, 6500, 7000]);
  assert.ok(results.every(item => Number.isFinite(item.finalScore)));
  assert.ok(results.every(item => Number.isFinite(item.totalSales)));
  assert.ok(results.every(item => Array.isArray(item.notes)));
});

test('scenario run is deterministic for the same seed and scenario', () => {
  const first = simulateScenarioRun({ baseScenarioKey: 'motorcycles', turns: 8, seed: 17 });
  const second = simulateScenarioRun({ baseScenarioKey: 'motorcycles', turns: 8, seed: 17 });

  assert.deepEqual(first, second);
});

test('lower supply coverage reduces sales or score in a sweep', () => {
  const results = runParameterSweep({
    baseScenarioKey: 'drones',
    parameter: 'supplyCoverage',
    values: [0.45, 1],
    turns: 8,
    seed: 11,
  });

  assert.ok(results[0].totalSales <= results[1].totalSales || results[0].finalScore <= results[1].finalScore);
});

test('recipe cost is computed from component recipe quantities', () => {
  const cost = recipeUnitCost({
    components: {
      frame: { unitCost: 500, recipe: 1 },
      wheel: { unitCost: 100, recipe: 2 },
    },
  });

  assert.equal(cost, 700);
});
