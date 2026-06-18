# Phase 1 Plan

## Context

Phase 0 MVP is closed under the narrow Persona Harness definition.

What Phase 0 proved:

- Java/Spring target files can be captured from OpenCode hook activity.
- File roles can be classified from Java/Spring filenames such as Controller, Service, Repository, DTO, and Test.
- `.persona/rules` policies can be selected and compressed into an injection block.
- The injection block can reach tool output or model input.
- Evidence can record targetFile, file role, selected rules, and injection timing.
- #1 and #2-3 Java/Spring fixtures showed observable model behavior consistent with the injected rules.
- Scenario-aware contract selection kept `backend/step1-api-contract.md` and `backend/step2-3-api-contract.md` from mixing in #2-3 Controller/Test/DTO evidence.

What Phase 0 did not prove:

- It did not certify generated Spring app quality.
- It did not enforce rules through Guard, AST, or linter checks.
- It did not prove that models naturally read every role file without prompt steering.
- It did not implement profile-aware, frontend, infra, benchmark routing, desktop app, or OMO-style workflow expansion.

## Remaining Risks

- Prompt read guidance strengthened #2-3 Test/DTO evidence, so natural file discovery remains unproven.
- The drift detector is string-pattern based and can produce false positives or miss semantic issues.
- Fixture requirements can still be mistaken for a room-reservation product backlog instead of injection test input.
- The rule loader is still intentionally simple: Phase 1.1 added a catalog/frontmatter/glob/scenario eligibility layer, not a full rule engine.
- Scenario selection remains narrow: `.persona/harness.jsonc` only distinguishes `step1` and `step2-3`.
- The latest #2-3 live runtime evidence is one implementation run, not statistical proof across models or prompts.

## Candidates

### Guard/AST/Linter

Goal:

- Add a verification layer that checks whether generated Java/Spring code actually follows injected rules.

Advantages:

- Directly addresses the string-detector limitation.
- Converts some observation-only findings into enforceable checks.
- Helps separate app-quality drift from injection-path evidence.

Risks:

- Easy to overbuild into a full quality gate.
- Requires Java-aware parsing or external tooling choices.
- Can shift Persona Harness from injection proof to generated-code enforcement too early.
- Higher chance of false confidence if the guard only covers a few surface patterns.

Minimum experiment:

- Pick one narrow Spring rule, for example "Controller must not depend on Repository".
- Run a small AST or structured scan only on generated Java files in an ignored fixture.
- Report PASS/WEAK/FAIL as observation, not as a blocking product gate.

Assessment:

- Reduces a real Phase 0 weakness, but the first experiment is still more expensive than rule-loader cleanup.
- It is better as Phase 1.2 after rule selection semantics are less hardcoded.

### Profile-Aware Backend/Frontend/Infra Expansion

Goal:

- Route different rule packs by developer profile or target domain.

Advantages:

- Moves toward the broader Persona Harness vision.
- Creates a path to Backend/Frontend/Infra specialization.
- Useful once the backend injection path is stable.

Risks:

- Broadens scope before the rule-selection core is mature.
- Adds routing dimensions while scenario selection is still hardcoded.
- Reopens MVP boundaries that Phase 0 deliberately kept closed.
- Hard to verify in 1-2 loops without shallow demos.

Minimum experiment:

- Add a non-runtime planning fixture that defines profile inputs and expected rule-pack outputs.
- Do not inject frontend/infra rules yet.

Assessment:

- Valuable later, but not the first Phase 1 step.
- It does not directly reduce the current prompt-read or rule-loader simplicity risks.

### Rule-Loader / Frontmatter / Glob / Scenario Selection Refinement

Goal:

- Make rule selection more declarative and less hardcoded while preserving the Phase 0 injection path.

Advantages:

- Directly addresses one of the biggest Phase 0 limitations: simple hardcoded selection.
- Continues from existing `.persona/rules` frontmatter and `globs`.
- Keeps the project inside Java/Spring Backend Phase 0 evidence boundaries.
- Can be tested with existing fixture patterns without a large architecture rewrite.
- Can be verified in 1-2 loops with unit tests plus prepare-only evidence.

Risks:

- Could drift into a full rule engine if scope is not constrained.
- Frontmatter parsing can become a new dependency or parsing edge case.
- Scenario selection must not become benchmark routing or profile-aware routing by accident.
- If too much changes at once, #1 behavior may regress.

Minimum experiment:

- Parse only the Phase 1.1 frontmatter fields needed for selection: `id`, `description`, `applies_to`, `globs`, `scenario`, `priority`, `max_bullets`, `enforcement`.
- Keep current role classification and scenario marker.
- Use frontmatter/globs only to choose candidate rules for Java/Spring files.
- Preserve #1 default contract selection and #2-3 contract selection.
- Add tests that prove #1 Controller/Test still gets `step1-api-contract`, and #2-3 Controller/Test/DTO gets `step2-3-api-contract` without mixing.

Assessment:

- Best Phase 1 first axis.
- It reduces hardcoded selection while staying close to Phase 0.
- It creates a cleaner foundation for later Guard/AST and profile-aware routing.

### OMO Workflow / Skill Adaptation

Goal:

- Bring more OMO-style workflow or skill orchestration into Persona Harness.

Advantages:

- Aligns with the long-term vision of a stronger harness around coding agents.
- Could improve end-to-end loop discipline and evidence quality.

Risks:

- Too broad for immediate post-MVP work.
- Risks copying/adapting OMO core behavior before Persona Harness has its own stable rule-selection semantics.
- Hard to keep inside Java/Spring Backend Phase 0 boundaries.
- Could obscure whether improvements come from Persona Harness rules or workflow machinery.

Minimum experiment:

- Documentation-only comparison of OMO workflow ideas that should remain out of Phase 1.1.

Assessment:

- Defer.
- It is a vision track, not the next implementation experiment.

## Comparison

| Candidate | Reduces Phase 0 Weakness | MVP Continuity | Minimal Experiment | Refactor Risk | Verifiable in 1-2 Loops |
| --- | --- | --- | --- | --- | --- |
| Guard/AST/linter | High for detector weakness | Medium | Medium | Medium-High | Maybe |
| profile-aware expansion | Low-Medium | Low | Weak | High | Weak |
| rule-loader refinement | High for hardcoded selection | High | Strong | Medium if constrained | Yes |
| OMO workflow adaptation | Low for immediate risks | Low | Weak | High | Weak |

## Decision

Phase 1 first experiment axis: **rule-loader/frontmatter/glob/scenario selection refinement**.

The first Phase 1 loop should not build a full rule engine. It should make the existing rule-selection path less hardcoded while keeping Phase 0 behavior stable.

Decision constraints:

- Keep Java/Spring Backend as the only active domain.
- Keep profile-aware, frontend, infra, benchmark routing, desktop app out of scope.
- Keep Guard/AST/linter out of the first Phase 1 implementation loop.
- Keep #1 and #2-3 scenario behavior stable.
- Use existing `.persona/rules` frontmatter as input, not a new rule format.
- Preserve metadata-only evidence.

## Phase 1.1 Design Lock

Phase 1.1 started as a design/documentation loop and then moved through minimal implementation, test hardening, internal refactoring, test split, and runtime evidence observation.

Design note:

- [`docs/phase1-rule-loader-design.md`](./phase1-rule-loader-design.md)

Minimum design locked for the next implementation loop:

- Read only a small frontmatter subset from `.persona/rules/**/*.md`: `id`, `description`, `applies_to`, `globs`, `scenario`, `priority`, `max_bullets`, `enforcement`.
- Treat `globs` as the main candidate filter for Java/Spring files.
- Keep existing file-role classification as the role source for Controller, Service, Repository, DTO, Entity, Domain, Exception, Test, and java-common files.
- Keep `.persona/harness.jsonc` scenario selection compatible with Phase 0: missing/unknown is `step1`, explicit `step2-3` selects step2-3 contract.
- Keep #1 and #2-3 contract rules mutually exclusive for Controller/Test/DTO evidence.
- Keep injection block format and `selectedRules` evidence as path string arrays.
- Do not implement Guard/AST/linter, profile-aware routing, frontend/infra expansion, OMO workflow adaptation, or a full rule engine in Phase 1.1.

Compatibility tests required before changing loader behavior:

- #1 Controller/Test receives `backend/step1-api-contract.md`.
- #1 Controller/Test does not receive `backend/step2-3-api-contract.md`.
- #2-3 Controller/Test/DTO receives `backend/step2-3-api-contract.md`.
- #2-3 Controller/Test/DTO does not receive `backend/step1-api-contract.md`.
- clean-code/java-common/base backend rule remains selected for all Java/Spring files.
- existing injection block format remains stable.
- evidence `selectedRules` recording format remains stable.

## Phase 1.1 Decision

Decision: **Phase 1.1 종료**.

Closure scope:

- Phase 1.1 closes only the minimal rule-loader/frontmatter/glob/scenario selection refinement for Java/Spring Backend Phase 0 fixtures.
- It does not close full rule-engine work, Guard/AST/linter enforcement, profile-aware routing, frontend/infra expansion, OMO workflow adaptation, or generated Spring product-quality validation.

Completed work:

- Added a small rule catalog loader over `.persona/rules/**/*.md`.
- Split frontmatter parsing into `src/phase0/rule-frontmatter.ts`.
- Split minimal glob matching into `src/phase0/rule-glob.ts`.
- Kept `src/phase0/rule-catalog.ts` focused on catalog orchestration and eligibility.
- Preserved existing fallback/order so globs do not fully replace Phase 0 behavior.
- Kept scenario-aware contract selection mutually exclusive: #1 selects `backend/step1-api-contract.md`; #2-3 selects `backend/step2-3-api-contract.md`.
- Added catalog/loader tests for scenario frontmatter, `max_bullets`, glob match/mismatch, missing/empty rules fallback, malformed frontmatter behavior, injection block format, and `selectedRules` shape.
- Split catalog tests by scenario/frontmatter/glob/fallback to reduce test file size risk.
- Confirmed #2-3 live runtime evidence matches catalog-based selection.

Closure basis:

- #1/#2-3 scenario contract exclusivity is locked by tests.
- The catalog loader acts as a frontmatter/glob/scenario eligibility layer.
- Existing injection block format is preserved.
- Evidence `selectedRules` remains a rule path string array.
- #2-3 live run `experiments/phase0-runs/2026-06-18T02-10-18-110Z` captured Controller/Test/DTO targetFile evidence.
- That live run left injection blocks in tool output/model input.
- That live run had catalog expected selection mismatch 0건.
- That live run had `backend/step2-3-api-contract.md` 17건 and `backend/step1-api-contract.md` 0건.

Limits:

- #1 prepare is a static step1 selection check, not runtime hook-path proof.
- The runtime proof is #2-3 one live implementation run.
- The #2-3 role evidence still depends on prompt read guidance for Controller/Test/DTO files.
- The generated Spring app is not product-quality certified.
- `./gradlew test` wrapper absence and the intermediate `gradle test` H2 SQL syntax failure are product-quality observations, not injection evidence failures.
- If Phase 1.1 were defined to include a full rule engine, Guard/AST/linter, profile-aware routing, natural file discovery without prompt steering, or product-quality verification, it would not be closed. Under the narrower Phase 1.1 definition, it is closed.

## Why Not Others Yet

Guard/AST/linter:

- It is important, but it changes the project from injection-path proof toward enforcement.
- It should sit on top of a cleaner rule-selection layer.

Profile-aware expansion:

- It expands dimensions before the current backend selection mechanism is declarative enough.
- It would make regression attribution harder.

OMO workflow adaptation:

- It is too broad and risks copying workflow structure before Persona Harness has finished its own minimal rule semantics.
- It should remain a reference track, not Phase 1.1.

## Next Loop

Recommended next loop goal:

```text
Phase 1.1 종료 상태를 기준으로 커밋/푸시 후보를 정리하거나, 다음 Phase 1 축을 Guard/AST/linter 관찰 실험으로 좁힌다.
```

Minimum next-loop deliverable if continuing implementation:

- Do not add profile-aware/frontend/infra/OMO workflow work yet.
- If choosing Guard/AST/linter, start with one narrow observation-only Java/Spring rule.
- If choosing commit/push cleanup, separate tracked implementation/docs from ignored `PROJECT-PLAN.md`, `experiments/`, and `.persona-test-fixtures/`.
