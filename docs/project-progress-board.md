# Persona Harness Progress Board

Last updated: 2026-06-30

## Purpose

Short index for the current Persona Harness state.

Detailed historical board content is archived at:

- `docs/archive/project-progress-board-2026-06-19-pre-taxonomy.md`

`PROJECT-PLAN.md` remains the long local planning log.

## Current Position

Current track: `0.4.0-rc.2` next-channel candidate for scoped product workflow
guard behavior on top of the Java/Spring backend workflow rail.

Current installable candidate: `persona-harness@next` -> `0.4.0-rc.2`.
Observed registry channels on 2026-06-30: `next=0.4.0-rc.2`,
`alpha=0.3.9-alpha.8`, `latest=0.3.9-alpha.8`.

Current claim boundary: GUARD Phase 0-3 is a scoped opt-in closure enforcement
candidate, not a strong general guard. Phase 0 is opt-in direct verification for
the supported Java/Spring/Gradle slice; Phase 1 adds convention
`report|warn|block` levels and the scoped Controller -> Repository blocker;
Phase 2 is warning-only write guard fallback because deny/rewrite is unsupported;
Phase 3 is convention registry plus BYO ast-grep preview groundwork. Current
HEAD through `a9bf926` routes closure blockers through structured registry
metadata with block eligibility and precision fields, while keeping
`controller.repository-dependency` as the first/default block-capable convention.
BYO `.persona/conventions/*.yml` ast-grep convention preview is implemented for
simple YAML metadata; current registry size is 2 conventions, including 1
ast-grep convention: `controller.persistence-import`. Missing `sg`/`ast-grep`
skips with a warning instead of faking a pass.

