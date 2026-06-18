# Phase 0 Step 2 Scope

Date: 2026-06-17

## Status

READY / LIVE EVIDENCE SECURED

The user provided a concrete `# 2단계: 데이터베이스 연동 및 시간 관리` requirement. It is specific enough to start a Phase 0 #2 Java/Spring backend experiment, as long as the next loop only uses the explicit API, schema, configuration, and completion-test contracts below.

READY originally meant the #2 scope could be turned into an experiment prompt. Since then, #2-3 prepare and implementation runs have been executed as fixture experiments.

This is not a product roadmap for a room-escape reservation app. It is a higher-complexity Java/Spring fixture for observing whether Persona Harness keeps role-specific rule injection stable when JDBC, schema, and time-linking concerns appear.

Current evidence:

- `experiments/phase0-runs/2026-06-18T00-16-01-731Z`: scenario-aware contract selection removed `backend/step1-api-contract.md` from #2-3 Controller evidence and selected `backend/step2-3-api-contract.md`.
- `experiments/phase0-runs/2026-06-18T00-34-47-590Z`: Controller, Test, Request DTO, and Response DTO were captured as live target files. All relevant roles selected `backend/step2-3-api-contract.md`; `backend/step1-api-contract.md` selected count was 0.

This evidence was secured by explicitly prompting the model to `glob` and `read` Controller/Test/DTO files after implementation. It is sufficient for MVP injection-path observation, but it is not proof that future models naturally inspect every role file and it is not product-quality validation.

## Source Requirement

Source: user-provided requirement in the current conversation on 2026-06-17.

Title:

```md
# 2단계: 데이터베이스 연동 및 시간 관리
```

Relevant original scope:

- Convert reservation CRUD from in-memory storage to H2 database persistence.
- Add time management so an admin can select managed time slots instead of typing reservation time text.
- Connect reservations to managed times.
- Add `spring-boot-starter-jdbc` and `h2`.
- Enable H2 console at `/h2-console`.
- Set datasource URL to `jdbc:h2:mem:database`.
- Create `reservation_time` and `reservation` tables.
- Use `JdbcTemplate` for reservation CRUD.
- Remove the existing `List<Reservation>` and `AtomicLong`.
- Change reservation request body from `time` to `timeId`.
- Change reservation response `time` to an object with `id` and `startAt`.

## API Contract

Only contracts explicitly present in the source requirement are fixed.

| Method | Path | Request Body | Response Body | Status |
| --- | --- | --- | --- | --- |
| `GET` | `/reservations` | none specified | reservation list. Reservation `time` is an object with `id`, `startAt`. | `200 OK` |
| `POST` | `/reservations` | `name`, `date`, `timeId` | includes the DB-generated reservation `id`. Other response fields are not fully specified. | `200 OK` |
| `DELETE` | `/reservations/{id}` | path variable `id` | not specified | `200 OK` |
| `POST` | `/times` | `startAt` | not specified | `200 OK` |
| `GET` | `/times` | none specified | time list. Exact item fields are not stated in the API section; table/object requirements define `id`, `startAt`. | `200 OK` |
| `DELETE` | `/times/{id}` | path variable `id` | not specified | `200 OK` |

Schema/configuration contract:

- `build.gradle` includes `spring-boot-starter-jdbc` and `h2`.
- H2 console is enabled.
- H2 console path is `/h2-console`.
- datasource URL is `jdbc:h2:mem:database`.
- `reservation_time` table fields: `id`, `start_at`.
- `reservation_time.id` is auto-increment primary key.
- `reservation_time.start_at` is required.
- `reservation` table fields: `id`, `name`, `date`, `time_id`.
- `reservation.id` is auto-increment primary key.
- `reservation.name` and `reservation.date` are required.
- `reservation.time_id` references `reservation_time.id`.

## State Transition

The #1 reservation CRUD contract is preserved as an external API shape, but its storage and time representation change in #2.

- Reservation state moves from in-memory `List<Reservation>` plus `AtomicLong` to H2 tables accessed through `JdbcTemplate`.
- Directly inserted reservation rows must be visible through `GET /reservations`.
- `GET /reservations` returns `200 OK`.
- The reservation list size returned by the API must equal the DB `reservation` row count.
- `POST /reservations` with `name`, `date`, `timeId` creates one reservation row.
- After reservation creation, DB `reservation` row count is `1`.
- `DELETE /reservations/1` deletes reservation id `1`.
- After reservation deletion, DB `reservation` row count is `0`.
- `POST /times` with `startAt` creates one time.
- `GET /times` returns `200 OK`.
- After time creation, the time list size is `1`.
- `DELETE /times/1` deletes time id `1` and returns `200 OK`.
- Reservation creation links `reservation.time_id` to `reservation_time.id`.
- Reservation response `time` changes from a string to an object with `id`, `startAt`.

