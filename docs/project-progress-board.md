# Persona Harness Progress Board

Last updated: 2026-06-19

## Purpose

This is the single progress board for Persona Harness.

Use this file to answer:

- 지금 전체 작업이 어디까지 왔는가
- 어떤 Phase/Loop가 끝났는가
- 지금 active next loop가 무엇인가
- 무엇이 남았는가
- 어떤 것은 보류됐고, 왜 보류됐는가

`PROJECT-PLAN.md` remains the long local planning log. This file is the short, maintained table of contents and progress tracker.

## Current Position

Current track: backend Clean Code uniformity validation after diagnostics-first MVP productization surface.

Current active candidate: exact `com.example/global` sibling package fixture validation or move to project intake/planning design.

Current recommendation:

1. Treat the Phase 1.2 observation pass as closed.
2. Do not choose another report-only observation candidate by default.
3. Treat the existing Phase 1.1/frontmatter worktree settlement as complete.
4. Use diagnostics-only as the PersonaHarnessRule MVP schema validation policy and implementation behavior.
5. Keep rule/prompt reinforcement deferred unless future actual runs provide repeated manual-confirmed evidence.
6. Use `npm run report:rules` as the first user-visible diagnostics surface.
7. Treat Gradle as the canonical Java/Spring build tool and discard Maven as primary evidence.
8. Move the next decision from release/demo packaging to backend product-code uniformity.
9. Keep personal/team/project philosophy as an optional future harness layer; the current default is Clean Code plus backend role responsibility.
10. Keep test style and test-contract policy out of the current product-code-quality track.
11. Treat `Gradle only + Service storage ownership baseline reinforcement` as the first implemented backend product-code uniformity step.
12. Treat OMO `shared-skills` as a vendored reusable skill package, not as something wired into the current backend rule MVP.
13. Target OMO-like skill behavior with Persona-specific backend/frontend/infra specialization.
14. Treat the first Gradle ON/OFF A/B pair as mixed evidence, not product-quality proof.
15. Treat Spring Boot entrypoint/package-shape cleanup as confirmed in one new A/B pair, but not as an ON-positive differential signal.
16. Treat the Task Management fixture A/B as weak ON-positive evidence for explicit layered package shape, not as product-quality proof.
17. Treat Java common routing to `backend/layered-architecture.md` as actual-run confirmed at the injection surface.
18. Do not treat exact `presentation/application/domain/infrastructure` package naming as proven: the latest Library Loans A/B still produced `book` + `web` on Injection ON.
19. Prefer package structure planning before implementation over repeatedly strengthening package-name wording in isolation.
20. Treat package structure planning as actual-run useful: the follow-up Library Loans A/B produced exact domain-internal `presentation/application/domain/infrastructure` packages on Injection ON.
21. Treat common cross-cutting backend concerns as `global`, not as domain/application/presentation spillover.
22. Treat the corrected root/domain package plan as partially validated: domain-internal layers repeated on Injection ON, but root `global` placement did not match exactly.
23. Treat the clarified root semantics A/B as useful but still partial: ON removed the previous `library/loan` nested domain drift, but the fixture still led to `com.example.library.global` rather than `com.example.global`.

Current evidence summary:

- Phase 0 MVP: complete under the Java/Spring backend MVP scope.
- Phase 1.1 catalog-backed rule selection: complete under the narrow selection-refinement scope.
- Controller Repository observation: complete, actual WARN repetition not found.
- Controller SQL observation: complete, actual WARN repetition not found.
- Service Storage observation: complete, actual PASS repeated.
- Test Contract Anchor observation: implemented, actual `WARN/HIGH` repeated at observer level.
- Row-count helper matcher correction is implemented and reduced the third actual report mismatch.
- Response time object actual missing did not repeat in the comparison run.
- Time-list matcher correction moved `reservation_time` table or time list size `1` from missing to present in the rechecked actual report.
- The remaining actual report warning is reservation response time object, but prior comparison did not show repetition.
- Test Contract observer cleanup track is closed; response time object remains a watch item, not an active cleanup loop.
- Phase 1.2 observation pass is closed; no new report-only observation candidate is selected now.
- Phase 1.1/frontmatter/config dirty worktree settlement is complete and commit-ready.
- PersonaHarnessRule validation policy is diagnostics-only: report findings without changing selection.
- PersonaHarnessRule diagnostics-only validation is implemented: valid rules have no findings, invalid or malformed frontmatter produces catalog diagnostics, and loading remains non-blocking.
- PersonaHarnessRule diagnostics now have a user-visible report surface via `npm run report:rules`.
- README documents the MVP reproduction path from install/build/test to rule diagnostics and OpenCode plugin connection.
- `example/src` is now treated as a backend product-code style reference answer, not a universal roomescape/step1 template.
- The current product-code direction is documented in `docs/backend-product-code-style-direction.md`.
- Gradle-only Java/Spring generation and keeping storage state/id sequence outside Application Service are now reinforced in rule/prompt surfaces.
- The backend baseline now treats presentation/application/domain/infrastructure boundaries as explicit Clean Code structure: upper layers may know lower layers, direct skip-layer coupling is avoided, and domain can be used by application/infrastructure without knowing infrastructure.
- OMO shared-skills structure is vendored under `packages/shared-skills`; `programming` is the first important skill, with TypeScript expected to be React/frontend oriented later.
- The long-term skill direction is OMO-like operation with Persona-specific backend/frontend/infra routing.
- Minimal skill auto-routing is implemented: TypeScript selects `programming`, React/frontend TypeScript selects `programming` plus `frontend`.
- Gradle ON/OFF A/B run `experiments/phase0-runs/2026-06-18T10-55-43-325Z` completed with model `openai/gpt-5.4-mini-fast`.
- Both ON and OFF kept Gradle files and avoided `pom.xml`.
- Both ON and OFF kept storage state/id sequence out of `ReservationService`.
- Injection ON separated request/response DTOs and reached final Gradle success without an intermediate failing test attempt; Injection OFF fixed a first failing test and then passed.
- The current A/B signal is mixed: useful for direction, insufficient for product-quality or stable effect claims.
- Parallel A/B generation requires isolated OpenCode data/cache/state directories seeded from existing OpenCode data. Naive parallel execution hit run directory collision and global database locking.
- Across three earlier A/B pairs, response DTO boundary repeated in Injection ON 3/3 and in Injection OFF 1/3.
- After minimal response DTO boundary reinforcement, two new A/B pairs showed Controller response DTO boundary in both ON and OFF 2/2. The earlier ON-positive differential did not hold.
- In the response DTO recheck, Service response DTO boundary was ON 1/2 and OFF 2/2, and one ON run generated an extra `ReservationApplication` in the feature package.
- The backend baseline now injects a Spring Boot entrypoint/package-shape rule: keep one main application class in the root package and do not create extra `*Application.java` classes under feature/domain packages.
- Gradle ON/OFF A/B run `experiments/phase0-runs/2026-06-19T00-14-57-663Z-19978-drflpp` completed with model `openai/gpt-5.4-mini-fast`.
- In that A/B pair, ON and OFF both kept `build.gradle`/`settings.gradle`, avoided `pom.xml`, produced exactly one root-package `ReservationApplication.java`, avoided feature-package extra `*Application.java`, and passed `gradle test --quiet`.
- This closes the immediate package/class duplication noise check as cleanup confirmation. It is not an ON-positive product-quality signal because OFF was also clean.
- A new non-reservation Task Management Gradle fixture is defined in `docs/backend-clean-code-task-fixture-design.md`.
- Primary Task fixture A/B run `experiments/phase0-runs/2026-06-19T00-37-19-269Z-68875-mxhhug-task-service-fixture` completed with model `openai/gpt-5.4-mini-fast`.
- In the primary Task fixture run, ON and OFF both kept Gradle-only files, avoided `pom.xml`, produced one root `TaskApplication.java`, avoided Service storage/id ownership, kept Repository and DTO boundaries, and passed `gradle test --quiet`.
- ON produced explicit `web/application/domain/infrastructure` package layering; OFF produced a flatter but still acceptable `task` package with `dto` and `repository` subpackages.
- The Task fixture gives weak ON-positive evidence for explicit layered package shape only.
- A secondary Controller-first Task run selected reservation-specific `backend/step1-api-contract.md`; this exposes a generic-fixture contamination risk in the current scenario rule setup.
- Java common routing A/B run `experiments/phase0-runs/2026-06-19T03-03-05Z-library-routing-ab` completed with model `openai/gpt-5.4-mini-fast`.
- In that A/B pair, ON evidence for `LibraryApplication.java` and `build.gradle` selected `backend/layered-architecture.md`.
- ON and OFF both kept Gradle-only files, avoided `pom.xml`, passed independent `gradle test`, and passed manual HTTP smoke for book create/list/loan/return/delete.
- ON improved repository and Service storage/id boundaries: `BookService` delegated to `BookRepository`/`InMemoryBookRepository`; OFF `LibraryService` directly owned `Map<Long, Book>` and `AtomicLong nextId`.
- ON still did not generate exact `presentation/application/domain/infrastructure` package names; it generated `book` + `web`.
- Java common backend guidance now asks the agent to write a package structure plan before implementation, with root `global` plus domain-specific internal layers as the default candidate.
- Package structure plan A/B run `experiments/phase0-runs/2026-06-19T03-28-43Z-library-package-plan-ab` completed with model `openai/gpt-5.4-mini-fast`.
- In that A/B pair, ON generated exact domain-internal `presentation/application/domain/infrastructure` packages; OFF generated `book` + `web`.
- ON output did not literally print `package structure plan`, but it did describe a small layered HTTP app before editing.
- ON and OFF both kept Gradle-only files, avoided `pom.xml`, passed independent `gradle test`, and passed manual HTTP smoke for book create/list/loan/return/delete.
- The current package-shape signal is ON-positive for code uniformity, not product-quality proof.
- Java common backend guidance now includes an explicit root `global` plus `root/<domain>/application`, `root/<domain>/domain`, `root/<domain>/infrastructure`, and `root/<domain>/presentation` package plan.
- `global` is scoped to cross-cutting concerns such as error, response, and config; domain logic, domain DTOs, services, and repositories should not be placed there.
- The guidance now surfaces presentation request/response DTO packages, application command/result DTO packages, domain repository interfaces, and infrastructure repository implementations.
- Domain root package A/B run `experiments/phase0-runs/2026-06-19T03-48-03Z-library-domain-root-ab` completed with model `openai/gpt-5.4-mini-fast`.
- In that A/B pair, ON generated `library/loan/application`, `library/loan/domain`, `library/loan/infrastructure`, and `library/loan/presentation` with DTO subpackages, domain repository interface, and infrastructure implementation.
- ON generated `library/global/exception` and `library/global/response`, not root `com.example.global`.
- OFF generated a flat `library/book` package and `BookService` directly owned `Map` and `AtomicLong nextId`.
- The corrected package plan is ON-positive for code-shape uniformity but still partial for exact root `global` placement and domain package naming.
- Java common backend guidance now explicitly says the root package is where the Spring Boot Application class is located, `global` sits directly below that root package, domain packages sit at the same depth as `global`, and an existing `com.example.library.LibraryApplication` should not trigger a nested `library/loan` domain package.
- Root semantics A/B run `experiments/phase0-runs/2026-06-19T04-01-00Z-library-root-semantics-ab` completed with model `openai/gpt-5.4-mini-fast`.
- In that A/B pair, ON generated `library/application`, `library/domain`, `library/infrastructure`, `library/presentation`, request/response DTO packages, command/result DTO packages, domain `BookRepository`, and infrastructure `InMemoryBookRepository`.
- ON did not generate a nested `library/loan` package, fixing the previous ON drift.
- ON still generated `library/global/exception`, not sibling `com.example.global`, because the starting fixture placed `LibraryApplication.java` under `com.example.library`.
- OFF generated a flatter `library/book` package and `library/common` package.
- ON and OFF both kept Gradle-only files, avoided `pom.xml`, and passed independent `gradle test --quiet`.

