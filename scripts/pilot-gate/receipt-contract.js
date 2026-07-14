const crypto = require('node:crypto');

const COMMAND_SEQUENCE = Object.freeze([
  'release-verify',
  'release-verify-clean',
  'classroom-rehearsal',
  'dist-classroom',
  'classroom-package',
  'packaged-smoke',
]);

const COMMANDS = Object.freeze({
  'release-verify': Object.freeze({ npmScript: 'release:verify', command: Object.freeze(['npm', 'run', 'release:verify']) }),
  'release-verify-clean': Object.freeze({ npmScript: 'release:verify-clean', command: Object.freeze(['npm', 'run', 'release:verify-clean']) }),
  'classroom-rehearsal': Object.freeze({ npmScript: 'rehearsal:classroom', command: Object.freeze(['npm', 'run', 'rehearsal:classroom']) }),
  'dist-classroom': Object.freeze({ npmScript: 'dist:classroom', command: Object.freeze(['npm', 'run', 'dist:classroom']) }),
  'classroom-package': Object.freeze({ npmScript: 'release:classroom-package', command: Object.freeze(['npm', 'run', 'release:classroom-package']) }),
  'packaged-smoke': Object.freeze({ npmScript: 'smoke:packaged-electron', command: Object.freeze(['npm', 'run', 'smoke:packaged-electron']) }),
});

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const RECEIPT_FIELDS = new Set([
  'contract', 'runId', 'commandId', 'command', 'buildCommit', 'version',
  'startedAt', 'finishedAt', 'exitCode', 'previousReceiptSha256', 'output',
  'artifactDigests', 'postValidation', 'receiptSha256',
]);
const OUTPUT_FIELDS = new Set(['stdoutBytes', 'stderrBytes', 'stdoutSha256', 'stderrSha256', 'truncated']);
const POST_VALIDATION_FIELDS = new Set(['status', 'reasonCode']);
const POST_VALIDATION_REASONS = new Set([
  'command-failed',
  'post-command-build-identity-mismatch',
  'artifact-validation-failed',
]);
const ARTIFACT_FIELDS = Object.freeze({
  'release-verify': new Set(),
  'release-verify-clean': new Set(),
  'classroom-rehearsal': new Set(['rehearsalReportSha256']),
  'dist-classroom': new Set(),
  'classroom-package': new Set(['packageManifestHash', 'serverSetupSha256', 'clientSetupSha256']),
  'packaged-smoke': new Set(),
});

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not allow non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
}

