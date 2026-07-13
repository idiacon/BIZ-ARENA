const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sourceProvenance } = require('../lib/release-provenance');
const { createRunStore } = require('./run-store');
const { COMMAND_SEQUENCE, canonicalJsonHash, verifyReceiptChain } = require('./receipt-contract');
const { captureReceipt } = require('./receipt-capture');
const { validateAggregate, validateAttestation } = require('./schema');
const { evaluateEvidence, normalizeEvidence } = require('./index');
const { normalizeAutomation } = require('./adapters/automation');

function parseArgs(args) {
  const [command, ...rest] = args;
  const options = {};
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      if (!key || options[key] !== undefined || index + 1 >= rest.length || rest[index + 1].startsWith('--')) throw new Error(`Invalid option: ${value}`);
      options[key] = rest[index + 1];
      index += 1;
    } else positional.push(value);
  }
  return { command, options, positional };
}

function readPackageVersion(rootDir) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
}

function assertCleanBuild(rootDir) {
  const provenance = sourceProvenance(rootDir);
  if (provenance.dirty || !/^[a-f0-9]{40}$/.test(provenance.commit || '')) throw new Error('Pilot Gate requires a clean committed Git worktree.');
  const version = readPackageVersion(rootDir);
  if (typeof version !== 'string' || !version) throw new Error('package.json version is required.');
  return { buildCommit: provenance.commit, version };
}

function required(options, name) {
  if (!options[name]) throw new Error(`--${name} is required.`);
  return options[name];
}

