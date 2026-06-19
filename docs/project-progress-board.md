# Persona Harness Progress Board

Last updated: 2026-06-19

## Purpose

Short index for the current Persona Harness state.

Detailed historical board content is archived at:

- `docs/archive/project-progress-board-2026-06-19-pre-taxonomy.md`

`PROJECT-PLAN.md` remains the long local planning log.

## Current Position

Current track: Java backend MVP v0.2.1 local/tarball release readiness with scope and artifact hygiene controls.

Current active candidate: v0.2.1 local/tarball validation is complete; continue local testing toward `1.0.0`. Public publish remains deferred.

## Current Decisions

- Java/Spring backend Clean Code injection remains the MVP scope.
- Shared skills have limited active routing: `programming` supports Java/Gradle and TypeScript targets, while `frontend` supports React/frontend TypeScript targets experimentally.
- TypeScript/frontend routing is experimental.
- Infra and generic shared-skill roles are parking surfaces.
- Vendored OMO skills such as `ast-grep`, `debugging`, `visual-qa`, and `review-work` are inactive references unless a later scope decision activates them.
- Gradle is the canonical Java/Spring build tool; Maven evidence is discarded as primary evidence.
- Test-style policy is out of the current product-code-quality track.
- Long-term backend workflow direction is Test -> Feat -> Refactor, but the current active track still evaluates product-code shape first.
- Backend Clean Code uniformity is judged by product-code flow, not exact package-name matching.
- Java injection value stopping rule is satisfied: 3 comparable product-code-flow regraded A/B pairs, ON-positive 3/3.
- v0.2.1 local/tarball readiness is scoped to Java/Spring backend Clean Code injection and does not claim generated app product quality.
- `v0.2.1` support contract covers local/tarball install, `ph init`, Java/Spring target injection, metadata evidence, and `npx ph bearshell` command-surface behavior in clean OpenCode smoke.
- `packages/shared-skills` remains in the v0.2.1 tarball as packaged reference material; it is not a release-facing support surface or enforcement gate.
- v0.2.1 package metadata is checked for name, version, description, keywords, license, repository, homepage, bugs, bin, files, engines, and package size.
- Public npm publish, GitHub release, version tag, and release branch remain deferred.
- Experiment artifact cleanup is a phase-close hygiene step and remains dry-run-first.

## Active Commands

- `npm run report:rules`: diagnostics-only rule metadata report.
- `npm run check:scope`: diagnostics-only MVP scope consistency check; also runs as part of `npm test`.
- `npm run check:scope:strict`: strict MVP scope consistency check for release/CI-style verification.
- `npm run check:docs`: docs root taxonomy check; also runs as part of `npm test`.
- `npm run check:injection-value`: validates the Java injection value evidence-window decision state.
- `npm run demo:java-mvp`: builds, packs, installs, and hook-smoke-tests the Java backend MVP from the packaged artifact.
- `npm run demo:init`: builds, packs, installs, runs `persona-harness init`, and verifies clean project initialization without copied evidence.
- `npm run demo:bootstrap`: builds, packs, installs, runs init, and verifies README bootstrap injection plus runtime evidence.
- `npm run cleanup:experiments`: dry-run experiment artifact cleanup.
- `npm run cleanup:experiments -- --apply`: apply cleanup after dry-run review.
- `npm pack --dry-run`: package contents dry run for v0.2.1 readiness.
- `ph bearshell <command>`: Persona Harness CLI helper for bounded repo inspection and smoke-test command output. Injection blocks now tell the agent to prefer this helper for repo inspection, CLI smoke tests, and large output checks.

## Phase Map

