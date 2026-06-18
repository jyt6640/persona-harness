# Phase 0 Hook Feasibility

Date: 2026-06-17

## Goal

Prove the MVP path with a minimal rule loader:

```text
targetFile -> injection block -> actual model input
```

## Decision

Use an OpenCode TypeScript plugin, not a Java application.

The Java/Spring files are test targets only. They live under ignored fixture paths so the repository stays focused on the plugin implementation.

The room-escape reservation domain is not the product. It is a repeatable Java/Spring fixture used to observe whether role-specific rule injection reaches the model input and influences generated behavior.

## Hook Points

- `tool.execute.before`: best first capture point for read/edit/write-like tool arguments.
- `tool.execute.after`: fallback capture point when a host exposes usable target file arguments after execution.
- `experimental.chat.messages.transform`: preferred Phase 0 injection point because it mutates the message list immediately before model input.

## Current Proof

The test suite simulates OpenCode hook calls:

1. A tool call touches `ReservationController.java`, `ReservationService.java`, or `ReservationEntity.java`.
2. Persona Harness captures the target Java file and resolves its file role.
3. Persona Harness selects `.persona/rules` files for that role.
4. Persona Harness creates a temporary Phase 0 injection block.
5. The messages transform hook prepends the block to the latest user message.
6. Assertions verify the transformed message contains both the original user request and the role-specific injection policy.

## Backend MVP Decision

Status: **Closed for Phase 0 #1 Java/Spring backend**.

This decision only covers `# 1단계: 웹 요청-응답`.

Closed means the #1 fixture is sufficient for the MVP injection-path proof. It does not mean Persona Harness has guaranteed the product quality of a reservation application.

Reviewed runs:

- `experiments/phase0-runs/2026-06-17T10-53-27-107Z`
- `experiments/phase0-runs/2026-06-17T10-58-42-358Z`
- `experiments/phase0-runs/2026-06-17T11-04-54-321Z`
- `experiments/phase0-runs/2026-06-17T11-06-35-453Z`

Prior drift:

- `2026-06-17T10-53-27-107Z` kept the API contract and Controller/Service boundary, but generated `ReservationRepository` as a concrete `@Repository` class holding `List` and `AtomicLong`.
- That collapsed the repository contract and in-memory implementation into one class.
- The drift did not recur in the two post-reinforcement runs.

API contract evidence:

- `GET /reservations` returns `200 OK`.
- `POST /reservations` returns `200 OK`.
- `DELETE /reservations/1` returns `200 OK`.
- POST request body uses `name`, `date`, `time`.
- Create response contains `id`, `name`, `date`, `time`.
- The first created id is `1`.
- List size is `0` before create, `1` after create, and `0` after delete.

Role separation evidence:

- Controller calls Service and does not own Repository, Map/List, id sequence, or repository implementation details.
- Service handles create/list/delete use-case flow and does not own storage state or id sequence.
- `ReservationRepository` is an interface in the passing runs.
- `InMemoryReservationRepository` owns Map/List storage, id generation, and reset, and is registered as a Spring bean.
- DTOs express external API input/output contracts only.
- Tests pin status, body fields, first id, and list sizes instead of following generated implementation conventions.

Detector limitation:

- The detector is string-pattern based, not Java AST based.
- Normal generated code has produced false positives, including `jsonPath("$").isEmpty()` list-size assertions and `sequence.set(0L)` plus `incrementAndGet()` id reset.
- Detector PASS is not the sole completion signal.
- The closure decision combines detector output, direct generated-code review, Maven success, and repeated PASS evidence.
- Detector is a helper for observing drift, not a quality gate. Phase 0 does not enforce rules through Guard, AST, or linter checks.

## Phase 0 #2-3 Live Evidence

Status: **Closed for Phase 0 #2-3 Java/Spring backend fixture evidence**.

This does not reopen the product scope. The #2-3 room-reservation requirement is a higher-complexity Spring fixture for observing rule injection under H2/JdbcTemplate, schema, and time-linking concerns.

Reviewed runs:

- `experiments/phase0-runs/2026-06-18T00-16-01-731Z`
- `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- `experiments/phase0-runs/2026-06-18T01-02-20-056Z`

Evidence:

- `2026-06-18T00-16-01-731Z` confirmed scenario-aware contract selection for Controller evidence: `backend/step2-3-api-contract.md` selected and `backend/step1-api-contract.md` absent.
- `2026-06-18T00-34-47-590Z` captured live targetFile evidence for Controller, Test, Request DTO, and Response DTO.
- In that run, `backend/step2-3-api-contract.md` was selected 14 times and `backend/step1-api-contract.md` was selected 0 times.
- `2026-06-18T01-02-20-056Z` repeated the same default implementation command and again captured Controller, Test, Request DTO, and Response DTO live targetFile evidence.
- In the repeated run, `backend/step2-3-api-contract.md` was selected 15 times and `backend/step1-api-contract.md` was selected 0 times.
- Injection appeared in `pending-store`, `tool-output`, and `model-input`.

Limitation:

- The Controller/Test/DTO evidence was obtained by explicitly prompting the model to `glob` and `read` those file categories after implementation.
- This proves the Phase 0 harness can observe role-specific #2-3 contract injection when the fixture makes those files target files.
- It does not prove that models naturally inspect every role file without prompting.
- It is not a quality gate, Guard/AST/linter verification, or a guarantee of finished reservation-app product quality.

## Phase 0 MVP Decision

Status: **#2-3 evidence closed, Phase 0 MVP closed**.

This closure is valid only under the MVP definition in this repository: prove that Java/Spring target files can drive deterministic rule selection and injection into model-facing context, with enough evidence to observe model behavior.

Closure basis:

- #1 fixture proved the basic Spring backend injection path.
- #2-3 fixture proved the same path under a more complex H2/JdbcTemplate/schema/time/Test/DTO fixture.
- Scenario-aware contract selection kept `backend/step1-api-contract.md` and `backend/step2-3-api-contract.md` from mixing in the observed #2-3 Controller/Test/DTO evidence.
- Repeated #2-3 live run reproduced the selected-rules evidence.

Non-closure basis:

- This is not application quality certification.
- This is not a complete backend quality gate.
- This is not Guard/AST/linter enforcement.
- This is not proof that a model naturally reads every role file without prompt steering.
- This is not profile-aware, frontend, infra, benchmark routing, desktop app, or OMO-style full harness expansion.

## Phase 1.1 Follow-up Decision

Status: **Phase 1.1 종료**.

This follow-up does not change the Phase 0 MVP boundary. It records that the first Phase 1 axis, rule-loader/frontmatter/glob/scenario selection refinement, has enough evidence to close under the narrow Java/Spring Backend scope.

Closure basis:

- The rule catalog loader reads `.persona/rules/**/*.md` and uses frontmatter/glob/scenario eligibility as a minimal layer over the existing safe order/fallback.
- Frontmatter parsing and glob matching were split into small modules.
- #1/#2-3 scenario contract exclusivity is covered by tests.
- Existing injection block format and evidence `selectedRules` path string array format are preserved.
- #2-3 live run `experiments/phase0-runs/2026-06-18T02-10-18-110Z` captured Controller/Test/DTO targetFile evidence.
- That live run kept injection blocks in tool output/model input.
- That live run had catalog selection and evidence `selectedRules` matching with 0 mismatches.
- That live run had `backend/step2-3-api-contract.md` 17건 and `backend/step1-api-contract.md` 0건.

Limits:

- #1 prepare is a static step1 selection check, not runtime hook path proof.
- The live runtime evidence is one #2-3 implementation run.
- Prompt read guidance still helped produce Controller/Test/DTO targetFile evidence.
- Generated Spring app quality is not certified.
- The `./gradlew test` wrapper absence and the intermediate `gradle test` H2 SQL syntax failure are product-quality observations, not injection evidence failures.

## Boundary

This phase intentionally keeps out:

- frontmatter validation
- full glob matching
- guard or AST enforcement

Those belong after the Phase 0 hook path and loop evidence are stable.
