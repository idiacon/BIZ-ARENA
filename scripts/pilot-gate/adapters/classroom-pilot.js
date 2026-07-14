function normalizeClassroomPilot(attestation) {
  if (!attestation) return null;
  const facts = attestation.classroomPilot;
  const participantCount = facts?.participantCount;
  const pseudonyms = facts?.pseudonyms;
  const aliases = facts?.companyAliases;
  const calculatedThresholdsAccepted = Boolean(
    Number.isInteger(participantCount) && participantCount >= 5 && participantCount <= 7 &&
    Array.isArray(pseudonyms) && pseudonyms.length === participantCount && new Set(pseudonyms).size === participantCount && pseudonyms.every((value, index) => value === `S${index + 1}`) &&
    Array.isArray(aliases) && aliases.length === participantCount && new Set(aliases).size === participantCount &&
    Number.isInteger(facts?.turnsCompleted) && facts.turnsCompleted >= 5 && facts.turnsCompleted <= 8 &&
    facts?.crisisCardCount === 1 && facts?.roomSetupWithinFiveMinutes === true && facts?.allJoinedWithoutManualUrlEdits === true &&
    facts?.firstTurnCompletionRate >= 0.8 && facts?.blockedTeamIdentifiedWithinFifteenSeconds === true &&
    facts?.reconnectPreservedActions === true && facts?.historyAndExportObtained === true && facts?.debriefRecorded === true,
  );
  return {
    ...attestation,
    reviewedAttestation: attestation.reviewedAttestation === true,
    thresholdsAccepted: attestation.thresholdsAccepted === true && calculatedThresholdsAccepted,
  };
}
module.exports = { normalizeClassroomPilot };
