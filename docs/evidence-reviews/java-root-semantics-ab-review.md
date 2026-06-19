# Java Root Semantics A/B Review

## Goal

Re-run the Library Loans Gradle Java/Spring A/B pair after clarifying Java package root semantics and check whether the generated code follows the desired package shape.

Expected user-facing target shape:

```text
com.example
├── global
├── library
│   ├── application
│   ├── domain
│   ├── infrastructure
│   └── presentation
└── LibraryApplication.java
```

This is code-shape evidence only. It is not a product-quality gate.

## Run Source

- Run directory: `experiments/phase0-runs/2026-06-19T04-01-00Z-library-root-semantics-ab`
- Model: `openai/gpt-5.4-mini-fast`
- Commit under test: local working tree after Java root-semantics rule clarification
- ON directory: `sandbox`
- OFF directory: `sandbox-baseline`
- First target: `src/main/java/com/example/library/LibraryApplication.java`
- Execution mode: sequential ON then OFF.

## Injection Surface

ON evidence for `LibraryApplication.java` selected:

- `clean-code/common.md`
- `clean-code/method-design.md`
- `backend/java-common.md`
- `clean-code/abstraction.md`
- `backend/layered-architecture.md`

The Java common rule now surfaces:

- root package is where the Spring Boot Application class is located,
- `global` lives directly below the root package,
- domain packages live at the same depth as `global`,
- when the existing Application class is `com.example.library`, treat `library` as the domain package and do not create an additional `library/loan` domain package.

## Generated Structure

### Injection ON

ON generated:

```text
com.example.library
├── application
│   └── dto
│       ├── command
│       └── result
├── domain
├── global
│   └── exception
├── infrastructure
└── presentation
    └── dto
        ├── request
        └── response
```

Important files:

- `library/application/BookService.java`
- `library/application/dto/command/CreateBookCommand.java`
- `library/application/dto/result/BookResult.java`
- `library/domain/BookRepository.java`
- `library/infrastructure/InMemoryBookRepository.java`
- `library/presentation/BookController.java`
- `library/presentation/dto/request/CreateBookRequest.java`
- `library/presentation/dto/response/BookResponse.java`
- `library/global/exception/GlobalExceptionHandler.java`

### Injection OFF

OFF generated:

```text
com.example.library
├── book
└── common
```

with Controller, Service, DTOs, domain object, Repository, and Repository implementation mostly under the same `book` package.

## Comparison

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| OpenCode run | exit `0` | exit `0` | neutral |
| Gradle only | `build.gradle`, `settings.gradle`, no `pom.xml` | `build.gradle`, `settings.gradle`, no `pom.xml` | neutral |
| Independent `gradle test` | pass | pass | neutral |
| No nested `library/loan` package | yes | yes | ON fixed the previous ON drift, but OFF also avoided it |
| Domain-internal layers | present under `library` | missing | ON-positive |
| Presentation request/response DTO packages | present | missing | ON-positive |
| Application command/result DTO packages | present | missing | ON-positive |
| Repository interface in domain | present | missing | ON-positive |
| Repository implementation in infrastructure | present | same feature package | ON-positive |
| Service storage/id ownership | Service delegates to repository | Service delegates to repository | neutral |
| Root `global` beside `library` under `com.example` | missing; generated under `com.example.library.global` | missing; generated under `com.example.library.common` | still missing |
| Root Application class directly under `com.example` | missing; fixture started at `com.example.library.LibraryApplication` and stayed there | missing | still missing |

## Decision

The clarification improved the important package drift from the previous ON run: Injection ON no longer created `library/loan`. It produced the clean domain-internal package set directly under `library`.

It still did not produce the exact user-facing sibling shape with `com.example.global` and `com.example.library`. The current fixture starts with `LibraryApplication.java` in `com.example.library`, and the rule says the root package is where the Application class is located. The model therefore treated `com.example.library` as the root package.

So the result is:

- stronger ON-positive evidence for domain-internal layered package uniformity,
- no proof that the harness will move an existing Application class up to `com.example`,
- exact `com.example/global` sibling shape still unvalidated.

## Limitations

- Single A/B pair after the root-semantics wording change.
- The fixture itself biases the model by placing `LibraryApplication.java` under `com.example.library`.
- This does not prove product quality.
- This does not evaluate DB/JPA/Flyway or project intake choices.

## Next Loop

If exact sibling shape matters, stop using `src/main/java/com/example/library/LibraryApplication.java` as the starting fixture.

Use a fixture with:

- `src/main/java/com/example/LibraryApplication.java`
- domain package target `com.example.library`
- expected common package `com.example.global`

Then run one more A/B. Do not add another observer for this.

