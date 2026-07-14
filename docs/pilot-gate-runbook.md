# Pilot Gate B-lite Runbook

Status: normative procedure for the `1.0.0-beta.1` pilot gate.

This is the only normative Pilot Gate procedure. The evidence schema, pilot
validation page, and teacher checklist are short derivatives of this runbook.

## Scope and verdicts

Pilot Gate B-lite evaluates one immutable build identity. It does not replace
the existing release pipeline or prove manual classroom events.

Every record for a run must bind to the same clean 40-character Git commit,
package version, classroom package-manifest digest, and Server and Client Setup
SHA-256 values.

| Condition | Verdict |
| --- | --- |
| Failed/malformed evidence, identity mismatch, dirty tree, failed threshold, privacy or retention violation, or invalidation | `FAIL` |
| A required stage, review, or Git aggregate anchor is missing | `CONDITIONAL` |
| All three reviewed stages match the build identity and the matching aggregate is anchored | `PASS` |

Use strict precedence: `FAIL` > `CONDITIONAL` > `PASS`. A `PASS` only opens a
separate v1.1 Classroom Stability planning decision; it is not cryptographic
proof of device or classroom events.

## Privacy and review boundary

Before creating or joining a room, assign student pseudonyms `S1` through `S7`
and neutral company aliases. Do not keep or submit a mapping to real people.

Evidence is allowlist-only. Do not ingest or place in Git raw URLs, IP
addresses, logs, screenshots, video, raw exports, device names, serial numbers,
or participant names. The gate records only compact booleans, counts, rates,
hashes, timestamps, and the approved pseudonyms/aliases.

Manual device and classroom records are reviewed attestations, not mechanically
verified events. Each manual attestation requires reviewer role and time,
consent status, access owner, retention deadline, and deletion procedure.
Screen recordings, when used outside the gate, require recorded consent, a
named access owner, permitted viewers, a retention deadline, and a documented
deletion date/method. Keep raw operational artefacts outside Git and outside
the evaluator.

## CLI lifecycle

The following is the normative CLI interface. It becomes executable when the
Pilot Gate implementation and its `pilot:*` package scripts are present.

1. `create` creates one write-once run and records its clean build identity.
2. `receipt` captures exactly one canonical prerequisite as a bounded receipt.
3. `ingest` accepts a reviewed, allowlisted manual attestation only after all
   six receipts exist.
4. `evaluate` reads evidence and writes only immutable evaluation records; it
   never runs a release command.
5. `invalidate` appends an invalidation record and never edits prior evidence.

The run record uses strict contract `pilot-run-v1`. Evaluation reloads and
revalidates the run, receipts, attestations, and aggregate from the untrusted
runtime staging directory before computing a verdict.

Run `create` only from a clean, committed tree. Store the returned identifier:

```powershell
$id = (npm run --silent pilot:create | ConvertFrom-Json).runId
```

Capture the receipts in this exact order. Do not skip, repeat, alias, reorder,
or add shell fragments to a command ID.

```powershell
npm run pilot:receipt -- --run-id $id release-verify
npm run pilot:receipt -- --run-id $id release-verify-clean
npm run pilot:receipt -- --run-id $id classroom-rehearsal
npm run pilot:receipt -- --run-id $id dist-classroom
npm run pilot:receipt -- --run-id $id classroom-package
npm run pilot:receipt -- --run-id $id packaged-smoke
npm run pilot:evaluate -- --run-id $id
```

| Position | Command ID | Canonical command |
| ---: | --- | --- |
| 1 | `release-verify` | `npm run release:verify` |
| 2 | `release-verify-clean` | `npm run release:verify-clean` |
| 3 | `classroom-rehearsal` | `npm run rehearsal:classroom` |
| 4 | `dist-classroom` | `npm run dist:classroom` |
| 5 | `classroom-package` | `npm run release:classroom-package` |
| 6 | `packaged-smoke` | `npm run smoke:packaged-electron` |

The expected verdict after the six valid receipts and before manual evidence is
`CONDITIONAL`. The receipt command may execute only the exact canonical command
listed above; the evaluator and adapters must not execute commands, builds,
browsers, installers, smoke tests, or rehearsals.

If a canonical command exits unsuccessfully or its post-command build/artifact
validation fails, the failed attempt is still written as an immutable receipt
and the run evaluates to `FAIL`. Do not delete that receipt and retry the same
run; create a new run after fixing the cause.

## Manual evidence

Use the allowlisted template in
[pilot-evidence-template.json](pilot-evidence-template.json). Replace only
template values with reviewed aggregates for the same run; do not add fields.

For the device-preflight attestation, review and record all of the following:

- actual Server and Client Setup hashes match the classroom manifest;
- clean Setup installation succeeds;
- a separate student device joins through QR/LAN;
- external health is reachable;
- no manual URL editing is required.

For the classroom-pilot attestation, review and record all of the following:

- 5–7 students, 5–8 completed turns, and exactly one Crisis Card;
- `classroomPilot.crisisCardCount` is the integer `1`;
- room setup in at most 5 minutes;
- 100% of joins without manual URL editing;
- at least 80% first-turn completion without navigation help;
- teacher identifies a blocked team in at most 15 seconds;
- reconnect/fallback causes neither a duplicate participant nor a lost action;
- completed history and JSON/CSV export are obtained;
- debrief records at least one explanation using price, demand, costs,
  inventory, or capacity.

Ingest the two separate files only after the ordered receipts complete:

```powershell
npm run pilot:ingest -- --run-id $id --stage device-preflight --file <device-attestation.json>
npm run pilot:ingest -- --run-id $id --stage classroom-pilot --file <classroom-attestation.json>
npm run pilot:evaluate -- --run-id $id
```

The first evaluation with complete reviewed manual evidence is still
`CONDITIONAL`: it creates an aggregate candidate with
`preAnchorEligibility: "PASS_READY"` and has no final `PASS` until anchoring.

## Aggregate anchor and invalidation

The sole durable reviewed anchor path is exactly:

```text
docs/pilot-evidence/<runId>.json
```

Copy the reviewed, redacted aggregate candidate to that path. It may contain
only build commit, version, receipt-chain root, evidence digest, reviewed stage
statuses, reviewer role/time, invalidation status, and
`preAnchorEligibility: "PASS_READY"`. It must not contain the final verdict or
any raw classroom artefact.

Commit this aggregate as a descendant of `buildCommit`. Its diff must contain
only `docs/pilot-evidence/<runId>.json`; the evaluator treats the commit as
`anchorCommit` and verifies that it descends from `buildCommit`. Do not put
`anchorCommit` inside the aggregate, because a commit cannot contain its own
hash. Re-run evaluation after the commit. The evaluator reads the aggregate
from the Git object at `HEAD`, reports that commit as `anchorCommit`, requires a
clean working tree, and permits `PASS` only when the committed blob matches the
local candidate.

The ignored `.runtime/pilot-gate/` store is CLI append-only staging, not a
trusted or recoverable archive. Its hash chain detects mutation, while the
redacted committed aggregate provides the durable Git anchor. Keep any private
backup outside Git under the documented access and retention policy.

Never correct a record in place. To invalidate a run, append a reason-coded
record:

```powershell
npm run pilot:invalidate -- --run-id $id --reason-code <code>
```

An invalidation changes the verdict to `FAIL` without altering earlier records.
For a corrected build or evidence set, create a new run. A durable invalidation
anchor is a later descendant commit containing only
`docs/pilot-evidence/<runId>.invalidation.json`, which references the original
aggregate digest and a reason code.
