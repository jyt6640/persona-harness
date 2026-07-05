# Workflow State Concurrency Model

Status: current ROLE-RULES T5 ownership and conflict-detection record.

This document records who writes Persona Harness workflow state and where T5
adds read-modify-write conflict detection. It is a persistence-safety record,
not product-efficacy, reliability, closure-guarantee, or delegation evidence.

## Writer Ownership

| State surface | Primary writer | Other readers / observers | T5 behavior |
| --- | --- | --- | --- |
| `.persona/workflow/plan.md` status | CLI `ph plan --accept` / `--revise` / `--auto-accept` | CLI plan gates and workflow status readers | Read-modify-write status updates use an mtime/size token and abort when the file changes after read. |
| `.persona/workflow/implementation-report.md` and `review-report.md` status | CLI `ph plan --report-filled <implementation\|review>` | CLI finish/check/next/resume readers and runtime rail-compliance observers | Read-modify-write status updates use an mtime/size token and abort when the file changes after read. |
| `.persona/workflow/requirements/backlog.md` draft status | CLI `ph workflow approve requirements` | CLI split/next guidance | Draft approval uses an mtime/size token and aborts when the draft changes after read. |
| `.persona/workflow/backlog.md` ticket status | CLI `ph workflow archive <ticket>` | CLI next/closure/finish/check readers and relay/role surfaces | Backlog repair/archive writes use an mtime/size token and abort when the backlog changes after read. |
| `.persona/workflow/workflow-loop-state.json` | CLI `ph workflow loop` | CLI `workflow loop --dry-run --json` readers | Loop writes carry a state-file token across iterations and abort when an external process changes the file. |
| `.persona/workflow/ralph-loop-state.json` | OpenCode plugin/runtime hooks for ralph-loop idle/tool-output continuation | CLI dry-run/reporting readers | Runtime hook writes carry a state-file token and fail closed when another writer changes the file before the hook write. |

## Conflict Behavior

T5 conflict detection is scoped to read-modify-write workflow state paths. If
the target file's mtime/size token differs between read and write, PH refuses
to overwrite the newer file and returns a diagnostic such as:

```text
Workflow state changed while Persona Harness was updating <path>. Refusing to overwrite concurrent changes. Rerun the command after reviewing the current workflow state.
```

For CLI commands this is a status-1 abort. For runtime ralph-loop hook writes,
the write returns false and the hook fails closed: no continuation attempt or
tool-output append should be emitted from a stale state write.

## Out Of Scope

- Create-only workflow artifacts, such as initial split/capture/template files,
  keep their existing existence/conflict checks.
- Evidence and telemetry files remain evidence surfaces, not workflow state
  ownership surfaces for T5.
- Directory moves, such as moving a ticket work directory into history, are not
  converted into a multi-file transaction by T5.
- No gate semantics, JSON output schema, evidence schema, defaults, hook
  signatures, versioning, publish, or dist-tag behavior changes are included.

## Coverage

- `tests/persona-harness-workflow-state-concurrency.test.ts` covers stale
  snapshot refusal, report-filled conflicts, requirements approval conflicts,
  workflow-loop external-session state conflicts, and ralph-loop hook-owned
  state conflicts.
- H1-2 mechanical finish regression remains the guard that the normal workflow
  gate chain still reaches finish when state is not concurrently modified.
