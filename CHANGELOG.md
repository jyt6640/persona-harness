# Changelog

All notable Persona Harness changes are recorded here.

This project uses npm prerelease versions for tester-facing alpha builds. During the alpha pilot, `latest` is kept on the current alpha build to avoid stale default installs. Stable support guarantees are still deferred.

## Unreleased

No unreleased changes yet.

## [0.3.7-alpha.0] - 2026-06-24

### Added

- Added `detectTopLevelIntent` runtime routing for requirements/debug/review/refactor/git/programming intent priority.
- Added Persona Debug Workflow block injection for debug primary intent.
- Added Persona Review Workflow block injection for review primary intent.
- Added Persona Refactor Workflow block injection for refactor primary intent.
- Added Persona Git Workflow block injection for git primary intent.
- Added Persona Programming Workflow block injection for direct code creation/edit primary intent.
- Added `phase0.intent.1` evidence records for injected workflow rails.
- Added report-only `phase0.rail-compliance.1` evidence for selected-rail versus observed-tool behavior mismatches.
- Added report-only `phase0.continuation.1` evidence and text-completion continuation guidance for unfinished workflow backlog/report state.
- Added `ph workflow roles` and `.persona/workflow/roles.md` as a non-autonomous role-boundary artifact for blackbear/Charles/jaeki/roach.
- Added unit coverage for top-level intent priority and mixed-intent sequencing.
- Added next rail prompt drafts for review/refactor/git workflow blocks.

### Changed

- Workflow rail text now loads from PH-owned `packages/shared-skills/skills/workflow/**/SKILL.md` runtime blocks instead of hardcoded runtime strings.
- Requirements workflow injection now goes through the top-level router, so README-related bug reports do not get misrouted into requirements implementation workflow.
- README-related debug requests now receive a debug workflow block instead of no workflow guidance.
- Review requests now receive a findings-first review workflow block that tells the AI not to modify code unless the user explicitly asks for fixes.
- Refactor requests now receive a behavior-preserving refactor workflow block that tells the AI to establish baseline behavior, avoid feature changes, keep changes small, and rerun the same verification.
- Git-only requests now receive a repository-safe git workflow block before commit/push/tag/history operations.
- Direct programming requests now receive a scoped programming workflow block unless a stronger requirements/debug/review/refactor/git rail applies.
- Workflow rail injection now records the original user prompt, primary intent, secondary intents, reason, and injected rail marker in local evidence.
- Rail compliance checks remain diagnostics-only; they do not block builds, tests, OpenCode runs, or generated app output.
- Continuation checks remain diagnostics-only; they append next-ticket guidance when workflow artifacts record remaining scope, but do not continue or certify implementation.
- Role boundaries are now a workflow artifact, not autonomous multi-agent execution.

## [0.3.6-alpha.1] - 2026-06-23

### Added

- Added a PH-style intent preamble for requirements workflow routing:
  - `의도 감지`;
  - `근거`;
  - `다음 행동`.
- Added top-level intent router design documentation for:
  - requirements;
  - debug;
  - review;
  - refactor;
  - git;
  - programming.

### Changed

- Clarified that short AI/TUI requests should first be classified into a primary workflow rail before defaulting to direct implementation.
- Updated the progress board to track `v0.3.x` AI-facing workflow routing as the active direction.

### Verification

- `npm run check:docs` passed.
- `npm test` passed: 37 files, 261 tests.

## [0.3.6-alpha.0] - 2026-06-23

### Added

- Added requirements drafting workflow before implementation:
  - `ph workflow draft --stdin` creates `.persona/workflow/requirements/backlog.md`, `questions.md`, and `assumptions.md` from a vague product idea;
  - `ph workflow approve requirements` marks the draft accepted before ticket splitting;
  - vague product ideas such as `TODO 웹 서비스 만들래` route to `requirement-drafting` and stop for user review;
  - approval phrases such as `진행하자` route to `requirement-approval` only when a draft backlog exists.

### Verification

- `npm test -- tests/persona-harness-workflow-ticket.test.ts tests/phase0-hooks.test.ts` passed.
- `npm run typecheck`, `npm run build`, `npm test`, `npm run report:rules`, `npm run check:scope:strict`, `npm run check:injection-value`, and `npm pack --dry-run` passed.
- dist CLI smoke confirmed `draft -> approve -> split -> next`.
- dist runtime transform smoke confirmed draft/approval intent routing.

