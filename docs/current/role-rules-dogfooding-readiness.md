# ROLE-RULES Dogfooding Readiness

Status: T10 exit record for starting the next Woowacourse-style personal
mission on Persona Harness.

This document is a current status/checklist record. It does not add product
behavior, migrate rules, change gates, or expand evidence schemas.

## Accepted Inputs

The ROLE-RULES cycle can move to mission dogfooding because the following
gates are accepted:

| Tranche | Accepted result | Boundary |
| --- | --- | --- |
| T0 | Retired the legacy npm `alpha` shortcut after stable `0.6.0`. | Channel hygiene only. |
| T1 | Rule delivery-role metadata moved into rule frontmatter. | Behavior-preserving rule loading refactor. |
| T2 | Rule/convention pack diagnostics added to `ph doctor`. | Report-only diagnostics; no gate change. |
| T3 | Workflow ticket/backlog state writes gained `schemaVersion`. | Persisted-state metadata only. |
| T4 | Report status parsing moved to a frontmatter-first shared reader. | Legacy string status remains supported. |
| T5 | Workflow state read-modify-write paths gained conflict detection. | Stale write refusal only; no new evidence schema. |
| T6 | All `50/50` `references/diff-rules` files classified. | Docs-only classification fixture. |
| T7 | Role/stage scoped static rule delivery accepted by source, measurement, and External package smoke. | Scoped delivery evidence, not quality proof. |
| T8 | Diff-rules migration accepted by source and External package smoke. | Migrated package evidence, not quality proof. |

T9 rail body de-dup remains a separate measurement cycle and is not a T10
blocker. Do not implement T9 from this record.

## Dogfooding Path Checklist

The next Woowacourse mission may start on PH when the operator can walk this
path in a clean mission workspace:

| Step | Check | Woowacourse personal mission environment |
| --- | --- | --- |
| 1 | Install PH with the intended npm selector. | macOS or Windows shell; Node/npm available. |
| 2 | Run `npx ph init`. | No project-source rewrite expected. |
| 3 | Run `npx ph bootstrap backend`. | Java 21, Gradle, and IntelliJ-friendly project layout remain the mission baseline. |
| 4 | Capture mission requirements. | Use the official mission README or prompt; do not infer stack from PH package files. |
| 5 | Split requirements into tickets with `ph workflow split` / `next`. | Tickets should map to mission-visible behavior, not implementation chores. |
| 6 | Work one ticket at a time. | Current role/checklist guidance may be delivered by PH, but closure gates remain authoritative. |
| 7 | Verify through `npx ph bearshell`. | Prefer Gradle wrapper commands such as `./gradlew test`; on Windows use `gradlew.bat`. |
| 8 | Fill implementation and review reports. | Report whether rule delivery was present when a violation happened. |
| 9 | Run `npx ph workflow finish implement`. | If finish blocks, treat that as the gate working and record the blocker. |

Environment assumptions for the first dogfood run:

- macOS and Windows are both supported operator environments.
- IntelliJ is the expected editor for a standard personal mission, but PH
  evidence must come from CLI-visible files and commands.
- Java 21 and Gradle are the mission baseline.
- Runtime injection remains parked/default-off; do not use dogfooding to unpark
  it.

## Violation Log Template

Use this template during mission dogfooding. It unlocks HARDEN-3 prioritization:
rules that were delivered but still violated can be candidates for convention
promotion from `report` to `warn` to `block`.

| Date | Ticket / context | Violated rule id | Violation content | Delivered at that time? | T7 hash rederive evidence | Gate caught it? | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | `req-id` / short context | `rule-id` | What the agent wrote or skipped | yes/no/unknown | rule pack hash + role/stage rederive note | yes/no/which gate | keep as delivery-only / promote report / promote warn / promote block / revise rule |

Recording rules:

- If `Delivered at that time?` is `yes`, record the delivered rule-pack hash
  and rederive the expected T7 role/stage delivery set.
- If delivery is `no`, treat it as a delivery gap, not a convention failure.
- If the gate caught it, record the exact gate surface.
- If the gate did not catch it, do not claim PH failed broadly; record the
  narrow missing observer/convention candidate.

## Audit Score Update

Conservative readiness score after accepted ROLE-RULES evidence:

| Audit axis | Score | Reason |
| --- | ---: | --- |
| ④ Role/rule delivery readiness | 9 | T1/T2/T6/T7/T8 establish frontmatter metadata, diagnostics, 50-file classification, scoped delivery, and migrated diff-rules package evidence. |
| ⑤ Dogfooding readiness / violation feedback loop | 8 | T10 path and violation template are ready, but real mission violation logs have not accumulated yet. |
| Overall readiness | about 8.2 | Supported as an operator readiness audit only; not a product-quality or efficacy metric. |

This score is not `scorecard.1`, not measurement evidence, and not a release
claim. It is a bounded readiness summary for deciding whether the next
Woowacourse-style mission can begin on PH.

## Next Queue

1. Mission dogfooding.
2. Violation log accumulation.
3. Woowacourse convention pack.
4. HARDEN-3 minimum: adopt-to-block path plus 3-tier merge.
5. Team project distribution.

HARDEN-2 and ROLE-RULES follow-ups remain subordinate to incoming external
tester feedback and dogfooding defects.

## Boundaries

- T10 status only.
- T7/T8 evidence is scoped delivery/package evidence, not code-quality proof.
- T9 remains pending and non-blocking.
- No code/rule/convention behavior change.
- No runtime injection unpark.
- No default, schema, evidence-schema, hook, exit-code, JSON schema, version,
  publish, tag, latest, next, or alpha movement.
- No product quality, product efficacy, token/provider-token saving, app
  quality, broad reliability, closure guarantee, production-ready delegation,
  deterministic enforcement, autonomous completion, generated-app
  certification, automatic completion/downgrade/removal, or broad product
  claim.
