const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const PSEUDONYM = /^S[1-7]$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const REVIEWER_ROLE = /^(?:release-reviewer|teacher-reviewer|verifier)$/;
const RUN_FIELDS = new Set(['contract', 'runId', 'buildCommit', 'version', 'dirty', 'createdAt']);

const BASE_FIELDS = new Set([
  'contract', 'stage', 'runId', 'buildCommit', 'version', 'packageManifestHash',
  'serverSetupSha256', 'clientSetupSha256', 'reviewedAt', 'reviewerRole',
  'consentStatus', 'accessOwner', 'retentionDeadline', 'deletionProcedure',
  'reviewedAttestation', 'thresholdsAccepted', 'devicePreflight', 'classroomPilot',
]);

const STAGE_FIELDS = {
  'device-preflight': new Set([
    'setupHashesMatchManifest', 'cleanInstallSucceeded', 'secondDeviceJoinedByQrLan',
    'externalHealthReachable', 'noManualUrlEditing',
  ]),
  'classroom-pilot': new Set([
    'participantCount', 'pseudonyms', 'companyAliases', 'turnsCompleted', 'crisisCardCount',
    'roomSetupWithinFiveMinutes', 'allJoinedWithoutManualUrlEdits', 'firstTurnCompletionRate',
    'blockedTeamIdentifiedWithinFifteenSeconds', 'reconnectPreservedActions',
    'historyAndExportObtained', 'debriefRecorded',
  ]),
};

