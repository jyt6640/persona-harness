# CI Evidence Reverification Design

**Status:** Item 19 design only. No runtime, schema, default, package version,
publish, tag, or CI workflow behavior changes are included here.

**Source snapshot:** `3d5534c0e886b8a747616654a77f4096e8e6857a`
(`docs(ci): record finish gate contract`, 2026-07-10T22:34:04+09:00).
All line references below are snapshots from that commit.

## Decision

For CI that needs independent verification of a prepared PH project, the
proposed entry surface is:

```sh
ph workflow finish implement --reverify
```

This is a proposed future flag, not a command supported at the source snapshot.
It is intentionally a finish-gate extension rather than `finish --json`:

- current `ph workflow finish implement` remains plaintext and unchanged;
- current `ph workflow closure next --json` remains the separate, unversioned
  diagnostic companion;
- CI receives the finish result from the future flag's normal exit code and
  human stdout/stderr, then retains the existing closure JSON artifact;
- no current or proposed claim requires a JSON finish response.

`--reverify` means PH itself must select and execute the verification command
catalog from the ready project profile, create a fresh PH-owned revalidation
record, and make that record authoritative for that invocation's finish
decision. Agent-authored `.persona` ledger content remains useful context but
is not independent proof for this path.

## Trust Boundary

### Proposed Contract

- Trusted for the narrow CI decision: a fresh process launched by PH with the
  selected fixed argv either completed with the recorded result, or PH reported
  that it could not determine that result.
- Not trusted as authority: implementation/review prose, existing execution
  ledgers, copied JSON files, stale JUnit XML, or an artifact written by an
  agent or another process before the revalidation invocation.
- A pass requires a current attempt whose profile digest, command-plan digest,
  and workspace identity match the invocation. A missing, malformed, stale, or
  mismatched attempt cannot pass finish.
- PH must not delete, repair, overwrite, or relabel stale or malformed legacy
  ledger files. It records their non-authoritative presence only.

### Non-Goals

This does not prove a generated application's quality, security, efficacy,
test sufficiency, broad reliability, or token savings. It does not protect
against a hostile same-user process that can replace executables or paths
between checks and execution. It does not certify remote services, perform
deployment checks, require an OpenCode hook, or make CI a substitute for PH's
own exit authority.

## Existing Observations

At the source snapshot, `runWorkflowFinish` derives reasons from the closure
payload and emits the existing plaintext PASS or BLOCK result. The closure
payload writes JSON separately. `enforce.executeVerification=true` already
selects and runs a direct Gradle test command, but its output is an in-memory
closure summary rather than a CI revalidation artifact contract. When that
enforcement is off, closure may classify local structured evidence and report
text instead.

| Snapshot reference | Observation |
| --- | --- |
| `src/cli/workflow-command.ts:finalGuardReasons` lines 80-82; `runWorkflowFinish` lines 137-146 | Finish delegates to closure reasons and uses plaintext runner output. |
| `src/cli/workflow-closure.ts:runWorkflowClosureCommand` lines 83-103 | `closure next --json` writes the existing JSON companion with exit 0. |
| `src/cli/workflow-closure.ts:readWorkflowClosureState` lines 105-127; `closureBlockers` lines 171-184 | Closure derives verification state and maps non-passed verification to a blocker. |
| `src/cli/workflow-closure-verification.ts:readClosureVerification` lines 24-52 | Strict mode uses direct verification; non-strict mode can read reports and execution evidence. |
| `src/cli/closure-verification-runner.ts:runDirectTestVerification` lines 71-160 | The current direct runner selects Gradle, runs one test command with a 120 s timeout, and returns an in-memory summary. |
| `src/cli/closure-verification-runner.ts:junitVerificationFromFiles` lines 173-218 | Current direct verification filters JUnit XML by post-start modification time. |
| `src/cli/bearshell.ts:runBearshell` lines 75-125; `parseBearshellArgs` lines 131-186 | Bearshell supports fixed argv by default, explicit shell opt-in, timeout, and evidence emission. |
| `src/runtime/execution-evidence.ts:writeBearshellExecutionEvidence` lines 19-46 | Existing bearshell evidence is `phase0.execution.1` and includes command, exit status, bounded output, and timestamps. |
| `src/cli/stack-alignment-profile.ts:readProfileIntent` lines 23-48 | The current profile parser accepts `persona.project-profile.v1` and exposes build tool, framework, and language intent. |
| `docs/current/ci-finish-contract.md` lines 15-32 and 100-108 | Current docs explicitly reject a finish JSON contract and defer independent ledger trust to item 19. |