## [0.3.5-alpha.0] - 2026-06-23

### Changed

- Split the `ph init` setup path by terminal mode:
  - interactive terminal: install harness files and start the backend profile interview;
  - AI/non-TTY shell: install harness files, stop before profile creation, and direct the agent to `npx ph bootstrap backend`.
- Updated injection guidance so agents do not attempt interactive prompts from non-TTY shells.
- Updated README/workflow docs to explain the human interview path and the AI bootstrap path separately.

### Fixed

- Prevented `ph init` in non-TTY contexts from falling through to the generic interactive-intake TTY error.
- Kept `ph init` from silently creating a default project profile when the intended profile interview cannot run.

### Verification

- `npm test -- tests/persona-harness-init.test.ts tests/phase0-hooks.test.ts tests/persona-harness-interactive-intake.test.ts` passed.
- `npm test` passed: 36 files, 240 tests.
- `npm run typecheck` passed.
- `npm run build`, `npm run report:rules`, `npm run check:scope:strict`, `npm run check:injection-value`, and `npm pack --dry-run` passed.
- non-TTY `ph init`, TTY `ph init`, and `ph bootstrap backend` smoke checks passed.

## [0.3.4-alpha.0] - 2026-06-23

### Added

- Strengthened continuation workflow for long README implementations.
- Added explicit continuation fields to the implementation report template:
  - completed requirements;
  - incomplete requirements;
  - last completed requirement/file;
  - remaining README/plan range;
  - remaining implementation scope;
  - interruption reason;
  - next command/action;
  - next prompt hint.
- Added `ph plan --next` behavior that prefers `npx ph workflow continue` when a filled implementation report still records remaining scope.
- Added plan unchecked checklist output to the continuation prompt so agents can resume from the accepted plan and previous report evidence.

### Changed

- Refactored workflow report template generation into `src/cli/workflow-templates.ts` to keep the plan CLI smaller and easier to review.

### Verification

- Long README smoke created a 260-line README and simulated an interrupted first pass that completed Step 1-40 and left Step 41-260.
- Observed `ph plan --next` recommend `npx ph workflow continue` with continuation evidence.
- Observed `ph workflow continue` print remaining README range, incomplete requirements, interruption reason, next action, next prompt hint, and unchecked plan items.
- `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run` passed before publish.

### Known Gaps

- Continuation workflow is still an AI-facing rail. It does not automatically execute OpenCode or certify generated app quality.
- It depends on the agent filling continuation evidence honestly when a run stops early.
- Full TDD workflow remains future scope.

## [0.3.3-alpha.0] - 2026-06-23

### Added

- Added Existing Project Adaptation Mode to `ph plan`, with automatic `greenfield` versus `existing-code` project mode output.
- Added existing Java source discovery for package root and layer/style hints so brownfield projects can prefer their current package, naming, repository, DTO, and domain flow.
- Added plan/prompt/workflow guidance that existing code wins over greenfield guidance.
- Added README read coverage fallback from `.persona/evidence` when filled workflow reports omit explicit README ranges.
- Added existing Spring-style role discovery coverage for Controller, Service, Repository, DTO, Domain, Exception, and Test files.

### Changed

- Changed Java Role Read Follow-up to ask for representative role files instead of every discovered Java file, while still recording full role-discovery evidence.
- Relaxed workflow finish classification when raw-shell checklist text remains but final verification was rerun through `npx ph bearshell`.

### Verification

- Existing Spring-style smoke used a current local tarball install, `npx ph init`, accepted plan workflow, and OpenCode `openai/gpt-5.4-mini-fast` with the short prompt `README.md 보고 구현해줘`.
- Observed `Mode: existing-code`, package root `com.acme.todo`, layer hints `domain, dto, repository, service, web`.
- Generated code stayed in the existing `web/service/repository/dto/domain` package flow rather than forcing `presentation/application/domain/infrastructure`.
- Java role discovery evidence covered Controller, Service, Repository, DTO, Domain, and Test files.
- `gradle test`, `gradle build`, and HTTP smoke passed through the generated project.

### Known Gaps

- OpenCode may still inspect package metadata such as `node_modules/persona-harness/package.json` before settling into the workflow rail.
- Agents may still perform an initial raw shell probe before rerunning final verification through `npx ph bearshell`.
- Long README continuation remains the next product gap; full TDD workflow is still future scope.