Historical board entries below may mention older alpha candidates, older
dist-tag policy, or older eval conclusions. Treat `package.json`, `CHANGELOG.md`,
and `docs/current/release/v0.4.0-rc.2-release-notes.md` as the current release
candidate source of truth.

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
- v0.3.0 starts as a planning surface, not rule enforcement: `ph intake` creates `.persona/project-profile.jsonc` with backend project-shaping questions. Philosophy/policy overlay slots are deferred to a separate future surface.
- v0.3.0 planned implementation smoke is positive: a filled profile plus explicit profile-read prompt produced a buildable Equipment Rental Gradle Spring app with domain-first packages, domain repository ports, infrastructure repository implementations, class-based domain entities with behavior, DTO boundaries, and no Service-owned storage/id sequence.
- v0.3.0 profile handling is implemented and smoke-verified: a README-only planning prompt received profile choices through project-bootstrap injection and reflected database, `JdbcTemplate`, `Flyway`, `domain-first`, and strict DTO choices in the first architecture/technology plan. Company/personal philosophy file loading, frontend/infra profile routing, AST/linter enforcement, and TDD workflow remain out of scope.
- v0.3.x workflow role names are reserved for documentation and local workflow artifacts: `blackbear` plans, `Charles` coordinates, `jaeki` implements, and `roach` reviews/pressures QA. `ph plan` now creates `.persona/workflow/plan.md`, `.persona/workflow/implementation-report.md`, and `.persona/workflow/review-report.md` drafts; `ph plan --status`, `ph plan --accept`, and `ph plan --revise` read or update the plan acceptance marker; `ph history` archives used workflow artifacts under `.persona/workflow/history/<archive-id>/` without deleting active files. Clean OpenCode smokes confirmed the model can fill the plan, implement from it, pass Gradle verification, fill the pre-created implementation/review report templates instead of creating ad hoc report files, and archive completed workflow artifacts. These are not autonomous Persona Harness agents yet.
- Installed package internals under `node_modules/persona-harness/` are not useful clean-project evidence targets. Direct target capture and Java role discovery now ignore those files so vendored shared-skill Java fixtures do not pollute generated-project evidence.
- v0.3.0 repeat clean workflow evaluation is positive after evidence-noise cleanup: the repeat Course Equipment Reservation run produced a buildable Gradle Spring app, passed independent `gradle test` and `gradle build`, passed basic HTTP smoke, and produced 75 evidence files with `node_modules/persona-harness` noisy target count 0.
- v0.3.0 template-fill/history smoke is positive, but exposed a narrow build-line issue: OpenCode disabled `bootJar` to work around a local Gradle 9.4.0 / Spring Boot 3.3.2 compatibility failure. Gradle/Spring build guidance now tells the agent to choose a compatible Spring Boot/Gradle/JDK line, include JUnit Platform launcher when needed, and keep `gradle test`, `gradle build`, and `gradle bootRun` viable for executable Spring Boot apps.
- v0.3.0 plan acceptance implementation smoke is positive for workflow behavior: OpenCode read `README.md`, `.persona/project-profile.jsonc`, and `.persona/workflow/plan.md`, ran `ph plan --revise`, re-read the plan, ran `ph plan --accept`, then implemented a buildable Pet Clinic Appointment API and filled implementation/review reports. Independent Gradle and HTTP smoke passed. The same smoke also repeated the `bootJar` disabling workaround, so build-line guidance remains the next narrow gap.
- Gradle/Spring build-line guidance was tightened again after the repeated `bootJar` workaround: executable Spring Boot apps must not add `tasks.named("bootJar") { enabled = false }` unless explicitly declared as a plain Java library, and `CopyProcessingSpec.getDirMode()` is named as a plugin/Gradle line mismatch to solve by choosing a compatible Spring Boot plugin or Gradle wrapper line.
- v0.3.0 Gradle/Spring build-line smoke is positive after the tightened guidance: clean Clinic Notice API generation selected Spring Boot 3.5.0, Java 21, and local Gradle 9.4.0; `bootJar` stayed enabled; independent `gradle test`, `gradle build` with `:bootJar`, `gradle bootRun`, and HTTP smoke passed. Reopen this gap only if a future clean run regresses.
- v0.3.0 workflow next-surface decision is closed: choose backend-only interactive intake refinement before plan-review ergonomics or Test -> Feat -> Refactor workflow. The next loop should improve the first project-shaping conversation, not add another clean generation A/B loop.
- v0.3.0 interactive intake schema is fixed before CLI implementation: `project-goal`, `application-type`, `architecture-style`, `boundary-strictness`, and `notes.project` are part of the backend profile; `dto-strictness` and `philosophy-overlay` are removed from project intake.
- v0.3.0 interactive intake is implemented and smoke-verified through `ph init -> ph intake --interactive -> ph plan`. The next narrow check is how OpenCode uses an accepted interactive profile.
- v0.3.0 accepted interactive profile smoke is positive: `ph init -> ph intake --interactive -> ph plan -> ph plan --accept` produced an accepted plan containing the filled backend profile; OpenCode plan-only mode used the profile to complete the architecture plan; OpenCode implementation mode produced a buildable Equipment Rental API with Gradle, Flyway, domain-first packages, domain repository ports, JDBC infrastructure implementations, class-based domain models with behavior, separated DTO boundaries, no service-owned storage/id sequence, independent `gradle test`/`gradle build` pass, and live HTTP manual QA pass. Remaining gaps: OpenCode did not run live HTTP manual QA itself, hidden `.persona` discovery is noisy, broad Java globs still see installed package fixtures, and Java target-role injection after generated files was not exercised.
- v0.3.0 implementation-report live HTTP QA guidance is now tightened: `ph plan` templates ask runnable Spring Boot apps to record `gradle bootRun`, HTTP happy path, HTTP failure path, or an explicit reason plus stderr/key logs when live manual QA cannot run. This is workflow evidence, not product-quality certification.
- v0.3.0 live HTTP QA OpenCode smoke is positive: after `ph init -> ph intake --interactive -> ph plan -> ph plan --accept`, OpenCode read the accepted workflow plan and implementation-report template, implemented a Club Event Registration API, ran and recorded `gradle test`, `gradle build`, `gradle bootRun`, an HTTP happy path, and an HTTP failure path. Remaining narrow gap: the filled implementation report still kept `Status: template`.
- v0.3.0 workflow report status lifecycle is implemented and smoke-verified: `ph plan` now creates implementation/review reports as `Status: template`, the templates ask the actor to run `ph plan --report-filled implementation` or `ph plan --report-filled review` after filling them, and those commands mark only the selected report as `Status: filled` while leaving plan status unchanged. This is local evidence metadata, not a build/test gate.
- v0.3.0 generated Java target-role follow-up is positive: after clean project generation, OpenCode explicitly read generated Controller, Service, Repository, request DTO, response DTO, and domain files; `.persona/evidence/phase0` then contained role-specific evidence for `controller`, `service`, `repository`, `request-dto`, `response-dto`, and `domain`, with `programming` shared skill attached to Java targets.
- v0.3.0 step API contract scoping is complete: `backend/step1-api-contract.md` and `backend/step2-3-api-contract.md` are roomescape step fixture rules, not default clean-project Java/Spring guidance. Clean Controller/DTO/Test targets keep generic requirement-based HTTP contract guidance without old roomescape 200 OK pressure.
- v0.3.0 step-contract-scoped clean workflow smoke is positive: a clean Team Task Board API generated from README/profile used `201 Created` for create endpoints, `200 OK` for list/update endpoints, `409 Conflict` for invalid state, and `404 Not Found` for missing resources. Generated Controller/DTO target injection checks selected no old roomescape step contract rules.
- Philosophy priority is company/team policy, then personal philosophy, then Clean Code baseline. README, current prompt, accepted workflow plan, and project-profile choices remain the requirements plane. `ph policy init` creates backend-only local overlay files, and backend Java/Spring plan/injection surfaces render a small company > personal overlay summary as planning context only.
- v0.3.0 policy overlay clean workflow smoke is positive: `ph init -> ph intake --interactive -> ph policy init -> ph plan -> OpenCode plan-only` produced a completed architecture plan that read the profile and company/personal policy files, treated policy overlay as planning context only, preserved README/current prompt priority, and created no implementation files.
- v0.3.0 policy overlay accepted implementation smoke is positive for policy behavior and partial for build-line behavior: generated code followed the policy-influenced accepted plan with domain-first packages, domain repository ports, JDBC infrastructure adapters, class-based domain behavior, and no Service-owned storage/id sequence; independent `gradle test`, `gradle build`, `gradle bootRun`, and HTTP smoke passed. However OpenCode again disabled `bootJar`, so the next narrow follow-up is build-line compatibility, not broader policy/enforcement.
- v0.3.0 external tester pilot is prepared as documentation, not public distribution: testers should use GitHub or tarball install, run `ph init -> ph intake --interactive -> ph policy init -> ph plan -> OpenCode`, and report install friction, `.persona/evidence`, Gradle/`bootJar`, HTTP smoke, generated structure, and usability judgment.
- v0.3.0-alpha npm publish readiness is closed for `0.3.0-alpha.2`: package version is `0.3.0-alpha.2`, alpha install flow is `npm install -D persona-harness@alpha`, and registry fresh install smoke passed.
- Published `persona-harness@alpha` smoke against the existing `0.3.0-alpha.1` package exposed stale package behavior: `ph init` still printed the old implementation-first prompt, and non-TTY `ph intake --interactive` correctly refused piped input. This makes `0.3.0-alpha.2` the necessary next package candidate for the P0 plan-first UX fixes.
- v0.3.0-alpha release automation is defined in `.github/workflows/release.yml`: tag pushes verify tests/typecheck/build/rule diagnostics/scope/injection-value/pack, publish npm with alpha/beta/latest dist-tag derived from the version tag, synchronize `latest` to prerelease tags during the alpha/beta pilot, and create generated GitHub release notes. This workflow is not yet proven by a real tag push in this board.
- v0.3.0 workflow command guidance now prefers clean-project-safe invocation: OpenCode-facing prompts and report templates use `npx ph ...`, and Gradle/test/build/smoke command slots prefer `npx ph bearshell ...` over raw shell.
- v0.3.0 bearshell guidance clean smoke is positive with a narrow limitation: OpenCode used `npx ph bearshell` for `gradle test`, `gradle build`, and `bootRun`, and used `npx ph plan --report-filled ...` for report lifecycle, but still used raw shell for `java -version` and the chained curl HTTP smoke.
- v0.3.0 init UX is now plan-first: `ph init` points users to `ph intake --interactive`, optional `ph policy init`, `ph plan`, plan review, and `ph plan --accept` or `--revise` before implementation. It also names the OpenCode TUI flow and `npx ph plan --prompt` instead of telling users to implement immediately.
- v0.3.0 scope hardening narrows the default harness domains to `backend` and `programming`; frontend/infra remain outside the Java/Spring backend MVP default.
- v0.3.0 diagnostics hardening records malformed `.persona/harness.jsonc` as diagnostics-only findings in injection/evidence while falling back to defaults.
- v0.3.0 bearshell hardening adds a default timeout with `PH_BEARSHELL_TIMEOUT_MS` override; the helper remains timeout/output bounded, not sandboxed.
- Java backend bootstrap guidance now makes static factory construction explicit: Domain entity/aggregate static factories should close creation through private constructors, not public constructors.
- `v0.2.1` support contract covers local/tarball install, `ph init`, Java/Spring target injection, metadata evidence, and `npx ph bearshell` command-surface behavior in clean OpenCode smoke.
- `packages/shared-skills` remains in the v0.2.1 tarball as packaged reference material; it is not a release-facing support surface or enforcement gate.
- v0.2.1 package metadata is checked for name, version, description, keywords, license, repository, homepage, bugs, bin, files, engines, and package size.
- Public npm alpha exists; `alpha` and `latest` both point to `0.3.0-alpha.3` during the alpha pilot. Stable support guarantees remain deferred.
- Experiment artifact cleanup is a phase-close hygiene step and remains dry-run-first.
- Next-version packaging was previously blocked after the `01-book-loans` context-noise rerun: Persona ON run-05 no longer timed out and passed `gradle test`, but the generated package-flow shape still missed the current Java backend MVP target enough that the A/B verdict remained mixed. The external analyzer now classifies this as `buildable-package-flow-mismatch` instead of conflating it with generated-project failure, and backend guidance now explicitly rejects `controller/service/repository/dto` role-name packages in favor of `presentation/application/domain/infrastructure`.
- Fresh ON package-flow/bootJar follow-up is positive: the `01-book-loans` run at `/Users/yongtae/Desktop/blackbear-persona-harness-test/fresh-runs/01-book-loans/A-persona-on/bootjar-guidance-20260622-005742` generated `presentation/application/domain/infrastructure`, domain repository ports plus infrastructure implementations, no Service-owned storage/id sequence, no `bootJar.enabled=false`, `gradle build` with `:bootJar UP-TO-DATE`, and independent `gradle bootRun` HTTP happy/failure smoke pass. This reduces the narrow package-flow/build-line blocker; final packaging still needs an explicit release/demo decision.
- Release/demo decision is now `proceed-to-demo-packaging` for `v0.3.0-alpha.3`. Version metadata, changelog, release notes, `npm pack --dry-run --json`, `npm publish --dry-run --tag alpha`, manual `npm publish --tag alpha`, `latest` dist-tag sync, GitHub tag/release, and external install smoke pass for `0.3.0-alpha.3`.
- v0.3.1 candidate is workflow diagnostics, not broader Java rule expansion: short OpenCode TUI requests already show useful Java/Spring product-code shape influence, but can skip workflow evidence discipline. The next surface adds `ph workflow check`, `ph doctor`, `ph smoke`, `ph feedback`, `ph evidence summary`, and `ph review backend-shape` as report-only local commands, improves `ph history` archive summary with evidence-summary content, and adds `ph workflow guard implement/final` so short implementation requests are routed through accepted plan, strict workflow state, `npx ph bearshell`, filled implementation report steps, and final-review readiness. Injection block dieting now removes full shared-skill reference paths from model-facing text while keeping metadata evidence intact.
- v0.3.1 short TUI workflow smoke is now positive for workflow report completion after follow-up: in clean installed tarball projects, the prompt `README 보고 구현해줘` triggered `npx ph plan --implement`, `npx ph workflow check`, implementation report filling, `npx ph plan --report-filled implementation`, review report filling, and `npx ph plan --report-filled review`. Generated backend shape was strong by manual inspection, with domain-first packages, domain repository ports, infrastructure adapters, class-based domain behavior, DTO boundaries, no Service-owned storage/id sequence, `bootJar` kept enabled, Gradle verification, and HTTP smoke. The follow-up backend-shape matcher correction now reports the same project as all PASS, including `*Store.java implements *Repository` adapters and verification evidence split across implementation/review reports. The remaining command-discipline gap is now visible: `ph workflow check` reports WARN when filled reports mention raw shell use or omit `npx ph bearshell`.
- v0.3.1 packaging posture is `alpha-candidate`: the code surface exists and the README now states the intended product behavior more directly. `ph` commands are not meant to become a human-memorized CLI sequence; they are stable handles for the AI agent to call while the human gives short natural-language requests.
- v0.3.1-alpha.1 packaging fix removes old Roomescape step contract fixture files from public `ph init` copies and from the npm tarball. `backend/step1-api-contract.md` and `backend/step2-3-api-contract.md` remain internal Phase 0 fixture rules only; external clean projects should not receive stale `/reservations`, `/times`, or Roomescape guidance.
- v0.3.1-alpha.2 candidate strengthens external-user diagnostics: `ph doctor` now reports rules-surface size and stale fixture findings, `ph smoke` writes local integration diagnostics into the smoke report, and workflow start/implementation prompts more directly route short TUI requests like `README.md 보고 구현해줘` through workflow start/finish and `npx ph bearshell`.
- v0.3.1 workflow guard clean TUI smoke is partial: across three clean OpenCode runs using the short prompt `README 보고 구현해줘`, all three ran `npx ph workflow guard implement`, all three ran `npx ph plan --implement`, all three filled implementation and review reports, and all three produced evidence. Only one of three reached `npx ph workflow guard final` PASS naturally. The repeated failure was command discipline around raw shell usage versus `npx ph bearshell`. The next improvement is now implemented as script-level workflow routing (`ph workflow start implement` / `ph workflow finish implement`) rather than more prose in README or plan templates.
- v0.3.x top-level intent router MVP is implemented: `detectTopLevelIntent` classifies user language into one primary rail among requirements, debug, review, refactor, git, and programming plus optional secondary intents. Requirements workflow injection now goes through this router so README-related debug/review/refactor/git requests do not automatically fall into implementation workflow. Dedicated requirements, debug, review, refactor, git, and programming workflow blocks are active; runtime rail text now loads from PH-owned workflow skill reference files; injected workflow rails write `phase0.intent.1` evidence with the user prompt, primary intent, secondary intents, reason, and rail marker. Rail compliance hooks now write report-only `phase0.rail-compliance.1` WARN evidence when observed tool behavior likely drifts from the selected rail.
- v0.3.x rail blocks are now complete at the inline runtime level: debug rail injects failure reproduction and hypothesis discipline; review rail injects findings-first read-only review discipline; refactor rail injects baseline public behavior evidence, no feature additions, small structural changes, and same verification rerun; git rail injects repository-safe status/diff/stage/commit/push discipline. The next architecture step is mandatory skill/hook/role-agentization: move rail text into PH skill/reference files, add hook-based report-only compliance evidence, add stop/continuation checks, and later map blackbear/jaeki/roach/Charles role boundaries.

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
- `ph intake --interactive`: asks backend project-shaping questions one at a time and writes a filled `.persona/project-profile.jsonc`.
- `ph policy init`: creates backend-only `.persona/policies/overlay.jsonc`, `.persona/policies/company/backend.md`, and `.persona/policies/personal/backend.md`.
- `ph plan`: creates `.persona/workflow/plan.md`, `.persona/workflow/implementation-report.md`, and `.persona/workflow/review-report.md` drafts.
- `ph plan --status`: reads the current plan acceptance status.
- `ph plan --accept`: marks `.persona/workflow/plan.md` as accepted.
- `ph plan --revise`: marks `.persona/workflow/plan.md` as needs-revision.
- `ph plan --report-filled implementation`: marks `.persona/workflow/implementation-report.md` as filled after the report has been filled.
- `ph plan --report-filled review`: marks `.persona/workflow/review-report.md` as filled after the report has been filled.
- `ph history`: archives completed workflow artifacts into `.persona/workflow/history/<archive-id>/` after a run has been used.
- `ph bearshell <command>`: Persona Harness CLI helper for bounded repo inspection and smoke-test command output. Injection blocks now tell the agent to prefer this helper for repo inspection, CLI smoke tests, and large output checks.
- `ph workflow check`: reports plan/report/evidence workflow status and the next workflow action.
- `ph workflow guard implement`: blocks implementation until the accepted-plan workflow state is ready.
- `ph workflow guard final`: blocks final completion reporting until workflow reports/evidence/command discipline are ready.
- `ph doctor`: diagnoses local Node/npm/OpenCode and Persona Harness integration state.
- `ph evidence summary`: writes `.persona/evidence/summary.md` from raw evidence files.
- `ph smoke`: writes `.persona/workflow/smoke-report.md` for external tester reproduction.
- `ph feedback`: writes `.persona/workflow/feedback-report.md` for external tester feedback.
- `ph review backend-shape`: writes `.persona/workflow/backend-shape-report.md` as a report-only Java/Spring backend shape observation.

