# Injection Value Stopping Rule

## Goal

Decide whether Java/Spring backend injection is producing useful product-code-flow improvement before widening scope again.

This is not a product-quality gate. It is a stop rule for A/B evidence loops.

## Current Question

Does Injection ON repeatedly produce cleaner Java backend product-code flow than Injection OFF under comparable Gradle fixtures?

The comparison surface is `docs/backend-clean-code-uniformity-rubric.md`.

## Minimum Evidence Window

Use a small fixed window:

- 3 comparable Gradle Java/Spring A/B pairs,
- non-reservation fixtures preferred after the first reservation-heavy phase,
- same model family and comparable prompt constraints,
- `gradle test` observed for both ON and OFF where generated projects are runnable.

Existing A/B reviews can count only if they are regraded with the product-code-flow rubric.

## Pair Classification

Classify one pair as `ON-positive` only when:

- at least one primary product-code-flow signal is clearer in Injection ON,
- no primary product-code-flow signal regresses in Injection ON,
- any secondary package-shape improvement is treated as supporting evidence, not the deciding evidence.

Classify one pair as `neutral/mixed` when:

- ON only improves secondary package naming,
- both ON and OFF satisfy the same primary signals,
- ON improves one primary signal but regresses another primary signal.

Classify one pair as `OFF-positive` when OFF is clearer on primary product-code-flow signals without an ON primary-signal offset.

## Decision Outcomes

### Continue Java MVP

Choose this only if Injection ON is product-code-flow positive in at least 2 of 3 comparable A/B pairs.

Allowed next work:

- tighten Java backend rule/prompt surfaces around repeated positive signals,
- package/demo the Java backend MVP,
- run one confirmatory A/B after packaging changes.

### Freeze Expansion

Choose this if Injection ON is neutral, mixed, or worse in 2 of 3 comparable A/B pairs.

Required action:

- stop adding observers, shared-skill domains, frontend/infra routing, and package-shape wording,
- record `Java injection effect not proven yet`,
- move to either prompt/rule simplification or a clearer fixture design before more A/B.

### Inconclusive

Choose this if the pairs are not comparable, runs fail for unrelated infrastructure reasons, or the generated artifacts cannot be inspected after cleanup.

Allowed action:

- run one replacement A/B pair,
- then apply `Continue Java MVP` or `Freeze Expansion`.

## Score Reading

Primary ON-positive signals:

- Controller stays an adapter and delegates use-case work.
- Application Service orchestrates and does not own storage state or id sequence.
- Domain is independent from Spring/HTTP/DB/infrastructure details.
- Repository interface and implementation boundaries are clear.
- Request/Response DTO and optional Command/Result boundaries are clear.

Secondary signals:

- exact package names,
- exact package depth,
- exact DTO suffixes,
- exact global/common package naming.

Secondary signals cannot override mixed primary signals.

## Non-Goals

- No product-quality certification.
- No test-quality certification.
- No frontend/infra/profile-aware expansion decision.
- No AST/linter/enforcement gate.
- No new observer by default.

## Progress Board Rule

The progress board must state which of the three outcomes is currently active.

Until the fixed evidence window is complete, the state is:

> Java injection value evidence is still open; do not widen product scope by default.
