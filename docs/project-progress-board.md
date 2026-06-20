# Persona Harness Progress Board

Last updated: 2026-06-20

## Purpose

Short index for the current Persona Harness state.

Detailed historical board content is archived at:

- `docs/archive/project-progress-board-2026-06-19-pre-taxonomy.md`

`PROJECT-PLAN.md` remains the long local planning log.

## Current Position

Current track: v0.3.0 project-intake / philosophy workflow planning surface on top of the Java backend MVP.

Current active candidate: choose the next narrow v0.3.0 gap after the template-fill/history smoke passed. v0.2.1 local/tarball validation is complete enough for continued local use; public publish remains deferred.

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
- v0.2.1 clean project generation can produce buildable Gradle Spring apps from README-only bootstrap. The first library-lending pass exposed repository-port/domain-record guidance gaps that were corrected by target-file follow-up; after narrow guidance tightening, the second course-enrollment README-only rerun produced domain repository ports, infrastructure implementations, class-based domain entities, and domain self-judgment methods without target-file follow-up.
- The narrow `v0.2.2` repository-port/domain-record candidate is closed for now. Reopen only if a future clean README-only run regresses on repository port placement or domain self-judgment behavior.
- v0.3.0 starts as a planning surface, not rule enforcement: `ph intake` creates `.persona/project-profile.jsonc` with backend project-shaping questions and optional philosophy overlay slots.
- v0.3.0 planned implementation smoke is positive: a filled profile plus explicit profile-read prompt produced a buildable Equipment Rental Gradle Spring app with domain-first packages, domain repository ports, infrastructure repository implementations, class-based domain entities with behavior, DTO boundaries, and no Service-owned storage/id sequence.
- v0.3.0 profile handling is implemented and smoke-verified: a README-only planning prompt received profile choices through project-bootstrap injection and reflected database, `JdbcTemplate`, `Flyway`, `domain-first`, and strict DTO choices in the first architecture/technology plan. Company/personal philosophy file loading, frontend/infra profile routing, AST/linter enforcement, and TDD workflow remain out of scope.
- v0.3.x workflow role names are reserved for documentation and local workflow artifacts: `blackbear` plans, `Charles` coordinates, `jaeki` implements, and `roach` reviews/pressures QA. `ph plan` now creates `.persona/workflow/plan.md`, `.persona/workflow/implementation-report.md`, and `.persona/workflow/review-report.md` drafts; `ph history` archives used workflow artifacts under `.persona/workflow/history/<archive-id>/` without deleting active files. Clean OpenCode smokes confirmed the model can fill the plan, implement from it, pass Gradle verification, fill the pre-created implementation/review report templates instead of creating ad hoc report files, and archive completed workflow artifacts. These are not autonomous Persona Harness agents yet.
- Installed package internals under `node_modules/persona-harness/` are not useful clean-project evidence targets. Direct target capture and Java role discovery now ignore those files so vendored shared-skill Java fixtures do not pollute generated-project evidence.
- v0.3.0 repeat clean workflow evaluation is positive after evidence-noise cleanup: the repeat Course Equipment Reservation run produced a buildable Gradle Spring app, passed independent `gradle test` and `gradle build`, passed basic HTTP smoke, and produced 75 evidence files with `node_modules/persona-harness` noisy target count 0.
- Philosophy priority is company, then personal, then Clean Code baseline. Automatic philosophy injection is not productized yet.
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
- `ph intake`: creates a draft `.persona/project-profile.jsonc` for backend project planning before implementation.
- `ph plan`: creates `.persona/workflow/plan.md`, `.persona/workflow/implementation-report.md`, and `.persona/workflow/review-report.md` drafts.
- `ph history`: archives completed workflow artifacts into `.persona/workflow/history/<archive-id>/` after a run has been used.
- `ph bearshell <command>`: Persona Harness CLI helper for bounded repo inspection and smoke-test command output. Injection blocks now tell the agent to prefer this helper for repo inspection, CLI smoke tests, and large output checks.

## Phase Map

| Phase | Status | Current Result |
| --- | --- | --- |
| Phase 0 | Done | Java/Spring backend injection MVP evidence collected |
| Phase 1.1 | Done | Catalog/frontmatter/glob/scenario selection refinement complete |
| Phase 1.2 | Done | Report-only observer pass closed; reinforcement deferred |
| Phase 2 | Active validation | Product-code-flow rubric, injection value stopping rule, scope diagnostics, and artifact cleanup added |
| Java MVP Packaging | Active productization | Init CLI, `ph bearshell`, `ph bearshell` awareness injection, bootstrap injection, packaged install/run/verify smoke commands, release-facing install guide, and v0.2.1 local/tarball readiness added |
| v0.3.0 Intake | Active planning surface | `ph intake` creates a backend project profile draft; profile summary injection is implemented and smoke-verified as planning context; `ph plan` creates plan, implementation-report, and review-report workflow drafts; `ph history` archives used workflow artifacts; clean OpenCode plan-fill, plan-based implementation, repeat workflow, and template-fill/history smokes passed; installed package Java fixture evidence noise is narrowed |
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

