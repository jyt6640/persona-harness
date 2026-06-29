# Workflow Closure State Machine Design

Status: design contract; read-only first slice implemented in
`5df7dc1 feat(cli): add workflow closure planner`

This is a product design contract for the workflow closure planner. It exists
because the current workflow rail guides an agent, but does not structurally
drive closure after the generated app already builds, tests, and runs.

## Problem

The alpha6 single finish trial reached successful Java/Spring/Gradle app
generation and verification, then failed to return to workflow closure:

- `.persona/workflow/implementation-report.md` stayed `Status: template`.
- `.persona/workflow/review-report.md` stayed `Status: template`.
- `req-1` stayed pending.
- `npx ph workflow finish implement` correctly exited 1.

That means the final gate worked. The missing product behavior is not another
sentence in the rail. The missing behavior is a state machine that can read the
current workflow state, compute exact missing closure steps, execute or request
the next step, re-read state after the action, and stop at the precise blocker.

## State Model

The closure machine should derive one structured snapshot from existing workflow
readers before every decision:

```ts
type WorkflowClosureState = {
  readonly plan: "missing" | "draft" | "needs-revision" | "accepted" | "unknown"
  readonly currentTicket:
    | { readonly id: string; readonly title: string; readonly state: "active-work" | "history-only" | "missing-work" }
    | undefined
  readonly pendingTickets: readonly string[]
  readonly implementationReport: "missing" | "template" | "filled" | "unknown"
  readonly reviewReport: "missing" | "template" | "filled" | "unknown"
  readonly evidence: "missing" | "present"
  readonly verification: "unknown" | "not-run" | "failed" | "passed"
  readonly reportCoverage: "not-checked" | "missing" | "sufficient"
  readonly archive: "not-needed" | "pending" | "history-only-repair" | "complete"
  readonly finish: "not-run" | "blocked" | "passed"
  readonly blockers: readonly ClosureBlocker[]
}
```

Notes:

- Plan/report status already comes from `workflow-status.ts` and `plan-next.ts`.
- Ticket state already comes from `workflow-ticket-summary.ts`.
- Report coverage already comes from `workflow-report-coverage.ts`.
- Verification should remain evidence-based; the CLI must not infer success from
  command names alone.
- Finish status is the result of running or simulating
  `npx ph workflow finish implement`; it is not replaced by the closure machine.

## Implemented CLI Surface

Implemented read-only first slice:

```text
npx ph workflow closure status [--json]
npx ph workflow closure next [--json]
```

Future candidate only:

```text
npx ph workflow closure run --step <step-id>
```

The first slice intentionally ships only `status` and `next`. There is no
`closure run`, no auto-fill, no auto-archive, and no workflow finish automation
in this slice.

Output contract:

- `status` prints the current state and blockers.
- `next` prints a deterministic command sequence with the first incomplete step
  marked as actionable.
- `--json` returns the same data for agents/runners without parsing prose.
- `workflow finish implement` remains the final authority.
- No command should mark substantive reports filled or archive tickets unless
  the required state transition is already observable.

Example JSON shape:

```json
{
  "state": {
    "plan": "accepted",
    "currentTicket": { "id": "req-1", "title": "Task CRUD API", "state": "active-work" },
    "implementationReport": "template",
    "reviewReport": "template",
    "evidence": "present",
    "verification": "passed",
    "archive": "pending",
    "finish": "blocked"
  },
  "steps": [
    {
      "id": "fill-implementation-report",
      "kind": "human-or-model-content",
      "status": "blocked",
      "reason": "implementation report is template",
      "commandAfterContent": "npx ph plan --report-filled implementation"
    },
    {
      "id": "fill-review-report",
      "kind": "human-or-model-content",
      "status": "pending",
      "commandAfterContent": "npx ph plan --report-filled review"
    },
    {
      "id": "archive-current-ticket",
      "kind": "cli-command",
      "status": "pending",
      "command": "npx ph workflow archive req-1"
    },
    {
      "id": "finish-implement",
      "kind": "cli-command",
      "status": "pending",
      "command": "npx ph workflow finish implement"
    }
  ]
}
```

## Transitions

The closure machine should be transition-driven, not string-driven.

1. `plan != accepted`
   - Stop.
   - Required command: `npx ph plan --accept` or `npx ph plan --revise`.