function canonicalJson(value) { return canonicalize(value); }
function canonicalJsonHash(value) { return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex'); }
function getCommand(commandId) {
  const command = COMMANDS[commandId];
  if (!command) throw new Error(`Unknown Pilot Gate command ID: ${commandId}`);
  return command;
}

function rejectUnknownFields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label}.${field} is not allowed.`);
  }
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !TIMESTAMP.test(value)) return false;
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === normalized;
}

function validateReceiptData(receipt) {
  rejectUnknownFields(receipt, RECEIPT_FIELDS, 'receipt');
  const command = getCommand(receipt.commandId);
  if (receipt.contract !== undefined && receipt.contract !== 'pilot-receipt-v1') throw new Error('Receipt contract is invalid.');
  if (typeof receipt.runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(receipt.runId)) throw new Error('Receipt runId is invalid.');
  if (!COMMIT.test(receipt.buildCommit || '')) throw new Error('Receipt buildCommit is invalid.');
  if (!VERSION.test(receipt.version || '')) throw new Error('Receipt version is invalid.');
  if (!validTimestamp(receipt.startedAt) || !validTimestamp(receipt.finishedAt)) throw new Error('Receipt timestamps are invalid.');
  if (!Number.isInteger(receipt.exitCode) || receipt.exitCode < 0 || receipt.exitCode > 255) throw new Error('Receipt exitCode is invalid.');
  if (receipt.previousReceiptSha256 !== null && !SHA256.test(receipt.previousReceiptSha256 || '')) throw new Error('Receipt previousReceiptSha256 is invalid.');
  if (receipt.command && canonicalJson(receipt.command) !== canonicalJson(command.command)) {
    throw new Error(`Receipt command does not match the fixed mapping for ${receipt.commandId}.`);
  }

  rejectUnknownFields(receipt.output, OUTPUT_FIELDS, 'receipt.output');
  for (const field of ['stdoutBytes', 'stderrBytes']) {
    if (!Number.isInteger(receipt.output[field]) || receipt.output[field] < 0) throw new Error(`receipt.output.${field} is invalid.`);
  }
  for (const field of ['stdoutSha256', 'stderrSha256']) {
    if (!SHA256.test(receipt.output[field] || '')) throw new Error(`receipt.output.${field} is invalid.`);
  }
  if (typeof receipt.output.truncated !== 'boolean') throw new Error('receipt.output.truncated is invalid.');

  const allowedArtifacts = ARTIFACT_FIELDS[receipt.commandId];
  rejectUnknownFields(receipt.artifactDigests, allowedArtifacts, 'receipt.artifactDigests');
  for (const [field, value] of Object.entries(receipt.artifactDigests)) {
    if (!SHA256.test(value || '')) throw new Error(`receipt.artifactDigests.${field} is invalid.`);
  }

  rejectUnknownFields(receipt.postValidation, POST_VALIDATION_FIELDS, 'receipt.postValidation');
  if (!['passed', 'failed'].includes(receipt.postValidation.status)) throw new Error('receipt.postValidation.status is invalid.');
  if (receipt.postValidation.status === 'passed' && receipt.postValidation.reasonCode !== null) {
    throw new Error('A passed receipt post-validation cannot have a reason code.');
  }
  if (receipt.postValidation.status === 'failed' && !POST_VALIDATION_REASONS.has(receipt.postValidation.reasonCode)) {
    throw new Error('A failed receipt post-validation requires an allowlisted reason code.');
  }
  if (receipt.postValidation.status === 'passed') {
    const actualArtifactFields = Object.keys(receipt.artifactDigests).sort();
    const requiredArtifactFields = [...allowedArtifacts].sort();
    if (canonicalJson(actualArtifactFields) !== canonicalJson(requiredArtifactFields)) {
      throw new Error(`receipt.artifactDigests does not contain the exact required keys for ${receipt.commandId}.`);
    }
  }
  return command;
}

function receiptPayload(receipt, command) {
  return {
    contract: 'pilot-receipt-v1',
    runId: receipt.runId,
    commandId: receipt.commandId,
    command: command.command,
    buildCommit: receipt.buildCommit,
    version: receipt.version,
    startedAt: receipt.startedAt,
    finishedAt: receipt.finishedAt,
    exitCode: receipt.exitCode,
    previousReceiptSha256: receipt.previousReceiptSha256,
    output: receipt.output,
    artifactDigests: receipt.artifactDigests,
    postValidation: receipt.postValidation,
  };
}

function createReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') throw new Error('Receipt data is required.');
  const command = validateReceiptData(receipt);
  const payload = receiptPayload(receipt, command);
  return { ...payload, receiptSha256: canonicalJsonHash(payload) };
}

function verifyReceipt(receipt) {
  try {
    if (!receipt || receipt.contract !== 'pilot-receipt-v1' || !SHA256.test(receipt.receiptSha256 || '')) {
      return { valid: false, code: 'receipt-contract-invalid', reason: 'invalid receipt contract' };
    }
    const expected = createReceipt(receipt).receiptSha256;
    return expected === receipt.receiptSha256
      ? { valid: true }
      : { valid: false, code: 'receipt-hash-mismatch', reason: 'receipt SHA-256 mismatch' };
  } catch (error) {
    return { valid: false, code: 'receipt-schema-invalid', reason: error.message };
  }
}

function verifyReceiptChain(receipts) {
  if (!Array.isArray(receipts)) return { valid: false, code: 'receipt-chain-not-array', reason: 'receipt chain must be an array' };
  let previousReceiptSha256 = null;
  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index];
    if (receipt?.commandId !== COMMAND_SEQUENCE[index]) return { valid: false, code: 'receipt-command-order-mismatch', reason: `unexpected command at receipt ${index + 1}` };
    if (receipt.previousReceiptSha256 !== previousReceiptSha256) return { valid: false, code: 'receipt-previous-hash-mismatch', reason: `previous receipt hash mismatch at receipt ${index + 1}` };
    const verification = verifyReceipt(receipt);
    if (!verification.valid) return { valid: false, code: verification.code, reason: verification.reason, index };
    previousReceiptSha256 = receipt.receiptSha256;
  }
  return { valid: true, receiptChainRoot: previousReceiptSha256 };
}

module.exports = { COMMANDS, COMMAND_SEQUENCE, canonicalJson, canonicalJsonHash, createReceipt, getCommand, verifyReceipt, verifyReceiptChain };
