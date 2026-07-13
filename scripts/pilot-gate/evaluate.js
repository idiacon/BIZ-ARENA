const { validateAggregate } = require('./schema');

const STAGES = ['automation', 'devicePreflight', 'classroomPilot'];
const MANUAL_IDENTITY_FIELDS = ['buildCommit', 'version', 'packageManifestHash', 'serverSetupSha256', 'clientSetupSha256'];
const SHA256 = /^[a-f0-9]{64}$/;

function sameIdentity(identity, record) {
  return Boolean(record) && MANUAL_IDENTITY_FIELDS.every(field => record[field] === identity[field]);
}

function retentionExpired(attestation, evaluatedAt) {
  if (!attestation?.retentionDeadline || typeof evaluatedAt !== 'string') return false;
  return attestation.retentionDeadline < evaluatedAt.slice(0, 10);
}

function evaluatePilotGate(evidence) {
  const failures = [];
  const incomplete = [];
  const run = evidence?.run;
  const automation = evidence?.automation;
  const devicePreflight = evidence?.devicePreflight;
  const classroomPilot = evidence?.classroomPilot;
  const aggregate = evidence?.aggregate;
  const aggregatePresent = evidence?.aggregatePresent ?? (aggregate !== null && aggregate !== undefined);
  const anchor = evidence?.anchor;

  if (!run || run.dirty || !/^[a-f0-9]{40}$/.test(run.buildCommit || '')) failures.push('invalid-build-provenance');
  if (evidence?.runValidation === false) failures.push('run-schema-invalid');
  if (evidence?.source?.dirty) failures.push('dirty-source-tree');
  if ((evidence?.schemaRejections || []).length) failures.push('schema-rejection');
  if ((evidence?.invalidations || []).length) failures.push('invalidated');
  for (const code of new Set(evidence?.runtimeLoadErrors || [])) failures.push(code);
  if (evidence?.attestationValidation?.devicePreflight === false) failures.push('device-preflight-schema-invalid');
  if (evidence?.attestationValidation?.classroomPilot === false) failures.push('classroom-pilot-schema-invalid');

  if (!automation || automation.failureCode === 'automation-receipts-missing') {
    incomplete.push('automation-receipts-missing');
  } else if (automation.failureCode) {
    failures.push(automation.failureCode);
  }

  const canonical = { ...run, ...automation };
  const automationIdentityRequired = Boolean(automation?.complete || automation?.mechanicallyVerified);
  if (automationIdentityRequired
    && !['packageManifestHash', 'serverSetupSha256', 'clientSetupSha256'].every(field => SHA256.test(automation[field] || ''))) {
    failures.push('automation-identity-mismatch');
  }

  for (const [name, attestation] of [['device-preflight', devicePreflight], ['classroom-pilot', classroomPilot]]) {
    if (!attestation) {
      incomplete.push(`${name}-missing`);
      continue;
    }
    if (!attestation.reviewedAttestation) incomplete.push(`${name}-not-reviewed`);
    if (!sameIdentity(canonical, attestation)) failures.push(`${name}-identity-mismatch`);
    if (!attestation.thresholdsAccepted) failures.push(`${name}-thresholds-not-accepted`);
    if (retentionExpired(attestation, evidence?.evaluatedAt)) failures.push(`${name}-retention-expired`);
  }

  let aggregateValid = false;
  if (!aggregatePresent) {
    incomplete.push('aggregate-missing');
  } else {
    const validation = validateAggregate(aggregate);
    aggregateValid = validation.valid;
    if (!validation.valid) {
      failures.push('aggregate-schema-invalid');
    } else {
      if (aggregate.buildCommit !== run?.buildCommit || aggregate.version !== run?.version) failures.push('aggregate-identity-mismatch');
      if (aggregate.receiptChainRoot !== automation?.receiptChainRoot) failures.push('aggregate-receipt-chain-mismatch');
      if (aggregate.preAnchorEligibility !== 'PASS_READY') failures.push('aggregate-not-pass-ready');
      if (evidence.aggregateMatchesEvidence === false) failures.push('aggregate-evidence-mismatch');
    }
  }

  if (!anchor) {
    incomplete.push('anchor-missing');
  } else {
    if (anchor.loadError) failures.push(anchor.loadError);
    if (!anchor.schemaValid) failures.push('anchor-schema-invalid');
    if (!aggregate
      || anchor.buildCommit !== run?.buildCommit
      || anchor.receiptChainRoot !== aggregate.receiptChainRoot
      || anchor.evidenceDigest !== aggregate.evidenceDigest) {
      failures.push('anchor-mismatch');
    }
    if (!anchor.descendantOfBuildCommit || !anchor.exactAggregateOnlyDiff || !anchor.aggregateMatches || !anchor.anchorCommit) {
      failures.push('invalid-anchor');
    }
  }

  const completeManual = Boolean(
    devicePreflight?.reviewedAttestation
    && devicePreflight.thresholdsAccepted
    && classroomPilot?.reviewedAttestation
    && classroomPilot.thresholdsAccepted
  );
  const passReady = Boolean(automation?.mechanicallyVerified && completeManual && aggregateValid && anchor);
  const verdict = failures.length ? 'FAIL' : passReady ? 'PASS' : 'CONDITIONAL';
  const reasons = [...failures, ...incomplete];

  return {
    verdict,
    reasons,
    anchorCommit: anchor?.anchorCommit || null,
    stages: STAGES.map(stage => ({
      stage,
      status: stage === 'automation'
        ? (automation?.mechanicallyVerified ? 'complete' : 'missing')
        : (evidence?.[stage]?.reviewedAttestation ? 'complete' : 'missing'),
    })),
  };
}

module.exports = { evaluatePilotGate };