## Progress Snapshot

Known scoped work items in this board: 62

- Done: 56
- Active next: 1
- Deferred/watch: 6
- Not yet decomposed: final product packaging and desktop app track

This is not an overall product-quality percentage. It is a progress count over the currently documented Persona Harness MVP and Phase 1 observation track.

## Status Legend

- `[x]` Done
- `[>]` Active next
- `[~]` Deferred or watch
- `[ ]` Not started
- `[?]` Needs decomposition

## Phase Map

| Phase | Status | Scope | Current Result |
| --- | --- | --- | --- |
| Phase 0 | Done | OpenCode plugin MVP for Java/Spring backend rule injection | MVP evidence collected for #1 and #2-3 |
| Phase 1.1 | Done | Catalog/frontmatter/glob/scenario selection refinement | Narrow rule-loader refinement complete |
| Phase 1.2 | Done | Report-only observers over generated Java/Spring runs | Observation pass closed; reinforcement deferred |
| Phase 2 | Active validation | Backend product-code uniformity and productization direction | Response DTO boundary reinforced; follow-up A/B is mixed and no longer ON-positive |
| Desktop App Track | Not decomposed | Final long-term host/app goal | Not started |

## Current Active Work Queue

1. `[>]` Backend Clean Code uniformity next decision
   - Goal: choose whether exact `com.example/global` sibling package shape needs one fixture-corrected A/B or whether to move to project intake/planning design.
   - Evidence: `docs/backend-product-code-style-direction.md`, `docs/gradle-ab-actual-run-review.md`, `docs/backend-clean-code-uniformity-rubric.md`, `docs/backend-clean-code-parallel-ab-review.md`, `docs/response-dto-boundary-ab-review.md`, `docs/spring-boot-entrypoint-package-shape-review.md`, `docs/backend-clean-code-task-fixture-ab-review.md`, `docs/java-common-routing-ab-review.md`, `docs/java-package-structure-plan-surface.md`, `docs/java-package-structure-plan-ab-review.md`, `docs/java-global-package-plan-surface.md`, `docs/java-domain-root-package-plan-ab-review.md`, `docs/java-root-semantics-ab-review.md`
   - Constraints: no new observer by default, no test-policy work, no frontend/infra/profile-aware implementation, no product-quality certification claim.

