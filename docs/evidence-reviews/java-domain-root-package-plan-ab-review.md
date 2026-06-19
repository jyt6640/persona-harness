# Java Domain Root Package Plan A/B Review

## Goal

Run the Library Loans Gradle Java/Spring A/B pair after correcting the package plan to root `global` plus domain-owned internal layers.

Expected target shape:

```text
com.example
├── global
└── library
    ├── application
    ├── domain
    ├── infrastructure
    └── presentation
```

This review is code-shape evidence only. It is not a product-quality gate.

## Run Source

- Run directory: `experiments/phase0-runs/2026-06-19T03-48-03Z-library-domain-root-ab`
- Model: `openai/gpt-5.4-mini-fast`
- Commit under test: `e1a9571 feat(phase0): align Java package plan with domain root`
- ON directory: `sandbox`
- OFF directory: `sandbox-baseline`
- First target: `src/main/java/com/example/library/LibraryApplication.java`
- Execution mode: sequential ON then OFF to avoid OpenCode global database lock.

## Injection Surface

ON evidence for `LibraryApplication.java` and `build.gradle` selected:

- `clean-code/common.md`
- `clean-code/method-design.md`
- `backend/java-common.md`
- `clean-code/abstraction.md`
- `backend/layered-architecture.md`

The Java common rule included the corrected explicit package plan:

- `root/global/exception`
- `root/global/response`
- `root/global/config`
- `root/<domain>/application`
- `root/<domain>/application/dto/command`
- `root/<domain>/application/dto/result`
- `root/<domain>/domain`
- `root/<domain>/infrastructure`
- `root/<domain>/presentation`
- `root/<domain>/presentation/dto/request`
- `root/<domain>/presentation/dto/response`

## Generated Structure

### Injection ON

ON generated:

```text
com.example.library
├── global
│   ├── exception
│   └── response
└── loan
    ├── application
    │   └── dto
    │       ├── command
    │       └── result
    ├── domain
    ├── infrastructure
    └── presentation
        └── dto
            ├── request
            └── response
```

Important files:

- `library/global/exception/GlobalExceptionHandler.java`
- `library/global/response/ApiErrorResponse.java`
- `library/loan/application/BookLoanService.java`
- `library/loan/application/dto/command/AddBookCommand.java`
- `library/loan/application/dto/result/BookResult.java`
- `library/loan/domain/BookRepository.java`
- `library/loan/infrastructure/InMemoryBookRepository.java`
- `library/loan/presentation/dto/request/AddBookRequest.java`
- `library/loan/presentation/dto/response/BookResponse.java`

### Injection OFF

OFF generated:

```text
com.example.library.book
```

with Controller, Service, DTO, domain object, exception handler, and storage state under the same `book` package.

## Comparison

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| OpenCode run | exit `0` | exit `0` | neutral |
| Gradle only | `build.gradle`, `settings.gradle`, no `pom.xml` | `build.gradle`, `settings.gradle`, no `pom.xml` | neutral |
| Independent `gradle test` | pass | pass | neutral |
| HTTP smoke | create/list/loan/return/delete worked | create/list/loan/return/delete worked | neutral |
| Root `global` under `com.example` | missing; generated under `com.example.library.global` | missing | partial |
| Domain package name | `loan`, not `library` | `book` | partial |
| Domain-internal layers | present under `loan` | missing | ON-positive |
| Presentation request/response DTO packages | present | missing | ON-positive |
| Application command/result DTO packages | present | missing | ON-positive |
| Repository interface in domain | present | missing | ON-positive |
| Repository implementation in infrastructure | present | missing | ON-positive |
| Service storage/id ownership | Service delegates to repository | Service owns `Map` and `AtomicLong nextId` | ON-positive |

## HTTP Smoke

Both ON and OFF passed:

- `POST /books`: `201`
- `GET /books`: `200`
- `POST /books/1/loan`: `200`
- `POST /books/1/return`: `200`
- `DELETE /books/1`: `204`

## Decision

The corrected package plan produced a strong ON-positive code-shape signal for domain-internal layers, DTO subpackages, domain repository interface, infrastructure implementation, and Service storage/id boundary.

It did not produce the exact requested root shape. ON placed `global` under `com.example.library.global`, not `com.example.global`, and selected `loan` as the domain package below `library`.

So the current result is:

- useful and materially better than OFF,
- not exact enough for the desired default project structure.

## Limitations

- Single A/B pair for the corrected root/domain package plan.
- The starting fixture already places `LibraryApplication.java` under `com.example.library`, which may bias the model to treat `library` as the root application package rather than the domain package.
- This does not prove product quality.
- This does not cover DB/JPA/Flyway or project intake choices.

## Next Loop

Do not add another observer.

The next useful adjustment is to clarify package root semantics:

- root package means the Spring Boot application package such as `com.example`,
- `global` lives directly under that root package,
- `<domain>` such as `library` lives beside `global`,
- if the existing application class is already under `com.example.library`, do not create `library/loan`; use `library` as the domain package or move the application root in a fixture.

Then run one more A/B only if exact root/domain shape matters before intake design.
