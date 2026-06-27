# Changelog

All notable Persona Harness changes are recorded here.

This project uses npm prerelease versions for tester-facing alpha builds. During the alpha pilot, `latest` is kept on the current alpha build to avoid stale default installs. Stable support guarantees are still deferred.

## Unreleased

No unreleased changes.

## [0.3.9-alpha.3] - 2026-06-27

### Changed

- Bumped the prerelease version to `0.3.9-alpha.3` because registry `persona-harness@0.3.9-alpha.2` points to `gitHead` `ecc65560af26df78656f6135237f44cdbf9c2607`, while current HEAD includes the verification-focused changes through `a5204db`.
- Marked injection value as not proven:
  - `docs/current/injection-value-status.json` now uses `decision: injection-effect-not-proven`;
  - legacy self-rated counts are retained only as audit data, not measured evidence;
  - `npm run check:injection-value` passes against the not-measured evidence state.
- Added `ph observe <path>` as a report-only Java observer CLI surface:
  - observer findings are normalized with `ruleId`, `result`, `evidence`, `confidence`, `source`, and `limitations`;
  - observer code is now reachable from the shipped CLI instead of only from scripts/tests.
- Hardened observer measurement code:
  - replaced naive Java parameter comma splitting with a tokenizer that respects nested generics and other Java syntax boundaries;
  - consolidated `isRecord` into a single shared definition;
  - removed product analyzer `roomescape` / `/reservations` domain literals from `src`;
  - added adversarial Java observer/tokenizer coverage.
- Added live runtime observer trace evidence:
  - Java write/edit hook paths can record `observer-report-only` evidence;
  - evidence is best-effort and non-blocking;
  - no enforcement or generated app quality certification is added.
- Added ON/OFF eval measurement infrastructure:
  - `run-onoff-eval.mjs` supports dry-run, preflight, capture, replay, reproducibility pins, JUnit XML / Gradle artifact based scoring, and observer-based stack alignment;
  - `decide.mjs` computes an objective gate from results JSON;
  - `blind-grade.mjs` creates anonymized review packages and aggregates reviewer disagreement.
- Restored a tracked minimal Java `example/` fixture used by observe tests.

### Verification

- Current-head score-uplift smoke passed on local tarball HEAD `a5204db`:
  - clean install, `ph init`, `ph bootstrap backend`, and `ph doctor` passed;
  - `ph observe --json example/` passed and emitted report-only schema findings;
  - runtime hook observer evidence was created without throwing or blocking;
  - eval runner help/dry-run/preflight/replay guard surfaces passed;
  - `decide.mjs` and `blind-grade.mjs` surfaces executed.
- Actual OpenCode ON/OFF eval was not run because `OPENCODE_MODEL`, model version, and provider keys were not pinned. No fake `results.json` was generated.
- This release does not certify generated app product quality, does not add AST/linter/enforcement, and keeps observer/backend-shape report-only.

## [0.3.9-alpha.2] - 2026-06-27

### Changed

- Bumped the prerelease version to `0.3.9-alpha.2` because registry `persona-harness@0.3.9-alpha.1` is stale relative to current HEAD.
- Reinforced workflow closure guidance after build/test success so agents are reminded to fill reports, check status, archive completed requirements, and run the final gate before claiming completion.
- Refined backend-shape smoke findings for current HEAD:
  - `application/port/out/*Repository.java` can be recognized as repository port evidence;
  - Verification report wording is intended to distinguish test/build evidence from bootRun evidence, though the current-head re-smoke still found a false-success wording risk.
- Added Gradle dependency self-check guidance to reduce dot-version recurrence in generated `build.gradle` files.
- Returned runtime QA guidance to workflow closure so agents are expected to come back from build/test/bootRun or manual QA attempts to report fill, archive, and finish.
- Hardened backend-shape Verification reporting so template-only command mentions produce WARN instead of false PASS.
- Kept v0.5 AST/linter/enforcement work behind the existing decision gate. `dfeb88c docs(eval): plan v0.5 qa decision cadence` exists locally but is not an ancestor of this release-prep HEAD, so this package does not claim that commit's files as package contents.

### External Smoke