2. `[~]` Test Contract response time object actual missing watch
   - Evidence: `docs/phase1-test-contract-response-time-repeat-review.md`
   - Current state: third run missed reservation response `time.id/startAt`, but comparison run had explicit assertions.
   - Decision: keep inactive unless another actual run repeats manual-confirmed missing.

3. `[~]` Shared programming skill loader/adaptation
   - Evidence: `docs/shared-skill-reference-direction.md`
   - Current state: OMO shared-skills structure and skill content copied into `packages/shared-skills` with Persona-specific pruning of LazyCodex-only `lcx-*` skills; minimal auto-routing is implemented, but full loader/adaptation is not.
   - Decision: keep inactive until Gradle A/B validation or philosophy/intake design needs backend/frontend/infra skill routing.

## Completed Work

### Phase 0 MVP

- [x] Hook feasibility checked.
- [x] `.persona/harness.jsonc` MVP config path established.
- [x] Java/Spring target file detection implemented.
- [x] File role classification implemented.
- [x] Rule selection policy implemented.
- [x] Injection block formatting implemented.
- [x] Metadata-only evidence writer implemented.
- [x] Matching unit tests added.
- [x] ReservationController vertical demo completed.
- [x] Phase 0 #1 fixture completed.
- [x] Phase 0 #2-3 scenario-aware contract selection completed.
- [x] Phase 0 #2-3 Controller/Test/DTO live target evidence collected.

Primary docs:

- `docs/phase-0-report.md`
- `docs/phase0-rule-selection-review.md`
- `docs/phase0-step2-scope.md`

### Phase 1.1 Rule Selection Refinement

- [x] Rule-loader/frontmatter/glob/scenario selection refinement selected as first Phase 1 axis.
- [x] Rule catalog loader minimally implemented.
- [x] Actual rule frontmatter fields aligned to `source`, `domain`, `topic`, `severity`.
- [x] Scenario-specific contract selection preserved for #1 and #2-3.
- [x] Config wiring audited and adjusted in the local worktree.
- [x] Compatibility tests and catalog tests added/split.
- [x] Runtime evidence reviewed.
- [x] Phase 1.1 closed under narrow Java/Spring backend selection scope.

Primary docs:

- `docs/phase1-plan.md`
- `docs/phase1-rule-loader-design.md`
- `docs/phase1-completion-audit.md`

Note:

- Phase 1.1/frontmatter/config dirty worktree settlement is recorded in `docs/phase1-1-frontmatter-worktree-settlement.md`.
- The next open Phase 1.1 item is explicit schema validation behavior, not more observer work.

### Phase 1.2 Controller Repository Observer

- [x] Controller direct Repository observer designed.
- [x] Controller direct Repository observer implemented.
- [x] Smoke fixture report reviewed.
- [x] Actual generated run report reviewed.
- [x] Additional actual generated run reviewed.
- [x] Rule/prompt reinforcement deferred because actual WARN repetition was not found.

Primary docs:

- `docs/phase1-2-observer-design.md`
- `docs/phase1-2-report-review.md`
- `docs/phase1-2-controller-rule-improvement.md`
- `docs/phase1-2-actual-report-review.md`
- `docs/phase1-2-additional-actual-report-review.md`
- `docs/phase1-2-next-decision.md`

