const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validateAggregate, validateAttestation } = require('../scripts/pilot-gate/schema');
const { normalizeClassroomPilot } = require('../scripts/pilot-gate/adapters/classroom-pilot');

function devicePreflightAttestation() {
  return {
    contract: 'pilot-attestation-v1',
    stage: 'device-preflight',
    runId: 'pilot-red-schema',
    buildCommit: 'a'.repeat(40),
    version: '1.0.0-beta.1',
    packageManifestHash: 'b'.repeat(64),
    serverSetupSha256: 'c'.repeat(64),
    clientSetupSha256: 'd'.repeat(64),
    reviewedAt: '2026-07-12T09:00:00.000Z',
    reviewerRole: 'release-reviewer',
    consentStatus: 'recorded',
    accessOwner: 'release-manager',
    retentionDeadline: '2026-08-12',
    deletionProcedure: 'delete-reviewed-evidence',
    reviewedAttestation: true,
    thresholdsAccepted: true,
    devicePreflight: {
      setupHashesMatchManifest: true,
      cleanInstallSucceeded: true,
      secondDeviceJoinedByQrLan: true,
      externalHealthReachable: true,
      noManualUrlEditing: true,
    },
  };
}

test('rejects an unknown nested device-preflight field', () => {
  const attestation = devicePreflightAttestation();
  attestation.devicePreflight.network = { url: 'http://192.168.1.5:3000' };

  const result = validateAttestation(attestation);

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /devicePreflight\.network/);
});

test('rejects empty or unsafe review-governance metadata', () => {
  const attestation = devicePreflightAttestation();
  attestation.reviewerRole = '';
  attestation.accessOwner = 'http://private-host.example';

  const result = validateAttestation(attestation);

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /reviewerRole/);
  assert.match(result.errors.join('\n'), /accessOwner/);
});

test('keeps the published evidence template aligned with the strict schema', () => {
  const template = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'pilot-evidence-template.json'), 'utf8'));

  assert.equal(validateAttestation(template.devicePreflight).valid, true);
  assert.equal(validateAttestation(template.classroomPilot).valid, true);
});

test('rejects impossible or chronologically invalid retention metadata', () => {
  const impossible = devicePreflightAttestation();
  impossible.reviewedAt = '2026-02-31T09:00:00.000Z';
  const reversed = devicePreflightAttestation();
  reversed.retentionDeadline = '2026-01-01';

  assert.equal(validateAttestation(impossible).valid, false);
  assert.equal(validateAttestation(reversed).valid, false);
});

test('rejects unknown aggregate fields and accepts only the Git anchor allowlist', () => {
  const aggregate = {
    buildCommit: 'a'.repeat(40),
    version: '1.0.0-beta.1',
    receiptChainRoot: 'b'.repeat(64),
    evidenceDigest: 'c'.repeat(64),
    reviewedStages: ['automation', 'device-preflight', 'classroom-pilot'],
    review: {
      devicePreflight: { reviewerRole: 'release-reviewer', reviewedAt: '2026-07-12T09:00:00.000Z' },
      classroomPilot: { reviewerRole: 'teacher-reviewer', reviewedAt: '2026-07-12T10:00:00.000Z' },
    },
    invalidationStatus: 'clear',
    preAnchorEligibility: 'PASS_READY',
  };

  assert.equal(validateAggregate(aggregate).valid, true);
  assert.equal(validateAggregate({ ...aggregate, runId: 'not-allowlisted' }).valid, false);
  assert.equal(validateAggregate({ ...aggregate, rawLog: 'secret' }).valid, false);
});

test('requires exactly one Crisis Card for the classroom threshold', () => {
  const template = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'pilot-evidence-template.json'), 'utf8')).classroomPilot;
  template.classroomPilot.crisisCardCount = 2;

  assert.equal(validateAttestation(template).valid, true);
  assert.equal(normalizeClassroomPilot(template).thresholdsAccepted, false);
});
