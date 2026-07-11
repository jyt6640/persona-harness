# AGENTS Managed Block Contract

Status: P1 STEP 2 inspection contract. This page defines how `ph doctor` observes Persona Harness steering in `AGENTS.md`. It does not change bootstrap output or migrate user files.

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

The current markerless bootstrap body is retroactively treated as the legacy V1 steering body. P1 STEP 2 only inspects it. Marker insertion, migration, and managed-block writing belong to the later transactional attach acceptance unit.

## Migration And Preservation

Future migration must:

1. parse and validate the complete document before writing;
2. preserve all user-authored bytes outside the managed block;
3. replace one older complete managed block atomically;
4. refuse duplicate, partial, reversed, or unsupported markers without writing;
5. publish the resulting file only after the surrounding attach transaction revalidates its owned-path snapshot.

No current command is authorized to rewrite an existing unrecognized or corrupt `AGENTS.md`.

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

This is a WARN with no remediation command until the later attach/remediation acceptance units provide a path that enables only `executeVerification`.

## Source Boundary

- Existing markerless steering body: `src/cli/bootstrap.ts:289-320 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Existing non-destructive AGENTS skip/update behavior: `src/cli/bootstrap.ts:323-349 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Current doctor project-local config inspection: `src/cli/doctor.ts:87-102 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Existing single follow-up renderer shape: `src/cli/workflow-finish-follow-up.ts:181-205 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.
- Enforcement config reader: `src/config/harness-config.ts:318-380 @ b6cdd84cdfb8c56459b320b38e8da931b640f6ef`.

## Boundaries

- No default, bootstrap, AGENTS writer, runtime injection, system constitution, idle continuation, or Ralph loop behavior changes here.
- No global host configuration claim.
- No automatic repair of user-authored files.
- No `--strict` remediation.