## [0.3.2-alpha.3] - 2026-06-23

### Added

- Added `ph bootstrap backend` as an AI-facing fast path that fills missing backend profile, policy, accepted plan, and workflow report templates.
- Added conditional workflow behavior for non-harness projects: when `.persona/` is absent, `ph workflow implement` now returns an advisory PASS and does not block normal implementation.
- Added stricter initialized-harness behavior: when `.persona/` exists but profile/plan/report artifacts are missing, `ph workflow implement` now directs the agent to `npx ph bootstrap backend`.
- Added `ph workflow continue` as an AI-facing alias for the accepted-plan continuation prompt used after interrupted or long README implementations.
- Added clean short-request review evidence for the current alpha.3 candidate.

### Changed

- Strengthened Gradle wrapper guidance in Java/Spring implementation rails so generated apps prefer `./gradlew`/`gradlew.bat` verification and do not treat missing system Gradle as application failure.
- Clarified raw shell environment probe warnings as non-blocking notes when final verification was rerun through `npx ph bearshell`.
- Updated injection guidance so Persona Harness workflow gates apply only after a project has opted in with `.persona/`.

### Known Gaps

- OpenCode may still read `.persona/rules` directly before settling into the workflow rail.
- Workflow finish can still be satisfied by report text, so future hardening should reduce report-only self-attestation risk.
- This release still does not certify generated application product quality.

## [0.3.2-alpha.2] - 2026-06-22

### Added

- Added a profile-required implementation gate: `ph plan` and `ph workflow implement` now stop when `.persona/project-profile.jsonc` is missing, draft, invalid, or incomplete.
- Added `ph intake --default backend` for a ready backend profile without an interactive terminal.
- Added default backend profile creation during `ph init`, so a clean install can move straight to `ph plan --auto-accept` unless the user wants to customize intake answers.
- Added `ph plan --auto-accept` as a faster planning path for users who do not want a separate manual accept step during alpha smoke tests.
- Added Java role-discovery guidance to `ph workflow implement` so generated Java files can be surfaced through `npx ph bearshell --shell 'find ...*.java...'` and picked up by existing role-discovery evidence.

### Changed

- Updated fast-path guidance so implementation starts through `npx ph workflow implement` only after the profile and accepted workflow plan exist.
- Updated the implementation report template with Java role discovery/read evidence fields.

### Known Gaps

- Java role discovery depends on the agent following the `ph workflow implement` rail after generating files; file creation alone is not treated as proof that every generated Java file was read.

## [0.3.2-alpha.1] - 2026-06-22

### Fixed

- Fixed README read coverage parsing so `ph workflow check` and `ph workflow finish implement` accept ranges recorded under a `## README ranges read` heading, not only the older `- README ranges read:` field shape.

### Notes

- `0.3.2-alpha.0` was published, but fresh install smoke found this parser gap before external tester handoff.
- This hotfix keeps the same Java/Spring backend MVP scope and only patches the workflow evidence parser.

## [0.3.2-alpha.0] - 2026-06-22

### Added

- Added `ph workflow implement` as the single AI-facing implementation rail for short TUI requests such as `README.md 보고 구현해줘`.
- Added README chunk-read guidance to the implementation rail, using `npx ph bearshell --shell 'wc -l README.md'` and 220-line `sed -n` ranges.
- Added README read coverage workflow diagnostics so filled implementation reports must record `README ranges read` when `README.md` exists.
- Added `src/cli/workflow-output.ts` to keep workflow command orchestration separate from long AI-facing rail output.

### Changed

- Updated injection, plan prompts, next/resume output, and README guidance to prefer `npx ph workflow implement` over the older two-step `workflow start implement` plus `plan --implement` path.
- Kept `ph workflow start implement` and `ph plan --implement` available as lower-level compatibility surfaces.
- Kept direct `.persona/rules` reads as non-blocking workflow notes, while raw final verification remains blocking.

### Fixed

- `ph workflow finish implement` now fails when `README.md` exists but README range coverage is empty, preventing agents from reporting completion after only a partial README read.

### Known Gaps

- The read coverage gate verifies recorded ranges, not semantic understanding of the README.
- This release still does not certify generated application product quality.
- Full TDD workflow, frontend, infra, desktop, and AST/linter enforcement remain future tracks.