- Current-head local tarball closure re-smoke at `23877e2` was partially successful. This was not a registry `0.3.9-alpha.1` smoke.
- Confirmed:
  - `ph init`, `ph bootstrap backend`, and `ph doctor` passed;
  - OpenCode reached workflow rail / split / next / `req-1`;
  - Java/Spring/Gradle generation, Gradle wrapper creation, `profileSummaryInjected`, and Java role evidence were observed;
  - backend-shape `application/port/out` fixture produced Domain repository port / adapter / DTO PASS;
  - fake Gradle shim, Java `HttpServer`, and CommonJS workarounds were not observed in generated source.
- Blocked:
  - `gradlew.bat test` and `gradlew.bat build` failed with dependency `:.` interpretation errors such as `spring-boot-starter-*:.` and `flyway-core:.`;
  - OpenCode hung after wrapper generation;
  - implementation/review reports remained templates;
  - `req-1` remained pending;
  - `workflow finish implement` exited 1 on template reports + pending `req-1` and showed "Do not claim overall completion" guidance.
- Remaining risk:
  - backend-shape Verification report wording still said `gradle test/build success evidence observed; bootRun evidence not observed` despite test/build failure or missing success evidence.
- Release prep for alpha2 should stay on hold until the dependency recurrence and Verification report wording blockers are fixed and re-smoked, unless HQ explicitly accepts the risk.
- This current-head smoke does not certify generated app product quality, does not make backend-shape an enforcement gate, and does not add AST/linter/enforcement.
- Second current-head local tarball closure re-smoke at `691f874` was partially successful. This was not a registry `0.3.9-alpha.1` smoke.
- Improvements confirmed:
  - Java/Spring/Gradle generation;
  - valid dependency notation;
  - `gradlew.bat test` and `gradlew.bat build` PASS;
  - `profileSummaryInjected` and Java role evidence;
  - backend-shape main PASS;
  - `application/port/out` repository port fixture PASS.
- Still blocked:
  - OpenCode stopped at the bootRun/manual QA PowerShell step;
  - implementation/review reports remained templates;
  - `plan --report-filled` markers were not observed;
  - `req-1` remained pending;
  - `workflow finish implement` exited 1 on missing reports + pending requirement.
- The blocker appears shifted from Gradle dependency notation to closure/report/final-gate follow-through after build/test/manual QA.
- Verification report false-success wording is still a residual risk rather than a proven failed fix because the dot-dependency fixture did not contain actual Gradle failure evidence.
- Release prep for alpha2 remains held unless HQ explicitly accepts partial closure risk.
- Third current-head local tarball closure re-smoke at `ee292ea` passed workflow closure. This was not a registry `0.3.9-alpha.1` smoke; registry alpha/latest still pointed to `gitHead` `bc7eadd...`.
- Source facts:
  - local `npm pack` tarball, package `0.3.9-alpha.1`;
  - tarball shasum `e03ce076cee801e0db91b01670c2efbdb2ca1db4`;
  - tarball sha256 `afb76178626a7d23657ddd78c2c77a5fe3df2528b3225005adff738edbd8ea1d`;
  - included follow-ups `32b557b`, `691f874`, and `bd2f8a1`.
- Workflow closure confirmed:
  - OpenCode returned from build/test/bootRun attempt to workflow closure;
  - implementation/review reports were filled;
  - `plan --report-filled implementation` and `plan --report-filled review` were observed;
  - `req-1` was archived;
  - `workflow finish implement` passed.
- Generated stack and verification observed:
  - Java/Spring/Gradle + wrapper generated;
  - no dot dependency recurrence such as `spring-boot-starter-*:.` or `flyway-core:.`;
  - `gradlew.bat test/build` and post-check `--no-daemon` test/build passed;
  - bootRun startup logs, Tomcat, and Flyway startup were observed before a 30s bearshell timeout;
  - `profileSummaryInjected` and Java role read coverage were observed;
  - fake Gradle shim, Java `HttpServer`, and CommonJS workarounds were not observed.
