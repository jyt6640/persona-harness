# Backend Clean Code Uniformity Rubric

## Goal

Compare Gradle Java/Spring generated runs with a narrow, repeatable rubric.

This rubric is not a product-quality gate. It is a comparison surface for Injection ON/OFF A/B evidence.

## Scope

- Java/Spring step1 Gradle fixture.
- Generated product code shape.
- Final generated project artifacts and observable build/test result.
- No test-style policy judgment.
- No frontend, infra, profile-aware, or philosophy-harness judgment.

## Rubric

| ID | Check | Expected Evidence | Notes |
| --- | --- | --- | --- |
| G1 | Gradle only | `build.gradle` and `settings.gradle` present, `pom.xml` absent | Prompt also asks for this, so this is weak differential evidence. |
| S1 | Service storage ownership | `*Service.java` has no storage field such as `Map`, `List`, `AtomicLong`, `nextId`, `idCounter`, `sequence` | Return type `List<ResponseDto>` is not storage ownership. |
| R1 | Repository boundary | storage state and id generation live behind Repository or explicit persistence boundary | In-memory fixture may use `InMemoryReservationRepository`. |
| D1 | Request DTO boundary | external request body uses a DTO/record/class instead of raw map or controller primitives | Name does not need to match the reference exactly. |
| D2 | Response DTO boundary | Controller/Service response path returns response DTO rather than exposing domain entity directly | This is a code-shape uniformity signal, not proof of correctness. |
| C1 | Controller role | Controller delegates use-case work to Service and does not own Repository/storage state directly | Existing controller observers cover stricter report-only checks. |
| B1 | Final Gradle verification | generated agent reaches successful `gradle test` | Intermediate failure followed by fix is weaker than first-pass success. |

## Scoring

Use a small comparison score, not a pass/fail gate:

- `present`: evidence clearly appears.
- `partial`: final state is usable but weaker or mixed.
- `missing`: expected evidence is absent.
- `unknown`: file or log evidence is unavailable.

For A/B comparison, prefer repeated directional signals over one-off wins.

## Limitations

- String and file-shape based review.
- Small sample A/B evidence.
- Same prompt can create behavior in both ON and OFF, so not every green cell is an injection effect.
- This does not judge product quality, maintainability in the large, or user-specific backend philosophy fit.

## Current Use

Use this rubric for the next parallel Gradle A/B runs.

The expected useful signal is not whether both runs compile. The useful signal is whether Injection ON repeatedly produces a more uniform code shape, especially around Controller/Service DTO response boundaries and first-pass verification behavior.
