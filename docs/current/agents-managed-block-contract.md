# AGENTS Managed Block Contract

Status: P1 STEP 2 doctor observation and P1 STEP 3 explicit attach contract.
`ph doctor` only observes Persona Harness steering in `AGENTS.md`; `ph attach`
is the separate project-local writer surface.

## Managed Block V1

The versioned managed block is bounded by these exact marker lines:

```text
<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->
<!-- persona-harness:agents:end -->
```

The start marker carries the schema identifier. Content outside the markers belongs to the user and must be preserved byte-for-byte by any future writer. A valid document contains exactly one start marker followed by exactly one end marker.

## Observation States

| State | Meaning | Doctor level |
| --- | --- | --- |
| `current` | One complete V1 marker pair is present in order. | PASS |
| `legacy observed` | The markerless body produced by the existing backend bootstrap is recognizable by its Persona Harness title and implementation/finish rail instructions. | WARN |
| `missing` | `AGENTS.md` does not exist. | BLOCK |
| `unrecognized` | `AGENTS.md` exists but neither a complete V1 block nor the legacy body is observed. | BLOCK |
| `corrupt` | A marker is partial, duplicated, reversed, or carries an unsupported schema. | BLOCK |

The current markerless bootstrap body is retroactively treated as the legacy V1
steering body. `ph attach --yes` creates the managed V1 block only for an
eligible existing Java/Spring/Gradle project. `ph attach --repair --yes` is
limited to a recognized weak Persona Harness installation.

## Explicit Attach Scope

The current explicit attach path:

1. writes the managed V1 block for an eligible fresh project;
2. permits `--repair --yes` only when the existing installation is recognized
   as weak; a ready attachment is reported unchanged and is not repairable;
3. blocks corrupt or unrecognized `AGENTS.md` content instead of overwriting it;
4. stages and revalidates only project-local `.gitignore`,
   `.opencode/opencode.json`, `.persona`, and `AGENTS.md` paths before writing;
5. enables `enforce.executeVerification=true` while keeping
   `features.runtimeInjection=false`, `enforce.systemConstitution=false`,
   `enforce.idleContinuation=false`, and `enforce.ralphLoop.enabled=false`.

P1 STEP 2 `ph doctor` is inspection-only and never rewrites `AGENTS.md`,
including unrecognized or corrupt files. This is not a universal guarantee for
older commands: the existing `ph bootstrap backend --multi-agent-preview` path
may append Relay guidance to an existing file without managed-block
classification. That legacy append behavior is outside this inspection
contract and must be reconciled before a future managed-block migration claims
whole-file preservation.

## Doctor Finding Model

Doctor reachability findings use `BLOCK` and `WARN`.

- Any `BLOCK` makes `ph doctor` exit nonzero.
- `WARN` findings remain visible but exit zero when no block exists.
- Priority is AGENTS missing/corrupt/unrecognized, then project-local OpenCode registration not observed, then legacy steering, then PH-run verification mode.
- The whole output renders at most one top-priority `Next action:` and at most one literal `Next command:`.
- A command is omitted when no safe current remediation exists. `--strict` is never suggested because it also activates measured-negative settings.

Project-local `.opencode/opencode.json` inspection proves only whether registration is observed in that file. It does not prove that a global OpenCode configuration is absent and does not identify a non-OpenCode host.

When `enforce.executeVerification=false`, doctor reports:

```text
PH-run verification OFF — evidence-only mode, TDD rail advisory
```

This is a WARN with no inline doctor remediation command. The explicit attach
surface may enable only `executeVerification` for an eligible project; it is
not a `--strict` recommendation and does not repair corrupt or unrecognized
files.

## Source Boundary

- Existing markerless steering body: `src/cli/bootstrap.ts:289-320 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Existing non-destructive AGENTS skip/update behavior: `src/cli/bootstrap.ts:323-349 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Current doctor project-local config inspection: `src/cli/doctor.ts:87-102 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Existing single follow-up renderer shape: `src/cli/workflow-finish-follow-up.ts:181-205 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Enforcement config reader: `src/config/harness-config.ts:318-380 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Managed V1 writer: `src/cli/agents-contract.ts:1-59 @ b7da6b40173ec8257fda352004d40ffea6c69fb0`.
- Existing attachment state and explicit weak-only repair: `src/cli/attach-installation-state.ts:10-42`; `src/cli/attach.ts:41-230 @ b7da6b40173ec8257fda352004d40ffea6c69fb0`.
- Project-local staging and enforcement values: `src/cli/attach-staging.ts:6-52`; `src/cli/attach-transaction.ts:104-146 @ b7da6b40173ec8257fda352004d40ffea6c69fb0`.

## Boundaries

- Attach is explicit; it does not change the package defaults or ordinary
  bootstrap behavior.
- No global host configuration claim or hostile-race security guarantee.
- No automatic repair of corrupt or unrecognized user-authored files.
- No `--strict` remediation.