function gitOutput(rootDir, args) {
  return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function readAnchor(rootDir, run, aggregate) {
  const relativePath = `docs/pilot-evidence/${run.runId}.json`;
  let head = null;
  try {
    head = gitOutput(rootDir, ['rev-parse', '--verify', 'HEAD']);
    const listedPath = gitOutput(rootDir, ['ls-tree', '--name-only', head, '--', relativePath]);
    if (listedPath !== relativePath) return null;
    const committedText = gitOutput(rootDir, ['show', `${head}:${relativePath}`]);
    let descendantOfBuildCommit = false;
    execFileSync('git', ['merge-base', '--is-ancestor', run.buildCommit, head], { cwd: rootDir, stdio: 'ignore' });
    descendantOfBuildCommit = true;
    const paths = gitOutput(rootDir, ['diff', '--name-only', `${run.buildCommit}..${head}`]);
    const exactAggregateOnlyDiff = paths === relativePath;
    let candidate;
    try {
      candidate = JSON.parse(committedText);
    } catch (_error) {
      return { anchorCommit: head, buildCommit: null, schemaValid: false, loadError: 'anchor-json-invalid' };
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { anchorCommit: head, buildCommit: null, schemaValid: false, loadError: 'anchor-schema-invalid' };
    }
    return {
      anchorCommit: head,
      buildCommit: candidate.buildCommit,
      receiptChainRoot: candidate.receiptChainRoot,
      evidenceDigest: candidate.evidenceDigest,
      schemaValid: validateAggregate(candidate).valid,
      aggregateMatches: canonicalJsonHash(candidate) === canonicalJsonHash(aggregate),
      descendantOfBuildCommit,
      exactAggregateOnlyDiff,
    };
  } catch (_error) {
    return { anchorCommit: head, buildCommit: null, schemaValid: false, loadError: 'anchor-git-read-failed' };
  }
}

function buildAggregate(run, evidence) {
  const reviewedStages = ['automation'];
  if (evidence.devicePreflight?.reviewedAttestation && evidence.devicePreflight.thresholdsAccepted) reviewedStages.push('device-preflight');
  if (evidence.classroomPilot?.reviewedAttestation && evidence.classroomPilot.thresholdsAccepted) reviewedStages.push('classroom-pilot');
  const devicePreflightSha256 = canonicalJsonHash(evidence.devicePreflight);
  const classroomPilotSha256 = canonicalJsonHash(evidence.classroomPilot);
  const digestPayload = {
    runId: run.runId, buildCommit: run.buildCommit, version: run.version,
    receiptChainRoot: evidence.automation.receiptChainRoot,
    packageManifestHash: evidence.automation.packageManifestHash,
    serverSetupSha256: evidence.automation.serverSetupSha256,
    clientSetupSha256: evidence.automation.clientSetupSha256,
    devicePreflightSha256,
    classroomPilotSha256,
    reviewedStages,
  };
  return {
    buildCommit: run.buildCommit,
    version: run.version,
    receiptChainRoot: evidence.automation.receiptChainRoot,
    evidenceDigest: canonicalJsonHash(digestPayload),
    reviewedStages,
    review: {
      devicePreflight: { reviewerRole: evidence.devicePreflight.reviewerRole, reviewedAt: evidence.devicePreflight.reviewedAt },
      classroomPilot: { reviewerRole: evidence.classroomPilot.reviewerRole, reviewedAt: evidence.classroomPilot.reviewedAt },
    },
    invalidationStatus: 'clear',
    preAnchorEligibility: 'PASS_READY',
  };
}

function loadEvidence(rootDir, store, runId, evaluatedAt) {
  const source = sourceProvenance(rootDir);
  const stored = store.readEvaluationEvidence(runId);
  const {
    run,
    receipts,
    devicePreflight,
    devicePreflightPresent,
    classroomPilot,
    classroomPilotPresent,
    aggregate,
    aggregatePresent,
    invalidations,
    schemaRejections,
    loadErrors: runtimeLoadErrors,
  } = stored;
  const preliminary = evaluateEvidence({
    run,
    expectedRunId: runId,
    source,
    receipts,
    devicePreflight,
    devicePreflightPresent,
    classroomPilot,
    classroomPilotPresent,
    aggregate: null,
    aggregatePresent: false,
    anchor: null,
    invalidations,
    schemaRejections,
    runtimeLoadErrors,
    evaluatedAt,
  });
  const normalized = normalizeEvidence({ run, expectedRunId: runId, receipts, devicePreflight, devicePreflightPresent, classroomPilot, classroomPilotPresent });
  const automation = normalized.automation;
  const normalizedDevice = normalized.devicePreflight;
  const normalizedClassroom = normalized.classroomPilot;
  const manualEvidenceAccepted = normalizedDevice?.reviewedAttestation
    && normalizedDevice.thresholdsAccepted
    && normalizedClassroom?.reviewedAttestation
    && normalizedClassroom.thresholdsAccepted;
  const expectedAggregate = preliminary.verdict === 'CONDITIONAL'
    && automation.mechanicallyVerified
    && manualEvidenceAccepted
    ? buildAggregate(run, { automation, devicePreflight: normalizedDevice, classroomPilot: normalizedClassroom })
    : null;
  const candidate = aggregatePresent ? aggregate : expectedAggregate;
  const aggregateMatchesEvidence = !aggregatePresent || Boolean(expectedAggregate && canonicalJsonHash(aggregate) === canonicalJsonHash(expectedAggregate));
  const anchor = candidate && normalized.runValidation ? readAnchor(rootDir, run, candidate) : null;
  return {
    run,
    source,
    receipts,
    devicePreflight,
    devicePreflightPresent,
    classroomPilot,
    classroomPilotPresent,
    aggregate: candidate,
    aggregatePresent: aggregatePresent || Boolean(candidate),
    aggregateMatchesEvidence,
    anchor,
    invalidations,
    schemaRejections,
    runtimeLoadErrors,
    newAggregate: !stored.aggregatePresent && candidate,
    evaluatedAt,
  };
}

async function runCli(args, dependencies = {}) {
  const rootDir = path.resolve(dependencies.rootDir || process.cwd());
  const store = dependencies.store || createRunStore({ rootDir });
  const now = dependencies.now || (() => new Date().toISOString());
  const randomUUID = dependencies.randomUUID || crypto.randomUUID;
  const readAttestation = dependencies.readAttestation || (filePath => JSON.parse(fs.readFileSync(path.resolve(rootDir, filePath), 'utf8')));
  const { command, options, positional } = parseArgs(args);

  if (command === 'create') {
    if (positional.length || Object.keys(options).length) throw new Error('create accepts no arguments.');
    const identity = assertCleanBuild(rootDir);
    return store.createRun({ contract: 'pilot-run-v1', runId: randomUUID(), ...identity, dirty: false, createdAt: now() });
  }

  const runId = required(options, 'run-id');
  if (command === 'receipt') {
    if (positional.length !== 1 || Object.keys(options).some(key => key !== 'run-id')) throw new Error('receipt requires exactly one command ID.');
    const commandId = positional[0];
    const run = store.readRun(runId);
    const receipts = store.listReceipts(runId);
    if (receipts.some(receipt => receipt.commandId === commandId)) {
      throw new Error(`Immutable receipt already exists and cannot be overwritten: ${commandId}.`);
    }
    const expected = COMMAND_SEQUENCE[receipts.length];
    if (commandId !== expected) throw new Error(`Receipt sequence violation: expected ${expected || 'no additional receipt'}, received ${commandId}.`);
    const receipt = await captureReceipt({
      rootDir,
      run,
      commandId,
      previousReceiptSha256: receipts.at(-1)?.receiptSha256 || null,
      executeCommand: dependencies.executeCommand,
    });
    store.appendReceipt(runId, receipt);
    if (receipt.exitCode !== 0 || receipt.postValidation.status !== 'passed') {
      throw new Error(`Canonical command ${commandId} failed receipt validation (${receipt.postValidation.reasonCode || `exit-${receipt.exitCode}`}).`);
    }
    return receipt;
  }
  if (command === 'show-receipt') {
    if (positional.length !== 1 || Object.keys(options).some(key => key !== 'run-id')) throw new Error('show-receipt requires exactly one command ID.');
    return store.readReceipt(runId, positional[0]);
  }
  if (command === 'ingest') {
    if (positional.length || Object.keys(options).some(key => !['run-id', 'stage', 'file'].includes(key))) throw new Error('ingest accepts only --run-id, --stage, and --file.');
    const stage = required(options, 'stage');
    if (!['device-preflight', 'classroom-pilot'].includes(stage)) throw new Error('Attestation stage is not allowlisted.');
    if (store.listReceipts(runId).length !== COMMAND_SEQUENCE.length || !verifyReceiptChain(store.listReceipts(runId)).valid) throw new Error('All six valid receipts are required before attestation ingestion.');
    const attestation = await readAttestation(required(options, 'file'));
    const result = validateAttestation(attestation);
    const receipts = store.listReceipts(runId);
    const run = store.readRun(runId);
    const automation = normalizeAutomation({ run, receipts });
    const identityErrors = result.valid ? [
      ...(attestation.stage === stage ? [] : ['attestation stage mismatch']),
      ...(attestation.runId === run.runId ? [] : ['attestation run identity mismatch']),
      ...(attestation.buildCommit === run.buildCommit ? [] : ['attestation build commit identity mismatch']),
      ...(attestation.version === run.version ? [] : ['attestation version identity mismatch']),
      ...(attestation.packageManifestHash === automation.packageManifestHash ? [] : ['attestation package manifest identity mismatch']),
      ...(attestation.serverSetupSha256 === automation.serverSetupSha256 ? [] : ['attestation Server Setup identity mismatch']),
      ...(attestation.clientSetupSha256 === automation.clientSetupSha256 ? [] : ['attestation Client Setup identity mismatch']),
    ] : [];
    const errors = result.valid ? identityErrors : result.errors;
    if (errors.length) {
      store.appendSchemaRejection(runId, { contract: 'pilot-schema-rejection-v1', stage, rejectedAt: now(), errors });
      throw new Error(`Attestation schema or identity rejected: ${errors.join('; ')}`);
    }
    return store.writeAttestation(runId, stage, attestation);
  }
  if (command === 'evaluate') {
    if (positional.length || Object.keys(options).some(key => key !== 'run-id')) throw new Error('evaluate accepts only --run-id.');
    const evaluatedAt = now();
    const evidence = loadEvidence(rootDir, store, runId, evaluatedAt);
    if (evidence.newAggregate) store.writeAggregateCandidate(runId, evidence.aggregate);
    const result = evaluateEvidence(evidence);
    const evaluation = { ...result, evaluatedAt, receipts: evidence.receipts, schemaRejections: evidence.schemaRejections, aggregateCandidate: evidence.aggregate };
    store.appendEvaluation(runId, evaluation);
    return evaluation;
  }
  if (command === 'invalidate') {
    if (positional.length || Object.keys(options).some(key => !['run-id', 'reason-code'].includes(key))) throw new Error('invalidate accepts only --run-id and --reason-code.');
    const prior = store.readOptionalAggregateCandidate(runId);
    return store.appendInvalidation(runId, { contract: 'pilot-invalidation-v1', reasonCode: required(options, 'reason-code'), invalidatedAt: now(), evidenceDigest: prior?.evidenceDigest || null });
  }
  throw new Error(`Unknown Pilot Gate command: ${command || '(missing)'}.`);
}

if (require.main === module) {
  runCli(process.argv.slice(2)).then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

module.exports = { runCli };
