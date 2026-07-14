const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createRunStore } = require('../scripts/pilot-gate/run-store');

function createStoreFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-pilot-run-store-'));
  return { rootDir, store: createRunStore({ rootDir }) };
}

function runRecord(runId = 'pilot-red-store') {
  return {
    contract: 'pilot-run-v1',
    runId,
    buildCommit: 'a'.repeat(40),
    version: '1.0.0-beta.1',
    dirty: false,
    createdAt: '2026-07-12T09:00:00.000Z',
  };
}

test('rejects creating a run when its run ID already exists', () => {
  const { rootDir, store } = createStoreFixture();
  try {
    store.createRun(runRecord());

    assert.throws(() => store.createRun(runRecord()), /already exists|exclusive|overwrite/i);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('preserves the original run record after a rejected overwrite', () => {
  const { rootDir, store } = createStoreFixture();
  try {
    const original = runRecord();
    store.createRun(original);
    assert.throws(() => store.createRun({ ...original, version: '1.0.0-beta.2' }));

    assert.deepEqual(store.readRun(original.runId), original);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('appends an invalidation without mutating the original run record', () => {
  const { rootDir, store } = createStoreFixture();
  try {
    const original = runRecord();
    store.createRun(original);
    store.appendInvalidation(original.runId, {
      reasonCode: 'setup-hash-mismatch',
      invalidatedAt: '2026-07-12T09:03:00.000Z',
      evidenceDigest: 'e'.repeat(64),
    });

    assert.deepEqual(store.readRun(original.runId), original);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('keeps multiple evaluations created in the same millisecond immutable', () => {
  const { rootDir, store } = createStoreFixture();
  try {
    const original = runRecord();
    store.createRun(original);
    const evaluatedAt = '2026-07-12T09:03:00.000Z';
    store.appendEvaluation(original.runId, { verdict: 'CONDITIONAL', evaluatedAt });
    store.appendEvaluation(original.runId, { verdict: 'FAIL', evaluatedAt });

    assert.equal(store.listEvaluations(original.runId).length, 2);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
