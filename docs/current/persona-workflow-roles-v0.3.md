# Persona Workflow Roles v0.3

## Goal

Define the Persona Harness workflow role model inspired by OMO, but scoped to the current Java/Spring backend MVP direction.

This document names the roles and their intended inputs/outputs. It does not implement multi-agent orchestration yet.

## Current Boundary

The current product surface is:

```text
ph init(interactive interview) -> profile summary injection -> OpenCode plan/implementation -> evidence review
```

The v0.3.x workflow should make this path more explicit without turning Persona Harness into a full autonomous agent platform.

For AI/non-TTY shells, the equivalent fast path is `npx ph bootstrap backend`. It is intentionally separate from `ph init` so a direct human setup can collect interview answers while an agent shell can still create deterministic smoke-test artifacts without hanging on prompts.

## Role Map

| Persona Role | OMO-like role | Responsibility | Productized in v0.3.x |
| --- | --- | --- | --- |
| `blackbear` | planner / Prometheus | Read README, project profile, constraints, and propose architecture/technology plan. | Design target only |
| `Charles` | executor / start-work coordinator | Convert the accepted plan into ordered work items and keep the run on scope. | Not yet |
| `jaeki` | implementer / Hephaestus-Sisyphus worker | Implement code, run tests/build, fix failures. | OpenCode model does this today, not a named Persona agent |
| `roach` | reviewer / Oracle-QA | Review goal fit, code shape, risks, and manual QA evidence. | Design target only |

## Flow

```text
1. npx ph init in an interactive terminal
2. user answers the backend intake interview
3. .persona/project-profile.jsonc is written
4. profile summary injection exposes planning context
5. blackbear-style planning:
   - read README
   - read profile summary
   - propose architecture/technology plan
6. user or run policy accepts or revises the plan:
   - `npx ph plan --accept`
   - `npx ph plan --revise`
7. jaeki-style implementation:
   - implement the plan
   - run build/tests through `npx ph bearshell` when possible
   - repair failures
   - fill `.persona/workflow/implementation-report.md`
   - run `npx ph plan --report-filled implementation`
8. roach-style review:
   - compare result to requirements and profile
   - check Clean Code rubric
   - record manual QA evidence
   - fill `.persona/workflow/review-report.md`
   - run `npx ph plan --report-filled review`
9. evidence review decides next loop
```

## Inputs And Outputs

### blackbear

Inputs:

- `README.md` or equivalent requirements file
- `.persona/project-profile.jsonc`
- Persona Harness injection block
- current backend Clean Code rules

Outputs:

- short architecture/technology plan
- package/layer plan
- storage/persistence decision summary
- explicit non-goals

Current file candidate:

```text
.persona/workflow/plan.md
```

### Charles

Inputs:

- `.persona/workflow/plan.md`
- current worktree state
- accepted scope

Outputs:

- ordered implementation checklist
- progress state
- blocked/complete status

Current file candidate:

```text
.persona/workflow/run-state.json
```

### jaeki

Inputs:

- accepted plan
- implementation checklist
- project codebase

Outputs:

- code changes
- build/test results
- implementation notes

Current file candidate:

```text
.persona/workflow/implementation-report.md
```

### roach

Inputs:

- requirements
- profile
- plan
- implementation report
- generated code
- test/build/manual QA output

Outputs:

- review findings
- manual QA evidence
- next-loop recommendation

Current file candidate:

```text
.persona/workflow/review-report.md
```

## Evidence Ledger

The existing `.persona/evidence` directory records injection evidence. Workflow evidence should be separate to avoid mixing runtime hook evidence with review notes.

Candidate:

```text
.persona/workflow/evidence-ledger.md
```

Minimum ledger entries:

- plan proposed
- plan accepted or revised through `npx ph plan --accept` / `npx ph plan --revise`
- implementation started
- test/build verification
- manual QA surface used
- implementation report marked filled through `npx ph plan --report-filled implementation`
- review report marked filled through `npx ph plan --report-filled review`
- review decision
- next loop

## Manual QA Gate

Manual QA should mean using the generated artifact through its real surface.

For Java/Spring backend projects:

- run `npx ph bearshell gradle test`;
- run `npx ph bearshell gradle build`;
- start the Spring app through `npx ph bearshell --shell 'gradle bootRun --args="--server.port=<port>"'` when feasible;
- hit the API with curl or an equivalent HTTP client, preferably through `npx ph bearshell --shell '<curl command>'`;
- record at least one happy path and one requirement-relevant failure path.
- if live HTTP QA cannot run, record the reason and stderr/key logs in `.persona/workflow/implementation-report.md`.

This gate is evidence, not product-quality certification.

## v0.3.x Scope

In scope:

- backend-only profile summary injection;
- plan-first prompt surface;
- documentation of role boundaries;
- optional local workflow files under `.persona/workflow`;
- evidence review format for clean Java/Spring backend generation.

Out of scope:

- actual subagent orchestration;
- autonomous multi-pane execution;
- frontend/infra workflow roles;
- company/personal philosophy file loading;
- TDD workflow enforcement;
- AST/linter/Guard enforcement;
- product-quality certification;
- public npm publish.

## Naming Decision

Use Persona names in user-facing Persona Harness docs:

- `blackbear`: planning
- `Charles`: execution coordination
- `jaeki`: implementation
- `roach`: review and QA pressure

Mention OMO names only in reference/comparison documents.

## Next Loop

After `.persona/workflow/plan.md` is generated by `npx ph plan`, run a clean OpenCode smoke where the model fills the plan, leaves an explicit accepted or needs-revision marker, and only then proceeds to implementation.

Do not implement `Charles`, `jaeki`, or `roach` as autonomous agents until the plan artifact proves useful in at least one clean Java/Spring project smoke.