const AGGREGATE_FIELDS = new Set([
  'buildCommit', 'version', 'receiptChainRoot', 'evidenceDigest', 'reviewedStages',
  'review', 'invalidationStatus', 'preAnchorEligibility',
]);
const AGGREGATE_REVIEW_FIELDS = new Set(['devicePreflight', 'classroomPilot']);
const REVIEW_FIELDS = new Set(['reviewerRole', 'reviewedAt']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function error(errors, message) {
  errors.push(message);
}

function rejectUnknownFields(value, allowed, prefix, errors) {
  if (!isObject(value)) {
    error(errors, `${prefix} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) error(errors, `${prefix}.${key} is not allowed`);
  }
}

function validateString(value, field, pattern, errors) {
  if (typeof value !== 'string' || value.trim().length === 0 || (pattern && !pattern.test(value))) {
    error(errors, `${field} is invalid`);
  }
}

function validateBoolean(value, field, errors) {
  if (typeof value !== 'boolean') error(errors, `${field} must be boolean`);
}

function isExactTimestamp(value) {
  if (typeof value !== 'string' || !TIMESTAMP.test(value)) return false;
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === normalized;
}

function isExactDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function validateReview(value, prefix, errors) {
  rejectUnknownFields(value, REVIEW_FIELDS, prefix, errors);
  if (!isObject(value)) return;
  validateString(value.reviewerRole, `${prefix}.reviewerRole`, REVIEWER_ROLE, errors);
  if (!isExactTimestamp(value.reviewedAt)) error(errors, `${prefix}.reviewedAt is invalid`);
}

function validateAttestation(attestation) {
  const errors = [];
  rejectUnknownFields(attestation, BASE_FIELDS, 'attestation', errors);
  if (!isObject(attestation)) return { valid: false, errors };

  validateString(attestation.contract, 'contract', /^pilot-attestation-v1$/, errors);
  if (!Object.hasOwn(STAGE_FIELDS, attestation.stage)) {
    error(errors, 'stage is invalid');
    return { valid: false, errors };
  }
  validateString(attestation.runId, 'runId', /^[A-Za-z0-9_-]+$/, errors);
  validateString(attestation.buildCommit, 'buildCommit', COMMIT, errors);
  validateString(attestation.version, 'version', VERSION, errors);
  for (const field of ['packageManifestHash', 'serverSetupSha256', 'clientSetupSha256']) {
    validateString(attestation[field], field, SHA256, errors);
  }
  if (!isExactTimestamp(attestation.reviewedAt)) error(errors, 'reviewedAt is invalid');
  validateString(attestation.reviewerRole, 'reviewerRole', REVIEWER_ROLE, errors);
  validateString(attestation.consentStatus, 'consentStatus', /^recorded$/, errors);
  validateString(attestation.accessOwner, 'accessOwner', /^(?:release-manager|teacher|project-owner)$/, errors);
  if (!isExactDate(attestation.retentionDeadline)) error(errors, 'retentionDeadline is invalid');
  if (isExactTimestamp(attestation.reviewedAt) && isExactDate(attestation.retentionDeadline)) {
    const reviewedDate = attestation.reviewedAt.slice(0, 10);
    if (attestation.retentionDeadline < reviewedDate) error(errors, 'retentionDeadline cannot precede reviewedAt');
  }
  validateString(attestation.deletionProcedure, 'deletionProcedure', /^(?:delete-reviewed-evidence|secure-delete|retain-until-deadline)$/, errors);
  validateBoolean(attestation.reviewedAttestation, 'reviewedAttestation', errors);
  validateBoolean(attestation.thresholdsAccepted, 'thresholdsAccepted', errors);

  const section = attestation.stage === 'device-preflight' ? 'devicePreflight' : 'classroomPilot';
  const forbiddenSection = section === 'devicePreflight' ? 'classroomPilot' : 'devicePreflight';
  if (Object.hasOwn(attestation, forbiddenSection)) error(errors, `${forbiddenSection} is not allowed for ${attestation.stage}`);
  rejectUnknownFields(attestation[section], STAGE_FIELDS[attestation.stage], section, errors);
  if (!isObject(attestation[section])) return { valid: false, errors };

  if (attestation.stage === 'device-preflight') {
    for (const field of STAGE_FIELDS['device-preflight']) validateBoolean(attestation.devicePreflight[field], `devicePreflight.${field}`, errors);
  } else {
    const pilot = attestation.classroomPilot;
    for (const field of ['participantCount', 'turnsCompleted', 'crisisCardCount']) {
      if (!Number.isInteger(pilot[field])) error(errors, `classroomPilot.${field} must be an integer`);
    }
    if (!Array.isArray(pilot.pseudonyms) || !pilot.pseudonyms.every(value => typeof value === 'string' && PSEUDONYM.test(value))) error(errors, 'classroomPilot.pseudonyms are invalid');
    if (!Array.isArray(pilot.companyAliases) || !pilot.companyAliases.every(value => typeof value === 'string' && /^(?:[A-G]|Team-[A-G])$/.test(value))) error(errors, 'classroomPilot.companyAliases are invalid');
    if (typeof pilot.firstTurnCompletionRate !== 'number' || pilot.firstTurnCompletionRate < 0 || pilot.firstTurnCompletionRate > 1) error(errors, 'classroomPilot.firstTurnCompletionRate is invalid');
    for (const field of ['roomSetupWithinFiveMinutes', 'allJoinedWithoutManualUrlEdits', 'blockedTeamIdentifiedWithinFifteenSeconds', 'reconnectPreservedActions', 'historyAndExportObtained', 'debriefRecorded']) validateBoolean(pilot[field], `classroomPilot.${field}`, errors);
  }
  return { valid: errors.length === 0, errors };
}

function validateRun(run, expectedRunId) {
  const errors = [];
  rejectUnknownFields(run, RUN_FIELDS, 'run', errors);
  if (!isObject(run)) return { valid: false, errors };
  validateString(run.contract, 'run.contract', /^pilot-run-v1$/, errors);
  validateString(run.runId, 'run.runId', /^[A-Za-z0-9][A-Za-z0-9._-]*$/, errors);
  if (expectedRunId !== undefined && run.runId !== expectedRunId) error(errors, 'run.runId does not match the requested run');
  validateString(run.buildCommit, 'run.buildCommit', COMMIT, errors);
  validateString(run.version, 'run.version', VERSION, errors);
  if (run.dirty !== false) error(errors, 'run.dirty must be false');
  if (!isExactTimestamp(run.createdAt)) error(errors, 'run.createdAt is invalid');
  return { valid: errors.length === 0, errors };
}

function validateAggregate(aggregate) {
  const errors = [];
  rejectUnknownFields(aggregate, AGGREGATE_FIELDS, 'aggregate', errors);
  if (!isObject(aggregate)) return { valid: false, errors };
  validateString(aggregate.buildCommit, 'aggregate.buildCommit', COMMIT, errors);
  validateString(aggregate.version, 'aggregate.version', VERSION, errors);
  validateString(aggregate.receiptChainRoot, 'aggregate.receiptChainRoot', SHA256, errors);
  validateString(aggregate.evidenceDigest, 'aggregate.evidenceDigest', SHA256, errors);
  if (!Array.isArray(aggregate.reviewedStages)
    || aggregate.reviewedStages.length !== 3
    || aggregate.reviewedStages.join(',') !== 'automation,device-preflight,classroom-pilot') {
    error(errors, 'aggregate.reviewedStages is invalid');
  }
  rejectUnknownFields(aggregate.review, AGGREGATE_REVIEW_FIELDS, 'aggregate.review', errors);
  if (isObject(aggregate.review)) {
    validateReview(aggregate.review.devicePreflight, 'aggregate.review.devicePreflight', errors);
    validateReview(aggregate.review.classroomPilot, 'aggregate.review.classroomPilot', errors);
  }
  validateString(aggregate.invalidationStatus, 'aggregate.invalidationStatus', /^clear$/, errors);
  validateString(aggregate.preAnchorEligibility, 'aggregate.preAnchorEligibility', /^PASS_READY$/, errors);
  return { valid: errors.length === 0, errors };
}

module.exports = { validateAggregate, validateAttestation, validateRun };
