const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { evaluatePilotGate } = require('../scripts/pilot-gate/evaluate');
const { classroomArtifactDigests } = require('../scripts/pilot-gate/receipt-capture');
const { normalizeAutomation } = require('../scripts/pilot-gate/adapters/automation');

function completeEvidence(overrides = {}) {
  const runId = 'pilot-red-evaluator';
  const buildCommit = 'a'.repeat(40);
  const version = '1.0.0-beta.1';
  const receiptChainRoot = 'b'.repeat(64);
  const evidenceDigest = 'c'.repeat(64);
  return {
    run: { runId, buildCommit, version, dirty: false },
    automation: {
      mechanicallyVerified: true,
      reviewedAt: '2026-07-12T09:00:00.000Z',
      receiptChainRoot,
      packageManifestHash: 'd'.repeat(64),
      serverSetupSha256: 'e'.repeat(64),
      clientSetupSha256: 'f'.repeat(64),
    },
    devicePreflight: {
      reviewedAttestation: true,
      reviewedAt: '2026-07-12T09:01:00.000Z',
      buildCommit,
      version,
      packageManifestHash: 'd'.repeat(64),
      serverSetupSha256: 'e'.repeat(64),
      clientSetupSha256: 'f'.repeat(64),
      thresholdsAccepted: true,
      retentionDeadline: '2026-08-12',
    },
    classroomPilot: {
      reviewedAttestation: true,
      reviewedAt: '2026-07-12T09:02:00.000Z',
      buildCommit,
      version,
      packageManifestHash: 'd'.repeat(64),
      serverSetupSha256: 'e'.repeat(64),
      clientSetupSha256: 'f'.repeat(64),
      thresholdsAccepted: true,
      retentionDeadline: '2026-08-12',
    },
    aggregate: {
      buildCommit,
      version,
      receiptChainRoot,
      evidenceDigest,
      reviewedStages: ['automation', 'device-preflight', 'classroom-pilot'],
      review: {
        devicePreflight: { reviewerRole: 'release-reviewer', reviewedAt: '2026-07-12T09:01:00.000Z' },
        classroomPilot: { reviewerRole: 'teacher-reviewer', reviewedAt: '2026-07-12T09:02:00.000Z' },
      },
      invalidationStatus: 'clear',
      preAnchorEligibility: 'PASS_READY',
    },
    anchor: {
      anchorCommit: '0'.repeat(40),
      buildCommit,
      receiptChainRoot,
      evidenceDigest,
      aggregateMatches: true,
      exactAggregateOnlyDiff: true,
      descendantOfBuildCommit: true,
      schemaValid: true,
    },
    source: { dirty: false },
    aggregateMatchesEvidence: true,
    invalidations: [],
    evaluatedAt: '2026-07-13T09:00:00.000Z',
    ...overrides,
  };
}

test('returns CONDITIONAL when reviewed manual attestations are missing', () => {
  const evidence = completeEvidence({ devicePreflight: null, classroomPilot: null, anchor: null });

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'CONDITIONAL');
});

test('returns CONDITIONAL when automation evidence has not been captured yet', () => {
  const evidence = completeEvidence({ automation: null, devicePreflight: null, classroomPilot: null, aggregate: null, anchor: null });

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'CONDITIONAL');
});

test('returns CONDITIONAL when present manual evidence is not reviewed yet', () => {
  const evidence = completeEvidence({ aggregate: null, anchor: null });
  evidence.devicePreflight.reviewedAttestation = false;

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'CONDITIONAL');
  assert.ok(result.reasons.includes('device-preflight-not-reviewed'));
});

test('returns FAIL for an explicit threshold failure even before review', () => {
  const evidence = completeEvidence({ aggregate: null, anchor: null });
  evidence.devicePreflight.reviewedAttestation = false;
  evidence.devicePreflight.thresholdsAccepted = false;

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.reasons.includes('device-preflight-thresholds-not-accepted'));
});

test('returns FAIL for a malformed or reordered automation receipt chain', () => {
  const evidence = completeEvidence({ devicePreflight: null, classroomPilot: null, aggregate: null, anchor: null });
  evidence.automation.mechanicallyVerified = false;
  evidence.automation.failureCode = 'automation-receipt-chain-invalid';

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'FAIL');
  assert.ok(result.reasons.includes('automation-receipt-chain-invalid'));
});

test('normalizes malformed receipt collections to typed failures without throwing', () => {
  const run = { runId: 'pilot-malformed', buildCommit: 'a'.repeat(40), version: '1.0.0-beta.1' };

  assert.equal(normalizeAutomation({ run, receipts: null }).failureCode, 'automation-receipt-chain-invalid');
  assert.equal(normalizeAutomation({ run, receipts: {} }).failureCode, 'automation-receipt-chain-invalid');
  assert.equal(normalizeAutomation({ run, receipts: [null] }).failureCode, 'automation-receipt-chain-invalid');
});

test('returns FAIL when the source tree is dirty or reviewed evidence has expired', () => {
  const dirty = evaluatePilotGate(completeEvidence({ source: { dirty: true } }));
  const expiredEvidence = completeEvidence();
  expiredEvidence.devicePreflight.retentionDeadline = '2026-07-12';
  const expired = evaluatePilotGate(expiredEvidence);

  assert.equal(dirty.verdict, 'FAIL');
  assert.ok(dirty.reasons.includes('dirty-source-tree'));
  assert.equal(expired.verdict, 'FAIL');
  assert.ok(expired.reasons.includes('device-preflight-retention-expired'));
});

test('returns FAIL when invalidation coexists with missing manual evidence', () => {
  const evidence = completeEvidence({
    devicePreflight: null,
    classroomPilot: null,
    anchor: null,
    invalidations: [{ reasonCode: 'setup-hash-mismatch', invalidatedAt: '2026-07-12T09:03:00.000Z' }],
  });

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'FAIL');
});

test('returns PASS for reviewed attestations bound to a matching aggregate anchor', () => {
  const result = evaluatePilotGate(completeEvidence());

  assert.equal(result.verdict, 'PASS');
});

test('returns FAIL when a reviewed attestation no longer matches the build identity', () => {
  const evidence = completeEvidence();
  evidence.devicePreflight.clientSetupSha256 = '0'.repeat(64);

  const result = evaluatePilotGate(evidence);

  assert.equal(result.verdict, 'FAIL');
});

test('rejects a classroom manifest produced from another or dirty source revision', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-pilot-manifest-'));
  const version = '1.0.0-beta.1';
  const manifestPath = path.join(rootDir, 'dist', `classroom-release-manifest-${version}.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({
    version,
    source: { commit: '0'.repeat(40), dirty: true },
    files: [
      { name: `BizArena-Server-${version}-Setup-x64.exe`, sha256: 'e'.repeat(64) },
      { name: `BizArena-Client-${version}-Setup-x64.exe`, sha256: 'f'.repeat(64) },
    ],
  }));

  try {
    assert.throws(
      () => classroomArtifactDigests(rootDir, { version, buildCommit: 'a'.repeat(40) }, 'classroom-package'),
      /manifest.*source|dirty|commit/i
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