- backend-shape main was mostly PASS, and fixture coverage confirmed `application/port/out/TaskRepository`, adapter, and DTO PASS. Verification report avoided false PASS for template-only command mentions by leaving `gradle test/build/bootRun mentioned without success/failure output` as a WARN.
- Smoke perspective: alpha2 release prep candidate.
- Residual risks: generated app product quality is not certified, backend-shape remains report-only, AST/linter/enforcement is still absent, separate manual curl QA was not performed, and the backend-shape Verification WARN remains conservative because reports lacked raw success/failure output even though post-check test/build passed.
- Post-publish registry surface smoke passed for `persona-harness@0.3.9-alpha.2`.
  - Source: Windows clean project registry-only `npm install -D persona-harness@alpha`.
  - Registry facts: installed `persona-harness@0.3.9-alpha.2`; dist-tags `alpha=0.3.9-alpha.2`, `latest=0.3.9-alpha.1`; gitHead `ecc65560af26df78656f6135237f44cdbf9c2607`; shasum `cdd6a238da82a06b59f0c9ee75f7eea2bbec1440`.
  - `ph init`, `ph bootstrap backend`, and `ph doctor` passed; doctor Runtime readiness passed with OpenCode present and package version `0.3.9-alpha.2`.
  - `workflow implement` / `plan --prompt` surfaces showed Windows-safe bearshell read/search guidance and finish/report-filled guidance.
  - Fresh/template `workflow check` WARN and `workflow finish implement` exit 1 for missing implementation/review reports + evidence were expected.
  - `bearshell` README search/read commands passed.
  - Copied backend rules contained Gradle wrapper/dependency self-check guidance, including no blank/dot versions for `spring-boot-starter-*` / `flyway-core` and build.gradle self-check guidance.
  - backend-shape fixture confirmed `application/port/out` repository port PASS, adapter/DTO PASS, and template-only verification mentions as Verification WARN rather than false PASS.
  - No blocker was found for registry alpha2 install/init/bootstrap/doctor/workflow/bearshell/backend-shape surfaces.
  - `latest=0.3.9-alpha.1` is recorded as observed dist-tag state, not a smoke failure.
  - Optional OpenCode generated-app closure smoke was not run; this is not generated app product quality certification, backend-shape remains report-only, and AST/linter/enforcement remains absent.

### Verification

