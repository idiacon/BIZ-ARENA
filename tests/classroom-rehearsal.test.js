const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateRuns,
  parseRunOutput,
  requestedRunCount,
} = require('../scripts/rehearse-classroom');

function sampleRun(overrides = {}) {
  return {
    ok: true,
    students: 30,
    websocketConnections: 30,
    latency: {
      join: { p95Ms: 500 },
      state: { p95Ms: 40 },
      action: { p95Ms: 35 },
    },
    limitsMs: {
      joinP95: 1500,
      stateP95: 750,
      actionP95: 1000,
    },
    failures: [],
    ...overrides,
  };
}

test('classroom rehearsal requires at least three sequential runs', () => {
  assert.equal(requestedRunCount('1'), 3);
  assert.equal(requestedRunCount('3'), 3);
  assert.equal(requestedRunCount('7'), 7);
  assert.equal(requestedRunCount('99'), 10);
});

test('classroom rehearsal aggregates worst p95 across all runs', () => {
  const report = aggregateRuns([
    sampleRun(),
    sampleRun({ latency: { join: { p95Ms: 700 }, state: { p95Ms: 55 }, action: { p95Ms: 42 } } }),
    sampleRun({ latency: { join: { p95Ms: 650 }, state: { p95Ms: 48 }, action: { p95Ms: 50 } } }),
  ]);

  assert.equal(report.ok, true);
  assert.equal(report.contract, 'classroom-rehearsal-v1');
  assert.equal(report.runsCompleted, 3);
  assert.deepEqual(report.worstP95Ms, { join: 700, state: 55, action: 50 });
});

test('classroom rehearsal rejects incomplete websocket coverage', () => {
  const report = aggregateRuns([
    sampleRun(),
    sampleRun({ websocketConnections: 29 }),
    sampleRun(),
  ]);

  assert.equal(report.ok, false);
  assert.match(report.failures.join('\n'), /expected 30 websocket connections/);
});

test('classroom rehearsal parses one load runner JSON result', () => {
  const parsed = parseRunOutput(JSON.stringify(sampleRun()), 1);
  assert.equal(parsed.students, 30);
});
