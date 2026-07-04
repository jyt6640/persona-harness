# External Review Adoption Status

This Stage 16-e status records the current disposition of twelve
external-review items so release notes and future implementation choices can
refer to one append-only decision surface.

The original review text lives outside this repository. Item labels below are
normalized to the accepted Stage 15-16 cycle decisions and evidence boundaries.
This file is a decision/status record only: it does not change product
behavior, expand evidence schemas, move release channels, or create new
runtime guarantees.

## Decision Table

| # | Review item | Decision | Reason | Owner/stage | Boundary |
| --- | --- | --- | --- | --- | --- |
| 1 | Keep runtime-injection wording parked and opt-in. | accepted | Current docs and release records already frame `runtimeInjection` as a parked opt-in preview, not a recommended/default path. | Docs Release / current release docs | No token-saving, product-efficacy, navigation-benefit, or default-change claim. |
| 2 | Correct the ralph-loop n=15 blocker-delta wording. | accepted | Stage 15 records that `blockerDelta -3.00` is resolution/exposure movement for initially named blockers, while visible blockers increased `3 -> 6`; finish PASS stayed OFF `0/15` and ON `0/15`. | Stage 15 / `docs/current/ralph-loop-measurement-status.md` | No completion improvement, completion-integrity, default-change, or closure guarantee claim. |
| 3 | Record cooldown and loop-rotation caveats. | accepted | Stage 15 records all ON sessions had `attempts=1` and `cooldownMs=30000` was near or greater than short measured sessions, so the run is trigger-survival evidence, not multi-attempt loop benefit. | Stage 15 / ralph-loop measurement status | No product default change or autonomous completion claim. |
| 4 | Elevate fake Gradle/Spring gate-gaming as an adversarial case candidate. | accepted-narrowly | Stage 15 frequency audit found `21/30` post-finish stderr files with `gradle-shim|Node shim` plus `stack-alignment-mismatch`; pair `pair-01/ON` is the named fake `gradle-shim.js` incident. | Stage 15 / future README measured-behavior candidate | Candidate only; no README row yet and no broad reliability, deterministic enforcement, or generated-app certification claim. |
| 5 | Continue ralph-loop blocker-depth and finishable-fixture prep. | accepted-narrowly | The current direction is to make blocker depth/finishable fixtures measurable before any default or completion-integrity decision. | Stage 16 / future measurement work | Prep only; no default ON, completion-integrity, or success guarantee claim. |
| 6 | Treat archive-local external-loop prototype work as non-product. | deferred | External-loop work remains archive-local/prototype preparation and does not introduce a product `ph workflow loop` command. | Future CLI Workflow if separately approved | No autonomous loop, automatic completion, or product command claim. |
| 7 | Record OpenCode subagent capability without overclaiming relay orchestration. | accepted-narrowly | A direct OpenCode task/subagent capability probe was observed, but PH relay evidence remains checklist/rail evidence. | Stage 13 / Role Checklist Relay docs | No reliable automatic OpenCode subagent orchestration or production-ready delegation claim. |
| 8 | Add or expand evidence schemas for the review item. | rejected | The relevant evidence/reporting schemas already exist or the concern is already covered by current report/status surfaces. Stage 16-e accepts no new evidence schema expansion. | None; revisit only with a product-schema task | No evidence schema expansion and no compatibility-breaking output claim. |
| 9 | Turn measurement outcomes into product efficacy claims. | measurement-owned | Measurement results stay in measurement/status records. They can guide P-minus and release decisions, but they are not asserted as product efficacy, token-saving, navigation-benefit, or quality proof. | Measurement records / QA interpretation | Measurement-owned only; no product-efficacy, token/provider-token saving, app-quality, or navigation-benefit claim. |
| 10 | Preserve role-boundary wrong-actor and heuristic attribution caveats. | accepted | Current role-boundary records say runtime write observations are report-only, time-window/path/role-context heuristics and cannot deterministically identify the actor. | Stage 10 / role-boundary docs | No deterministic role enforcement, fake block mode, blocked-write, or closure-blocker claim. |
| 11 | Claim reliable automatic OpenCode subagent orchestration from the relay path. | rejected | This conflicts with Stage 13 real observation and relay-path evidence: static guidance and optional host-dependent subagent invocation are visible, but reliable automatic OpenCode role subagent invocation/orchestration was not proven. | Role Checklist Relay docs; future host-specific probe if reopened | No production-ready delegation, deterministic role enforcement, or reliable automatic orchestration claim. |
| 12 | Keep prompt-regression fixture protection for accepted wording. | accepted-narrowly | Prompt regression fixtures protect Role Checklist Relay framing, ralph-loop blocker-depth wording, and no-claim boundaries. They are test protection only. | P5-A / tests and docs wording | No new product capability, runtime benefit, or measurement claim. |

## Current Owner Notes

- Items marked `accepted` or `accepted-narrowly` may be referenced by release
  notes only within the boundary column.
- Items marked `deferred` or `rejected` require a separate product or schema
  task before implementation can proceed.
- Item #9 is intentionally `measurement-owned`: future A/B archives may change
  a decision status, but the docs must keep measured facts separate from product
  efficacy claims.

## No-Claim Boundary

This status must not be cited as token/provider-token saving, product efficacy,
navigation benefit, app quality, full-TDD/test sufficiency, broad reliability,
closure guarantee, autonomous completion, generated-app certification,
deterministic role enforcement, production-ready delegation, automatic
completion/downgrade/removal, CodeGraph/LSP default/effectiveness, release,
registry, version, tag, or dist-tag evidence.
