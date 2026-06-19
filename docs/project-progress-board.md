# Persona Harness Progress Board

Last updated: 2026-06-19

## Purpose

Short index for the current Persona Harness state.

Detailed historical board content is archived at:

- `docs/archive/project-progress-board-2026-06-19-pre-taxonomy.md`

`PROJECT-PLAN.md` remains the long local planning log.

## Current Position

Current track: Java backend MVP productization readiness with scope and artifact hygiene controls.

Current active candidate: init/bootstrap productization verification and npm beta preparation.

## Current Decisions

- Java/Spring backend Clean Code injection remains the MVP scope.
- Shared skills have limited active routing: `programming` supports Java/Gradle and TypeScript targets, while `frontend` supports React/frontend TypeScript targets experimentally.
- TypeScript/frontend routing is experimental.
- Infra and generic shared-skill roles are parking surfaces.
- Vendored OMO skills such as `ast-grep`, `debugging`, `visual-qa`, and `review-work` are inactive references unless a later scope decision activates them.
- Gradle is the canonical Java/Spring build tool; Maven evidence is discarded as primary evidence.
- Test-style policy is out of the current product-code-quality track.
- Backend Clean Code uniformity is judged by product-code flow, not exact package-name matching.
- Java injection value stopping rule is satisfied: 3 comparable product-code-flow regraded A/B pairs, ON-positive 3/3.
- Experiment artifact cleanup is a phase-close hygiene step and remains dry-run-first.

## Active Commands

- `npm run report:rules`: diagnostics-only rule metadata report.
- `npm run check:scope`: diagnostics-only MVP scope consistency check; also runs as part of `npm test`.
- `npm run check:scope:strict`: strict MVP scope consistency check for release/CI-style verification.
- `npm run check:injection-value`: validates the Java injection value evidence-window decision state.
- `npm run demo:java-mvp`: builds, packs, installs, and hook-smoke-tests the Java backend MVP from the packaged artifact.
- `npm run demo:init`: builds, packs, installs, runs `persona-harness init`, and verifies clean project initialization without copied evidence.
- `npm run demo:bootstrap`: builds, packs, installs, runs init, and verifies README bootstrap injection plus runtime evidence.
- `npm run cleanup:experiments`: dry-run experiment artifact cleanup.
- `npm run cleanup:experiments -- --apply`: apply cleanup after dry-run review.

## Phase Map

| Phase | Status | Current Result |
| --- | --- | --- |
| Phase 0 | Done | Java/Spring backend injection MVP evidence collected |
| Phase 1.1 | Done | Catalog/frontmatter/glob/scenario selection refinement complete |
| Phase 1.2 | Done | Report-only observer pass closed; reinforcement deferred |
| Phase 2 | Active validation | Product-code-flow rubric, injection value stopping rule, scope diagnostics, and artifact cleanup added |
| Java MVP Packaging | Active productization | Init CLI, bootstrap injection, packaged install/run/verify smoke commands, and release-facing install guide added |
| Desktop App Track | Not decomposed | Not started |

## Active Work Queue

1. `[x]` Backend Clean Code uniformity next decision
   - Goal: fill the 3-pair stopping-rule window using `docs/backend-clean-code-uniformity-rubric.md`, `docs/java-product-code-flow-ab-regrade.md`, and `docs/injection-value-stopping-rule.md`.
   - Constraints: no new observer by default, no test-policy work, no frontend/infra/profile-aware implementation, no product-quality certification claim.
   - Current window: 3 comparable regraded pairs, ON-positive 3/3. Decision: `continue-java-mvp`.

2. `[x]` Java backend MVP packaging/demo readiness
   - Evidence: `docs/java-backend-mvp-packaging-readiness.md`, `docs/java-backend-mvp-install-guide.md`
   - Current state: `npm run demo:java-mvp` verifies build, `npm pack`, package install, OpenCode plugin hook exposure, Java Controller injection, model-input transform, and ignored evidence output from the installed package. The release-facing install guide fixes local development install, package artifact smoke, OpenCode plugin connection, Java target injection flow, and evidence location.

3. `[>]` Java backend MVP init/bootstrap productization
   - Evidence: `docs/java-backend-bootstrap-injection-design.md`, `docs/java-backend-bootstrap-open-code-demo.md`, `docs/npm-beta-publish-preparation.md`
   - Current state: `persona-harness init` installs `.persona/harness.jsonc`, `.persona/rules`, and merged `.opencode/opencode.json` without copying `.persona/evidence`; README/requirements/Gradle bootstrap targets are scoped to Java backend project-start guidance.
   - Next candidate: actual clean OpenCode run or npm beta publish.

4. `[~]` Test Contract response time object watch
   - Evidence: `docs/phase1-test-contract-response-time-repeat-review.md`
   - Current state: comparison run had explicit assertions, so no active reinforcement loop.

5. `[~]` Shared-skill productization watch
   - Evidence: `docs/phase2-scope-settlement.md`, `docs/shared-skill-reference-direction.md`, `docs/mvp-scope-consistency-check.md`
   - Current state: Java/Gradle `programming` support is limited active routing; multi-domain productization remains inactive.

## Current Decision Docs

- `docs/phase2-scope-settlement.md`
- `docs/mvp-scope-status.json`
- `docs/backend-clean-code-uniformity-rubric.md`
- `docs/injection-value-stopping-rule.md`
- `docs/injection-value-status.json`
- `docs/java-backend-mvp-packaging-readiness.md`
- `docs/java-backend-mvp-install-guide.md`
- `docs/java-backend-bootstrap-injection-design.md`
- `docs/java-backend-bootstrap-open-code-demo.md`
- `docs/npm-beta-publish-preparation.md`
- `docs/phase-artifact-retention-policy.md`
- `docs/mvp-scope-consistency-check.md`
- `docs/docs-taxonomy-archive-plan.md`

## Current Evidence Reviews

- `docs/java-product-code-flow-ab-regrade.md`
- `docs/coupon-product-code-flow-ab-review.md`
- `docs/inventory-product-code-flow-ab-review.md`
- `docs/java-root-semantics-ab-review.md`
- `docs/java-domain-root-package-plan-ab-review.md`
- `docs/java-package-structure-plan-ab-review.md`
- `docs/java-common-routing-ab-review.md`
- `docs/backend-clean-code-task-fixture-ab-review.md`

## Snapshot

Known scoped work items tracked in the archived board: 68, plus injection value stopping-rule, Java MVP packaging readiness, init/bootstrap productization, and release-facing install guide decisions.

- Done: 65
- Active next: 1
- Deferred/watch: 6
- Not yet decomposed: final product packaging and desktop app track

This is not an overall product-quality percentage. It is a compact index over the currently documented MVP and Phase 2 validation track.
