# Stop / Continuation Hook Design

## Goal

When an OpenCode run finishes text output while Persona workflow artifacts still record unfinished work, Persona Harness should add report-only continuation guidance.

This is for long README or requirements runs that stop after one slice. It should make the next ticket or remaining scope visible without claiming product quality or blocking the run.

## Runtime Surface

Hook:

- `experimental.text.complete`

Evidence:

- `.persona/evidence/phase0/*continuation*.json`
- schema: `phase0.continuation.1`

Injected marker:

- `[Persona Harness Continuation]`

## Inputs

The hook reads local workflow artifacts only when `.persona/` exists:

- `.persona/workflow/implementation-report.md`
- `.persona/workflow/backlog.md`

Observed implementation report labels:

- `미완료 요구사항`
- `남은 README/plan 범위`
- `남은 구현 범위`
- `다음 프롬프트 힌트`

Observed backlog state:

- first markdown table row with `pending` status.

## Behavior

The hook appends continuation guidance when:

- the implementation report has non-empty remaining scope; or
- the assistant output looks like a completion claim while the workflow backlog still has a pending ticket.

The guidance includes:

- next pending ticket;
- task card path;
- remaining README/plan range;
- remaining implementation scope;
- next prompt hint;
- recommended next action: `npx ph workflow continue` or `npx ph workflow next`.

## Non-Goals

- Not a build/test gate.
- Not an enforcement hook.
- Not generated app product-quality certification.
- Not autonomous role-agent execution.
- Not a replacement for the implementation report.

## Limitations

- String and markdown-table based.
- Depends on the agent filling workflow reports honestly.
- Does not execute OpenCode or continue work automatically.
- May miss custom backlog/report formats.

## Next

After this report-only continuation hook, the next product direction is role boundary design for `blackbear`, `jaeki`, `roach`, and `Charles`, still without autonomous role-agent execution.
