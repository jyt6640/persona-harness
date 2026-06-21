# Changelog

All notable Persona Harness changes are recorded here.

This project uses npm prerelease versions for tester-facing alpha builds. Stable `latest` releases are deferred until the Java/Spring backend MVP has enough external tester feedback.

## [0.3.0-alpha.1] - Unreleased

### Changed

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

- npm public publish has not been completed yet.
- `latest` dist-tag is intentionally deferred.
- Generated app product quality is not certified.
- Rule compliance is not enforced by AST, linter, or build failure gates.
- Frontend, infra, desktop, and full TDD workflows remain future tracks.

## Links

- Release checklist: [docs/current/release/release-checklist.md](docs/current/release/release-checklist.md)
- Release notes template: [docs/current/release/release-notes-template.md](docs/current/release/release-notes-template.md)