7. `[x]` v0.2.1 clean project generation quality review
   - Evidence: `docs/evidence-reviews/v0.2.1-clean-project-quality-review.md`
   - Current state: clean tarball install plus README-only OpenCode generation created buildable Java/Spring Gradle apps in two domains. The first library-lending pass needed target-file follow-up for repository port placement and domain behavior. After narrow guidance tightening, the second course-enrollment README-only rerun generated domain repository ports, infrastructure implementations, class-based domain entities, and domain self-judgment behavior without target-file follow-up. Final `gradle test` and `gradle build` passed in the second clean project.
   - Next candidate: v0.3.0 project-intake / philosophy workflow planning. Reopen a narrow `v0.2.2` guidance loop only if a future clean README-only run regresses on repository port placement or domain self-judgment behavior.

8. `[x]` v0.3.0 project-intake / philosophy workflow minimum surface
   - Evidence: `docs/current/v0.3.0-project-intake-philosophy-workflow.md`, `docs/current/v0.3.0-backend-profile-summary-injection-design.md`, `docs/current/v0.3.0-blackbear-plan-artifact.md`, `docs/current/v0.3.0-workflow-history.md`, `docs/current/v0.3.0-installed-package-evidence-noise-policy.md`, `docs/current/persona-workflow-roles-v0.3.md`, `docs/evidence-reviews/v0.3.0-intake-planning-smoke.md`, `docs/evidence-reviews/v0.3.0-intake-planned-implementation-smoke.md`, `docs/evidence-reviews/v0.3.0-profile-summary-injection-smoke.md`, `docs/evidence-reviews/v0.3.0-blackbear-plan-fill-smoke.md`, `docs/evidence-reviews/v0.3.0-plan-based-implementation-smoke.md`, `docs/evidence-reviews/v0.3.0-repeat-workflow-evidence-noise-review.md`, `docs/evidence-reviews/v0.3.0-template-fill-history-smoke.md`
   - Current state: `ph intake` creates `.persona/project-profile.jsonc` with backend project context, scale, storage, persistence, migration, package style, DTO strictness, and philosophy overlay questions. Clean project planning-only smoke and planned implementation smoke are positive. Backend-only profile summary injection now surfaces filled profile answers as planning context for Java/Spring backend/bootstrap targets without enforcing them. A README-only planning prompt smoke confirmed the first plan reflected profile choices without explicitly naming `.persona/project-profile.jsonc`. `ph plan` creates `.persona/workflow/plan.md` for `blackbear` planning plus `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md` templates for `jaeki`/`roach` evidence. `ph history` archives completed workflow artifacts into `.persona/workflow/history/<archive-id>/` without deleting active workflow files. Clean plan-fill smoke confirmed OpenCode can complete that plan and stop before implementation. Plan-based implementation smoke produced a buildable Equipment Rental API, passed Gradle verification, passed manual HTTP smoke, and left implementation/review evidence files. Repeat workflow smoke produced a buildable Course Equipment Reservation API, passed independent Gradle verification and HTTP smoke, and confirmed `node_modules/persona-harness` evidence target count 0. Template-fill/history smoke confirmed OpenCode filled the pre-created implementation/review report templates instead of creating ad hoc report files, then `ph history` archived all three workflow artifacts. Installed-package Java fixture evidence noise is narrowed by ignoring `node_modules/persona-harness/` targets during direct capture and Java role discovery. `Charles`, `jaeki`, and `roach` workflow role boundaries are documented but not implemented as autonomous agents.
   - Next candidate: choose between a narrow Gradle/Spring build guidance review around JDK/toolchain/`bootJar`, or the next v0.3 workflow surface such as interactive intake or plan acceptance.

9. `[~]` Test Contract response time object watch
   - Evidence: `docs/phases/phase1/phase1-test-contract-response-time-repeat-review.md`
   - Current state: comparison run had explicit assertions, so no active reinforcement loop.

10. `[~]` Shared-skill productization watch
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
- `docs/current/v0.3.0-project-intake-philosophy-workflow.md`
- `docs/current/v0.3.0-backend-profile-summary-injection-design.md`
- `docs/current/v0.3.0-installed-package-evidence-noise-policy.md`
- `docs/current/v0.3.0-blackbear-plan-artifact.md`
- `docs/current/v0.3.0-workflow-history.md`
- `docs/current/persona-workflow-roles-v0.3.md`
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
- `docs/evidence-reviews/v0.2.1-clean-project-quality-review.md`
- `docs/evidence-reviews/v0.3.0-intake-planning-smoke.md`
- `docs/evidence-reviews/v0.3.0-intake-planned-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.0-profile-summary-injection-smoke.md`
- `docs/evidence-reviews/v0.3.0-blackbear-plan-fill-smoke.md`
- `docs/evidence-reviews/v0.3.0-plan-based-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.0-template-fill-history-smoke.md`
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
