function normalizeDevicePreflight(attestation) {
  if (!attestation) return null;
  const facts = attestation.devicePreflight;
  const calculatedThresholdsAccepted = Boolean(facts && [
    'setupHashesMatchManifest', 'cleanInstallSucceeded', 'secondDeviceJoinedByQrLan',
    'externalHealthReachable', 'noManualUrlEditing',
  ].every(field => facts[field] === true));
  return {
    ...attestation,
    reviewedAttestation: attestation.reviewedAttestation === true,
    thresholdsAccepted: attestation.thresholdsAccepted === true && calculatedThresholdsAccepted,
  };
}
module.exports = { normalizeDevicePreflight };