## Test Contract

The next experiment should require tests for the following source-stated conditions.

- `JdbcTemplate` can obtain a `DataSource connection`.
- The connection is not null.
- DB catalog is `DATABASE`.
- `RESERVATION` table exists.
- Test setup can insert reservation data directly into the DB.
- `GET /reservations` returns `200 OK`.
- Reservation API list size equals DB `reservation` row count.
- `POST /reservations` returns `200 OK`.
- `POST /reservations` request body uses `name`, `date`, `timeId`.
- After reservation creation, DB `reservation` row count is `1`.
- Reservation list size is `1`.
- `DELETE /reservations/1` returns `200 OK`.
- After reservation deletion, DB `reservation` row count is `0`.
- `POST /times` returns `200 OK`.
- `GET /times` returns `200 OK`.
- After time creation, time list size is `1`.
- `DELETE /times/1` returns `200 OK`.

Test boundaries inherited from Phase 0 #1:

- Tests must pin the requirement status codes, not Spring/REST defaults.
- Tests should verify externally visible HTTP behavior and DB state, not private implementation details.
- Test setup must be explicit about DB cleanup between tests.

## Backend Scope

Java/Spring backend fixture scope for Phase 0 #2-3:

- Keep the Phase 0 #1 reservation endpoints, but switch persistence from in-memory state to H2/JdbcTemplate.
- Add time-management endpoints for creating, listing, and deleting reservation times.
- Add `reservation_time` and `reservation` table schema.
- Replace reservation request `time` with `timeId`.
- Represent reservation response `time` as a `ReservationTime` object with `id`, `startAt`.
- Remove `List<Reservation>` and `AtomicLong` from the implementation.
- Keep Controller/Service/Repository role separation.
- Controller handles HTTP request/response conversion and delegates to Service.
- Service coordinates reservation/time use cases and does not own JDBC details or storage state.
- Repository owns SQL/JdbcTemplate access.
- DTOs express API input/output contracts only.

This scope is used to observe the rule-injection path. Generated Spring app quality may be reviewed as evidence, but it is not the MVP product goal.

## Out of Scope

- Treating the reservation app as the product goal.
- Treating completed #2-3 fixture runs as product-quality certification.
- Adding more #2-3 product behavior beyond the source requirement.
- Guessing response bodies not stated in the source requirement.
- Guessing validation or failure cases not stated in the source requirement.
- Changing Phase 0 #1 closure evidence.
- profile-aware routing.
- frontend.
- deployment or production infra beyond the source-stated local H2/Spring configuration.
- benchmark routing.
- desktop app.
- OMO core skill copying or adaptation.
- large rule engine refactoring.
- injection structure changes.
- detector expansion before a #2 run exposes a concrete need.
- Guard/AST/linter enforcement.

## Open Questions

The source requirement is enough to start a #2 experiment, but these details are not explicit and should not be invented in the prompt or tests:

- Exact response body for `POST /reservations` beyond including the DB-generated `id`.
- Whether `POST /reservations` response must include `name`, `date`, `time`, or `timeId`.
- Exact response body for `POST /times`.
- Exact response body for `DELETE /reservations/{id}` and `DELETE /times/{id}`.
- Whether `GET /times` items must be asserted as `id`, `startAt`, or only list size.
- Behavior when `timeId` does not exist.
- Behavior when deleting a time that is referenced by a reservation.
- Validation responses for missing `name`, `date`, `timeId`, or `startAt`.
- Whether `reservation_time` table existence must be tested directly; the completion tests only explicitly mention `RESERVATION` table existence.
- The requirement says H2 solves restart data loss, but also requires `jdbc:h2:mem:database`, which is in-memory. The experiment must follow the specified URL, but this is a product-level inconsistency to note.

## Next Action

In the next loop:

1. Reflect the #2-3 live evidence in README/report docs.
2. Review the accumulated worktree by commit category.
3. Keep `experiments/` ignored.
4. Commit only after explicit user approval.
