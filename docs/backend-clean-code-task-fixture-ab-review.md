# Backend Clean Code Task Fixture A/B Review

## Goal

Define one new Gradle Java/Spring backend fixture outside the reservation/roomescape domain and compare Injection ON/OFF with the Clean Code uniformity rubric.

## Fixture

- Domain: personal task management.
- APIs:
  - `GET /tasks`
  - `POST /tasks`
  - `PATCH /tasks/{id}/complete`
  - `DELETE /tasks/{id}`
- Storage: DB choice not forced; in-memory allowed.
- Test style: not judged.
- Build: Gradle only.

Fixture design is recorded in `docs/backend-clean-code-task-fixture-design.md`.

## Runs

Primary service-first run:

- Run: `experiments/phase0-runs/2026-06-19T00-37-19-269Z-68875-mxhhug-task-service-fixture`
- Model: `openai/gpt-5.4-mini-fast`
- ON target: `sandbox`
- OFF target: `sandbox-baseline`
- First ON target file: `src/main/java/com/example/task/TaskService.java`
- ON elapsed: `285707 ms`
- OFF elapsed: `162221 ms`

Secondary controller-first run:

- Run: `experiments/phase0-runs/2026-06-19T00-30-03-256Z-51809-tbc7vk-task-fixture`
- This run is treated as secondary because the current `step1` scenario selected `backend/step1-api-contract.md`, which is reservation-specific and contaminated the Task fixture with `/reservations` status-policy guidance.

## Injection Evidence

Primary ON evidence selected Service-centered rules:

- `clean-code/common.md`
- `clean-code/method-design.md`
- `backend/java-common.md`
- `backend/spring-service.md`
- `backend/validation-exception.md`

The primary run did not inject the reservation-specific `backend/step1-api-contract.md` in the first Service evidence.

## Rubric Comparison

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| Gradle only | present | present | no differential signal |
| Root package application class | present, one `TaskApplication.java` | present, one `TaskApplication.java` | no differential signal |
| Maven avoided | present | present | no differential signal |
| Layer/package shape | explicit `web/application/domain/infrastructure` packages | flatter `task` package with `dto` and `repository` subpackages | weak ON-positive code-shape signal |
| Controller delegates to Service | present | present | no differential signal |
| Service storage/id ownership avoided | present | present | no differential signal |
| Repository boundary | present; domain `TaskRepository`, infra `InMemoryTaskRepository` | present; repository package interface and implementation | no differential signal, ON is more layered |
| Request DTO boundary | present as `TaskRequest`, mapped to `CreateTaskCommand` | present as `TaskCreateRequest` | no differential signal |
| Response DTO boundary | present as web `TaskResponse`; Service returns application `TaskView`, not domain entity | present as DTO `TaskResponse`; Service returns DTO | both avoid external domain exposure |
| Final `gradle test --quiet` | pass | pass | no final-state differential signal |

## Observed Difference

Injection ON produced a more explicit Clean Code layering:

- `com.example.task.web`
- `com.example.task.application`
- `com.example.task.domain`
- `com.example.task.infrastructure`

Injection OFF produced a simpler but still acceptable structure:

- `com.example.task`
- `com.example.task.dto`
- `com.example.task.repository`

Both kept storage state and id sequence behind repository implementations. Neither put `Map`, `List`, `AtomicLong`, `nextId`, `idCounter`, or `sequence` state into `TaskService`.

## Decision

This new fixture gives a weak ON-positive signal for package/layer uniformity, not for final correctness. Both ON and OFF passed Gradle tests and satisfied the core Controller/Service/Repository/DTO boundary.

Do not claim product-quality improvement from one pair. The useful evidence is narrower:

- The less saturated Task fixture can expose code-shape differences.
- Current generic fixture runs can be contaminated by scenario-specific API contract rules when the first target is a Controller.
- A future generic backend fixture path should avoid reservation-specific API contract injection.

## Limitations

- Single primary A/B pair.
- String/file-shape review, not AST or linter.
- Test style intentionally not evaluated.
- DB choice intentionally not evaluated.
- The current harness still has a scenario-specific contract rule problem for non-reservation Controller targets.

## Next Loop

Choose one:

1. Add a generic/no-contract scenario or fixture mode so non-reservation backend A/B runs do not inject reservation-specific `step1` contract rules.
2. Run one more less-saturated backend fixture to see whether explicit layering repeats.
3. Move to intake/planning surface design for project scale and stack choices.