- Release-prep verification for `0.3.9-alpha.2` was rerun on 2026-06-27.
- `npm test`: passed. Scope diagnostics and docs taxonomy diagnostics passed; 58 files / 367 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run check:docs`: passed.
- `npm pack --dry-run`: passed for `persona-harness@0.3.9-alpha.2`.
  - Filename: `persona-harness-0.3.9-alpha.2.tgz`
  - Package contents: 345 files
  - Shasum: `9fc8fdcb92e3a2824112b51b2fce5f6c73269b1a`
- `git diff --check`: passed.

## [0.3.9-alpha.1] - 2026-06-25

### Changed

- Bumped the prerelease version to `0.3.9-alpha.1` because `persona-harness@0.3.9-alpha.0` already exists on the npm registry and cannot be overwritten with the refreshed current HEAD contents.
- Carried forward the `0.3.9-alpha.0` release-prep refresh contents:
  - release checklist docs stale guard for version/doc alignment, smoke interpretation boundaries, registry `gitHead` / current `HEAD` mismatch recording, and develop commit/no-commit reporting;
  - v0.4 evaluation methodology, fixture files, evaluation plan, and runbook with fixture order, baseline setup, metadata capture, archive naming, metrics, blind package preparation, second reviewer handoff, and kill-gate calculation timing;
  - v0.4 runbook release-reference guard;
  - verified report manual backfill plan with artifact selection, rule ID evidence sources, PASS/WARN/FAIL/UNKNOWN criteria, confidence/source handling, false-positive review, and v0.5 parser spike decision criteria;
  - Gradle skills guidance wording tightening that preserves fake-shim ban, wrapper-first verification, and Spring Boot dependency-management semantics;
  - runtime structured warning output as `[Persona Harness Runtime Warning] kind=... scope=...`;
  - CLI report coverage helper refactor into `workflow-report-coverage.ts` with unchanged workflow semantics.
- Recorded that external develop retrospectives and templates are repo-outside operating artifacts only and are not package contents.

### Registry Note

- `persona-harness@0.3.9-alpha.0` is a stale registry artifact for the refreshed release docs: npm reports its `gitHead` as `4338cc51b40eb9ba3b3853e9df394373fc2b0269`, while the refreshed alpha.0 release-prep/tag commit was `b31b557`.
- Because npm package versions are immutable, `0.3.9-alpha.1` is the next prerelease intended to carry the refreshed current HEAD state.

### External Smoke

- No new External Smoke was run for this release prep.
- Pre-alpha9 and focused smoke remain surface/guidance verified:
  - parser hardening local/Windows adversarial fixture succeeded;
  - clean tarball install, `init`, `bootstrap`, and `doctor` succeeded;
  - report coverage guidance surfaced through `check`, `continue`, and `finish`;
  - Spring Boot dependency-management guidance surfaced through README/build.gradle injection.
- Post-publish registry install/surface smoke passed for `persona-harness@0.3.9-alpha.1`:
  - registry dist-tags were `latest=0.3.9-alpha.1` and `alpha=0.3.9-alpha.1`;
  - registry `gitHead` was `bc7eaddc678b6268be1194d7e659123f895e6fd5`;
  - registry shasum was `c901e24a0c6da82658ebf6800f038223d0e93de4`;
  - Windows clean install from registry `persona-harness@alpha`, `ph doctor`, `ph init`, `ph bootstrap backend`, workflow/bearshell guidance, and backend-shape report surfaces were OK;
  - `workflow check` WARNs were limited to template reports and missing evidence;
  - `review backend-shape` WARNs were expected because the smoke did not generate a Java app, while fake shim absence passed;
  - `workflow finish implement` exited 1 as expected and named the required filled reports and evidence file.
- HQ local checks before that smoke did not find a `v0.3.9-alpha.1` tag locally or on origin.
- Post-publish full continuation smoke was partially successful for `persona-harness@0.3.9-alpha.1`:
  - OpenCode generated a Java/Spring/Gradle app with `build.gradle`, `settings.gradle`, `gradlew.bat`, `src/main/java`, `src/test/java`, and presentation/application/domain/infrastructure/DTO/test structure;
  - `gradlew.bat test` passed and post-check `gradlew.bat build` passed;
  - evidence was present, `profileSummaryInjected: true` was observed, and Java representative file evidence was observed;
  - fake shim, Java `HttpServer`, and CommonJS source scans were clean;
  - OpenCode did not fill reports or reach the final gate after generation/build repair and was stopped after a long no-output state;
  - `workflow finish implement` exited 1 with exact reasons that `implementation-report.md` and `review-report.md` must be filled;
  - reports remained `Status: template`, req archive/split was not observed, and `workflow check` stayed WARN;
  - `review backend-shape` was mostly PASS, with a Domain repository port WARN because repository ports were under `application/port/out`;
  - backend-shape Verification report wording incorrectly implied bootRun evidence, while this smoke observed test/build only.
- This prep does not directly certify that a full OpenCode continuation applies dependency guidance, fills reports by itself, and reaches `finish` PASS.
- This release does not certify generated app product quality and does not add AST/linter/enforcement.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 57 files, 361 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run check:docs` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.9-alpha.1` with 341 files.
- `git diff --check` passed.

## [0.3.9-alpha.0] - 2026-06-25

### Changed

- Hardened backend-shape Java field parsing so naive `private` line text scans create fewer false WARNs from comments, text blocks, strings, lambdas, and nested generic mentions while still preserving WARNs for real multiline Service fields such as `Map`, `AtomicLong`, and `nextId`.
- Added adversarial fixture coverage for the Java field parser hardening.
- Strengthened Spring Boot Gradle dependency-management guidance around Boot plugin-managed dependencies, `io.spring.dependency-management`, starter dependencies, Flyway, wrapper-backed verification, and recovery after dependency resolution failures.
- Added report coverage continuation hardening so reports marked `Status: filled` but left blank or template-like produce report coverage WARNs with next actions in `check`, `continue`, and `finish`.
- Added the 0.3.9-alpha pre-eval stop gate: before `0.4` eval, HQ must stop for a `0.3.9-alpha` publish or release decision.
- Refined AST verified report schema research with candidate fields such as `ruleId`, `result`, `targetFile`, `evidence`, `limitations`, `confidence`, and `source`, plus stable rule ID candidates.
- Preregistered the v0.4 eval fixture matrix, including README fixture candidates, plain/AGENTS/CLAUDE/cursorrules/PH baseline conditions, baseline kill-gate, thresholds, primary/secondary metrics, and blind/second-reviewer rubric.
- Added a release checklist docs stale guard covering package/lockfile, CHANGELOG, release note, develop record alignment, smoke interpretation boundaries, registry `gitHead` / current `HEAD` mismatches, and develop commit/no-commit reporting.
- Added and restored v0.4 evaluation docs, including the evaluation methodology, fixture files, evaluation plan, and runbook with fixture order, baseline condition setup, metadata capture, archive naming, metrics, blind package preparation, second reviewer handoff, and kill-gate calculation timing.
- Guarded release references to the v0.4 runbook so release prep may mention it only when the runbook exists in the target HEAD being prepared.
- Added the verified report manual backfill plan, including artifact selection, rule ID evidence sources, PASS/WARN/FAIL/UNKNOWN criteria, confidence/source handling, false-positive review, and v0.5 parser spike decision criteria.
- Tightened Gradle guidance wording while preserving the fake-shim ban, wrapper-first verification, and Spring Boot dependency-management semantics.
- Structured runtime warnings as `[Persona Harness Runtime Warning] kind=... scope=...` while keeping host hooks alive and evidence writes best-effort.
- Split workflow report coverage finding logic into `workflow-report-coverage.ts` with unchanged workflow semantics and structured summary assertions.
- External develop retrospective artifacts and templates were prepared outside this repository and remain operating context only, not package content.

### External Smoke

- Pre-alpha9 5-run smoke was partially successful:
  - parser hardening local/Windows adversarial fixture succeeded;
  - clean tarball install, `init`, `bootstrap`, and `doctor` succeeded;
  - PH ON bounded OpenCode run confirmed workflow rail/profile/evidence/pending block behavior but stopped before implementation files were generated;
  - PH OFF baseline used the same README but drifted to a CommonJS/in-memory Node HTTP server.
- Focused re-smoke succeeded:
  - report coverage guidance surfaced through `check`, `continue`, and `finish`;
  - Spring Boot dependency-management guidance surfaced through README/build.gradle injection;
  - `init`, `bootstrap`, and `doctor` passed.
- Focused smoke is surface verified only. It did not directly verify that a full OpenCode continuation applies dependency guidance, fills reports by itself, and reaches `finish` PASS.
- This release does not certify generated app product quality and does not add AST/linter/enforcement.
- Registry `alpha`/`latest` before this release prep pointed to `0.3.8-alpha.5` with gitHead `d99df54`, so current commits were verified with local tarballs.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 57 files, 361 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run check:docs` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.9-alpha.0` with 340 files.
- `git diff --check` passed.

## [0.3.8-alpha.5] - 2026-06-25

### Changed

- Repositioned Persona Harness release-facing docs as an AI coding workflow rail, evidence, and continuation harness rather than a Java Clean Code quality guarantee.
- Clarified that evidence records read/injection/workflow traces, not generated-code quality proof.
- Added a runtime hook/evidence boundary so evidence write failures are best-effort and do not reject the host hook.
- Guarded injection context loading failures, including malformed filesystem states such as `.persona/project-profile.jsonc` being a directory, so they do not kill the host hook.
- Strengthened Gradle wrapper guidance so agents are expected to create and use real wrapper outputs instead of relying on unavailable system Gradle or fake shims.
- Added failed verification continuation guidance so compile/test/build failures remain continuation work instead of being smoothed over as completion.
- Reduced backend-shape false positives for domain/DTO naming, entity-name mentions inside DTO messages, and verification evidence visibility.

### External Smoke

- Long continuation smoke passed for workflow rail closure using a local `0.3.8-alpha.4` tarball at HEAD `d0eb111`.
- The smoke used a Windows clean ON project and the same `Inventory Lending API` README.
- Initial run timed out at 600 seconds after README/profile read, workflow implement/split/next, and Java/Spring/Gradle generation.
- Continuation 1 timed out at 900 seconds after reports fill, Gradle wrapper creation, and `test`/`build`/`bootRun` execution, with some stale verification wording still present.
- Continuation 2 exited 0 after reports were updated, `req-1` was archived, and `workflow finish implement` passed.
- Final state:
  - `implementation-report.md`: filled;
  - `review-report.md`: filled;
  - `req-1`: archived;
  - `workflow finish implement`: PASS exit 0;
  - `workflow check`: WARN only, with reports filled, no verification failure, stack alignment OK, no pending tickets, and Java role read coverage present.
- Gradle wrapper files were generated, and `gradlew.bat test` / `gradlew.bat build` were BUILD SUCCESSFUL. `bootRun` started the server and then timed out while running.
- Backend-shape PASS evidence included Spring Boot app, Gradle runtime, Gradle only, Maven absent, fake shim absent, package/layer boundaries, Controller/Service/Repository/DTO/Domain boundary, domain repository port, infrastructure repository adapter, service storage/id sequence ownership, domain behavior, DTO boundary, and bootJar.
- Remaining backend-shape WARN candidates were Entity direct exposure and Verification report.
- Fake `gradle-shim.js`, Java `HttpServer`, and Express/CommonJS workarounds were not observed.
- This smoke is workflow rail closure evidence, not generated app product quality certification. AST/linter/enforcement gates are still not part of this release.
- Runtime hook/evidence boundary coverage was added after release prep so host stability is improved when evidence or context loading fails. Normal injection/evidence behavior is expected to stay unchanged.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 56 files, 355 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.5` with 336 files.
- `npm run check:docs` passed.

