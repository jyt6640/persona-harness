# CI Evidence Reverification Design

**Status:** Item 19 design only. No runtime, schema, default, package version,
publish, tag, or CI workflow behavior changes are included here.

**Source snapshot:** `f51abd1b74fdb4aed2433ea135a3ffcc54c28e99`
(`docs(ci): specify reverification contracts`,
2026-07-10T23:14:45+09:00).
All line references below are snapshots from that commit.

## Decision

For CI that needs independent verification of a prepared PH project, the
proposed entry surface is:

```sh
ph workflow finish implement --reverify --ci
```

These are proposed future flags, not commands supported at the source snapshot.
`--ci` is the explicit authority selector for the CI policy; an environment
variable alone never selects CI mode. `--ci` requires `--reverify`. The
proposed surface is intentionally a finish-gate extension rather than
`finish --json`:

- current `ph workflow finish implement` remains plaintext and unchanged;
- current `ph workflow closure next --json` remains the separate, unversioned
  diagnostic companion;
- CI receives the finish result from the future flag's normal exit code and
  human stdout/stderr, then retains the existing closure JSON artifact;
- no current or proposed claim requires a JSON finish response.

`--reverify` means PH itself must select and execute the verification command
catalog from the ready project profile, create a fresh PH-owned revalidation
record, and make that record authoritative for that invocation's finish
decision. `--reverify` without `--ci` is local mode. Agent-authored `.persona`
ledger content remains useful context but is not independent proof for either
mode.

## Trust Boundary

### Proposed Contract

- Trusted for the narrow CI decision: a fresh process launched by PH with the
  selected fixed argv either completed with the recorded result, or PH reported
  that it could not determine that result.
- Not trusted as authority: implementation/review prose, existing execution
  ledgers, copied JSON files, stale JUnit XML, or an artifact written by an
  agent or another process before the revalidation invocation.
- A pass requires a current attempt whose profile digest, command-plan digest,
  Git HEAD, workspace-root identity, and evidence-parent identity match the
  invocation. A missing, malformed, stale, or mismatched attempt cannot pass
  finish.
- PH must not delete, repair, overwrite, or relabel stale or malformed legacy
  ledger files. It records their non-authoritative presence only.

### Non-Goals

This does not prove a generated application's quality, security, efficacy,
test sufficiency, broad reliability, or token savings. The proposed identity
checks cover cooperative local PH writers and ordinary cooperative workspace
edits; they are not a hostile same-user path or symlink micro-race, or a
switch-away-and-back security guarantee. This does not certify remote services,
perform deployment checks, require an OpenCode hook, or make CI a substitute
for PH's own exit authority.

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
| `src/cli/closure-verification-runner.ts:runDirectTestVerification` lines 71-160 | The current direct runner selects Gradle across platform branches, runs one test command with a 120 s timeout, and returns an in-memory summary. P19 deliberately narrows its first catalog to POSIX. |
| `src/cli/closure-verification-runner.ts:junitVerificationFromFiles` lines 173-218 | Current direct verification filters JUnit XML by post-start modification time. |
| `src/cli/bounded-process.ts:runBoundedProcess` lines 24-105 | The current bounded helper uses direct argv and supervisor process-group handling; P19 adopts that no-shell shape only for POSIX CI. |
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
ph workflow finish implement --reverify --ci > .persona-artifacts/finish.stdout 2> .persona-artifacts/finish.stderr
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
decision says otherwise. The recipe, rather than ambient CI environment
variables, supplies `--ci`.

## Command Selection And Execution

### Platform And Catalog

P19 first implementation supports POSIX runners only, including GitHub Actions
Ubuntu/macOS-class CI runners that can use direct spawn argv and the matching
local POSIX path. Windows is explicitly unsupported and unavailable in P19. A
future cross-platform ticket must define and audit a separate Windows execution
contract before Windows support can be claimed.

The first command catalog is exactly a ready
`persona.project-profile.v1` Java/Spring/Gradle wrapper project:

| Safe preflight condition | Catalog result |
| --- | --- |
| POSIX runner, ready Java/Spring/Gradle profile, workspace-contained executable `./gradlew` | `java-spring-gradle-wrapper.1`: `./gradlew test`, then `./gradlew build` |
| Windows runner | unavailable before command start |
| Maven, non-Gradle, multi-tool, unsupported, malformed, or unready profile | unavailable before command start |
| Missing/non-executable wrapper, invalid `.persona/evidence` parent, or CI Git/HEAD/workspace-root preflight failure | unavailable before command start |

The catalog IDs are `gradle-wrapper-test.1` and `gradle-wrapper-build.1`.
`bootRun`, HTTP smoke, system-Gradle fallback, arbitrary profile command
strings, shell snippets, and tool discovery beyond the table are excluded.
Profile text selects a catalog row but never supplies an executable path,
argument, shell fragment, or environment value.

### Execution

- Run each command once, serially, in the prepared project root.
- Use direct POSIX spawn argv and no shell. The implementation should use a
  bounded child-process helper with process-group termination semantics rather
  than raw `spawnSync`.
- Set a 120 s timeout per command to match the current direct verifier. Apply
  a 300 s total attempt budget; a later command is not started after a prior
  failure or timeout.
- Start a new attempt for every `--reverify` invocation. PH result caching is
  prohibited; Gradle's own local cache may exist but cannot substitute for a
  PH-run attempt.
- Capture command outcome, exit code, timeout flag, byte counts, SHA-256
  digests, order, and post-start JUnit XML references. Do not accept
  pre-existing JUnit XML as the fresh result.
- At attempt start and end, execute the fixed direct argv
  `["git", "rev-parse", "--verify", "HEAD^{commit}"]`. Store the verified
  commit object IDs as `preHead` and `postHead`; CI requires both values and
  their equality. No shell or profile-provided Git argument is involved.
- At the same boundaries, record the workspace root's normalized realpath and
  POSIX `dev` and `ino`. CI requires the start and end identities to be equal.
  This is a cooperative-workspace identity check, not a hostile replacement
  defense.

## Result And Artifact Contract

The implementation must introduce a new schema rather than mutate
`phase0.execution.1`. The proposed artifact is
`.persona/evidence/ci-reverification/<attempt-id>.json` with:

```text
schemaVersion: "ph-ci-reverification.1"
attemptId
mode: local | ci
profileSha256
commandCatalogId
commands[]: ordinal, fixedArgvId, exitCode, durationMs, outcome,
            stdoutBytes, stderrBytes, stdoutSha256, stderrSha256, junitRefs[]
finalStatus: passed | failed | unavailable | timeout | artifact-invalid | partial
diagnosticCodes[]
mutationSnapshot
```

The maximum serialized artifact size is 256 KiB. PH persists no raw child
stdout/stderr and no environment values. It persists only the catalog ID,
fixed argv identifier, outcome/exit/duration, byte counts, SHA-256 digests,
mutation snapshot, and fixed diagnostic codes described above. This is
structural redaction, not a best-effort output regex.

If policy-critical mutation data would exceed the bound, PH must not truncate
the disallowed tracked mutations. It emits the smallest valid
`artifact-invalid` summary with digest/count information instead. Raw output is
never emitted, retained, or cleaned up.

The artifact parent is exactly workspace-relative `.persona/evidence`. Before
any command starts, PH resolves that path within the recorded workspace root,
requires both `.persona` and `.persona/evidence` to be directories and not
symlinks, verifies their normalized containment, and records the evidence
parent's realpath plus POSIX `dev` and `ino`. Failure of that preflight is
`unavailable`. Immediately before the durable write, PH repeats the same
containment, non-symlink, and parent-identity check. A post-command parent
mismatch, write failure, strict reread failure, or schema validation failure is
`artifact-invalid`, unless a timeout occurred, which takes precedence.

Freshness binding requires all of the following:

1. the finish invocation creates the attempt;
2. the profile digest and fixed command catalog match the same invocation;
3. the final result is `passed`;
4. any newly observed workspace mutation has passed the accepted P19-1 policy;
5. CI `preHead` and `postHead` are verified commit object IDs and are equal;
6. CI start/end workspace-root identities are equal;
7. the evidence parent retains the preflight identity immediately before write;
   and
8. the artifact passes its own strict parser.

Any failure of that binding becomes a blocked/unknown revalidation result, not
a fallback to the ledger.

## Final Status Precedence

The implementation must calculate exactly one final status with this exhaustive,
mutually exclusive algorithm. Command observations are retained in
`commands[]` even when a higher-precedence final status applies.

1. Return `unavailable` only when safe preflight prevents every command from
   starting: unsupported platform/profile/catalog, missing safe wrapper,
   invalid `.persona/evidence` parent, or, in explicit CI mode, unusable Git
   worktree, verified `preHead`, or workspace-root identity. Local
   snapshot-unavailable is report-only and is not this result.
2. Otherwise, if any started command timed out, return `timeout`.
3. Otherwise, if post-command evidence-parent identity/containment validation,
   durable artifact write, strict reread, or schema validation failed, return
   `artifact-invalid`.
4. Otherwise, if explicit CI mode observed a P19-1 disallowed tracked
   source/config mutation, unequal verified `preHead`/`postHead`, or unequal
   workspace-root identity, return `partial`.
5. Otherwise, if a command failed before any prior command succeeded, return
   `failed`.
6. Otherwise, if one or more commands succeeded and a later command failed or
   became unavailable, return `partial`.
7. Otherwise, if all selected commands succeeded and the valid artifact passed
   the P19-1 policy, return `passed`.

An attempted command launch that fails after safe preflight is recorded as a
command failure, not `unavailable`. A timeout remains `timeout` even if the
subsequent parent recheck, artifact write, or reread also fails. A post-command
HEAD or workspace-root mismatch is `partial` only after the higher timeout and
artifact-invalid checks. A non-passing final status makes the plaintext finish
exit nonzero; `passed` continues ordinary finish closure and exits 0 only when
every other existing gate also passes.

The existing human finish renderer remains plaintext. The existing closure JSON
may report the resulting blocker, but the implementation must not add a
`finish --json` flag or reinterpret the closure JSON as a finish result.

## Mutation Snapshot And P19-1 Policy

`--reverify` uses the same catalog, fixed argv, timeout, artifact shape, and
freshness checks locally and in CI. The explicit `--ci` flag changes only the
accepted P19-1 final-status policy and CI artifact retention. There is no host
hook, runtime injection, or ambient-environment authority.

The runner may create its new PH-owned artifact directory and normal
build-tool outputs. It must never edit source, reports, profiles, plans,
backlog, or legacy evidence to make a gate pass. It must not automatically
delete stale, malformed, or unexpected files.

`mutationSnapshot` is a proposed new `mutationSnapshot.1` object. It must
contain enough data to test Git availability and the pre/post/observed/allowed/
disallowed/untracked classification without changing an existing schema:

```text
schemaVersion: "mutationSnapshot.1"
git:
  available, diagnosticCode
  preHead, postHead, headEqual
workspaceRoot:
  pre: realpath, dev, ino
  post: realpath, dev, ino
  equal
artifactParent:
  relativePath: ".persona/evidence"
  pre: realpath, dev, ino
  post: realpath, dev, ino
  equal
pre: normalizedPorcelainNameStatusNulSha256, entryCount
post: normalizedPorcelainNameStatusNulSha256, entryCount
observed:
  trackedModified[], added[], deleted[], renamed[{oldPath,newPath}],
  typeChanged[], untracked[]
allowlist: id, roots["build/**",".gradle/**"], allowedTracked[]
disallowedTracked[]
untracked[]
decision: allowed | partial | report-only | snapshot-unavailable
```

