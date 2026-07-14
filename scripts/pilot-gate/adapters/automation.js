const { COMMAND_SEQUENCE, verifyReceiptChain } = require('../receipt-contract');

function normalizeAutomation({ run, receipts }) {
  const safeRun = run && typeof run === 'object' && !Array.isArray(run) ? run : {};
  const receiptChain = verifyReceiptChain(receipts);
  const safeReceipts = Array.isArray(receipts) ? receipts : [];
  const manifest = safeReceipts.find(receipt => receipt?.commandId === 'classroom-package')?.artifactDigests || {};
  const complete = safeReceipts.length === COMMAND_SEQUENCE.length;
  const receiptFailure = safeReceipts.some(receipt => (
    !receipt
    || receipt.runId !== safeRun.runId
    || receipt.buildCommit !== safeRun.buildCommit
    || receipt.version !== safeRun.version
    || receipt.exitCode !== 0
    || receipt.postValidation?.status !== 'passed'
  ));
  const sourceMatches = complete && safeReceipts.every(receipt => (
    receipt
    && receipt.runId === safeRun.runId
    && receipt.buildCommit === safeRun.buildCommit
    && receipt.version === safeRun.version
    && receipt.exitCode === 0
    && receipt.postValidation?.status === 'passed'
  ));
  return {
    complete,
    mechanicallyVerified: Boolean(complete && receiptChain.valid && sourceMatches),
    reviewedAt: safeReceipts.at(-1)?.finishedAt || null,
    receiptChainRoot: receiptChain.receiptChainRoot || null,
    packageManifestHash: manifest.packageManifestHash || null,
    serverSetupSha256: manifest.serverSetupSha256 || null,
    clientSetupSha256: manifest.clientSetupSha256 || null,
    buildCommit: safeRun.buildCommit || null,
    version: safeRun.version || null,
    failureCode: !receiptChain.valid
      ? 'automation-receipt-chain-invalid'
      : receiptFailure
        ? 'automation-receipt-failed-or-mismatched'
        : (complete ? null : 'automation-receipts-missing'),
    failureDetail: receiptChain.valid ? null : receiptChain.code,
  };
}
module.exports = { normalizeAutomation };
