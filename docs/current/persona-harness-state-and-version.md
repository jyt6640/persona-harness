# Persona Harness State And Version

Last updated: 2026-06-19

## Verdict

Persona Harness is currently best described as:

> `0.2.0`: Java/Spring backend Clean Code injection MVP with diagnostics, scoped shared-skill support, artifact hygiene, packaged local demo validation, and Java role read follow-up.

It is no longer a pure Phase 0 proof-of-concept. It is also not a productized `1.0`.

The strongest current claim is:

> Persona Harness can deterministically inject Java/Spring backend Clean Code guidance, report rule metadata diagnostics, keep scope drift visible, and compare generated Gradle Java/Spring outputs with a product-code-flow rubric.

The project still cannot honestly claim:

> Injection ON reliably improves generated code quality across enough comparable actual runs.

That claim is deliberately blocked by the 3-pair injection value stopping rule.

## Version Judgment

### Semver-Like Project Version

Recommended current version: `0.2.0`.

Why not `0.1.x`:

- Phase 0 injection MVP exists.
- Rule catalog/frontmatter diagnostics exist.
- Shared-skill routing exists in a limited active form.
- A/B evidence collection and rubric-based review exist.
- Scope checker and cleanup scripts now exist.

Why not `0.2.0-alpha`:

- Local install/init/bootstrap productization exists.
- Java MVP package demo exists.
- Gradle Java/Spring A/B evidence window reached a continue-java-mvp decision.
- Java role discovery and role read follow-up now make Controller/Service/Repository/DTO reads observable.

Why not `0.3.0`:

- npm distribution is still not published.
- User-facing release/support contract is still local/tarball-first.
- The shared-skill surface is not a productized multi-domain feature.

Why not `1.0.0`:

- No npm-published release path.
- No documented installation/support contract beyond MVP reproduction.
- No claim that generated application quality improves.

### Product Maturity Version

| Area | Maturity | Reason |
| --- | --- | --- |
| Java/Spring injection MVP | MVP-complete | deterministic rule injection and tests exist |
| Rule metadata diagnostics | MVP-complete | diagnostics-only report surface exists |
| Backend Clean Code guidance | active alpha | rubric and Java guidance exist, but effect evidence is still open |
| Shared skills | experimental alpha | `programming` active support, frontend/TypeScript experimental, infra parking |
| A/B effect evidence | active validation | 1 comparable regraded pair, ON-positive 1/1 |
| Artifact hygiene | operational alpha | cleanup policy/script and actual cleanup applied |
| Docs governance | operational alpha | compact board and taxonomy exist, full migration not done |
| Product packaging/demo | not started | not decomposed |
| Desktop app track | not started | not decomposed |

## Completed Work

### Phase 0: Java/Spring Injection MVP

Completed:

- OpenCode hook feasibility.
- Java/Spring target detection.
- File role classification.
- Rule selection.
- Injection block formatting.
- Metadata-only evidence writing.
- Unit tests for matching/injection behavior.
- #1 and #2-3 Java/Spring fixture evidence.

Current judgment:

- Phase 0 is complete for Java/Spring backend MVP.
- It is not a general code-quality verifier.

### Phase 1.1: Rule Catalog And Frontmatter

Completed:

- Catalog-backed rule loading.
- Frontmatter alignment around `source`, `domain`, `topic`, `severity`.
- Scenario/glob selection refinement.
- Diagnostics-only schema validation policy.
- Rule diagnostics report via `npm run report:rules`.

Current judgment:

- This was a real MVP gap and is now meaningfully closed.
- Diagnostics are visible without blocking injection.

### Phase 1.2: Report-Only Observers

Completed:

- Controller direct Repository observer.
- Controller SQL observer.
- Service Storage Ownership observer.
- Test Contract Anchor observer.
- Row-count helper matcher cleanup.
- Time-list matcher cleanup.
- Actual run reviews.

Decisions:

- Controller Repository: no repeated WARN evidence.
- Controller SQL: reinforcement evidence insufficient.
- Service Storage: PASS repeated.
- Test Contract: cleanup track closed.
- Response time object: watch item only.

Current judgment:

- Phase 1.2 observation pass is closed.
- Do not add another observer by default.

### Phase 2: Backend Clean Code Uniformity

Completed:

- Gradle-only Java/Spring direction.
- Service-owned storage/id sequence guidance.
- Java shared-skill/reference direction.
- Package structure planning guidance.
- Root/domain/global package semantics.
- Product-code-flow rubric.
- Existing Library Loans A/B regraded by responsibility flow, not exact package naming.

Current judgment:

- Phase 2 is active validation.
- The next question is not "can we add more guidance?"
- The next question is "does Injection ON beat OFF often enough under the rubric?"

## Major Decisions

### Java Backend MVP First

Decision:

- Keep the productized MVP scoped to Java/Spring backend Clean Code injection.

Implications:

- TypeScript/frontend routing remains experimental.
- Infra/shared-skill roles remain parking surfaces.
- Vendored OMO skills remain inactive references unless explicitly activated later.

### Gradle Is Canonical

Decision:

- Gradle is the canonical Java/Spring build tool.
- Maven evidence is no longer primary.

Implications:

- Future Java fixtures and A/B runs should be Gradle-based.
- `pom.xml` generation is a negative signal in Java/Spring fixture work.

### Clean Code Flow Over Exact Package Names

Decision:

- Judge generated backend code by product-code flow:

```text
HTTP boundary -> Application use case -> Domain rule -> Repository boundary -> Infrastructure implementation
```

Primary signals:

- Controller delegates use cases.
- Application Service orchestrates only.
- Service does not own storage state or id sequence.
- Domain stays independent from Spring/HTTP/DB/infrastructure.
- Repository boundary owns persistence/storage.
- DTO boundaries are clear.

Secondary signals:

- exact package names,
- exact package depth,
- exact DTO suffixes,
- exact `global` placement.

### Diagnostics-Only, Not Enforcement

Decision:

- Rule metadata diagnostics and MVP scope diagnostics are report surfaces.
- They are not product-quality gates.
- Scope checker runs under `npm test` for visibility, but scope findings themselves exit `0`.

Implications:

- Script execution errors can fail commands.
- WARN findings should trigger review, not automatic build failure.

### Injection Value Stopping Rule

Decision:

- Use a fixed 3-pair Gradle Java/Spring A/B evidence window.
- Continue Java MVP productization only if ON is product-code-flow positive in at least 2 of 3 comparable pairs.
- Freeze expansion if ON is neutral, mixed, or worse in 2 of 3 pairs.

Current count:

- 1 comparable regraded pair.
- ON-positive: 1/1.
- Remaining before decision: 2 comparable regraded pairs.

### Artifact Hygiene

Decision:

- Keep metadata/reviews/status.
- Remove generated sandboxes/build outputs/caches at phase close.
- Trim huge raw logs to `.trimmed.log`.

Actual result:

- `experiments/` was reduced from about 4.7GB to about 1.0GB.
- Remaining cleanup dry-run reports delete `0`, trim `0`.

## Current Surfaces

### Commands

- `npm test`: runs scope diagnostics, then Vitest.
- `npm run test:unit`: runs Vitest only.
- `npm run typecheck`: TypeScript typecheck.
- `npm run build`: build dist.
- `npm run report:rules`: rule metadata diagnostics report.
- `npm run check:scope`: MVP scope consistency diagnostics.
- `npm run check:injection-value`: Java injection value evidence-window decision check.
- `npm run cleanup:experiments`: dry-run artifact cleanup.
- `npm run cleanup:experiments -- --apply`: apply artifact cleanup.

### Current Decision Docs

- `docs/current/phase2-scope-settlement.md`
- `docs/current/mvp-scope-status.json`
- `docs/current/backend-clean-code-uniformity-rubric.md`
- `docs/current/injection-value-stopping-rule.md`
- `docs/current/injection-value-status.json`
- `docs/current/phase-artifact-retention-policy.md`
- `docs/current/mvp-scope-consistency-check.md`
- `docs/archive/docs-taxonomy-archive-plan.md`

### Current Evidence Docs

- `docs/evidence-reviews/java-product-code-flow-ab-regrade.md`
- `docs/evidence-reviews/java-root-semantics-ab-review.md`
- `docs/evidence-reviews/java-domain-root-package-plan-ab-review.md`
- `docs/evidence-reviews/java-package-structure-plan-ab-review.md`
- `docs/evidence-reviews/java-common-routing-ab-review.md`
- `docs/evidence-reviews/backend-clean-code-task-fixture-ab-review.md`

## Current Risks

### 1. Injection Value Window Closed

The biggest remaining risk is no longer the initial Java injection value question.

The fixed evidence window now has 3 comparable Gradle Java/Spring pairs, with Injection ON positive in all 3 regraded pairs.

Stopping rule result: `continue-java-mvp`.

The project should move to Java backend MVP productization/demo packaging before widening into frontend/infra/productized shared-skill scope.

### 2. Shared-Skill Surface Can Expand Too Easily

The router already knows about TypeScript/frontend experimental paths.

This is acceptable only while:

- Java backend remains the MVP claim,
- frontend/infra are not productized,
- `check:scope` stays green,
- docs do not imply multi-domain readiness.

### 3. Documentation Can Re-Grow

The compact progress board fixed the immediate documentation sprawl, but the deeper failure mode is loop-by-loop document production.

Mitigation:

- keep progress board short,
- move historical detail into archive/evidence docs,
- promote only actual decisions into current docs.

### 4. Observer Work Can Return As A Distraction

Phase 1.2 is closed.

New observers should require new repeated actual evidence. Do not add observers just because a code smell is imaginable.

## What Not To Do Next

Do not:

- add another observer by default,
- broaden shared-skill routing,
- claim frontend/infra productization,
- tune package names again without new evidence,
- turn diagnostics into enforcement gates,
- start desktop app work before Java MVP value is decided.

## Recommended Next Work

### Option A: Finish The A/B Evidence Window

Run or regrade two more comparable Gradle Java/Spring A/B pairs using:

- `docs/current/backend-clean-code-uniformity-rubric.md`
- `docs/current/injection-value-stopping-rule.md`

Outcome:

- if ON-positive reaches at least 2/3, move to Java MVP productization/demo packaging,
- otherwise freeze expansion and simplify.

### Option B: Productization Only After 2/3

If the next pair is ON-positive, the project is close to Java MVP productization.

Then work should shift to:

- install/demo path,
- minimal user guide,
- release packaging,
- one confirmatory A/B after packaging.

### Option C: Freeze If Next Pair Is Mixed

If the next pair is neutral/mixed, do not run endless A/B.

At that point the current window would be 1 positive and 1 mixed. One final comparable pair decides whether to continue or freeze.

## Current Version Summary

Recommended label:

```text
0.2.0
```

Short version name:

```text
Java Backend MVP Local Productization Candidate
```

Current status sentence:

> Persona Harness has a working Java/Spring backend injection MVP with local install/demo validation, rule diagnostics, scoped shared-skill support, and Java role read follow-up. It is not yet an npm-published or multi-domain product.
