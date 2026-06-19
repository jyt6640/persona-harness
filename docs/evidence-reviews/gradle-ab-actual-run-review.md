# Gradle A/B Actual Run Review

## Goal

Run one Injection ON/OFF actual generated pair on the same Gradle Java/Spring step1 fixture and check whether Persona Harness changes generated-code evidence around Gradle usage, Maven avoidance, and Service storage ownership.

## Run Source

- Model: `openai/gpt-5.4-mini-fast`
- Run directory: `experiments/phase0-runs/2026-06-18T10-55-43-325Z`
- Injection ON sandbox: `experiments/phase0-runs/2026-06-18T10-55-43-325Z/sandbox`
- Injection OFF sandbox: `experiments/phase0-runs/2026-06-18T10-55-43-325Z/sandbox-baseline`
- Ignored review report: `experiments/phase0-runs/2026-06-18T10-55-43-325Z/gradle-ab-review.md`

## Injection ON

- OpenCode run completed with exit code `0`.
- `gradle test` completed with `BUILD SUCCESSFUL`.
- Root build files: `build.gradle`, `settings.gradle`.
- `pom.xml`: absent.
- `ReservationService` depends on `ReservationRepository` and does not own `Map`, `List`, `AtomicLong`, `nextId`, `idCounter`, or `sequence` as storage state.
- Storage state and id sequence exist behind `InMemoryReservationRepository`.
- Request and response DTOs are separated as `ReservationRequest` and `ReservationResponse`.

## Injection OFF

- OpenCode run completed with exit code `0`.
- The first `gradle test` attempt failed because of a test JSON path issue, then the model fixed it and reran `gradle test` successfully.
- Root build files: `build.gradle`, `settings.gradle`.
- `pom.xml`: absent.
- `ReservationService` depends on `ReservationRepository` and does not own `Map`, `List`, `AtomicLong`, `nextId`, `idCounter`, or `sequence` as storage state.
- Storage state and id sequence exist behind `InMemoryReservationRepository`.
- The controller/service path returns domain `Reservation` for responses and only has a request DTO.

## Comparison

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| Gradle files kept | yes | yes | no differential signal |
| Maven file avoided | yes | yes | no differential signal |
| Final Gradle tests pass | yes | yes, after one failed attempt and fix | weak positive ON workflow signal |
| Service storage/id ownership avoided | yes | yes | no differential signal |
| Storage/id sequence behind repository | yes | yes | no differential signal |
| Request/response DTO separation | yes | partial | weak positive ON code-shape signal |

## Decision

This A/B pair gives a useful but mixed signal.

The reinforced baseline did not produce a strong differential result for Gradle-only or Service storage ownership because the OFF run also avoided Maven and kept storage state out of Service.

The ON run did show a cleaner DTO boundary and reached a successful Gradle test without the intermediate test failure seen in OFF, but one pair is not enough to claim product-quality improvement.

## Limitations

- Single A/B pair.
- Same prompt already strongly requested Gradle, so Gradle-only behavior may not distinguish injection from prompt pressure.
- This is generated-code evidence, not a product-quality guarantee.
- Service storage ownership was clean in both runs, so it is not proof that the rule caused the behavior.

## Next Loop

Do not add another observer by default. The next useful loop is either:

- run one more Gradle A/B pair with the same model to see whether DTO/code-shape uniformity repeats, or
- define a narrow backend code-shape rubric for Clean Code uniformity before running more A/B comparisons.

## Follow-up

The follow-up parallel A/B review is recorded in `docs/evidence-reviews/backend-clean-code-parallel-ab-review.md`.

Across three A/B pairs, Gradle-only and Service storage ownership stayed clean in both ON and OFF. The repeated ON-positive signal moved to response DTO/code-shape uniformity.