These observations are not an implementation acceptance claim. They identify
the code and data boundaries that the implementation tickets must preserve or
replace deliberately.

## Proposed Entry And CI Flow

The future CI path is explicit:

```sh
mkdir -p .persona-artifacts
ph workflow finish implement --reverify > .persona-artifacts/finish.stdout 2> .persona-artifacts/finish.stderr
finish_status=$?
ph workflow closure next --json > .persona-artifacts/workflow-closure-next.json
exit "$finish_status"
```

The CI driver must retain artifacts with an `always()`-equivalent step and
must not add `|| true`, `continue-on-error`, or a success override. The first
command's exit code remains PH authority. The second command is diagnostic
only; it does not become a JSON finish protocol.

The plain current finish command keeps its current behavior. The future
`--reverify` path is opt-in until a separately accepted release/default
decision says otherwise.

## Command Selection And Execution

### Catalog

The first implementation scope is only a ready
`persona.project-profile.v1` Java/Spring/Gradle project:

| Condition | Fixed command plan |
| --- | --- |
| Windows with `gradlew.bat` | `cmd.exe /d /s /c gradlew.bat test`, then `cmd.exe /d /s /c gradlew.bat build` |
| Non-Windows with `gradlew` | `./gradlew test`, then `./gradlew build` |
| Wrapper absent, Gradle profile/project detected | `gradle test`, then `gradle build` |
| Any other profile, unsupported profile, or no catalog match | command unavailable |

`bootRun`, HTTP smoke, arbitrary profile command strings, shell snippets, and
tool discovery beyond the table are excluded. The catalog uses fixed command
and argument arrays; profile text selects a catalog row but never supplies an
executable path, argument, shell fragment, or environment value.

### Execution

- Run each command once, serially, in the prepared project root.
- Use no shell. The implementation should use a bounded child-process helper
  with process-group termination semantics rather than raw `spawnSync`.
- Set a 120 s timeout per command to match the current direct verifier. Apply
  a 300 s total attempt budget; a later command is not started after a prior
  failure or timeout.
- Start a new attempt for every `--reverify` invocation. PH result caching is
  prohibited; Gradle's own local cache may exist but cannot substitute for a
  PH-run attempt.
- Capture exit code, timeout flag, bounded/redacted stdout and stderr, command
  order, and post-start JUnit XML references. Do not accept pre-existing JUnit
  XML as the fresh result.

## Result And Artifact Contract

The implementation must introduce a new schema rather than mutate
`phase0.execution.1`. The proposed artifact is
`.persona/evidence/ci-reverification/<attempt-id>.json` with:

```text
schemaVersion: "ph-ci-reverification.1"
attemptId
startedAt, endedAt
phVersion, sourceCommit (when available)
profilePath, profileSha256
workspaceIdentity
commandPlanId, commandPlanSha256
commands[]: ordinal, argv, exitCode, timedOut, durationMs,
            stdoutSha256, stderrSha256, junitRefs[]
result: passed | failed | unavailable | timeout | malformed-profile | partial
legacyLedger: observedCount, authoritative: false
redaction: policyVersion, redactedFieldCount
workspaceMutation: preState, postState, decision
```

The artifact records only relative paths. It does not record environment
values, tokens, credentials, home directories, raw Git remotes, or unbounded
output. Output is redacted before persistence and is bounded with a digest of
the redacted representation. The artifact is provenance for a narrow finish
decision, not a new general evidence schema claim until an implementation and
release decision accept it.

Freshness binding requires all of the following:

1. the finish invocation creates the attempt;
2. the profile digest and command-plan digest match the same invocation;
3. the result is complete and `passed`;
4. the workspace identity has not changed between attempt start and finish
   evaluation; and
5. the artifact passes its own strict parser.

Any failure of that binding becomes a blocked/unknown revalidation result, not
a fallback to the ledger.

## Exit And Block Behavior

| Revalidation result | Proposed finish behavior | Artifact behavior |
| --- | --- | --- |
| All commands pass | Continue normal finish closure; exit 0 only if all other gates pass. | Complete fresh artifact. |
| Command exits nonzero | Exit 1 with `verification-failed` details. | Complete failed artifact with the exit and redacted output. |
| Command unavailable | Exit 1 with `verification-unknown` and an explicit unavailable reason. | Complete unavailable artifact; no fallback to ledger. |
| Timeout | Exit 1 with `verification-unknown` and the timeout detail. | Complete timeout artifact; later commands not started. |
| Malformed/unsupported profile | Exit 1 with `verification-unknown` and profile diagnostic. | Complete malformed-profile artifact if an artifact directory is usable. |
| Partial execution | Exit 1 with `verification-unknown`; do not treat earlier command success as a pass. | Complete partial artifact naming the command not run. |
| Fresh artifact missing or malformed | Exit 1 with `verification-unknown`. | Preserve files; do not repair or delete them. |

