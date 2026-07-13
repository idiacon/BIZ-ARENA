const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { COMMAND_SEQUENCE } = require('./receipt-contract');
const { validateRun } = require('./schema');

const RUNTIME_DIRECTORY = path.join('.runtime', 'pilot-gate');
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function assertSafeName(value, label) {
  if (typeof value !== 'string' || !SAFE_NAME.test(value) || value.includes('..')) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function fsyncDirectory(directory) {
  // Directory fsync is not supported by every Windows filesystem. The file has
  // already been fsynced; this is the strongest portable follow-up available.
  try {
    const descriptor = fs.openSync(directory, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  } catch (error) {
    const windowsUnsupported = process.platform === 'win32'
      && ['EPERM', 'EINVAL', 'EISDIR', 'EBADF', 'ENOTSUP'].includes(error?.code);
    if (!windowsUnsupported) throw error;
    // Windows may reject directory handles even after the file itself is synced.
  }
}

function writeJsonExclusive(filePath, value) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, contents, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    // link(2) is an atomic create-if-absent operation on the final name.
    fs.linkSync(temporaryPath, filePath);
    fsyncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (error && error.code === 'EEXIST') {
      throw new Error(`Immutable record already exists and cannot be overwritten: ${filePath}`);
    }
    throw error;
  } finally {
    try { fs.unlinkSync(temporaryPath); } catch (_error) { /* already removed */ }
  }
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} does not exist: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonOptional(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
}

function readJsonForEvaluation(filePath, errorCode) {
  if (!fs.existsSync(filePath)) return { present: false, value: null, errors: [] };
  try {
    return { present: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), errors: [] };
  } catch (_error) {
    return { present: true, value: null, errors: [errorCode] };
  }
}

function listJsonForEvaluation(directory, errorCode) {
  if (!fs.existsSync(directory)) return { values: [], errors: [] };
  const values = [];
  const errors = [];
  for (const name of fs.readdirSync(directory).filter(item => item.endsWith('.json')).sort()) {
    try {
      values.push(JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
    } catch (_error) {
      errors.push(errorCode);
    }
  }
  return { values, errors };
}

function timestampName(value, fallback) {
  const timestamp = value || new Date().toISOString();
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp)) {
    throw new Error('Record timestamp must be an ISO-8601 UTC timestamp.');
  }
  return `${timestamp.replace(/[:.]/g, '-')}-${fallback}`;
}