## Phase Map

| Phase | Status | Current Result |
| --- | --- | --- |
| Phase 0 | Done | Java/Spring backend injection MVP evidence collected |
| Phase 1.1 | Done | Catalog/frontmatter/glob/scenario selection refinement complete |
| Phase 1.2 | Done | Report-only observer pass closed; reinforcement deferred |
| Phase 2 | Active validation | Product-code-flow rubric, injection value stopping rule, scope diagnostics, and artifact cleanup added |
| Java MVP Packaging | Active productization | Init CLI, `ph bearshell`, `ph bearshell` awareness injection, bootstrap injection, packaged install/run/verify smoke commands, release-facing install guide, and v0.2.1 local/tarball readiness added |
| v0.3.0 Intake | Active planning surface | `ph intake` creates a backend project profile draft; `ph intake --interactive` writes a filled backend profile; `ph policy init` creates backend-only company/personal overlay files; profile and policy overlay summaries are implemented as planning context; `ph plan` creates plan, implementation-report, and review-report workflow drafts; `ph plan --status/--accept/--revise` records plan acceptance state; `ph plan --report-filled implementation|review` records filled workflow report state; implementation-report live HTTP QA slots are tightened and clean OpenCode smoke-verified; generated Java target-role follow-up is smoke-verified; `ph history` archives used workflow artifacts; clean OpenCode plan-fill, plan-based implementation, repeat workflow, template-fill/history, plan-acceptance implementation, Gradle/Spring build-line, interactive-intake planning, accepted-interactive-profile implementation, live HTTP QA template behavior, workflow report status, and generated Java target-role smokes passed; installed package Java fixture evidence noise is narrowed |
| v0.3.1 Diagnostics | Alpha candidate | `ph workflow check`, `ph doctor`, `ph smoke`, `ph feedback`, `ph evidence summary`, and `ph review backend-shape` are implemented as local report-only commands for external tester friction, workflow evidence discipline, evidence noise reduction, and backend shape observation. `ph workflow guard implement/final` are implemented as strict AI-facing workflow gates. README/release notes now frame `ph` as the command surface agents should call from short TUI implementation requests. |
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
   - Evidence: `docs/current/v0.3.0-project-intake-philosophy-workflow.md`, `docs/current/v0.3.0-backend-profile-summary-injection-design.md`, `docs/current/v0.3.0-blackbear-plan-artifact.md`, `docs/current/v0.3.0-plan-acceptance.md`, `docs/current/v0.3.0-workflow-history.md`, `docs/current/v0.3.0-workflow-report-status-lifecycle.md`, `docs/current/v0.3.0-gradle-spring-build-guidance.md`, `docs/current/v0.3.0-installed-package-evidence-noise-policy.md`, `docs/current/v0.3.0-workflow-next-surface-decision.md`, `docs/current/v0.3.0-interactive-intake-design.md`, `docs/current/v0.3.0-intake-transcript-fixture.md`, `docs/current/v0.3.0-profile-schema-decision.md`, `docs/current/v0.3.0-step-api-contract-scope-decision.md`, `docs/current/v0.3.0-philosophy-policy-overlay-design.md`, `docs/current/persona-workflow-roles-v0.3.md`, `docs/evidence-reviews/v0.3.0-intake-planning-smoke.md`, `docs/evidence-reviews/v0.3.0-intake-planned-implementation-smoke.md`, `docs/evidence-reviews/v0.3.0-profile-summary-injection-smoke.md`, `docs/evidence-reviews/v0.3.0-blackbear-plan-fill-smoke.md`, `docs/evidence-reviews/v0.3.0-plan-based-implementation-smoke.md`, `docs/evidence-reviews/v0.3.0-repeat-workflow-evidence-noise-review.md`, `docs/evidence-reviews/v0.3.0-template-fill-history-smoke.md`, `docs/evidence-reviews/v0.3.0-plan-acceptance-implementation-smoke.md`, `docs/evidence-reviews/v0.3.0-gradle-spring-buildline-smoke.md`, `docs/evidence-reviews/v0.3.0-interactive-intake-planning-smoke.md`, `docs/evidence-reviews/v0.3.0-interactive-accepted-plan-implementation-smoke.md`, `docs/evidence-reviews/v0.3.0-live-http-qa-template-smoke.md`, `docs/evidence-reviews/v0.3.0-live-http-qa-opencode-smoke.md`, `docs/evidence-reviews/v0.3.0-workflow-report-status-lifecycle-smoke.md`, `docs/evidence-reviews/v0.3.0-generated-java-target-role-followup.md`, `docs/evidence-reviews/v0.3.0-step-contract-scoped-clean-workflow-smoke.md`, `docs/evidence-reviews/v0.3.0-policy-overlay-clean-workflow-smoke.md`, `docs/evidence-reviews/v0.3.0-policy-overlay-accepted-implementation-smoke.md`
   - Current state: `ph intake` creates `.persona/project-profile.jsonc` with the fixed backend profile schema: project context, project goal, scale/lifecycle, application type, storage, persistence technology, conditional migration style, package style, architecture style, boundary strictness, and `notes.project`. `ph intake --interactive` asks those questions one at a time, supports numeric choices, Enter/`추천`/`recommend`, `미정`, conditional migration, no partial profile on abort, and `notes.project`. `dto-strictness` and `philosophy-overlay` are no longer project-intake questions; philosophy/policy is a separate surface. `ph policy init` creates `.persona/policies/overlay.jsonc`, `.persona/policies/company/backend.md`, and `.persona/policies/personal/backend.md`; backend Java/Spring plan and injection surfaces read those files diagnostics-only and render company policy before personal philosophy as planning context only. Clean `ph init -> ph intake --interactive -> ph policy init -> ph plan -> OpenCode plan-only` smoke is positive: OpenCode read profile and policy files, completed only `.persona/workflow/plan.md`, treated policy overlay as planning context only, and created no implementation files. Accepted-plan implementation smoke is positive for policy overlay behavior: generated code followed the accepted policy-influenced plan with domain-first packages, domain repository ports, infrastructure JDBC adapters, class-based domain behavior, and no Service-owned storage/id sequence; `gradle test`, `gradle build`, `gradle bootRun`, HTTP happy path, and HTTP failure path passed independently. The same smoke is partial for Gradle/Spring build-line behavior because OpenCode again set `bootJar { enabled = false }`, making `gradle build` pass with `:bootJar SKIPPED`. Clean `ph init -> ph intake --interactive -> ph plan` planning smoke is positive. Backend-only profile summary injection now surfaces filled profile answers as planning context for Java/Spring backend/bootstrap targets without enforcing them. A README-only planning prompt smoke confirmed the first plan reflected profile choices without explicitly naming `.persona/project-profile.jsonc`. `ph plan` creates `.persona/workflow/plan.md` for `blackbear` planning plus `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md` templates for `jaeki`/`roach` evidence. `ph plan --status`, `ph plan --accept`, and `ph plan --revise` read or update the plan acceptance marker without acting as enforcement gates. `ph plan --report-filled implementation` and `ph plan --report-filled review` mark filled workflow reports as `Status: filled` without changing the plan status or acting as build/test gates; CLI smoke confirmed implementation/review reports become `filled` while the plan remains `draft`. `ph history` archives completed workflow artifacts into `.persona/workflow/history/<archive-id>/` without deleting active workflow files. Clean plan-fill smoke confirmed OpenCode can complete that plan and stop before implementation. Plan-based implementation smoke produced a buildable Equipment Rental API, passed Gradle verification, passed manual HTTP smoke, and left implementation/review evidence files. Repeat workflow smoke produced a buildable Course Equipment Reservation API, passed independent Gradle verification and HTTP smoke, and confirmed `node_modules/persona-harness` evidence target count 0. Template-fill/history smoke confirmed OpenCode filled the pre-created implementation/review report templates instead of creating ad hoc report files, then `ph history` archived all three workflow artifacts. Plan acceptance implementation smoke confirmed OpenCode used `ph plan --revise` then `ph plan --accept` before implementation, generated a Pet Clinic Appointment API, passed independent `gradle test`, `gradle build`, and HTTP smoke, and filled implementation/review reports. After that repeated `bootJar` workaround, Gradle/Spring guidance now explicitly rejects `bootJar.enabled=false` for executable apps and names `CopyProcessingSpec.getDirMode()` as a build-line mismatch. The follow-up Gradle/Spring build-line smoke generated a Clinic Notice API with Spring Boot 3.5.0, Java 21, and Gradle 9.4.0, kept `bootJar` enabled, passed independent `gradle test`, `gradle build`, `gradle bootRun`, and HTTP smoke. Accepted interactive profile smoke generated an Equipment Rental API from `team/production-service/database/JdbcTemplate/Flyway/domain-first/clean-architecture-light/strict` answers and a domain-model note; OpenCode plan-only mode completed the accepted architecture plan, and implementation mode produced Gradle/Flyway/domain-first code with domain repository ports, JDBC infrastructure repositories, class-based domain behavior, separated DTO boundaries, independent Gradle pass, and live HTTP QA pass. Implementation-report templates now explicitly ask generated runnable Spring Boot apps to record `gradle bootRun`, HTTP happy path, HTTP failure path, or the reason/logs when live manual QA is not feasible. Follow-up clean OpenCode smoke confirmed those tightened slots changed behavior: OpenCode ran and recorded `gradle test`, `gradle build`, `gradle bootRun`, HTTP happy path, and HTTP failure path for a Club Event Registration API. Generated Java target-role follow-up confirmed Controller, Service, Repository, request DTO, response DTO, and domain evidence appears after generated files are explicitly read, with `programming` shared skill on Java targets. Step API contract scoping now keeps the old roomescape `step1` and `step2-3` API contract rules out of default clean-project Controller/DTO/Test targets while preserving them for roomescape fixture paths. Step-contract-scoped clean workflow smoke generated a Team Task Board API that preserved README/profile status contracts (`201`, `200`, `409`, `404`) and selected no old roomescape step contract rules for generated clean Controller/DTO targets. Philosophy/policy overlay design separates the requirements plane from the policy plane: README/current prompt/accepted plan/project-profile choices own functional requirements, while company/team policy > personal philosophy > Clean Code baseline shapes implementation style as non-enforcing planning context. Installed-package Java fixture evidence noise is narrowed by ignoring `node_modules/persona-harness/` targets during direct capture and Java role discovery. `Charles`, `jaeki`, and `roach` workflow role boundaries are documented but not implemented as autonomous agents.
   - Next candidate: narrow Gradle/Spring build-line compatibility follow-up that prevents `bootJar` disabling by steering the agent toward a compatible Spring Boot plugin / Gradle wrapper / Java line.