| Phase | Status | Current Result |
| --- | --- | --- |
| Phase 0 | Done | Java/Spring backend injection MVP evidence collected |
| Phase 1.1 | Done | Catalog/frontmatter/glob/scenario selection refinement complete |
| Phase 1.2 | Done | Report-only observer pass closed; reinforcement deferred |
| Phase 2 | Active validation | Product-code-flow rubric, injection value stopping rule, scope diagnostics, and artifact cleanup added |
| Java MVP Packaging | Active productization | Init CLI, `ph bearshell`, `ph bearshell` awareness injection, bootstrap injection, packaged install/run/verify smoke commands, release-facing install guide, and v0.2.1 local/tarball readiness added |
| Desktop App Track | Not decomposed | Not started |

## Active Work Queue

1. `[x]` Backend Clean Code uniformity next decision
   - Goal: fill the 3-pair stopping-rule window using `docs/current/backend-clean-code-uniformity-rubric.md`, `docs/evidence-reviews/java-product-code-flow-ab-regrade.md`, and `docs/current/injection-value-stopping-rule.md`.
   - Constraints: no new observer by default, no test-policy work, no frontend/infra/profile-aware implementation, no product-quality certification claim.
   - Current window: 3 comparable regraded pairs, ON-positive 3/3. Decision: `continue-java-mvp`.

2. `[x]` Java backend MVP packaging/demo readiness
   - Evidence: `docs/current/java-backend-mvp-packaging-readiness.md`, `docs/current/java-backend-mvp-install-guide.md`, `docs/current/v0.2.1-release-readiness.md`
   - Current state: `npm run demo:java-mvp` verifies build, `npm pack`, package install, OpenCode plugin hook exposure, Java Controller injection, model-input transform, and ignored evidence output from the installed package. The release-facing install guide fixes local development install, package artifact smoke, OpenCode plugin connection, Java target injection flow, and evidence location. v0.2.1 readiness verifies local path install, tarball install, `persona-harness init`, clean project OpenCode bootstrap, and Java target read evidence.

3. `[x]` Java backend MVP init/bootstrap productization
   - Evidence: `docs/current/java-backend-bootstrap-injection-design.md`, `docs/current/java-backend-bootstrap-open-code-demo.md`, `docs/current/npm-beta-publish-preparation.md`, `docs/current/java-backend-actual-quality-shape-review.md`
   - Current state: `persona-harness init` installs `.persona/harness.jsonc`, `.persona/rules`, and merged `.opencode/opencode.json` without copying `.persona/evidence`; README/requirements/Gradle bootstrap targets are scoped to Java backend project-start guidance. Clean actual rerun improved root domain package shape, DTO file boundaries, application result DTOs, service-owned state avoidance, and repository boundary shape. Repository boundary now repeated as domain `BookRepository`-style interfaces plus infrastructure `JdbcBookRepository`/`InMemoryBookRepository` implementations. v0.2.1 readiness confirms clean OpenCode bootstrap evidence and a target-file read follow-up that generated Controller evidence.
   - Next candidate: npm public publish/support contract decision, not another package-shape A/B loop.

4. `[x]` v0.2.1 local/tarball support contract and clean OpenCode behavior smoke
   - Evidence: `docs/current/v0.2.1-release-readiness.md`, `docs/current/v0.2.1-support-contract.md`, `docs/current/clean-opencode-ph-bearshell-smoke.md`
   - Current state: local path install, tarball install, `ph init`, clean OpenCode Java target injection, metadata evidence, and model use of `npx ph bearshell` for `git status`, `gradle test`, and `gradle build` are verified. npm public publish remains explicitly deferred.
   - Next candidate: continue local/tarball validation; public npm publish remains deferred until closer to `1.0.0`.

5. `[x]` Vendored shared-skills tarball policy
   - Evidence: `docs/current/vendored-shared-skills-tarball-policy.md`, `docs/current/shared-skill-reference-direction.md`, `docs/current/v0.2.1-support-contract.md`
   - Current state: `packages/shared-skills` stays in the v0.2.1 tarball as packaged reference material. It is not an enforcement gate, not public support coverage for every skill, and not frontend/infra/desktop productization. Tarball size is accepted as a known local/tarball tradeoff until a pre-`1.0.0` activation policy decides productized/inactive/trimmed skills.
   - Next candidate: local/tarball validation, not tarball trimming or public npm publish.