function createRunStore({ rootDir }) {
  if (typeof rootDir !== 'string' || rootDir.length === 0) throw new Error('createRunStore requires rootDir.');
  const storageRoot = path.resolve(rootDir, RUNTIME_DIRECTORY);
  const runDirectory = runId => path.join(storageRoot, assertSafeName(runId, 'run ID'));
  const runPath = runId => path.join(runDirectory(runId), 'run.json');
  const requireRun = runId => {
    const run = readJson(runPath(runId), 'Pilot Gate run');
    const validation = validateRun(run, runId);
    if (!validation.valid) throw new Error(`Pilot Gate run schema is invalid: ${validation.errors.join('; ')}`);
    return run;
  };
  const listJson = directory => fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => readJson(path.join(directory, name), 'Pilot Gate record'))
    : [];
  const listReceipts = runId => {
    requireRun(runId);
    return listJson(path.join(runDirectory(runId), 'receipts'));
  };

  return Object.freeze({
    createRun(run) {
      if (!run || typeof run !== 'object') throw new Error('Run record is required.');
      const validation = validateRun(run, run.runId);
      if (!validation.valid) throw new Error(`Pilot Gate run schema is invalid: ${validation.errors.join('; ')}`);
      const directory = runDirectory(run.runId);
      fs.mkdirSync(storageRoot, { recursive: true, mode: 0o700 });
      try {
        fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
        fsyncDirectory(path.dirname(directory));
      } catch (error) {
        if (error && error.code === 'EEXIST') throw new Error(`Pilot Gate run already exists and cannot be overwritten: ${run.runId}`);
        throw error;
      }
      writeJsonExclusive(path.join(directory, 'run.json'), run);
      return run;
    },
    readRun(runId) { return requireRun(runId); },
    listReceipts,
    appendReceipt(runId, receipt) {
      requireRun(runId);
      if (!receipt || receipt.runId !== runId) throw new Error('Receipt runId must match its run.');
      const position = COMMAND_SEQUENCE.indexOf(receipt.commandId);
      if (position < 0) throw new Error(`Receipt command is not allowlisted: ${receipt.commandId}`);
      const existing = listReceipts(runId);
      if (existing.length !== position) throw new Error(`Receipt sequence violation: expected ${COMMAND_SEQUENCE[existing.length] || 'no additional receipt'}.`);
      const filename = `${String(position + 1).padStart(3, '0')}-${receipt.commandId}.json`;
      writeJsonExclusive(path.join(runDirectory(runId), 'receipts', filename), receipt);
      return receipt;
    },
    readReceipt(runId, commandId) {
      requireRun(runId);
      const position = COMMAND_SEQUENCE.indexOf(commandId);
      if (position < 0) throw new Error(`Receipt command is not allowlisted: ${commandId}`);
      return readJson(path.join(runDirectory(runId), 'receipts', `${String(position + 1).padStart(3, '0')}-${commandId}.json`), 'Pilot Gate receipt');
    },
    writeAttestation(runId, stage, attestation) {
      requireRun(runId); assertSafeName(stage, 'attestation stage');
      writeJsonExclusive(path.join(runDirectory(runId), 'attestations', `${stage}.json`), attestation);
      return attestation;
    },
    readAttestation(runId, stage) {
      requireRun(runId); assertSafeName(stage, 'attestation stage');
      return readJson(path.join(runDirectory(runId), 'attestations', `${stage}.json`), 'Pilot Gate attestation');
    },
    appendEvaluation(runId, evaluation) {
      const directory = runDirectory(runId);
      if (!fs.existsSync(directory)) throw new Error(`Pilot Gate run directory does not exist: ${runId}`);
      const name = timestampName(evaluation?.evaluatedAt || evaluation?.createdAt, `evaluation-${crypto.randomUUID()}`);
      writeJsonExclusive(path.join(directory, 'evaluations', `${name}.json`), evaluation);
      return evaluation;
    },
    listEvaluations(runId) { requireRun(runId); return listJson(path.join(runDirectory(runId), 'evaluations')); },
    writeAggregateCandidate(runId, aggregate) {
      requireRun(runId);
      writeJsonExclusive(path.join(runDirectory(runId), 'aggregate-candidate.json'), aggregate);
      return aggregate;
    },
    readAggregateCandidate(runId) { requireRun(runId); return readJson(path.join(runDirectory(runId), 'aggregate-candidate.json'), 'Pilot Gate aggregate candidate'); },
    readOptionalAggregateCandidate(runId) {
      requireRun(runId);
      return readJsonOptional(path.join(runDirectory(runId), 'aggregate-candidate.json'));
    },
    readEvaluationEvidence(runId) {
      const directory = runDirectory(runId);
      if (!fs.existsSync(directory)) throw new Error(`Pilot Gate run directory does not exist: ${runId}`);
      const run = readJsonForEvaluation(path.join(directory, 'run.json'), 'run-json-invalid');
      const receipts = listJsonForEvaluation(path.join(directory, 'receipts'), 'receipt-json-invalid');
      const devicePreflight = readJsonForEvaluation(path.join(directory, 'attestations', 'device-preflight.json'), 'device-preflight-json-invalid');
      const classroomPilot = readJsonForEvaluation(path.join(directory, 'attestations', 'classroom-pilot.json'), 'classroom-pilot-json-invalid');
      const aggregate = readJsonForEvaluation(path.join(directory, 'aggregate-candidate.json'), 'aggregate-json-invalid');
      const invalidations = listJsonForEvaluation(path.join(directory, 'invalidations'), 'invalidation-json-invalid');
      const schemaRejections = listJsonForEvaluation(path.join(directory, 'schema-rejections'), 'schema-rejection-json-invalid');
      return {
        run: run.value,
        receipts: receipts.values,
        devicePreflight: devicePreflight.value,
        devicePreflightPresent: devicePreflight.present,
        classroomPilot: classroomPilot.value,
        classroomPilotPresent: classroomPilot.present,
        aggregate: aggregate.value,
        aggregatePresent: aggregate.present,
        invalidations: invalidations.values,
        schemaRejections: schemaRejections.values,
        loadErrors: [
          ...run.errors,
          ...receipts.errors,
          ...devicePreflight.errors,
          ...classroomPilot.errors,
          ...aggregate.errors,
          ...invalidations.errors,
          ...schemaRejections.errors,
        ],
      };
    },
    appendInvalidation(runId, invalidation) {
      requireRun(runId); assertSafeName(invalidation?.reasonCode, 'invalidation reason code');
      const name = timestampName(invalidation?.invalidatedAt, `${invalidation.reasonCode}-${crypto.randomUUID()}`);
      writeJsonExclusive(path.join(runDirectory(runId), 'invalidations', `${name}.json`), invalidation);
      return invalidation;
    },
    listInvalidations(runId) { requireRun(runId); return listJson(path.join(runDirectory(runId), 'invalidations')); },
    appendSchemaRejection(runId, rejection) {
      requireRun(runId);
      const name = timestampName(rejection?.rejectedAt, `schema-rejection-${crypto.randomUUID()}`);
      writeJsonExclusive(path.join(runDirectory(runId), 'schema-rejections', `${name}.json`), rejection);
      return rejection;
    },
    listSchemaRejections(runId) { requireRun(runId); return listJson(path.join(runDirectory(runId), 'schema-rejections')); },
  });
}

module.exports = { createRunStore };
