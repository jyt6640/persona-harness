# Backend Clean Code Uniformity Rubric

## Goal

Compare Gradle Java/Spring generated runs with a narrow, repeatable product-code-flow rubric.

This rubric is not a product-quality gate. It is a comparison surface for Injection ON/OFF A/B evidence.

The primary question is not whether a generated project uses the exact same package names as the reference answer. The primary question is whether the generated product code follows the same clean backend flow:

```text
HTTP boundary -> Application use case -> Domain rule -> Repository boundary -> Infrastructure implementation
```

## Scope

- Java/Spring Gradle fixture.
- Generated product code shape.
- Final generated project artifacts and observable build/test result.
- No test-style policy judgment.
- No frontend, infra, profile-aware, or philosophy-harness judgment.
- No exact package-name certification.

## Rubric

| ID | Check | Expected Evidence | Notes |
| --- | --- | --- | --- |
| G1 | Gradle only | `build.gradle` and `settings.gradle` present, `pom.xml` absent | Prompt also asks for this, so this is weak differential evidence. |
| G2 | Single Application class | exactly one Spring Boot `*Application.java` class under the root application package; no feature/domain `*Application.java` duplicates | Root package naming can vary by fixture. |
| C1 | Controller role | Controller handles HTTP request/response mapping, status codes, DTO conversion, and delegates use-case work to Service | Controller should not own Repository, storage state, id sequence, transaction policy, or persistence details. |
| S1 | Application Service role | `*Service.java` coordinates one use-case flow and collaborator calls | Service should not become storage, HTTP adapter, or domain entity. |
| S2 | Service storage/id ownership | `*Service.java` has no storage field such as `Map`, `List`, `AtomicLong`, `nextId`, `idCounter`, `sequence` | Return type `List<ResponseDto>` is not storage ownership. |
| DO1 | Domain independence | Domain types do not depend on Spring, HTTP, DB, JDBC/JPA annotations, or infrastructure implementation details | Domain can be used by Application and Infrastructure, but should not know them. |
| R1 | Repository boundary | Repository interface or equivalent persistence boundary is separate from Controller/Service flow | Interface naming can vary, but storage operations should be behind a boundary. |
| R2 | Repository implementation boundary | storage state and id generation live in Repository/Store/Infrastructure implementation, not Controller or Application Service | In-memory fixtures may use `InMemoryBookRepository`; DB fixtures may use JDBC/JPA implementations. |
| D1 | Request DTO boundary | external request body uses a DTO/record/class instead of raw map or controller primitives | Name does not need to match the reference exactly. |
| D2 | Response DTO boundary | external response path returns response DTO rather than exposing domain entity directly | This is a code-shape uniformity signal, not proof of correctness. |
| D3 | Application command/result boundary | when HTTP DTOs and use-case inputs/outputs differ, Controller maps Request DTOs to Command/Query and Service returns Result/Response-oriented data | `Command`/`Result` exact names are helpful but not mandatory if the boundary is clear. |
| P1 | Package flow shape | generated code has a recognizable `global` plus domain-internal presentation/application/domain/infrastructure or equivalent layer grouping | Exact package-name match is secondary evidence only. |
| B1 | Final Gradle verification | generated agent reaches successful `gradle test` | Intermediate failure followed by fix is weaker than first-pass success. |

## Primary Signals

Prefer these signals when comparing Injection ON/OFF:

1. Controller remains an adapter and delegates to Service.
2. Application Service remains orchestration-only and does not own storage state or id generation.
3. Domain stays independent from Spring/HTTP/DB/infrastructure details.
4. Repository boundary owns persistence/storage details.
5. DTO boundaries separate external HTTP contracts from domain objects and, when needed, use-case command/result data.

## Secondary Signals

Treat these as supporting evidence, not the main conclusion:

- exact package names such as `presentation`, `application`, `domain`, `infrastructure`,
- exact package depth such as `com.example.global` vs `com.example.library.global`,
- exact DTO suffixes such as `Command` and `Result`,
- exact error/response helper package names.

If the product-code flow is clean but package names differ, record `partial` rather than `missing`.

If exact package names match but Controller/Service/Domain/Repository responsibilities are mixed, record the flow checks as `missing` or `partial`.

## Scoring

Use a small comparison score, not a pass/fail gate:

- `present`: evidence clearly appears.
- `partial`: final state is usable but weaker or mixed.
- `missing`: expected evidence is absent.
- `unknown`: file or log evidence is unavailable.

For A/B comparison, prefer repeated directional signals over one-off wins.

## Stopping Rule

Use `docs/injection-value-stopping-rule.md` before starting more A/B loops.

The short form:

- compare 3 comparable Gradle Java/Spring A/B pairs,
- count only pairs regraded with this product-code-flow rubric,
- continue Java MVP productization only if Injection ON is positive in at least 2 of 3 pairs,
- freeze scope expansion if ON is neutral, mixed, or worse in 2 of 3 pairs,
- run one replacement pair only when the evidence is not comparable or cannot be inspected.

Without this stopping rule, this rubric is only a scoring sheet and does not close the direction question.

## Current Regraded Evidence

- `docs/java-product-code-flow-ab-regrade.md`: Library Loans root semantics A/B is ON-positive for product-code flow.
- `docs/inventory-product-code-flow-ab-review.md`: Inventory Stock A/B is ON-positive for product-code flow, with a noted ON service HTTP exception leak.

Current fixed-window count: 2 comparable regraded pairs, ON-positive 2/2.

## A/B Reading Order

When reviewing a generated run, read evidence in this order:

1. build files: Gradle-only and Maven absence,
2. Application class count and package placement,
3. Controller dependencies and method bodies,
4. Service fields, collaborators, and public methods,
5. Domain imports/annotations/dependencies,
6. Repository interface and implementation placement,
7. Request/response DTO and command/result boundaries,
8. package shape as secondary support,
9. final `gradle test` status.

## Limitations

- String and file-shape based review.
- Small sample A/B evidence.
- Same prompt can create behavior in both ON and OFF, so not every green cell is an injection effect.
- This does not judge product quality, maintainability in the large, or user-specific backend philosophy fit.
- This does not certify test quality.
- This does not require AST/linter/enforcement gates.

## Current Use

Use this rubric for the next Gradle Java/Spring A/B reviews.

The expected useful signal is not whether both runs compile or whether package names match exactly. The useful signal is whether Injection ON repeatedly produces cleaner product-code flow across Controller, Application Service, Domain, Repository, DTO, and final Gradle verification evidence.
