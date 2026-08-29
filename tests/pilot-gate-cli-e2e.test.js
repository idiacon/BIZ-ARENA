const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runCli } = require('../scripts/pilot-gate/cli');
const { COMMAND_SEQUENCE, canonicalJsonHash, createReceipt, verifyReceipt, verifyReceiptChain } = require('../scripts/pilot-gate/receipt-contract');

function createGitFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biz-arena-pilot-cli-'));
  execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
  execFileSync('git', ['config', 'user.email', 'pilot@example.test'], { cwd: rootDir });
  execFileSync('git', ['config', 'user.name', 'Pilot Gate Test'], { cwd: rootDir });
  fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({ version: '1.0.0-beta.1' }));
  fs.writeFileSync(path.join(rootDir, '.gitignore'), '.runtime/\n', 'utf8');
  execFileSync('git', ['add', 'package.json', '.gitignore'], { cwd: rootDir });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: rootDir });
  return rootDir;
}

function commandExecutor(commandId) {
  return {
    commandId,
    exitCode: 0,
    stdout: `${commandId} passed`,
    stderr: '',
    artifactDigests: commandId === 'classroom-rehearsal'
      ? { rehearsalReportSha256: '1'.repeat(64) }
      : commandId === 'classroom-package'
        ? {
          packageManifestHash: 'd'.repeat(64),
          serverSetupSha256: 'e'.repeat(64),
          clientSetupSha256: 'f'.repeat(64),
        }
        : {},
  };
}

async function createRunWithSixReceipts(rootDir) {
  const created = await runCli(['create'], { rootDir, executeCommand: commandExecutor });
  for (const commandId of COMMAND_SEQUENCE) {
    await runCli(['receipt', '--run-id', created.runId, commandId], { rootDir, executeCommand: commandExecutor });
  }
  return created;
}

function reviewedAttestation(stage, run) {
  return {
    contract: 'pilot-attestation-v1',
    stage,
    runId: run.runId,
    buildCommit: run.buildCommit,
    version: run.version,
    packageManifestHash: 'd'.repeat(64),
    serverSetupSha256: 'e'.repeat(64),
    clientSetupSha256: 'f'.repeat(64),
    reviewedAt: '2026-07-12T09:00:00.000Z',
    reviewerRole: 'release-reviewer',
    consentStatus: 'recorded',
    accessOwner: 'release-manager',
    retentionDeadline: '2099-12-31',
    deletionProcedure: 'delete-reviewed-evidence',
    reviewedAttestation: true,
    thresholdsAccepted: true,
    ...(stage === 'device-preflight'
      ? { devicePreflight: { setupHashesMatchManifest: true, cleanInstallSucceeded: true, secondDeviceJoinedByQrLan: true, externalHealthReachable: true, noManualUrlEditing: true } }
      : { classroomPilot: { participantCount: 5, pseudonyms: ['S1', 'S2', 'S3', 'S4', 'S5'], companyAliases: ['A', 'B', 'C', 'D', 'E'], turnsCompleted: 5, crisisCardCount: 1, roomSetupWithinFiveMinutes: true, allJoinedWithoutManualUrlEdits: true, firstTurnCompletionRate: 0.8, blockedTeamIdentifiedWithinFifteenSeconds: true, reconnectPreservedActions: true, historyAndExportObtained: true, debriefRecorded: true } }),
  };
}

