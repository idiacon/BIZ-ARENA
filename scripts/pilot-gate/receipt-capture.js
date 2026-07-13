const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { sourceProvenance, sha256File } = require('../lib/release-provenance');
const { npmCommandSpec } = require('../lib/npm-command');
const { createReceipt, getCommand } = require('./receipt-contract');

const MAX_CAPTURED_OUTPUT_BYTES = 1024 * 1024;
const HEX_64 = /^[a-f0-9]{64}$/;

function readPackageVersion(rootDir) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
}

function assertCleanIdentity(rootDir, run) {
  const provenance = sourceProvenance(rootDir);
  const version = readPackageVersion(rootDir);
  if (provenance.dirty) throw new Error('Pilot Gate receipt capture requires a clean Git worktree.');
  if (!provenance.commit || provenance.commit !== run.buildCommit) throw new Error('Pilot Gate receipt build commit does not match the run.');
  if (version !== run.version) throw new Error('Pilot Gate receipt package version does not match the run.');
  return { provenance, version };
}

function digestText(value) {
  const buffer = Buffer.from(String(value || ''), 'utf8');
  return { bytes: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), truncated: buffer.length > MAX_CAPTURED_OUTPUT_BYTES };
}

function createOutputDigest() {
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  return {
    write(chunk) { const buffer = Buffer.from(chunk); bytes += buffer.length; hash.update(buffer); },
    result() { return { bytes, sha256: hash.digest('hex'), truncated: bytes > MAX_CAPTURED_OUTPUT_BYTES }; },
  };
}

function npmSpawnSpec(npmScript, { platform = process.platform, comspec = process.env.ComSpec } = {}) {
  return npmCommandSpec(['run', npmScript], { platform, comspec });
}

function runNpmScript(rootDir, command, onOutput) {
  return new Promise((resolve, reject) => {
    const { executable, args } = npmSpawnSpec(command.npmScript);
    const child = spawn(executable, args, { cwd: rootDir, shell: false, windowsHide: true });
    const stdout = createOutputDigest(); const stderr = createOutputDigest();
    child.stdout.on('data', chunk => { stdout.write(chunk); if (onOutput) onOutput('stdout', chunk); else process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { stderr.write(chunk); if (onOutput) onOutput('stderr', chunk); else process.stderr.write(chunk); });
    child.once('error', reject);
    child.once('close', exitCode => resolve({ exitCode: exitCode ?? 1, output: { stdout: stdout.result(), stderr: stderr.result() } }));
  });
}

function classroomArtifactDigests(rootDir, run, commandId) {
  const { version, buildCommit } = run;
  if (commandId === 'classroom-rehearsal') {
    const report = path.join(rootDir, '.runtime', 'rehearsals', 'classroom-rehearsal-latest.json');
    if (!fs.existsSync(report)) throw new Error('Classroom rehearsal did not produce its latest report.');
    return { rehearsalReportSha256: sha256File(report) };
  }
  if (commandId !== 'classroom-package') return {};
  const manifestPath = path.join(rootDir, 'dist', `classroom-release-manifest-${version}.json`);
  if (!fs.existsSync(manifestPath)) throw new Error('Classroom package did not produce its release manifest.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== version || manifest.source?.commit !== buildCommit || manifest.source?.dirty !== false) {
    throw new Error('Classroom package manifest source identity is dirty or does not match the Pilot Gate run commit/version.');
  }
  const byName = new Map((manifest.files || []).map(file => [file.name, file.sha256]));
  const serverSetupSha256 = byName.get(`BizArena-Server-${version}-Setup-x64.exe`);
  const clientSetupSha256 = byName.get(`BizArena-Client-${version}-Setup-x64.exe`);
  if (![serverSetupSha256, clientSetupSha256].every(value => typeof value === 'string' && HEX_64.test(value))) {
    throw new Error('Classroom package manifest is missing Setup SHA-256 values.');
  }
  return { packageManifestHash: sha256File(manifestPath), serverSetupSha256, clientSetupSha256 };
}

function validateArtifactDigests(commandId, artifactDigests) {
  const required = commandId === 'classroom-rehearsal'
    ? ['rehearsalReportSha256']
    : commandId === 'classroom-package'
      ? ['packageManifestHash', 'serverSetupSha256', 'clientSetupSha256']
      : [];
  if (!required.every(field => HEX_64.test(artifactDigests?.[field] || ''))) {
    throw new Error(`Canonical command ${commandId} did not produce its required artifact digests.`);
  }
}

async function captureReceipt({ rootDir, run, commandId, previousReceiptSha256 = null, executeCommand, onOutput }) {
  if (!rootDir || !run) throw new Error('captureReceipt requires rootDir and run.');
  const command = getCommand(commandId);
  assertCleanIdentity(rootDir, run);
  const startedAt = new Date().toISOString();
  const result = executeCommand
    ? await executeCommand(commandId, { command: [...command.command], npmScript: command.npmScript, rootDir, onOutput })
    : await runNpmScript(rootDir, command, onOutput);
  if (!result || !Number.isInteger(result.exitCode)) throw new Error('Command executor must return an integer exitCode.');
  const finishedAt = new Date().toISOString();
  const stdout = result.output?.stdout || digestText(result.stdout);
  const stderr = result.output?.stderr || digestText(result.stderr);
  let artifactDigests = {};
  let postValidation = { status: 'passed', reasonCode: null };
  if (result.exitCode !== 0) {
    postValidation = { status: 'failed', reasonCode: 'command-failed' };
  } else {
    try {
      assertCleanIdentity(rootDir, run);
    } catch (_error) {
      postValidation = { status: 'failed', reasonCode: 'post-command-build-identity-mismatch' };
    }
    if (postValidation.status === 'passed') {
      try {
        // Test executors supply a deterministic artifact view. Production derives
        // the same allowlisted hashes from files produced by the canonical command.
        artifactDigests = executeCommand
          ? { ...(result.artifactDigests || {}) }
          : classroomArtifactDigests(rootDir, run, commandId);
        validateArtifactDigests(commandId, artifactDigests);
      } catch (_error) {
        artifactDigests = {};
        postValidation = { status: 'failed', reasonCode: 'artifact-validation-failed' };
      }
    }
  }
  return createReceipt({
    runId: run.runId,
    commandId,
    buildCommit: run.buildCommit,
    version: run.version,
    startedAt,
    finishedAt,
    exitCode: result.exitCode,
    previousReceiptSha256,
    output: { stdoutBytes: stdout.bytes, stderrBytes: stderr.bytes, stdoutSha256: stdout.sha256, stderrSha256: stderr.sha256, truncated: stdout.truncated || stderr.truncated },
    artifactDigests,
    postValidation,
  });
}

module.exports = { MAX_CAPTURED_OUTPUT_BYTES, captureReceipt, classroomArtifactDigests, npmSpawnSpec, runNpmScript };