2. `verification == failed`
   - Stop.
   - Required action: fix compile/test/runtime failure, rerun verification, then
     re-run closure status.
3. `implementationReport != filled`
   - Stop at human/model content boundary.
   - Required content: actual implementation report with read coverage,
     verification evidence, and continuation state.
   - Allowed command after content exists:
     `npx ph plan --report-filled implementation`.
4. `reviewReport != filled`
   - Stop at human/model content boundary.
   - Required content: review/manual QA result and requirement satisfaction
     notes.
   - Allowed command after content exists:
     `npx ph plan --report-filled review`.
5. `pendingTickets.length > 0`
   - Stop unless the current ticket is review-confirmed satisfied.
   - Allowed command after review confirmation:
     `npx ph workflow archive <ticket>`.
   - If `history-only`, allow archive repair.
6. `finish != passed`
   - Run or instruct `npx ph workflow finish implement`.
   - Re-read full state after the command.
   - If blocked, surface the exact final gate reason and stop.
7. `finish == passed`
   - Terminal closure.

## Invariants

- `workflow finish implement` remains the final authority.
- The closure machine must never mark finish passed by inspecting state alone.
- The CLI must not invent implementation or review evidence.
- The CLI must not auto-fill substantive report bodies.
- The CLI must not auto-archive a pending ticket unless the command is
  explicitly invoked and the ticket state transition can be verified.
- Every state-changing command must be followed by a fresh read of the workflow
  state.
- Report-only analyzers remain report-only; backend-shape/observe do not become
  product quality certification.

## Human And Model Boundary

CLI can automate:

- Reading workflow state.
- Computing blockers and next steps.
- Running existing CLI state transitions when explicitly requested.
- Verifying that a command changed observable state.
- Returning structured JSON for agents/runners.

CLI must ask the model/user for:

- Implementation report substance.
- Review report substance.
- Requirement satisfaction judgment before archive.
- Code fixes for failed build/test/runtime.
- Any explanation of why a ticket should remain pending.

## Failure Modes

- `missing-report-content`: report is missing/template/unknown.
- `missing-evidence`: `.persona/evidence` is absent when final gate requires it.
- `verification-failed`: compile/test/runtime failure evidence exists.
- `verification-unknown`: verification commands are mentioned without success or
  failure output.
- `pending-ticket`: backlog has pending work.
- `history-backlog-mismatch`: history exists but backlog still marks pending.
- `provider-timeout`: model/provider stopped before requested content or command.
- `state-transition-missing`: command ran but state did not change.
- `finish-blocked`: final gate failed with explicit reasons.

## Minimal First Slice

Do not start with a full executor. The implemented first slice is a read-only
planner:

1. Add a structured closure state module that reuses existing readers.
2. Add `npx ph workflow closure status --json`.
3. Add `npx ph workflow closure next --json`.
4. Keep human output short, but make tests assert the JSON shape.
5. Do not add `run` until state reads and blocker ordering are stable.

This first slice gives agents and runners a deterministic closure target without
weakening gates or pretending the CLI can write substantive reports.

The alpha6 single finish trial failure remains valid. This planner is the
structural follow-up to that failure, not retroactive success for the trial.

## Test Strategy

Use fixture workspaces, not eval runs.

- Plan missing/draft/accepted states.
- Template implementation report after app verification evidence exists.
- Filled implementation report plus template review report.
- Filled reports plus pending `req-*`.
- `history-only` archive repair.
- Verification failed before report closure.
- Verification unknown: command text without success/failure output.
- Finish pass terminal state.
- JSON assertions for step IDs, status, command, blocker reason, and source.
- Built CLI smoke for `workflow closure status --json` and
  `workflow closure next --json` once implemented.

## Non-goals

- No new closure checklist wording patch.
- No finish gate weakening.
- No fake report filling.
- No automatic product quality certification.
- No eval-core, fixture, policy, or scorer changes.
- No model regeneration in CLI tests.

## Open Questions

- Should the first command be named `workflow closure` or
  `workflow finalize`? `closure` is clearer for state inspection; `finalize`
  may imply automation before the CLI can safely automate content steps.
- Should the eventual executor support only one step per invocation? One-step
  execution is safer because every step can re-read state before proceeding.
- Should provider timeout be represented in workflow state, or only in runner
  metadata? Product CLI can report `unknown/stopped`, but runner-specific
  timeout labels should stay outside CLI state unless a local artifact records
  them.