## [0.3.1-alpha.2] - 2026-06-22

### Added

- Strengthened `ph doctor` with rules-surface counts and a stale Roomescape step fixture scan across public `.persona/rules`.
- Strengthened `ph smoke` so the smoke report includes local install/OpenCode/plugin/rules-surface diagnostics in addition to workflow status.
- Strengthened AI-facing workflow output for short TUI requests such as `README.md 보고 구현해줘`, making `npx ph workflow start implement`, `npx ph bearshell`, report filling, and `npx ph workflow finish implement` more explicit.
- Added an npm package ignore file so `dist/` remains included in release tarballs even though it is ignored by git.

## [0.3.1-alpha.1] - 2026-06-22

### Fixed

- Removed old Roomescape step contract fixture rules from the public `ph init` rule copy and npm package surface. The internal `backend/step1-api-contract.md` and `backend/step2-3-api-contract.md` files remain available for Phase 0 regression fixtures, but clean external projects no longer receive stale `/reservations` or `/times` guidance.

### Added

- Added v0.3.1 external tester guide and feedback template for the published `persona-harness@alpha` smoke path.

## [0.3.1-alpha.0] - 2026-06-22

### Added

- Added `ph workflow check`, `ph doctor`, `ph smoke`, `ph feedback`, `ph evidence summary`, and `ph review backend-shape` as report-only local commands for external tester diagnostics, workflow evidence discipline, evidence summary, and backend shape observation.
- Added `ph workflow guard implement` and `ph workflow guard final` as AI-facing strict workflow gates for implementation start and final answer readiness.
- Added npm dist-tag reporting to `ph doctor` so local installs can see current `alpha` and `latest` registry versions when the registry is reachable.
- Added workflow command-discipline diagnostics so filled workflow reports can surface raw shell usage or missing `npx ph bearshell` evidence as report-only WARNs.
- Added backend-shape review coverage for `*Store.java implements *Repository` adapters and verification evidence split across implementation/review reports.
- Added AI-facing codegraph-first guidance for code structure analysis and change-impact review, with targeted file reads as fallback when codegraph is unavailable.

### Changed

- Clarified that `ph` commands are primarily an AI-facing workflow surface: users can ask the TUI in plain language, while the agent should run `npx ph workflow guard implement`, `npx ph plan --implement`, `npx ph bearshell`, report-fill commands, and `npx ph workflow guard final`.
- Tightened `ph plan --prompt` and `ph plan --implement` so short implementation requests route through strict workflow guards, accepted plan status, implementation report filling, review report filling, and manual QA evidence.
- Narrowed workflow command-discipline classification so raw final verification stays blocking, but an initial raw smoke that was rerun through `npx ph bearshell` can finish.
- Reduced model-facing injection noise by removing full shared-skill reference paths while preserving metadata evidence.
- Extended `ph history` archive summaries with evidence-summary content when available.

### Known Gaps

- Command-discipline diagnostics are report-only WARNs, not enforcement gates.
- `ph bearshell` is still timeout/output bounded only; it is not a sandbox.
- This alpha still does not certify generated application product quality.
- Full TDD workflow, frontend, infra, desktop, and AST/linter enforcement remain future tracks.

## [0.3.0-alpha.3] - 2026-06-22

### Added

- Added `ph plan --implement` as a plan-aware implementation gate that blocks short implementation requests until `.persona/workflow/plan.md` is accepted and workflow report templates exist.
- Added injected guidance for short implementation intents such as `플랜 보고 구현해줘` to route through `npx ph plan --implement` before coding.
- Added TUI read-limit guidance so long README/plan files are read through `ph bearshell` line ranges and interrupted runs record remaining scope in the implementation report.
- Added `ph help`, `ph language`, and a `user-language` intake question for multilingual tester setup.
- Added Read Coverage evidence fields to implementation reports so agents record read method/ranges instead of checkbox-only claims.
- Added `0.3.0-alpha.3` candidate notes and GitHub Actions release automation docs.
- Added `ph plan --next` to print the next workflow action from plan/report status.
- Added `ph plan --resume` to print a continuation prompt from accepted plan and implementation report evidence.
- Added package-flow guidance that steers Java/Spring generated packages toward `presentation/application/domain/infrastructure`.
- Added `bootJar` guidance/reporting so executable Spring Boot apps do not treat `:bootJar SKIPPED` as a valid build pass.
- Added alpha.3 demo packaging decision notes and release notes.

