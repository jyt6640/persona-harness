# Java Product-Code Flow A/B Regrade

## Goal

Regrade the existing Library Loans A/B using the backend product-code-flow rubric instead of exact package-name matching.

This review asks whether Injection ON produced a clearer Clean Code flow. It does not claim product quality, test quality, or general model improvement.

## Report Source

- Run: `experiments/phase0-runs/2026-06-19T04-01-00Z-library-root-semantics-ab`
- Model: `openai/gpt-5.4-mini-fast`
- ON output: `sandbox/`
- OFF output: `sandbox-baseline/`

Both ON and OFF completed generation and `gradle test` with status `0`.

## Product-Code Flow Rubric

| Signal | ON | OFF | Reading |
| --- | --- | --- | --- |
| Gradle only | Present | Present | Neutral |
| Single root Application class | Present | Present | Neutral |
| Controller delegates to Service | Present | Present | Neutral |
| Application Service orchestration | Strong | Present | ON clearer |
| Service-owned storage/id sequence absent | Present | Present | Neutral |
| Domain behavior separated from HTTP/persistence | Present, but imports global exceptions | Present | Slight ON-positive for placement, not purity |
| Repository interface boundary | Domain `BookRepository` | Feature-package `BookRepository` | ON clearer |
| Repository implementation boundary | `infrastructure/InMemoryBookRepository` | feature-package `InMemoryBookRepository` | ON clearer |
| Request DTO boundary | `presentation/dto/request` | feature-package request records | ON clearer |
| Response DTO boundary | `presentation/dto/response` | feature-package response record | ON clearer |
| Application command/result boundary | Present | Missing | ON-positive |
| Package flow shape | `application/domain/infrastructure/presentation` | flatter `book` + `common` | ON-positive |
| Final Gradle verification | Passed | Passed | Neutral |

## Finding

Injection ON is product-code-flow positive in this run.

The strongest ON signals are:

- explicit Application command/result DTOs,
- domain repository interface separated from infrastructure implementation,
- presentation request/response DTO packages,
- a visible `presentation -> application -> domain -> infrastructure` code-reading path.

The neutral signals are also important:

- both sides stayed Gradle-only,
- both avoided Maven,
- both had one Application class,
- both kept storage state/id sequence out of Application Service,
- both passed final Gradle verification.

## Not A Proof

This is not a product-quality proof. OFF was still a coherent small Spring app, and several core signals were neutral.

The useful conclusion is narrower:

> For this Library Loans fixture, Injection ON produced a more uniform product-code flow than OFF, mostly around boundary naming and DTO/use-case separation.

## Limitations

- Single A/B pair.
- Existing run was originally designed around package-root semantics.
- In-memory repository was allowed by the fixture, so persistence technology quality is not evaluated.
- Domain purity is not fully proven because both sides use local exception styles and neither was checked by AST/linter.

## Next Use

Use this rubric for the next Java Gradle A/B before adding more observers or widening shared-skill scope.