### Parser / AST Decision Track

- [x] Guard/AST/linter observation candidate documented.
- [x] Java parser fixture contract documented.
- [x] Java parser no-install metadata spike documented.
- [x] Java parser compile/import spike performed.
- [x] Parser-backed observer introduction deferred.
- [x] Spike dependency removed.

Primary docs:

- `docs/phase-next-guard-ast-linter-observation-design.md`
- `docs/phase-next-java-parser-fixture-contract.md`
- `docs/phase-next-java-parser-metadata-spike.md`
- `docs/phase1-2-parser-decision.md`

Current decision:

- Keep Phase 1.2 observers string-based unless repeated false positive/false negative evidence makes a parser worth the dependency surface.

### Phase 1.2 Controller SQL Observer

- [x] Controller SQL access observer designed.
- [x] Controller SQL access observer implemented.
- [x] Actual generated run reviewed.
- [x] Next decision recorded.
- [x] Rule/prompt reinforcement deferred because actual WARN repetition was not found.

Primary docs:

- `docs/phase-next-controller-sql-observer-design.md`
- `docs/phase1-2-controller-sql-actual-report-review.md`
- `docs/phase1-2-controller-sql-next-decision.md`

### Phase 1.2 Service Storage Observer

- [x] Service Storage Ownership observer selected as next observation.
- [x] Service Storage observer designed.
- [x] Service Storage observer implemented.
- [x] Actual generated run reviewed.
- [x] Additional actual generated run reviewed.
- [x] Service Storage reinforcement deferred because `PASS/none` repeated.
- [x] Next observation selected.

Primary docs:

- `docs/phase1-2-next-observation-decision.md`
- `docs/phase-next-service-storage-observer-design.md`
- `docs/phase1-service-storage-actual-report-review.md`
- `docs/phase1-service-storage-repeat-report-review.md`
- `docs/phase1-next-observation-decision.md`

### Phase 1.2 Test Contract Anchor Observer

- [x] Test contract drift reframed as requirements anchor presence observation.
- [x] Test Contract Anchor observer designed.
- [x] Test Contract Anchor observer implemented.
- [x] Actual generated run reviewed.
- [x] Additional actual generated run reviewed.
- [x] Row-count helper matcher adjustment designed.
- [x] Third actual generated run reviewed.
- [x] Narrow row-count helper matcher correction implemented.
- [x] Actual report recheck showed reservation row count moved from missing to present.
- [x] Test Contract follow-up decision completed.
- [x] Response time object actual missing repeat observation completed.
- [x] Time-list/table matcher follow-up decision completed.
- [x] Narrow time-list matcher correction implemented.
- [x] Actual report recheck showed `reservation_time` table or time list size `1` moved from missing to present.
- [x] Test Contract observer cleanup decision completed.
- [~] Reservation response time object actual missing remains under watch.

Primary docs:

- `docs/phase1-next-observation-decision.md`
- `docs/phase1-test-contract-observer-design.md`
- `docs/phase1-test-contract-actual-report-review.md`
- `docs/phase1-test-contract-repeat-report-review.md`
- `docs/phase1-test-contract-matcher-adjustment-design.md`
- `docs/phase1-test-contract-third-report-review.md`
- `docs/phase1-test-contract-matcher-adjustment-result.md`
- `docs/phase1-test-contract-follow-up-decision.md`
- `docs/phase1-test-contract-response-time-repeat-review.md`
- `docs/phase1-test-contract-time-list-matcher-decision.md`
- `docs/phase1-test-contract-time-list-matcher-result.md`
- `docs/phase1-test-contract-cleanup-decision.md`
- `docs/phase1-2-observation-pass-decision.md`

### Phase 1.2 Pass Closeout

- [x] Controller direct Repository observation closed without actual WARN repetition.
- [x] Controller SQL Access observation closed with insufficient reinforcement evidence.
- [x] Service Storage Ownership observation closed with repeated `PASS/none`.
- [x] Test Contract Anchor cleanup track closed.
- [x] Phase 1.2 observation pass closed without selecting a new report-only observation candidate.

### Phase 1.1 Worktree Settlement

- [x] Phase 1.1/frontmatter/config dirty worktree reviewed.
- [x] Commit-ready config/frontmatter/runtime evidence changes classified.
- [x] Schema validation, OMO rules-engine reuse, and packaging/demo deferred to separate loops.
- [x] Next implementation candidate selected: PersonaHarnessRule MVP schema validation.

