const { evaluatePilotGate } = require('./evaluate');
const { normalizeAutomation } = require('./adapters/automation');
const { normalizeDevicePreflight } = require('./adapters/device-preflight');
const { normalizeClassroomPilot } = require('./adapters/classroom-pilot');
const { validateAttestation, validateRun } = require('./schema');

function normalizeEvidence({ run, expectedRunId, receipts, devicePreflight, devicePreflightPresent, classroomPilot, classroomPilotPresent }) {
  const runValidation = validateRun(run, expectedRunId);
  const deviceValidation = devicePreflightPresent ? validateAttestation(devicePreflight) : { valid: true };
  const classroomValidation = classroomPilotPresent ? validateAttestation(classroomPilot) : { valid: true };
  return {
    automation: normalizeAutomation({ run, receipts }),
    devicePreflight: deviceValidation.valid ? normalizeDevicePreflight(devicePreflight) : null,
    classroomPilot: classroomValidation.valid ? normalizeClassroomPilot(classroomPilot) : null,
    attestationValidation: {
      devicePreflight: deviceValidation.valid,
      classroomPilot: classroomValidation.valid,
    },
    runValidation: runValidation.valid,
  };
}

function evaluateEvidence({ run, expectedRunId, source, receipts, devicePreflight, devicePreflightPresent, classroomPilot, classroomPilotPresent, aggregate, aggregatePresent, aggregateMatchesEvidence, anchor, invalidations, schemaRejections, runtimeLoadErrors, evaluatedAt }) {
  const normalized = normalizeEvidence({ run, expectedRunId, receipts, devicePreflight, devicePreflightPresent, classroomPilot, classroomPilotPresent });
  return evaluatePilotGate({
    run,
    source,
    ...normalized,
    aggregate,
    aggregatePresent,
    aggregateMatchesEvidence,
    anchor,
    invalidations,
    schemaRejections,
    runtimeLoadErrors,
    evaluatedAt,
  });
}

module.exports = { evaluateEvidence, normalizeEvidence };
