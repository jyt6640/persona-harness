# Role-Scoped Rule Delivery

Status: current T7 implementation record.

## Decision

Persona Harness delivers rule guidance narrowly by role or stage, while workflow
gates remain broad and global. A rule scoping miss may make a prompt less
efficient, but it must not make completion easier or weaken `workflow check`,
`workflow closure`, `workflow loop`, `workflow finish`, TDD, convention, report,
or verification gates.

## Delivery Points

- `workflow relay next --json` appends scoped rule bullets to the current role
  `promptBlock`. The role is the current Role Checklist Relay role:
  `test-writer`, `implementer`, or `reviewer`.
- `workflow loop` appends scoped rule bullets to each bounded iteration prompt.
  The role is derived from the current closure blocker/stage:
  verification/test/TDD blockers use `test-writer`, review blockers use
  `reviewer`, and remaining implementation/report blockers use `implementer`.
- `workflow split` writes a static scoped rule summary into each generated task
  card. The work type is derived from the ticket heading/body and maps to the
  same role set.

## Rule Pack Hash

Each delivery point records a `sha256:` rule-pack content hash rather than
expanding a new evidence schema. Post-hoc comparison rederives the delivered
rule paths from the current rule pack hash and role. If the hash differs, the
comparison must be treated as a different rule pack.

Current persisted records:

- task cards: `workflow-task-card.2`, `Rule pack hash: ...`;
- workflow loop state: `workflow-loop-state.2`, `rulePackHash`;
- relay JSON: additive `rulePackHash` field in the read-only payload.

## Budget

Delivery uses `.persona/harness.jsonc` `maxRulesPerInjection`. Rule-level
`max_bullets` and the existing bullet policy still cap bullets per rule. The
token snapshot is an approximate delivered-text count for measurement support;
it is not provider-token telemetry and must not be used as token-saving
evidence.

## T7 Measurement Record

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/t7-role-scoped-rule-delivery-20260705T112531Z`.

Decision: `PASS_NO_WORSE` for the scoped T7 gate.

- `gate-fixture.2` real OpenCode rail-entry check: control `10/10`,
  candidate `10/10`, delta `0pp`, invalid pairs `0`, non-inferior `true`.
- Stage 18 finish-reachable workflow-loop no-worse check: control finish PASS
  `3/5`, candidate finish PASS `5/5`, invalid pairs `0`, no-worse `true`.
- Candidate delivered-text token snapshot estimates:
  relay `2790`, workflow-loop mean per measured iteration prompt `2584`,
  workflow split task card `2725`.

This measurement supports only the narrow T7 decision that role-scoped delivery
did not regress the preregistered rail-entry and fixture-scoped finish checks.
It is not product-efficacy, provider-token-saving, app-quality, broad
reliability, or default-change evidence.

## Boundaries

- No runtime injection unpark.
- No new `.persona/evidence` schema.
- No default, exit-code, hook-signature, or release channel movement.
- No product efficacy, token-saving, app-quality, broad reliability,
  deterministic enforcement, closure guarantee, or generated-app certification
  claim.