async function createPassingRun(rootDir) {
  const run = await createRunWithSixReceipts(rootDir);
  for (const stage of ['device-preflight', 'classroom-pilot']) {
    const filePath = path.join(rootDir, '.runtime', 'inputs', `${stage}.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(reviewedAttestation(stage, run)));
    await runCli(['ingest', '--run-id', run.runId, '--stage', stage, '--file', filePath], { rootDir, executeCommand: commandExecutor });
  }
  const preAnchor = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });
  assert.equal(preAnchor.verdict, 'CONDITIONAL');
  assert.equal(preAnchor.aggregateCandidate.preAnchorEligibility, 'PASS_READY');
  const anchorPath = path.join(rootDir, 'docs', 'pilot-evidence', `${run.runId}.json`);
  fs.mkdirSync(path.dirname(anchorPath), { recursive: true });
  fs.writeFileSync(anchorPath, JSON.stringify(preAnchor.aggregateCandidate));
  execFileSync('git', ['add', path.relative(rootDir, anchorPath)], { cwd: rootDir });
  execFileSync('git', ['commit', '--quiet', '-m', 'anchor pilot evidence'], { cwd: rootDir });
  return { runId: run.runId, aggregateCandidate: preAnchor.aggregateCandidate };
}

test('creates six receipts in the canonical command order and returns CONDITIONAL before attestations', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });

    assert.deepEqual(evaluation.receipts.map(receipt => receipt.commandId), COMMAND_SEQUENCE);
    assert.equal(verifyReceiptChain(evaluation.receipts).valid, true);
    assert.equal(evaluation.verdict, 'CONDITIONAL');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('rejects a receipt command requested before its required predecessor', async () => {
  const rootDir = createGitFixture();
  try {
    const created = await runCli(['create'], { rootDir, executeCommand: commandExecutor });

    await assert.rejects(
      runCli(['receipt', '--run-id', created.runId, 'packaged-smoke'], { rootDir, executeCommand: commandExecutor }),
      /sequence|order|release-verify/i
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('records a failed canonical command and returns FAIL for the run', async () => {
  const rootDir = createGitFixture();
  try {
    const created = await runCli(['create'], { rootDir, executeCommand: commandExecutor });
    const failingExecutor = commandId => ({ ...commandExecutor(commandId), exitCode: 1 });

    await assert.rejects(
      runCli(['receipt', '--run-id', created.runId, 'release-verify'], { rootDir, executeCommand: failingExecutor }),
      /failed|exit code/i
    );

    const receipt = await runCli(['show-receipt', '--run-id', created.runId, 'release-verify'], { rootDir, executeCommand: commandExecutor });
    const evaluation = await runCli(['evaluate', '--run-id', created.runId], { rootDir, executeCommand: commandExecutor });
    assert.equal(receipt.exitCode, 1);
    assert.equal(evaluation.verdict, 'FAIL');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('records post-command artifact validation failure as an immutable failed receipt', async () => {
  const rootDir = createGitFixture();
  try {
    const created = await runCli(['create'], { rootDir, executeCommand: commandExecutor });
    for (const commandId of COMMAND_SEQUENCE.slice(0, 4)) {
      await runCli(['receipt', '--run-id', created.runId, commandId], { rootDir, executeCommand: commandExecutor });
    }
    const missingArtifacts = commandId => ({ ...commandExecutor(commandId), artifactDigests: {} });

    await assert.rejects(
      runCli(['receipt', '--run-id', created.runId, 'classroom-package'], { rootDir, executeCommand: missingArtifacts }),
      /artifact|post-command|validation/i
    );

    const receipt = await runCli(['show-receipt', '--run-id', created.runId, 'classroom-package'], { rootDir });
    const evaluation = await runCli(['evaluate', '--run-id', created.runId], { rootDir });
    assert.equal(receipt.postValidation.status, 'failed');
    assert.equal(evaluation.verdict, 'FAIL');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('rejects privacy-sensitive or unknown receipt fields', () => {
  const receipt = {
    runId: 'pilot-receipt-schema',
    commandId: 'release-verify',
    buildCommit: 'a'.repeat(40),
    version: '1.0.0-beta.1',
    startedAt: '2026-07-12T09:00:00.000Z',
    finishedAt: '2026-07-12T09:01:00.000Z',
    exitCode: 0,
    previousReceiptSha256: null,
    output: {
      stdoutBytes: 1,
      stderrBytes: 0,
      stdoutSha256: 'b'.repeat(64),
      stderrSha256: 'c'.repeat(64),
      truncated: false,
    },
    artifactDigests: {},
    postValidation: { status: 'passed', reasonCode: null },
    rawLog: 'not allowed',
  };

  assert.throws(() => createReceipt(receipt), /not allowed|unknown|rawLog/i);
});

test('rejects a rehashed successful rehearsal receipt without its required digest', () => {
  const valid = createReceipt({
    runId: 'pilot-artifact-schema',
    commandId: 'classroom-rehearsal',
    buildCommit: 'a'.repeat(40),
    version: '1.0.0-beta.1',
    startedAt: '2026-07-12T09:00:00.000Z',
    finishedAt: '2026-07-12T09:01:00.000Z',
    exitCode: 0,
    previousReceiptSha256: null,
    output: { stdoutBytes: 1, stderrBytes: 0, stdoutSha256: 'b'.repeat(64), stderrSha256: 'c'.repeat(64), truncated: false },
    artifactDigests: { rehearsalReportSha256: 'd'.repeat(64) },
    postValidation: { status: 'passed', reasonCode: null },
  });
  const { receiptSha256: _discarded, ...payload } = valid;
  payload.artifactDigests = {};
  const tampered = { ...payload, receiptSha256: canonicalJsonHash(payload) };

  assert.equal(verifyReceipt(tampered).valid, false);
});

test('rejects a receipt chain whose previous hash no longer matches', () => {
  const receipts = COMMAND_SEQUENCE.map((commandId, index) => ({
    commandId,
    previousReceiptSha256: index === 0 ? null : 'a'.repeat(64),
    receiptSha256: 'b'.repeat(64),
  }));
  receipts[2].previousReceiptSha256 = 'c'.repeat(64);

  const result = verifyReceiptChain(receipts);

  assert.equal(result.valid, false);
});

test('returns FAIL after an out-of-band receipt reorder or mutation', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    const receiptDirectory = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'receipts');
    const firstPath = path.join(receiptDirectory, '001-release-verify.json');
    const secondPath = path.join(receiptDirectory, '002-release-verify-clean.json');
    const first = fs.readFileSync(firstPath, 'utf8');
    const second = fs.readFileSync(secondPath, 'utf8');
    fs.writeFileSync(firstPath, second);
    fs.writeFileSync(secondPath, first);

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('automation-receipt-chain-invalid'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('returns an immutable FAIL evaluation for corrupted receipt JSON', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    const receiptPath = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'receipts', '003-classroom-rehearsal.json');
    fs.writeFileSync(receiptPath, '{not-json');

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('receipt-json-invalid'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('revalidates stored attestations and rejects out-of-band mutation', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    for (const stage of ['device-preflight', 'classroom-pilot']) {
      const filePath = path.join(rootDir, '.runtime', 'inputs', `${stage}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(reviewedAttestation(stage, run)));
      await runCli(['ingest', '--run-id', run.runId, '--stage', stage, '--file', filePath], { rootDir });
    }
    const storedPath = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'attestations', 'device-preflight.json');
    const tampered = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
    tampered.rawUrl = 'http://192.168.1.5:3000';
    fs.writeFileSync(storedPath, JSON.stringify(tampered));

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('device-preflight-schema-invalid'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('treats a stored null attestation as invalid rather than missing', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    for (const stage of ['device-preflight', 'classroom-pilot']) {
      const filePath = path.join(rootDir, '.runtime', 'inputs', `${stage}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(reviewedAttestation(stage, run)));
      await runCli(['ingest', '--run-id', run.runId, '--stage', stage, '--file', filePath], { rootDir });
    }
    const storedPath = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'attestations', 'device-preflight.json');
    fs.writeFileSync(storedPath, 'null');

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('device-preflight-schema-invalid'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('revalidates run metadata and records FAIL for unknown fields', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    const runPath = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'run.json');
    const tampered = JSON.parse(fs.readFileSync(runPath, 'utf8'));
    tampered.rawUrl = 'http://192.168.1.5:3000';
    fs.writeFileSync(runPath, JSON.stringify(tampered));

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('run-schema-invalid'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('records FAIL instead of throwing for malformed run JSON', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    const runPath = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'run.json');
    fs.writeFileSync(runPath, '{not-json');

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('run-json-invalid'));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('returns PASS after valid reviewed attestations and a matching aggregate anchor', async () => {
  const rootDir = createGitFixture();
  try {
    const { runId } = await createPassingRun(rootDir);

    const evaluation = await runCli(['evaluate', '--run-id', runId], { rootDir, executeCommand: commandExecutor });

    assert.equal(evaluation.verdict, 'PASS');
    assert.match(evaluation.anchorCommit, /^[a-f0-9]{40}$/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('returns FAIL when the committed aggregate differs from the local candidate', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    for (const stage of ['device-preflight', 'classroom-pilot']) {
      const filePath = path.join(rootDir, '.runtime', 'inputs', `${stage}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(reviewedAttestation(stage, run)));
      await runCli(['ingest', '--run-id', run.runId, '--stage', stage, '--file', filePath], { rootDir, executeCommand: commandExecutor });
    }
    const preAnchor = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });
    const anchorPath = path.join(rootDir, 'docs', 'pilot-evidence', `${run.runId}.json`);
    fs.mkdirSync(path.dirname(anchorPath), { recursive: true });
    fs.writeFileSync(anchorPath, JSON.stringify({ ...preAnchor.aggregateCandidate, unexpected: true }));
    execFileSync('git', ['add', path.relative(rootDir, anchorPath)], { cwd: rootDir });
    execFileSync('git', ['commit', '--quiet', '-m', 'anchor mismatched evidence'], { cwd: rootDir });
    fs.writeFileSync(anchorPath, JSON.stringify(preAnchor.aggregateCandidate));

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.some(reason => /anchor|dirty/.test(reason)));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('records FAIL for a committed null anchor instead of throwing', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    for (const stage of ['device-preflight', 'classroom-pilot']) {
      const filePath = path.join(rootDir, '.runtime', 'inputs', `${stage}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(reviewedAttestation(stage, run)));
      await runCli(['ingest', '--run-id', run.runId, '--stage', stage, '--file', filePath], { rootDir });
    }
    await runCli(['evaluate', '--run-id', run.runId], { rootDir });
    const anchorPath = path.join(rootDir, 'docs', 'pilot-evidence', `${run.runId}.json`);
    fs.mkdirSync(path.dirname(anchorPath), { recursive: true });
    fs.writeFileSync(anchorPath, 'null');
    execFileSync('git', ['add', path.relative(rootDir, anchorPath)], { cwd: rootDir });
    execFileSync('git', ['commit', '--quiet', '-m', 'anchor null evidence'], { cwd: rootDir });

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.some(reason => /anchor/.test(reason)));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('treats a present null aggregate candidate as invalid and never rebuilds it', async () => {
  const rootDir = createGitFixture();
  try {
    const { runId } = await createPassingRun(rootDir);
    const aggregatePath = path.join(rootDir, '.runtime', 'pilot-gate', runId, 'aggregate-candidate.json');
    fs.writeFileSync(aggregatePath, 'null');

    const evaluation = await runCli(['evaluate', '--run-id', runId], { rootDir });

    assert.equal(evaluation.verdict, 'FAIL');
    assert.ok(evaluation.reasons.includes('aggregate-schema-invalid'));
    assert.equal(evaluation.aggregateCandidate, null);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('preserves explicit threshold failure for reviewed and unreviewed attestations', async t => {
  for (const reviewedAttestationValue of [true, false]) {
    await t.test(`reviewedAttestation=${reviewedAttestationValue}`, async () => {
      const rootDir = createGitFixture();
      try {
        const run = await createRunWithSixReceipts(rootDir);
        const attestation = reviewedAttestation('device-preflight', run);
        attestation.reviewedAttestation = reviewedAttestationValue;
        attestation.thresholdsAccepted = false;
        await runCli(['ingest', '--run-id', run.runId, '--stage', 'device-preflight', '--file', 'device.json'], {
          rootDir,
          readAttestation: () => attestation,
        });

        const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir });

        assert.equal(evaluation.verdict, 'FAIL');
        assert.ok(evaluation.reasons.includes('device-preflight-thresholds-not-accepted'));
      } finally {
        fs.rmSync(rootDir, { recursive: true, force: true });
      }
    });
  }
});

test('returns FAIL when both local candidate and anchor are tampered after review', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    for (const stage of ['device-preflight', 'classroom-pilot']) {
      const filePath = path.join(rootDir, '.runtime', 'inputs', `${stage}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(reviewedAttestation(stage, run)));
      await runCli(['ingest', '--run-id', run.runId, '--stage', stage, '--file', filePath], { rootDir, executeCommand: commandExecutor });
    }
    const preAnchor = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });
    const tampered = { ...preAnchor.aggregateCandidate, evidenceDigest: '0'.repeat(64) };
    const localCandidatePath = path.join(rootDir, '.runtime', 'pilot-gate', run.runId, 'aggregate-candidate.json');
    fs.writeFileSync(localCandidatePath, JSON.stringify(tampered));
    const anchorPath = path.join(rootDir, 'docs', 'pilot-evidence', `${run.runId}.json`);
    fs.mkdirSync(path.dirname(anchorPath), { recursive: true });
    fs.writeFileSync(anchorPath, JSON.stringify(tampered));
    execFileSync('git', ['add', path.relative(rootDir, anchorPath)], { cwd: rootDir });
    execFileSync('git', ['commit', '--quiet', '-m', 'anchor tampered evidence'], { cwd: rootDir });

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });

    assert.equal(evaluation.verdict, 'FAIL');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('rejects an unknown nested attestation field and records a failing schema rejection', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);

    await assert.rejects(
      runCli(['ingest', '--run-id', run.runId, '--stage', 'device-preflight', '--file', 'device.json'], {
        rootDir,
        executeCommand: commandExecutor,
        readAttestation: () => ({
          stage: 'device-preflight',
          devicePreflight: { network: { url: 'http://192.168.1.5:3000' } },
        }),
      }),
      /schema|unknown|devicePreflight\.network/i
    );

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });
    assert.equal(evaluation.verdict, 'FAIL');
    assert.equal(evaluation.schemaRejections.length, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('rejects a reviewed attestation bound to another build identity', async () => {
  const rootDir = createGitFixture();
  try {
    const run = await createRunWithSixReceipts(rootDir);
    const attestation = reviewedAttestation('device-preflight', run);
    attestation.buildCommit = '0'.repeat(40);

    await assert.rejects(
      runCli(['ingest', '--run-id', run.runId, '--stage', 'device-preflight', '--file', 'device.json'], {
        rootDir,
        executeCommand: commandExecutor,
        readAttestation: () => attestation,
      }),
      /identity|build commit/i
    );

    const evaluation = await runCli(['evaluate', '--run-id', run.runId], { rootDir, executeCommand: commandExecutor });
    assert.equal(evaluation.verdict, 'FAIL');
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('rejects an attempted receipt overwrite without changing its original hash', async () => {
  const rootDir = createGitFixture();
  try {
    const created = await runCli(['create'], { rootDir, executeCommand: commandExecutor });
    const first = await runCli(['receipt', '--run-id', created.runId, 'release-verify'], { rootDir, executeCommand: commandExecutor });

    await assert.rejects(
      runCli(['receipt', '--run-id', created.runId, 'release-verify'], { rootDir, executeCommand: commandExecutor }),
      /already exists|exclusive|overwrite/i
    );

    const current = await runCli(['show-receipt', '--run-id', created.runId, 'release-verify'], { rootDir, executeCommand: commandExecutor });
    assert.equal(current.receiptSha256, first.receiptSha256);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('returns FAIL after invalidation without changing the prior aggregate', async () => {
  const rootDir = createGitFixture();
  try {
    const { runId, aggregateCandidate } = await createPassingRun(rootDir);
    const before = await runCli(['evaluate', '--run-id', runId], { rootDir, executeCommand: commandExecutor });
    assert.equal(before.verdict, 'PASS');
    await runCli(['invalidate', '--run-id', runId, '--reason-code', 'setup-hash-mismatch'], { rootDir, executeCommand: commandExecutor });
    const after = await runCli(['evaluate', '--run-id', runId], { rootDir, executeCommand: commandExecutor });

    assert.equal(after.verdict, 'FAIL');
    assert.equal(after.aggregateCandidate.evidenceDigest, aggregateCandidate.evidenceDigest);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
