# Response DTO Boundary A/B Review

## Goal

After minimally reinforcing the Backend Clean Code baseline, run Gradle Java/Spring Injection ON/OFF A/B pairs and check whether response DTO boundary signal remains differentiated.

## Baseline Change

The reinforcement is intentionally narrow:

- `backend/spring-dto.md` now says Controller/Service response paths should not expose domain entities directly as external responses.
- `backend/spring-service.md` now injects three bullets and states that Service response paths should convert saved results to Response DTOs.
- The experiment prompt was not strengthened with response DTO wording. This keeps OFF runs from receiving the same new guidance through the prompt.

## Runs Compared

| Pair | Run directory | Model |
| --- | --- | --- |
| 1 | `experiments/phase0-runs/2026-06-18T23-54-28-148Z-73202-4qjjfl` | `openai/gpt-5.4-mini-fast` |
| 2 | `experiments/phase0-runs/2026-06-18T23-59-33-320Z-79484-imbcu4` | `openai/gpt-5.4-mini-fast` |

## Summary Matrix

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| Gradle files kept | 2/2 | 2/2 | no differential signal |
| Maven file avoided | 2/2 | 2/2 | no differential signal |
| Service storage/id ownership avoided | 2/2 | 2/2 | no differential signal |
| Repository boundary | 2/2 | 2/2 | no differential signal |
| Request DTO boundary | 2/2 | 2/2 | no differential signal |
| Controller response DTO boundary | 2/2 | 2/2 | no differential signal after reinforcement |
| Service response DTO boundary | 1/2 | 2/2 | no ON-positive signal |
| Final Gradle test success | 2/2 | 2/2 | no differential signal |
| Extra application class in feature package | 1/2 ON | 0/2 OFF | ON-side code-shape noise |

## Result

The earlier response DTO boundary signal did not remain differentiated after reinforcement.

Both OFF runs also produced Response DTO boundaries, and one OFF run had a cleaner Service response DTO path than the matching ON run.

The first ON run kept external Controller responses as DTOs, but Service returned domain `Reservation` and Controller performed conversion. It also generated an extra `ReservationApplication` under the feature package.

The second ON run produced both Controller and Service response DTO boundaries.

## Decision

Response DTO boundary is now a reasonable baseline rule, but this A/B set does not prove that the reinforcement creates a stable ON-positive effect.

Do not claim product-quality improvement from this result.

## Cold Assessment

The practical conclusion changed:

- Before reinforcement: response DTO boundary was the strongest ON-positive signal.
- After reinforcement: response DTO boundary is generally present in both ON and OFF for this fixture.
- The remaining useful observation is stricter Service response DTO placement and package/class shape noise, not the mere existence of a `ReservationResponse`.

## Next Loop

Choose one narrow next target:

1. Clarify Service response DTO ownership so Service public use-case methods return Response DTOs when they are directly used by Controller response paths.
2. Investigate package/class duplication noise, especially extra `ReservationApplication` under feature packages.
3. Stop A/B for this fixture and move to a different backend fixture where the prompt is less saturated.