### Changed

- External tester guidance now starts with a minimal published-alpha command path and explicitly separates success evidence from setup-only evidence.
- Release automation now checks tag/package version alignment and runs an npm publish dry-run before real publish.
- Release readiness now allows alpha.3 demo packaging checks to proceed after fresh ON package-flow and `bootJar` evidence.

### Known Gaps

- `ph plan --resume` creates a continuation prompt but does not automatically resume OpenCode by itself.
- Alpha.3 is still workflow/tooling evidence, not generated application product-quality certification.

## [0.3.0-alpha.2] - 2026-06-21

### Changed

- Promoted the P0 plan-first CLI, diagnostics, scope, and bearshell hardening line to the next alpha candidate because the published `0.3.0-alpha.1` package still printed the old implementation-first `ph init` guidance.
- Updated release automation so prerelease publishes also move the npm `latest` dist-tag to the same current alpha/beta version, avoiding stale default installs.
- Published `persona-harness@0.3.0-alpha.2` to npm and synchronized both `alpha` and `latest` dist-tags to this version for the alpha pilot.
- Documented the full OpenCode prerequisite flow before Persona Harness setup.
- Added OpenCode provider/model connection steps using `opencode auth login`, `opencode auth list`, `/connect`, and `/models`.
- Clarified that Persona Harness planning files can be created without OpenCode, but plugin injection and evidence capture require OpenCode.
- Updated external tester docs to use the published `persona-harness@alpha` install path.
- Added GitHub Actions release automation for verify, npm publish on version tags, and generated GitHub release notes.
- Tightened workflow prompts and report templates to prefer `npx ph bearshell` for repo inspection, Gradle verification, and smoke commands.
- Clarified that clean project agents should call Persona Harness through `npx ph ...`, not a globally installed `ph`.
- Clarified Java backend bootstrap guidance so domain static factories close creation through private constructors.
- Changed `ph init` next steps to the plan-first flow: intake, policy, plan, accept or revise, then implementation.
- Narrowed default `enabledDomains` to the Java backend MVP surface: `backend` and `programming`.
- Added diagnostics-only reporting for malformed `.persona/harness.jsonc` instead of silently hiding the fallback.
- Added a default `ph bearshell` command timeout with `PH_BEARSHELL_TIMEOUT_MS` override, while keeping the command helper explicitly non-sandboxed.

## [0.3.0-alpha.1] - 2026-06-21

### Changed

- Published the first tester-facing alpha line after `0.3.0-alpha.0`.
- Added OpenCode prerequisite and provider/model setup documentation.
- Prepared release automation and external tester guidance, but the published package still had stale `ph init` implementation-first output.

## [0.3.0-alpha.0] - 2026-06-21

### Added

- Java/Spring backend alpha package posture for external tester installation.
- `ph init`, `ph intake`, `ph policy`, `ph plan`, `ph history`, and `ph bearshell` as the current CLI workflow surface.
- Backend project profile, policy overlay, planning artifact, report lifecycle, and workflow history docs.
- Apache-2.0 license file and alpha publish readiness record.
- User-facing README plus language-specific README files for Korean, Japanese, and Simplified Chinese.

### Changed

- Root README is now user-facing, while previous detailed usage notes moved to `docs/current/persona-harness-detailed-usage.md`.
- npm package contents are trimmed to the Java backend MVP surface.
- The alpha package includes only the Java programming shared-skill reference subset, not the full vendored shared-skills tree.

### Removed From Package

- Inactive OMO reference skills such as `ast-grep`, `frontend`, `debugging`, and `review-work`.
- Java no-excuse fixture files from the public alpha tarball.
- Repo maintenance scripts that are not required by installed package users.

### Known Gaps

- The current alpha line still needs external tester feedback before stable support guarantees.
- Generated app product quality is not certified.
- Rule compliance is not enforced by AST, linter, or build failure gates.
- Frontend, infra, desktop, and full TDD workflows remain future tracks.

## Links

- Release checklist: [docs/current/release/release-checklist.md](docs/current/release/release-checklist.md)
- Release notes template: [docs/current/release/release-notes-template.md](docs/current/release/release-notes-template.md)