The snapshot reader consumes `git status --porcelain=v1 -z` and the associated
normalized name-status classification before and after execution. It
canonicalizes workspace-contained paths, rename old/new paths, categories, and
sort order into a NUL-delimited representation before calculating digests. The
exact categories are tracked modified, added, deleted, renamed (old/new),
type-changed, and untracked. `preHead` and `postHead` are each obtained with
the fixed direct Git argv `["git", "rev-parse", "--verify", "HEAD^{commit}"]`;
they are verified commit object IDs, not an unverified symbolic ref.

In explicit CI mode, the Git worktree, verified `preHead`, and initial
workspace-root realpath/`dev`/`ino` must be usable before execution. Their
absence or parse failure prevents every command from starting and is
`unavailable`. After a command begins, an unequal verified `preHead`/`postHead`
or workspace-root identity is `partial`, subject to timeout and
artifact-invalid precedence. In local mode, snapshot-unavailable is recorded
as `report-only`; it does not select CI policy.

The preflight evidence parent is constructed only as
`workspaceRoot/.persona/evidence`. PH resolves it within the recorded
workspace root, rejects a `.persona` or `.persona/evidence` directory that is
missing, non-directory, or a symlink, verifies normalized containment, and
records the parent's realpath/`dev`/`ino`. Immediately before writing, it
repeats that exact check and compares the resulting parent identity to the
preflight record. A pre-command failure is `unavailable`; a post-command
mismatch is `artifact-invalid` unless a timeout takes precedence. PH never
deletes, reverts, cleans, or overwrites anything while handling either case.

P19-1 blocks only newly observed tracked source/config changes outside the
allowlist. For the first Java/Spring/Gradle catalog, the exact
workspace-relative allowlist roots are `build/**` and `.gradle/**`, derived
from `java-spring-gradle-wrapper.1`. Maven, non-Gradle, and multi-tool roots
are unavailable until separately catalogued. Unknown roots are outside the CI
allowlist. For deterministic first-tranche handling, every newly observed
tracked path outside those roots is classified as disallowed source/config
change; no wider implicit source/config exception exists. Untracked files
remain artifact-visible/report-only in this tranche; they do not silently
become tracked-mutation blockers.

PH never deletes, reverts, cleans, or overwrites any observed mutation in
either mode.

## Ledger Handling

Existing `.persona/evidence`, report prose, and JUnit files are non-authority
inputs for `--reverify`. The runner may observe their presence for control
flow, but it must not serialize their contents or counts, or parse a claimed
success as an authoritative substitute for a fresh execution.

Stale, forged, missing, and malformed ledger entries all preserve the same
safety rule: no deletion, no mutation, no silent recovery, and no finish pass
from that material. The fresh revalidation attempt either establishes its own
result or blocks.

## Acceptance Tests

The implementation acceptance suite must include:

1. `--ci` without `--reverify` is rejected; environment variables alone cannot
   select CI mode.
2. POSIX direct-argv Java/Spring/Gradle wrapper CI reaches plaintext finish
   PASS only when all selected commands and existing closure gates pass.
3. Windows, Maven, non-Gradle, multi-tool, malformed profile, missing wrapper,
   invalid/symlinked/out-of-root `.persona/evidence`, and CI Git/`preHead`/
   workspace-root preflight failures are `unavailable` before any command
   starts.
4. A forged or stale ledger claiming success cannot override a newly failing
   PH-run command.
5. Existing JUnit XML from before attempt start cannot satisfy freshness.
6. A hanging fixture yields `timeout`, skips later commands, and still wins over
   a subsequent artifact write/reread failure.
7. A first command failure before success is `failed`; test success followed by
   build failure or later unavailability is `partial`.
8. A post-command evidence-parent containment/identity mismatch, artifact
   write, strict reread, or schema-validation failure is `artifact-invalid`
   unless a timeout has precedence.
