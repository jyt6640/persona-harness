# Changelog

All notable Persona Harness changes are recorded here.

This project uses npm prerelease versions for tester-facing alpha builds. During the alpha pilot, `latest` is kept on the current alpha build to avoid stale default installs. Stable support guarantees are still deferred.

## Unreleased

### Added

- Added `ph plan --implement` as a plan-aware implementation gate that blocks short implementation requests until `.persona/workflow/plan.md` is accepted and workflow report templates exist.
- Added injected guidance for short implementation intents such as `플랜 보고 구현해줘` to route through `npx ph plan --implement` before coding.
- Added TUI read-limit guidance so long README/plan files are read through `ph bearshell` line ranges and interrupted runs record remaining scope in the implementation report.
- Added `ph help`, `ph language`, and a `user-language` intake question for multilingual tester setup.
- Added Read Coverage evidence fields to implementation reports so agents record read method/ranges instead of checkbox-only claims.
- Added `0.3.0-alpha.3` candidate notes and GitHub Actions release automation docs.
- Added `ph plan --next` to print the next workflow action from plan/report status.
- Added `ph plan --resume` to print a continuation prompt from accepted plan and implementation report evidence.

### Changed

- External tester guidance now starts with a minimal published-alpha command path and explicitly separates success evidence from setup-only evidence.
- Release automation now checks tag/package version alignment and runs an npm publish dry-run before real publish.

### Known Gaps

- `ph plan --resume` creates a continuation prompt but does not automatically resume OpenCode by itself.

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
