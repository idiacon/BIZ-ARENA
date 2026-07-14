# Pilot Gate Evidence Schema

This document is a concise derivative of the normative
[Pilot Gate runbook](pilot-gate-runbook.md). When it differs from the runbook,
the runbook controls.

## Record contract

Run metadata uses `pilot-run-v1` and accepts only `contract`, `runId`,
`buildCommit`, `version`, `dirty`, and `createdAt`. It is revalidated on every
evaluation because `.runtime` is not a trusted store.

Manual submissions use `pilot-attestation-v1` and are accepted only for
`device-preflight` or `classroom-pilot`. Every attestation is bound to one
`runId`, `buildCommit`, `version`, `packageManifestHash`,
`serverSetupSha256`, and `clientSetupSha256`.

Required review metadata is `reviewedAt`, `reviewerRole`, `consentStatus`,
`accessOwner`, `retentionDeadline`, and `deletionProcedure`. Manual records use
`reviewedAttestation: true`; only automation and build-identity checks use
`mechanicallyVerified`.

The accepted nested fields are limited to:

| Stage | Allowlisted aggregate fields |
| --- | --- |
| `device-preflight` | Setup hash match, clean-install result, QR/LAN second-device join, external-health result, no-manual-URL-edit result |
| `classroom-pilot` | participant count, `S1`–`S7`, neutral company aliases, completed turns, Crisis Card result, setup/join/first-turn/blocked-team thresholds, reconnect, history/export, and debrief results |

Unknown fields at every level are rejected. Raw URLs, IP addresses, logs,
screenshots, video, exports, device identifiers, real names, and identity maps
are forbidden.

The classroom attestation records `crisisCardCount` as an integer. The pilot
threshold accepts exactly `1`; zero or multiple cards produce `FAIL`.

The committed aggregate is also strict. Its only fields are `buildCommit`,
`version`, `receiptChainRoot`, `evidenceDigest`, `reviewedStages`, `review`,
`invalidationStatus`, and `preAnchorEligibility`. `runId`, raw evidence,
attestation payloads, and arbitrary metadata are not allowed in the Git anchor.

Automation receipts store only command identity, build identity, timestamps,
exit code, output byte counts and SHA-256 digests, allowlisted artifact digests,
post-command validation status, and the receipt-chain hashes. Unknown receipt
fields are rejected.

## Lifecycle constraints

The CLI accepts manual evidence only after six receipts in the fixed `create →
receipt → ingest → evaluate → invalidate` lifecycle described in the
[runbook](pilot-gate-runbook.md). Missing or unreviewed evidence is
`CONDITIONAL`; invalid data, privacy/retention violations, identity mismatches,
or invalidation are `FAIL`.

Runs are write-once. Corrections use a new run or a separate invalidation
record. The reviewed aggregate anchor is exactly
`docs/pilot-evidence/<runId>.json`; a missing anchor remains `CONDITIONAL` and
a mismatch is `FAIL`.

Use [pilot-evidence-template.json](pilot-evidence-template.json) as the
schema-conforming blank-data template.