9. `[~]` Test Contract response time object watch
   - Evidence: `docs/phases/phase1/phase1-test-contract-response-time-repeat-review.md`
   - Current state: comparison run had explicit assertions, so no active reinforcement loop.

10. `[~]` Shared-skill productization watch
   - Evidence: `docs/current/phase2-scope-settlement.md`, `docs/current/shared-skill-reference-direction.md`, `docs/current/mvp-scope-consistency-check.md`, `docs/current/programming-shared-skill-actual-usage-review.md`
   - Current state: Java/Gradle `programming` support is limited active routing; actual clean run shows it appears on Java Service targets but does not replace `.persona` backend rules. Multi-domain productization remains inactive.

11. `[~]` v0.3.1 workflow diagnostics and external tester surface
   - Evidence: `docs/current/v0.3.1-workflow-diagnostics-surface.md`, `docs/evidence-reviews/v0.3.1-short-tui-workflow-smoke.md`, `docs/evidence-reviews/v0.3.1-review-report-short-tui-smoke.md`, `docs/evidence-reviews/v0.3.1-workflow-guard-clean-tui-smoke.md`, `docs/evidence-reviews/v0.3.1-workflow-runner-clean-tui-smoke.md`, `docs/evidence-reviews/v0.3.1-workflow-noise-classification-smoke.md`
   - Current state: candidate implementation adds report-only commands for workflow status, install diagnostics, smoke report, feedback template, evidence summary, and backend shape observation. `ph history` includes evidence-summary content when present, and injection text drops full shared-skill file paths while preserving metadata evidence. Clean short-TUI smoke confirmed that a minimal `README 보고 구현해줘` request used `npx ph plan --implement`, `npx ph workflow check`, filled implementation and review reports, ran `npx ph plan --report-filled implementation`, and ran `npx ph plan --report-filled review`. Backend shape was manually strong in the follow-up Study Room Booking run, and the matcher now reports the same run as all PASS after recognizing `*Store.java implements *Repository` adapters and verification evidence split across implementation/review reports. `ph workflow guard implement/final` turn the implementation-start and final-answer workflow state into strict lower-level gates while leaving `ph workflow check` report-only. The three-run guard smoke is partial: 3/3 runs entered the guard and plan path, 3/3 filled both workflow reports, but only 1/3 reached final guard PASS because command discipline around raw shell versus `npx ph bearshell` remained fragile. `ph workflow start implement` and `ph workflow finish implement` now provide the higher-level AI-facing implementation rail on top of those guards. The two-run runner smoke improved the flow but did not close it: 2/2 clean short-TUI runs entered `ph workflow start implement`, 2/2 ran `ph plan --implement`, 2/2 filled implementation and review reports, and both generated buildable Java/Spring Gradle apps with strong backend shape by manual inspection. One run reached `ph workflow finish implement` PASS after retrying verification through `npx ph bearshell`; the other stayed WARN because early raw shell environment probes were recorded. The second run also read `.persona/rules` directly despite the prompt telling it not to. Workflow noise classification now distinguishes blocking final verification raw shell from WARN-only environment probes and direct `.persona/rules` reads. The follow-up clean Workshop Registration short-TUI smoke reached `ph workflow finish implement` PASS after raw final verification was rerun through `npx ph bearshell`; no actual direct `.persona/rules` read tool lines were observed.
   - Next candidate: complete npm browser/OTP authentication and rerun `npm publish --tag alpha`; full local verification and publish dry-run already passed. Do not add backend shape rules or generated app quality gates from this result.

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
- `docs/current/v0.3.0-workflow-next-surface-decision.md`
- `docs/current/v0.3.0-interactive-intake-design.md`
- `docs/current/v0.3.0-intake-transcript-fixture.md`
- `docs/current/v0.3.0-profile-schema-decision.md`
- `docs/current/v0.3.0-installed-package-evidence-noise-policy.md`
- `docs/current/v0.3.0-philosophy-policy-overlay-design.md`
- `docs/current/v0.3.0-blackbear-plan-artifact.md`
- `docs/current/v0.3.0-plan-acceptance.md`
- `docs/current/v0.3.0-workflow-history.md`
- `docs/current/v0.3.0-workflow-report-status-lifecycle.md`
- `docs/current/v0.3.0-step-api-contract-scope-decision.md`
- `docs/current/v0.3.0-gradle-spring-build-guidance.md`
- `docs/current/v0.3.0-external-tester-guide.md`
- `docs/current/v0.3.0-external-tester-feedback-template.md`
- `docs/current/v0.3.0-alpha-publish-readiness.md`
- `docs/current/v0.3.0-domain-behavior-guidance-review.md`
- `docs/current/v0.3.1-workflow-diagnostics-surface.md`
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
- `docs/evidence-reviews/generated-demo-quality-synthesis.md`
- `docs/evidence-reviews/v0.3.0-domain-behavior-clean-generation-review.md`
- `docs/evidence-reviews/v0.3.0-intake-planning-smoke.md`
- `docs/evidence-reviews/v0.3.0-intake-planned-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.0-profile-summary-injection-smoke.md`
- `docs/evidence-reviews/v0.3.0-blackbear-plan-fill-smoke.md`
- `docs/evidence-reviews/v0.3.0-plan-based-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.0-template-fill-history-smoke.md`
- `docs/evidence-reviews/v0.3.0-plan-acceptance-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.0-gradle-spring-buildline-smoke.md`
- `docs/evidence-reviews/v0.3.0-interactive-intake-planning-smoke.md`
- `docs/evidence-reviews/v0.3.0-interactive-accepted-plan-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.0-live-http-qa-template-smoke.md`
- `docs/evidence-reviews/v0.3.0-live-http-qa-opencode-smoke.md`
- `docs/evidence-reviews/v0.3.0-workflow-report-status-lifecycle-smoke.md`
- `docs/evidence-reviews/v0.3.0-generated-java-target-role-followup.md`
- `docs/evidence-reviews/v0.3.0-policy-overlay-clean-workflow-smoke.md`
- `docs/evidence-reviews/v0.3.0-policy-overlay-accepted-implementation-smoke.md`
- `docs/evidence-reviews/v0.3.1-short-tui-workflow-smoke.md`
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
