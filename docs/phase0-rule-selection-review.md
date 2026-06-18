# Phase 0 Rule Selection Review

## Current Status

Status: **resolved for Phase 0 #2-3 MVP evidence**.

The original review below captured the #2-3 rule-selection drift: `backend/step1-api-contract.md` was entering #2-3 Controller/Test injections. Follow-up loops added a narrow scenario marker and `backend/step2-3-api-contract.md`, then verified live evidence.

Resolution evidence:

- `experiments/phase0-runs/2026-06-18T00-16-01-731Z`: Controller live evidence selected `backend/step2-3-api-contract.md`; `backend/step1-api-contract.md` selected count was 0.
- `experiments/phase0-runs/2026-06-18T00-34-47-590Z`: Controller, Test, Request DTO, and Response DTO were live target files. Relevant roles selected `backend/step2-3-api-contract.md`; `backend/step1-api-contract.md` selected count was 0.

Important limitation:

- The second run secured Test/DTO evidence by explicitly prompting the model to `glob` and `read` Controller/Test/DTO files after implementation.
- This is sufficient for MVP injection-path observation.
- It is not proof that future models naturally inspect every role file.
- It is not a Guard/AST/linter quality gate or reservation-app product-quality certification.

## Context

Phase 0 #2-3 fixture run `experiments/phase0-runs/2026-06-17T12-07-49-050Z` showed that the injection path still works in a more complex Spring/H2/JdbcTemplate fixture, but it also exposed rule-selection drift.

The run was not a product-quality review of the reservation app. It used the #2-3 database/time-management requirement only as a Java/Spring backend fixture for observing this path:

```text
targetFile -> injection block -> model input -> model behavior
```

Before the fix, the Phase 0 loader selected contract rules by file role only. In `src/phase0/rule-loader.ts`, `backend/step1-api-contract.md` was attached to these roles:

- `controller`
- `request-dto`
- `response-dto`
- `test`

That made sense for the closed Phase 0 #1 fixture, but #2-3 changes the reservation contract from `time` to `timeId`, adds time APIs, and moves persistence to H2/JdbcTemplate. Without scenario context, #1 contract text entered #2-3 Controller/Test injections.

## Evidence Reviewed

Reviewed run:

- `experiments/phase0-runs/2026-06-17T12-07-49-050Z`

Reviewed files:

- `analysis.md`
- `evidence.md`
- `stdout.log`
- `diff.patch`
- `.persona/evidence/phase0/*.json` inside the sandbox

Observed `backend/step1-api-contract.md` selections:

| Target file | File role | Injection locations |
| --- | --- | --- |
| `sandbox/src/main/java/com/example/reservation/ReservationController.java` | `controller` | `pending-store`, `tool-output`, `model-input` |
| `sandbox/src/test/java/com/example/reservation/ReservationJdbcIntegrationTest.java` | `test` | `pending-store`, `tool-output`, `model-input` |

The Controller read output in `stdout.log` included `[Persona Harness Injection]` with `backend/step1-api-contract.md`. Its policy text still said `POST /reservations` request body is `name`, `date`, `time`. The #2-3 source requirement says reservation creation uses `name`, `date`, `timeId`.

## Problem

This mixing does not prove the model ignored the harness. The generated code still reflected much of the #2-3 requirement:

- `ReservationCreateRequest(String name, String date, Long timeId)`
- H2/JdbcTemplate repositories
- `reservation_time` and `reservation.time_id`
- 200 OK for reservation and time APIs
- response `time` represented as an object with `id`, `startAt`

The problem is evidence interpretation. If a #2-3 run receives both a strong #2-3 prompt and a stale #1 API-contract injection, then good generated behavior cannot be cleanly attributed to role-specific contract injection. The run still proves that the injection path is alive, but it weakens the claim that contract rule selection is scenario-appropriate under fixture complexity.

For MVP purposes, this is a rule-selection observation, not a quality gate failure. It does not justify Guard/AST/linter enforcement, detector expansion, or a large rule-engine rewrite.

## Contract Rule Split Candidates

### Candidate A: Separate Step Contract Rules

Create separate contract rule files, for example:

- `backend/step1-api-contract.md`
- `backend/step2-3-api-contract.md`

Pros:

- Keeps source-stated contracts explicit and reviewable.
- Makes stale #1 fields like `time` easier to keep out of #2-3 injections.
- Fits the existing `.persona/rules` layout without requiring a full rule engine.

Cons:

- Still needs a minimal selection signal so the loader knows which contract to choose.
- Risks accumulating one-off fixture rules if every experiment becomes a rule file.
- Requires care not to treat fixture contract rules as product backlog scope.

### Candidate B: Scenario Marker From Runner

Let the experiment runner provide a scenario marker such as `step1` or `step2-3`, then select the matching contract rule.

Pros:

- Directly matches how experiments are created.
- Keeps selection deterministic and easy to audit in evidence.
- Could be small if implemented as a narrow Phase 0 option rather than a general routing engine.

Cons:

- Introduces scenario-aware selection into the runtime path.
- Must avoid drifting into benchmark routing or profile-aware rule routing.
- OpenCode plugin execution would need a clear way to receive or infer the marker.

Chosen for Phase 0:

- #2-3 runner writes `"scenario": "step2-3"` into sandbox `.persona/harness.jsonc`.
- rule-loader keeps `step1` as the default scenario.
- only Controller/DTO/Test API contract rules swap to `backend/step2-3-api-contract.md` for `step2-3`.
- no full glob/frontmatter engine was introduced.

### Candidate C: Requirements Title Or Run Scenario Name

Use the requirements title, for example `# 2단계: 데이터베이스 연동 및 시간 관리`, or the run scenario name as rule-selection context.

Pros:

- Uses existing experiment inputs rather than adding a new concept.
- Keeps the source requirement close to the selected contract.
- Useful for prepare-time analysis and evidence review.

Cons:

- Parsing natural-language titles can become brittle.
- If implemented inside the plugin, it may require reading project files as context and broaden Phase 0.
- If implemented only in the runner, direct manual plugin usage may not get the same behavior.

### Candidate D: Prompt Guardrail First

Do not split rules yet. Keep current rules and add prompt wording that explicitly says #1 contract rules may be stale for #2-3 and the source requirement wins.

Pros:

- Smallest change.
- Avoids touching rule-loader and injection structure.
- Good temporary mitigation while collecting more #2-3 evidence.

Cons:

- Does not fix selected-rules evidence.
- Keeps stale #1 policies in model input, so evidence interpretation remains muddy.
- Relies on prompt strength rather than harness determinism.

## New File Evidence Observation

The #2-3 run generated Service, DTO, schema, and properties files, but evidence did not cover all of them directly.

Observed generated files without direct targetFile evidence:

- `ReservationService.java`
- `ReservationTimeService.java`
- `ReservationCreateRequest.java`
- `ReservationResponse.java`
- `ReservationTimeCreateRequest.java`
- `ReservationTimeResponse.java`
- `schema.sql`
- `application.properties`

Current observations:

- Existing target capture works when a read/edit/write-like tool call exposes a file path argument.
- The run produced evidence for files the model read or later edited directly: Controller, `ReservationApplication`, Repository, and Test.
- New files created inside a broad patch can appear in `diff.patch` without each new path becoming its own targetFile evidence event.
- `write` tool output can carry an injection block only if the hook sees a target file and the after-hook attaches the block to the tool output. A multi-file patch path may not give per-file injection evidence for every added file.
- `experimental.chat.messages.transform` carries the most recent pending injection into model input, but that is not the same as proving every newly generated file had a role-specific block before creation.
- Service, Repository, DTO, and Test Java file roles are mostly classifiable by filename once the path is visible.
- `schema.sql` and `application.properties` are non-Java. Current `resolveFileRole` falls back to `java-common` for unknown names, but `isJavaTargetFile` only accepts `.java`, so non-Java files are outside the current Java target path unless another hook path captures them explicitly.
- New files are inherently weaker evidence before they are read. The model may create them from prompt context and a prior Controller/Test injection rather than from a direct per-file injection block.

MVP interpretation:

- This is acceptable as an observation limit for Phase 0 if the claim remains narrow: "the injection path fired for observed target files."
- It is not enough to claim that every generated Service/DTO/Schema file received direct role-specific injection.

Possible minimal next-loop observations:

- Add an analysis-only summary that compares generated files against evidence target files.
- Record "unobserved generated files" in experiment analysis without changing hook behavior.
- If implementation is later justified, consider minimal target extraction for multi-file patch metadata before changing rule semantics.

## Recommended Next Loop

The implementation recommendation has been completed for Phase 0:

1. `backend/step2-3-api-contract.md` exists.
2. #2-3 runner marks sandbox scenario as `step2-3`.
3. #1 default behavior still selects `backend/step1-api-contract.md`.
4. #2-3 live run evidence now covers Controller/Test/DTO roles.

Next work should be documentation/commit hygiene, not more runner behavior:

1. Keep `experiments/` ignored.
2. Review accumulated changes by commit category.
3. Commit only after explicit user approval.

## Out of Scope

- Further changing evidence schema or hook behavior.
- Adding more step-specific routing beyond the narrow Phase 0 scenario marker.
- Running more OpenCode implementation experiments for this documentation loop.
- Treating generated reservation app quality as the product goal.
- Using detector as a quality gate.
- Guard/AST/linter enforcement.
- profile-aware routing.
- frontend.
- infra or deployment work.
- benchmark routing.
- desktop app.
- OMO core skill copying or adaptation.
- Large rule-engine refactoring.
