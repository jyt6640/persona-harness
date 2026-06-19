# Backend Clean Code Parallel A/B Review

## Goal

Run multiple Gradle Java/Spring Injection ON/OFF A/B pairs and compare them with the narrow Backend Clean Code uniformity rubric.

## Rubric

Primary comparison surface:

- G1: Gradle only
- S1: Service does not own storage state or id sequence
- R1: storage/id generation stays behind Repository
- D1: request DTO boundary
- D2: response DTO boundary
- C1: Controller delegates to Service
- B1: final `gradle test` success and whether intermediate failure was observed

See `docs/current/backend-clean-code-uniformity-rubric.md`.

## Parallel Execution Finding

Naive parallel execution failed for two reasons:

1. The experiment runner used a timestamp-only run id, so two parallel runs could collide on the same run directory.
2. OpenCode's default global database can lock under concurrent runs.

The runner now adds a process/random suffix to the run id. For actual parallel OpenCode execution, each process also needs an isolated XDG data/cache/state directory seeded from the existing OpenCode data directory. Isolated empty data directories caused `ProviderModelNotFoundError`.

## Runs Compared

| Pair | Run directory | ON | OFF |
| --- | --- | --- | --- |
| 1 | `experiments/phase0-runs/2026-06-18T10-55-43-325Z` | existing ON | existing OFF |
| 2 | `experiments/phase0-runs/2026-06-18T11-15-17-392Z-58513-0cztix` | parallel ON | parallel OFF |
| 3 | `experiments/phase0-runs/2026-06-18T11-15-17-376Z-58484-bmbmmj` | parallel ON | parallel OFF |

The additional parallel ON/OFF pairs used model `openai/gpt-5.4-mini-fast`.

## Summary Matrix

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| Gradle files kept | 3/3 | 3/3 | no differential signal |
| Maven file avoided | 3/3 | 3/3 | no differential signal |
| Service storage/id ownership avoided | 3/3 | 3/3 | no differential signal |
| Storage/id sequence behind Repository | 3/3 | 3/3 | no differential signal |
| Request DTO boundary | 3/3 | 3/3 | no differential signal |
| Response DTO boundary | 3/3 | 1/3 | repeated ON-positive signal |
| Final Gradle test success | 3/3 | 3/3 | no final-state differential signal |
| No intermediate Gradle failure observed | 3/3 | 2/3 | weak ON-positive workflow signal |

## Observed Code-shape Difference

Injection ON repeated the same broad shape across all three pairs:

- `ReservationRequest`
- `ReservationResponse`
- Controller response path returning `ReservationResponse`
- Service response path returning `ReservationResponse`

Injection OFF was mixed:

- Pair 1: request DTO only, response path returned domain `Reservation`.
- Pair 2: request DTO only, response path returned domain `Reservation`; also generated an extra `ReservationApplication` under the reservation package.
- Pair 3: request and response DTO boundaries were present.

## Decision

Parallel A/B analysis is useful, but generation must be isolated.

The current strongest repeated signal is not Gradle-only or Service storage ownership. Those are already clean in ON and OFF because the prompt strongly asks for them.

The strongest repeated ON-positive signal is response DTO/code-shape uniformity.

## Cold Assessment

This is still not product-quality proof. It is a stronger direction signal than the single A/B pair because it repeats across three pairs, but the sample is still small and the fixture prompt is strong.

The next practical target is to turn DTO response boundary and package/class duplication checks into explicit backend Clean Code baseline guidance or a rubric-backed A/B report, not another broad observer.

## Next Loop

Choose one:

1. Reinforce response DTO boundary as a backend Clean Code baseline and run one more A/B set.
2. Keep rules unchanged and run another parallel A/B set to see whether the 3/3 vs 1/3 DTO response signal holds.

## Follow-up

Response DTO boundary was reinforced and rechecked in `docs/evidence-reviews/response-dto-boundary-ab-review.md`.

The follow-up did not preserve the earlier ON-positive differential signal. OFF runs also produced response DTO boundaries, while one ON run still returned domain `Reservation` from Service and converted in Controller.