### Phase 1.1 Schema Validation

- [x] PersonaHarnessRule MVP schema validation policy selected.
- [x] Diagnostics-only chosen over selection-blocking and hybrid.
- [x] Diagnostics-only validation implementation completed.
- [x] Diagnostics report surface implemented via `npm run report:rules`.
- [x] MVP reproduction path documented in README.
- [x] Diagnostics-first productization surface completed.

Primary docs:

- `docs/phase1-1-schema-validation-policy-decision.md`
- `docs/phase1-1-schema-validation-result.md`
- `docs/productization-path-decision.md`

### Backend Product Code Style Direction

- [x] `example/src` clarified as a style reference answer, not a universal project template.
- [x] Gradle fixed as canonical Java/Spring build tool; Maven removed from primary evidence.
- [x] Default Clean Code/backend baseline separated from optional personal/team/project philosophy harness.
- [x] Test style deferred to a later dedicated policy track.
- [x] First backend product-code uniformity implementation landed: Gradle-only runner/rule prompt and Service storage/id sequence ownership baseline.
- [x] OMO `shared-skills` structure and skill content vendored as the future shape for reusable Programming/Frontend/Infra skills.
- [x] OMO-like operation with Persona-specific backend/frontend/infra specialization recorded as the target skill direction.
- [x] Minimal shared skill auto-routing implemented for TypeScript and React/frontend TypeScript targets.
- [>] Actual Gradle generated-run validation remains active next.

Primary docs:

- `docs/backend-product-code-style-direction.md`
- `docs/shared-skill-reference-direction.md`
- `docs/skill-auto-routing-result.md`

## Deferred / Watch List

### Rule/Prompt Reinforcement

- [~] Controller direct Repository rule/prompt reinforcement
  - Deferred because actual WARN repetition was not found.
- [~] Controller SQL direct access rule/prompt reinforcement
  - Deferred because actual WARN repetition was not found.
- [~] Service storage ownership rule/prompt reinforcement
  - Deferred because two actual runs repeated `PASS/none`.
- [~] Test contract route/status/body/count rule/prompt reinforcement
  - Deferred because observer `WARN/HIGH` repeated but manual review points first to matcher limits.

### Broader Engineering Tracks

- [~] AST/linter/full Guard
  - Deferred. Current observers remain report-only.
- [~] New parser dependency
  - Deferred after metadata/import spike and dependency hygiene.
- [~] Optional philosophy/intake harness
  - Deferred. Personal/team/project philosophy is a selectable future layer; current default remains Clean Code plus backend baseline.
- [~] Frontend/infra profile expansion
  - Deferred. Future tracks should use the same scale/stack intake pattern, but current work stays backend product code.
- [~] OMO workflow/skill adaptation
  - Deferred. Persona Harness remains independent; only the useful shared-skills package/content is vendored, with LazyCodex-only `lcx-*` skills removed.
- [~] Shared skill bundle implementation
  - Deferred. `packages/shared-skills` is copied, Persona-pruned, and minimally routed, but no full backend/frontend/infra loader/adaptation implementation is selected before Gradle A/B validation.
- [?] Desktop app packaging
  - Long-term goal, not decomposed into actionable Phase tasks yet.

## Known Dirty Worktree Items

No tracked Phase 1.1/frontmatter/config dirty items should remain after the settlement commit.

`PROJECT-PLAN.md` remains a local planning log and may contain untracked/local-only updates depending on the workspace setup.

## How To Update This Board

At the end of each loop:

1. Update `Last updated`.
2. Update `Current Position`.
3. Move finished active items into the matching completed section.
4. Add or adjust the next active item.
5. Keep deferred items explicit with the reason.
6. Do not use this board as proof of product quality.
7. Keep generated `experiments/`, `.persona/evidence/`, and `.persona-test-fixtures/` outputs untracked.

## Next Loop Template

Use this when starting the next loop:

```text
Current active item:
- Gradle canonical A/B rerun with reinforced backend baseline

Goal:
- Verify whether Gradle-only plus Service storage/id sequence ownership reinforcement improves generated backend code uniformity in an actual run.

Constraints:
- no observer work
- no new dependency
- no OMO rules-engine integration
- no rule/prompt reinforcement
- no enforcement gate
- no test/product quality guarantee

Expected output:
- one documented release/demo checklist path
- PROJECT-PLAN update
- this progress board updated
```