6. `[x]` v0.2.1 package metadata and dry-run validation
   - Evidence: `docs/current/v0.2.1-package-metadata-audit.md`
   - Current state: package metadata now covers npm-facing fields while keeping public npm publish deferred until the project is closer to `1.0.0`. `npm publish --dry-run`, `npm pack`, clean tarball install, `npx ph init`, and `npx ph bearshell` smoke were verified for `0.2.1`.
   - Next candidate: keep using local/tarball installs for real OpenCode project validation; do not public-publish yet.

7. `[~]` Test Contract response time object watch
   - Evidence: `docs/phases/phase1/phase1-test-contract-response-time-repeat-review.md`
   - Current state: comparison run had explicit assertions, so no active reinforcement loop.

8. `[~]` Shared-skill productization watch
   - Evidence: `docs/current/phase2-scope-settlement.md`, `docs/current/shared-skill-reference-direction.md`, `docs/current/mvp-scope-consistency-check.md`, `docs/current/programming-shared-skill-actual-usage-review.md`
   - Current state: Java/Gradle `programming` support is limited active routing; actual clean run shows it appears on Java Service targets but does not replace `.persona` backend rules. Multi-domain productization remains inactive.

## Current Decision Docs

- `docs/current/phase2-scope-settlement.md`
- `docs/current/mvp-scope-status.json`
- `docs/current/backend-clean-code-uniformity-rubric.md`
- `docs/current/injection-value-stopping-rule.md`
- `docs/current/injection-value-status.json`
- `docs/current/java-backend-mvp-packaging-readiness.md`
- `docs/current/java-backend-mvp-install-guide.md`
- `docs/current/ph-bearshell-mvp.md`
- `docs/current/clean-opencode-ph-bearshell-smoke.md`
- `docs/current/v0.2.1-support-contract.md`
- `docs/current/v0.2.1-package-metadata-audit.md`
- `docs/current/vendored-shared-skills-tarball-policy.md`
- `docs/current/v0.2.1-release-readiness.md`
- `docs/current/java-backend-bootstrap-injection-design.md`
- `docs/current/java-backend-bootstrap-open-code-demo.md`
- `docs/current/npm-beta-publish-preparation.md`
- `docs/current/java-backend-actual-quality-shape-review.md`
- `docs/current/programming-shared-skill-actual-usage-review.md`
- `docs/current/phase-artifact-retention-policy.md`
- `docs/current/mvp-scope-consistency-check.md`
- `docs/archive/docs-taxonomy-archive-plan.md`

## Current Evidence Reviews

- `docs/evidence-reviews/java-product-code-flow-ab-regrade.md`
- `docs/evidence-reviews/coupon-product-code-flow-ab-review.md`
- `docs/evidence-reviews/inventory-product-code-flow-ab-review.md`
- `docs/evidence-reviews/java-root-semantics-ab-review.md`
- `docs/evidence-reviews/java-domain-root-package-plan-ab-review.md`
- `docs/evidence-reviews/java-package-structure-plan-ab-review.md`
- `docs/evidence-reviews/java-common-routing-ab-review.md`
- `docs/evidence-reviews/backend-clean-code-task-fixture-ab-review.md`

## Snapshot

Known scoped work items tracked in the archived board: 68, plus injection value stopping-rule, Java MVP packaging readiness, init/bootstrap productization, release-facing install guide, and v0.2.1 local/tarball readiness decisions.

- Done: 66
- Active next: 1
- Deferred/watch: 6
- Not yet decomposed: final product packaging and desktop app track

This is not an overall product-quality percentage. It is a compact index over the currently documented MVP and Phase 2 validation track.
