# Persona Harness Progress Board

Last updated: 2026-06-18

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

Current track: Phase 1.2 report-only observation loop.

Current active candidate: Phase 1.2 next track decision.

Current recommendation:

1. Treat the Test Contract observer cleanup track as closed.
2. Choose the next Phase 1.2 action: a new report-only observation candidate or a broader phase-close decision.
3. Keep rule/prompt reinforcement deferred.

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

## Progress Snapshot

Known scoped work items in this board: 40

- Done: 35
- Active next: 1
- Deferred/watch: 4
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
| Phase 1.2 | Active | Report-only observers over generated Java/Spring runs | Test Contract cleanup closed after row-count and time-list matcher corrections |
| Phase 2 | Not decomposed | Stronger productization or broader domains | Not started |
| Desktop App Track | Not decomposed | Final long-term host/app goal | Not started |

## Current Active Work Queue

1. `[>]` Phase 1.2 next track decision
   - Goal: decide whether to select a new report-only observation candidate or close the current Phase 1.2 observation pass.
   - Evidence: `docs/phase1-test-contract-cleanup-decision.md`
   - Constraints: no product-quality gate, no enforcement gate, no rule/prompt reinforcement without repeated manual-confirmed actual missing evidence.

2. `[~]` Test Contract response time object actual missing watch
   - Evidence: `docs/phase1-test-contract-response-time-repeat-review.md`
   - Current state: third run missed reservation response `time.id/startAt`, but comparison run had explicit assertions.
   - Decision: keep inactive unless another actual run repeats manual-confirmed missing.

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

- There are still local unstaged Phase 0/frontmatter/config changes in the worktree. They are intentionally not mixed into later report-only observer commits.

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
- [~] Profile-aware backend/frontend/infra expansion
  - Deferred. Current MVP is Java/Spring backend.
- [~] OMO workflow/skill adaptation
  - Deferred. Persona Harness remains independent.
- [?] Desktop app packaging
  - Long-term goal, not decomposed into actionable Phase tasks yet.

## Known Dirty Worktree Items

These existed before this board and should not be mixed into unrelated observer/report commits:

- `.persona/harness.jsonc`
- `README.md`
- `docs/phase1-rule-loader-design.md`
- `src/phase0/evidence.ts`
- `src/phase0/hooks.ts`
- `src/phase0/injection.ts`
- `src/phase0/rule-catalog.ts`
- `src/phase0/rule-frontmatter.ts`
- `src/phase0/rule-loader.ts`
- `src/phase0/types.ts`
- `tests/helpers/rule-fixtures.ts`
- `tests/phase0-rule-frontmatter.test.ts`
- `src/phase0/harness-config.ts`
- `tests/phase0-harness-config.test.ts`

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
- Phase 1.2 next track decision

Goal:
- Decide whether to select a new report-only observation candidate or close the current Phase 1.2 observation pass.

Constraints:
- string-based observer only
- no new dependency
- report-only
- no rule/prompt reinforcement
- no enforcement gate
- no test/product quality guarantee

Expected output:
- next-track decision document
- PROJECT-PLAN update
- this progress board updated
```
