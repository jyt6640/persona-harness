# Backend Clean Code Task Fixture Design

## Goal

Define a less saturated Gradle Java/Spring backend fixture for Clean Code uniformity A/B review.

This fixture is not reservation or roomescape. It is intended to check whether the backend baseline helps generated code keep a consistent Controller / Service / Repository / DTO flow under a new but small use case.

## Fixture

Task management for a small personal work board.

Required API:

- `GET /tasks`: list tasks.
- `POST /tasks`: create a task with `title` and optional `description`.
- `PATCH /tasks/{id}/complete`: mark a task complete.
- `DELETE /tasks/{id}`: delete a task.

Response shape:

- Task response includes `id`, `title`, `description`, and `completed`.
- First created task uses id `1`.

Storage:

- The fixture does not force a DB choice.
- In-memory storage is allowed for the generated run.
- Storage state and id sequence should live behind Repository or an explicit persistence boundary, not in Service.

## Sandbox Shape

- Gradle only: `settings.gradle` and `build.gradle`.
- No `pom.xml`.
- Root Spring Boot application class only: `src/main/java/com/example/TaskApplication.java`.
- Initial target file for injection: `src/main/java/com/example/task/TaskController.java`.

## Prompt Boundary

The prompt asks for a Gradle Java/Spring implementation and the task API behavior. It does not prescribe a test framework style and does not require a database.

## Rubric

Use `docs/current/backend-clean-code-uniformity-rubric.md`:

- Gradle only.
- Root package Application class count.
- Controller delegates to Service.
- Service does not own storage state or id sequence.
- Repository boundary exists.
- Request DTO boundary.
- Response DTO boundary.
- Final `gradle test`.

## Non-Goals

- Product-quality certification.
- Test-style judgment.
- DB/JPA/JdbcTemplate/Flyway choice.
- New observer or enforcement gate.
- Frontend/infra/profile-aware expansion.
