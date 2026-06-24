# Skill / Hook / Role Agentization Roadmap

## Context

Persona Harness is moving from prompt-only guidance toward an OMO-inspired workflow runtime.

The goal is not to clone OMO wholesale. The goal is to make short OpenCode/TUI requests route through Persona Harness workflow surfaces reliably:

- skill-backed rail guidance;
- hook-based evidence and warnings;
- role-agent workflow boundaries;
- Java/Spring backend MVP scope first.

## OMO Reference Layers

OMO has five useful layers:

| Layer | OMO Pattern | Persona Harness Direction |
| --- | --- | --- |
| Skills | `debugging`, `review-work`, `refactor`, `git-master`, `programming`, `frontend`, `visual-qa`, `ulw-plan`, `start-work`, `teammode`, `lsp`, `ast-grep` | Create PH-owned workflow skills for requirements/debug/review/refactor/git/programming before broadening domains. |
| Hooks | session start, user prompt submit, pre/post tool use, stop, post compact | Add PH hook evidence gradually: selected rail, tool behavior, report status, continuation. |
| MCP / Tools | codegraph, LSP, Git Bash, workflow helpers | Keep PH tool surface narrow first: `ph bearshell`, `ph doctor`, `ph workflow`, `ph evidence`, later LSP/codegraph-like integrations only if needed. |
| Rules | global rules, project rules, post-tool rule matching, cache reset | Keep company policy > personal philosophy > Clean Code baseline, diagnostics-only unless explicitly promoted. |
| Agent / Workflow | `ulw-plan`, `start-work`, `review-work`, `debugging`, `teammode` | Map PH roles after rails are stable: blackbear planning, jaeki implementation, roach review, Charles coordination. |

## Decision

Persona Harness should become skill/hook/role-agent based.

This is mandatory for the product direction, but it must be staged:

1. finish top-level rails;
2. record intent evidence;
3. move rail text into PH skill/reference files;
4. add hook-based compliance evidence;
5. add stop/continuation checks;
6. introduce role-agent boundaries.

## Current Runtime State

Implemented:

- requirements rail block;
- debug rail block;
- review rail block;
- refactor rail block;
- git rail block;
- programming rail block;
- PH-owned workflow skill reference files for requirements/debug/review/refactor/git/programming;
- runtime loading of workflow rail text from `packages/shared-skills/skills/workflow/**/SKILL.md`;
- `phase0.intent.1` evidence for injected workflow rails;
- `phase0.rail-compliance.1` report-only evidence for selected-rail versus observed-tool behavior mismatches.

Diagnostics-only:

- intent evidence records what was selected and injected;
- rail compliance evidence records likely mismatches between the selected rail and observed tools;
- it does not enforce that the AI followed the rail;
- it does not certify generated app quality.

## Next Implementation Order

### P0: Rail Skill Extraction

Status: implemented for the current runtime rails.

Rail text lives in PH-owned skill/reference files:

- requirements;
- debug;
- review;
- refactor;
- git;
- programming.

Runtime should then:

1. detect top-level intent;
2. load the selected skill summary;
3. inject the rail;
4. write intent evidence.

### P1: Hook-Based Rail Compliance Evidence

Status: implemented as report-only evidence for the first six mismatch categories.

Add report-only hook checks:

- selected rail versus actual tool behavior;
- raw shell use versus `ph bearshell` guidance;
- implementation report / review report filled status;
- missing final workflow check;
- direct `.persona/rules` reads;
- rail mismatch such as review request followed by edits.

These findings should be local evidence/warnings, not build/test gates.

Current evidence schema: `phase0.rail-compliance.1`.

### P2: Stop / Continuation Hook

When a run stops with unfinished ticket/backlog/report state:

- summarize the next pending ticket;
- show remaining README/requirements range;
- point to the next `ph workflow continue` action;
- avoid pretending the full requirement set is complete.

### P3: Role Agentization

Introduce role boundaries after the rails and hook evidence are stable:

| Role | Responsibility |
| --- | --- |
| blackbear | planning and requirement decomposition |
| jaeki | implementation |
| roach | review / pressure testing |
| Charles | coordination and state handoff |

These should not become autonomous multi-agent behavior until the single-agent workflow rails are reliable.

## Non-Goals

- Not a direct copy of all OMO skills.
- Not frontend/infra productization.
- Not AST/linter/enforcement by default.
- Not generated app product-quality certification.
- Not role-agent automation before rail evidence is stable.