## [0.3.8-alpha.4] - 2026-06-25

### Changed

- Clarified pending review continuation guidance so template review reports and pending `req-*` tickets keep agents on the continuation path instead of allowing premature completion claims.
- Updated Java/Spring verification guidance to prefer a real Gradle wrapper first, then system Gradle only when appropriate, without suggesting fake Gradle shim workarounds.
- Reduced backend-shape false positives for repository ports, repository adapters, and flat DTO names such as `TaskRepository`, `JdbcTaskRepository implements TaskRepository`, `CreateTaskRequest`, and `TaskResponse`.
- Normalized backend-shape path handling so Windows path separators do not hide generated Java evidence.

### External Smoke

- Windows backend-shape fixture-v2 recheck succeeded from a local current `npm pack` install at HEAD `31fb91a` with package version `0.3.8-alpha.3`.
- `npx ph review backend-shape` exited 0 and generated a backend-shape report.
- The report passed:
  - Domain repository port evidence with `TaskRepository.java`;
  - Infrastructure repository adapter evidence with `JdbcTaskRepository.java`;
  - DTO boundary evidence with `CreateTaskRequest.java` and `TaskResponse.java`.
- The previous Windows path separator false positive was not reproduced.
- Remaining WARN items were limited to the narrow fixture shape: missing application/controller/service examples and missing Gradle runtime. Those are outside this recheck's success criteria.
- This release is still workflow/check/report guidance hardening. It does not certify generated app product quality, and full OpenCode end-to-end implementation quality remains a separate smoke target.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 55 files, 342 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.4` with 329 files.
- `npm run check:docs` passed.

## [0.3.8-alpha.3] - 2026-06-25

### Added

- Added Windows-aware doctor command detection so `ph doctor` can report OpenCode runtime readiness more reliably on Windows.
- Added stack-alignment checks for generated backend projects and made `ph workflow finish implement` block on stack mismatch.
- Added Java role read coverage gating so implementation finish can require generated Controller, Service, Repository, DTO, Domain, and related Java files to have been read.
- Added backend-shape review reporting to summarize generated backend structure evidence.
- Added Windows-safe and vendor-safe bearshell/read/search guidance for workflow prompts.

### Changed

- Clarified `ph init` as the minimal harness/OpenCode integration step and `ph bootstrap backend` as the backend-ready bootstrap path.
- Strengthened Java guidance to forbid fake Gradle shims and HTTP-server/CommonJS style workarounds for Java/Spring backend targets.
- Bounded Windows search guidance to README/project files instead of unsafe recursive vendor scans.

### External Smoke

- Windows P0/P1 smoke was partially successful:
  - doctor and runtime readiness passed;
  - init/bootstrap output matched generated artifacts;
  - `profileSummaryInjected` was confirmed;
  - backend-shape report generation was observed;
  - fake Gradle shim, `HttpServer`, and CommonJS workarounds were not observed.
- OpenCode full finish still timed out/continued with pending work, so full implementation completion and generated product quality are not certified.
- Windows vendor-safe bearshell search smoke succeeded for README-only `Select-String -Path README.md -Pattern TODO` guidance, output, and command execution; unsafe recursive/vendor search guidance was not observed.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 55 files, 337 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.3` with 328 files.
- `npm run check:docs` passed.

