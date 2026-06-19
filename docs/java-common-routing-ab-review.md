# Java Common Routing A/B Review

## Goal

Re-run the non-leading Gradle Java/Spring library fixture after the Phase 0 Java common routing change and check whether backend package architecture guidance appears in the actual injection surface and generated code.

This is an A/B evidence review, not a product-quality gate.

## Run Source

- Run directory: `experiments/phase0-runs/2026-06-19T03-03-05Z-library-routing-ab`
- Model: `openai/gpt-5.4-mini-fast`
- Commit under test: `0f092d8 feat(phase0): surface Java architecture for common targets`
- ON directory: `sandbox`
- OFF directory: `sandbox-baseline`
- First target: `src/main/java/com/example/library/LibraryApplication.java`
- Fixture: non-reservation Library Loans Gradle Java/Spring fixture.

## Injection Surface

The ON run recorded Java common evidence for both `LibraryApplication.java` and `build.gradle`.

Observed selected rules for those Java common targets:

- `clean-code/common.md`
- `clean-code/method-design.md`
- `backend/java-common.md`
- `clean-code/abstraction.md`
- `backend/layered-architecture.md`

This confirms the routing change reached the intended actual generated run surface.

## Comparison

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| OpenCode run | exit `0` | exit `0` | neutral |
| Gradle only | `build.gradle`, `settings.gradle`, no `pom.xml` | `build.gradle`, `settings.gradle`, no `pom.xml` | neutral |
| Independent `gradle test` | pass | pass | neutral |
| HTTP smoke | POST/list/loan/return/delete all worked | POST/list/loan/return/delete all worked | neutral |
| Explicit `presentation/application/domain/infrastructure` package names | missing | missing | no ON-positive package-name effect |
| Coarser package separation | `book` + `web` | flat `com.example.library` | ON-positive |
| Repository boundary | `BookRepository` + `InMemoryBookRepository` | missing | ON-positive |
| Service storage/id ownership | `BookService` delegates storage/id to repository | `LibraryService` owns `Map<Long, Book>` and `AtomicLong nextId` | ON-positive |
| DTO boundary | `CreateBookRequest`, `LoanBookRequest`, `BookResponse` under `web` | request/response DTOs exist in root package | weak ON-positive package organization |

## HTTP Smoke

Both ON and OFF passed the same manual HTTP flow against a running Spring Boot process:

- `POST /books`: `201`
- `GET /books`: `200`
- `POST /books/1/loan`: `200`
- `POST /books/1/return`: `200`
- `DELETE /books/1`: `204`

## Decision

The routing fix is real at the injection/evidence level and the generated ON output improved on repository boundary and Service-owned storage/id state compared with OFF.

However, the explicit four-layer package names still did not appear. ON produced `book` and `web`, not `presentation/application/domain/infrastructure`.

Treat this as a partial ON-positive signal:

- positive for Java common injection surface,
- positive for Service storage/id boundary in this run,
- not yet positive for exact four-layer package naming.

## Limitations

- Single A/B pair.
- String and file-shape review only.
- Same prompt still tells the model to keep the implementation understandable, so some Clean Code behavior can appear without injection.
- The review does not certify product quality.
- The explicit package-name target may require a stronger injection surface than current rule selection, or a less subtle prompt/skill surface, but that should be decided in a separate loop.

## Next Loop

Decide whether to:

1. strengthen the Java common injection wording for exact package names, or
2. accept coarser `web`/domain package separation as enough for now and move to the project intake/planning surface.

The current evidence favors a narrow decision loop before another A/B run.