The existing human finish renderer remains plaintext. The existing closure JSON
may report the resulting blocker, but the implementation must not add a
`finish --json` flag or reinterpret the closure JSON as a finish result.

## Local/CI Parity And Workspace Policy

`--reverify` uses the same catalog, fixed argv, timeout, artifact shape, and
exit mapping locally and in CI. CI differs only in how it retains artifacts.
There is no host hook, runtime injection, or CI-environment-only command
selection.

The runner may create its new PH-owned artifact directory and normal
build-tool outputs. It must never edit source, reports, profiles, plans,
backlog, or legacy evidence to make a gate pass. It must not automatically
delete stale, malformed, or unexpected files.

Before implementation, the following policy fork must be resolved:

- **P19-1 workspace mutation policy:** whether a newly observed tracked-source
  change outside declared build outputs blocks as `partial`, or is recorded
  only for review. The recommended first implementation is to block in CI and
  report locally, without cleanup, because the CI trust boundary is narrower.

## Ledger Handling

Existing `.persona/evidence`, report prose, and JUnit files are non-authority
inputs for `--reverify`. The runner may count them for diagnostic provenance,
but it must not parse a claimed success as an authoritative substitute for a
fresh execution.

Stale, forged, missing, and malformed ledger entries all preserve the same
safety rule: no deletion, no mutation, no silent recovery, and no finish pass
from that material. The fresh revalidation attempt either establishes its own
result or blocks.

## Acceptance Tests

The implementation acceptance suite must include:

1. Fresh test/build pass reaches the ordinary plaintext finish PASS only when
   all existing closure gates also pass.
2. A forged or stale ledger claiming success cannot override a newly failing
   PH-run command.
3. Existing JUnit XML from before attempt start cannot satisfy freshness.
4. Missing wrapper/system Gradle yields command-unavailable and exit 1.
5. A hanging fixture hits the per-command timeout, records timeout, and does
   not execute the next command.
6. A malformed or unsupported profile blocks without command execution.
7. Test pass plus build failure records `partial` and blocks.
8. Profile text containing shell metacharacters cannot alter the fixed argv.
9. Secrets in simulated output are redacted from the artifact and digest
   calculation uses the redacted form.
10. Local and CI-mode fixtures produce identical result classification for the
    same workspace state.
11. The current plain finish and `closure next --json` contracts remain
    unchanged when `--reverify` is absent.
12. Runtime injection stays default-off and no hook is required to run the
    revalidation path.

## Proposed Implementation Tickets

1. **I19-1: Contract parser and result model.** Add the explicit
   `finish implement --reverify` parser branch, result types, block mapping,
   and plaintext renderer tests. Do not change defaults.
2. **I19-2: Profile-derived command catalog and bounded runner.** Implement
   fixed argv selection, profile validation, serial execution, timeout, and
   JUnit freshness collection.
3. **I19-3: Fresh artifact writer and strict reader.** Add redaction,
   provenance/freshness binding, legacy-ledger non-authority handling, and
   no-delete behavior.
4. **I19-4: Closure integration and CI fixture coverage.** Make the reverify
   result authoritative only for the explicit finish path; retain the current
   closure JSON surface and test all result mappings.
5. **I19-5: Package/docs and external acceptance.** Add the CI recipe update,
   package policy coverage, local/current package smoke, and a separate
   release/default decision. No default promotion is bundled into I19-1..4.

## Deferred Decisions And Out Of Scope

- P19-1 workspace mutation policy is unresolved as described above.
- Whether the `--reverify` flag is later promoted to a default is a separate
  release decision requiring acceptance evidence.
- Whether the catalog expands beyond Java/Spring/Gradle is a separate profile
  and security review.
- Artifact retention duration, CI provider-specific encryption, and a
  registry release are not decided here.

This design neither implements nor certifies revalidation. It makes no claim
about token saving, product efficacy, generated-app quality, broad reliability,
automatic enforcement, delegation, or closure guarantee. Runtime injection
remains default-off and is not a dependency of this proposal.