## [0.3.8-alpha.2] - 2026-06-24

### Added

- Added `profileSummaryInjected` runtime evidence so README/project-bootstrap injection records whether the backend profile summary reached the same model-input block.
- Added pending workflow ticket completion guidance to `workflow check`, `workflow continue`, and `workflow finish implement` output so agents are explicitly told not to claim overall completion while pending tickets remain.

### Changed

- Clarified bootstrap injection evidence documentation to distinguish backend profile summary injection from AGENTS-only signals.
- Strengthened pending-ticket CLI copy without changing workflow enforcement semantics.

### External Smoke

- External Smoke was partially successful.
- `profileSummaryInjected` marker evidence was observed in README-read phase0 evidence.
- Pending workflow guidance was observed for `workflow check`, `workflow continue`, and `workflow finish implement`.
- Follow-up policy path smoke did not reproduce the previous `.persona/policies` permission auto-reject, so that issue can be removed as a publish blocker.
- OpenCode full implementation quality is still not certified, and direct `.persona/rules/backend/...` reads remain a follow-up risk.

### Verification

- `npm test` passed: scope/docs diagnostics PASS, 51 files, 327 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed for `persona-harness@0.3.8-alpha.2` with 309 files.

## [0.3.8-alpha.1] - 2026-06-24