9. A deterministic fixture that changes checkout/verified HEAD after a command
   begins records unequal `preHead`/`postHead` and ends `partial`, exit 1, with
   every command observation retained.
10. A deterministic fixture that changes the workspace-root realpath or
    POSIX `dev`/`ino` after a command begins ends `partial` in CI. This
    cooperative identity test makes no hostile switch-away-and-back claim.
11. A CI tracked source/config mutation outside `build/**` and `.gradle/**`
    yields `partial`, exit 1, and no cleanup.
12. In local mode, the same tracked mutation is artifact-visible/report-only;
    untracked files are report-only in both modes.
13. Added, deleted, renamed old/new, type-changed, modified, and untracked
    paths have deterministic normalized NUL-delimited pre/post snapshots.
14. Unknown generated-output roots are outside the CI allowlist and cannot be
    silently trusted.
15. Profile text containing shell metacharacters cannot alter the fixed argv.
16. Artifact size is capped at 256 KiB; oversized policy-critical mutation data
    yields `artifact-invalid` with digest/count summary and no raw output.
17. Simulated output and environment values never appear in the artifact; only
    byte counts, SHA-256 digests, fixed diagnostic codes, and allowed metadata
    persist.
18. The current plain finish and `closure next --json` contracts remain
    unchanged when `--reverify` is absent.
19. Runtime injection stays default-off and no hook is required to run the
    revalidation path.

## Proposed Implementation Tickets

1. **I19-1: Flag parser and final-status model.** Add explicit
   `finish implement --reverify [--ci]` parsing, reject bare `--ci`, implement
   the exhaustive precedence algorithm, and keep plaintext output. Do not
   change defaults.
2. **I19-2: POSIX Java/Spring/Gradle wrapper catalog.** Implement only
   `java-spring-gradle-wrapper.1`, fixed direct argv, safe preflight,
   timeouts, serial execution, and JUnit freshness. Return unavailable for
   Windows and non-catalog profiles before any command starts.
3. **I19-3: Git/workspace mutationSnapshot.1 and allowlist.** Implement fixed
   direct-argv verified `preHead`/`postHead`, workspace-root realpath/`dev`/
   `ino` snapshots, CI preflight and post-command equality rules, normalized
   NUL-delimited snapshots, exact `build/**`/`.gradle/**` allowlist, CI
   partial mapping, local report-only mapping, and no-cleanup behavior.
4. **I19-4: Bounded digest-only artifact and strict reader.** Implement
   `ph-ci-reverification.1`, 256 KiB bound, structural no-raw-output/no-env
   persistence, exact `.persona/evidence` preflight and pre-write
   containment/non-symlink/identity checks, artifact-invalid precedence, and
   digest/count overflow summary.
5. **I19-5: Closure integration and acceptance fixtures.** Make the explicit
   path authoritative, retain the existing closure JSON surface, and cover all
   status, snapshot, HEAD/workspace identity, artifact-parent, and
   ledger-non-authority cases, including a deterministic checkout/HEAD-change
   fixture that proves CI `partial`.
6. **I19-6: Package/docs and external acceptance.** Add the CI recipe update,
   package policy coverage, local/current package smoke, and a separate
   release/default decision. No default promotion is bundled into I19-1..5.
7. **I19-7: Future Windows contract.** Separately design and audit Windows
   process creation, timeout, mutation snapshot, and artifact semantics before
   any Windows support is proposed.

## Deferred Decisions And Out Of Scope

- Whether the `--reverify` flag is later promoted to a default is a separate
  release decision requiring acceptance evidence.
- Windows and any catalog beyond the POSIX Java/Spring/Gradle wrapper path are
  unavailable until their separately audited tickets are accepted.
- Artifact retention duration, CI provider-specific encryption, and a
  registry release are not decided here.

This design neither implements nor certifies revalidation. It makes no claim
about token saving, product efficacy, generated-app quality, broad reliability,
automatic enforcement, delegation, or closure guarantee. Runtime injection
remains default-off and is not a dependency of this proposal.