### Added

- Added prompt-only requirements workflow transition coverage:
  - capture;
  - draft;
  - approve;
  - split;
  - next;
  - finish blocking while tickets remain pending.
- Added parser-level workflow report status coverage for `workflow check` and `workflow finish implement`.
- Added direct `RailComplianceTracker` unit coverage for report-only rail mismatch evidence.
- Added `createPhase0Hooks` intent-workflow hook-boundary coverage for requirements, programming, debug, review, refactor, and git rails.
- Added clean tarball workflow smoke evidence for `ph bootstrap backend`, `ph workflow split`, `workflow next`, `workflow continue`, `workflow finish implement`, `workflow check`, and `ph doctor`.

### Changed

- Strengthened release confidence for v0.3.8 by covering workflow transitions at integration, parser, runtime tracker, and hook-boundary layers.
- Kept generated Java/Spring app code quality as injection guidance plus report-only review, not an enforcement gate.

### Verification

- `npm test` passed: 51 files, 326 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- Clean tarball install smoke passed for Persona workflow command surfaces.

## [0.3.8-alpha.0] - 2026-06-24

### Added

- Added v0.3.8 workflow reliability guidance for pending workflow tickets:
  - `ph workflow finish implement` now reports pending ticket id, title, path, next command, and archive command;
  - technical-constraints tickets can be surfaced as review/archive candidates when existing workflow signals already pass;
  - `ph workflow continue` now includes pending ticket context before the generic resume prompt.

### Changed

- Strengthened profile-not-ready workflow UX so `.persona` projects without a ready backend profile point to `npx ph intake --interactive` or `npx ph bootstrap backend`.
- Strengthened runtime implementation guidance so AI runs must read `.persona/project-profile.jsonc`, avoid stack drift, and continue pending tickets instead of claiming completion.

### Verification

- `npm test` passed: 47 files, 308 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm pack --dry-run` passed.

## [0.3.7-alpha.1] - 2026-06-24

### Added

- Added workflow profile read coverage reporting for backend profile runs.
- Added implementation-report and review-report prompts for `.persona/project-profile.jsonc` read method/range evidence.

### Changed

- `ph workflow finish implement` now blocks when a ready backend profile exists but project-profile read coverage is missing.
- AI-facing implementation guidance now tells agents to read `.persona/project-profile.jsonc` before implementation and record that coverage.

### Fixed

- Made `ph doctor` surface OpenCode runtime readiness explicitly, including a clear WARN when the OpenCode CLI is missing.
- Made workflow report status parsing accept checklist and bold Markdown forms such as `- **Status:** filled`.
- Added Java/Spring/Gradle stack-alignment diagnostics for backend profiles so Node/CommonJS or non-Gradle output is reported as `STACK_MISMATCH`.
- Made `ph workflow finish implement` block on `STACK_MISMATCH` while keeping `ph workflow check` report-only.

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
