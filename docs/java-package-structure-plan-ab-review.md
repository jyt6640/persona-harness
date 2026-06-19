# Java Package Structure Plan A/B Review

## Goal

Run the same non-leading Library Loans Gradle Java/Spring A/B pair after adding the package structure planning surface, and check whether Injection ON produces the exact backend package shape.

This is A/B evidence for code-shape uniformity. It is not a product-quality gate.

## Run Source

- Run directory: `experiments/phase0-runs/2026-06-19T03-28-43Z-library-package-plan-ab`
- Model: `openai/gpt-5.4-mini-fast`
- Commit under test: `5eff68b feat(phase0): surface Java package planning`
- ON directory: `sandbox`
- OFF directory: `sandbox-baseline`
- First target: `src/main/java/com/example/library/LibraryApplication.java`
- Fixture: non-reservation Library Loans Gradle Java/Spring fixture.

## Injection Surface

ON evidence for `LibraryApplication.java`, `build.gradle`, and `settings.gradle` selected:

- `clean-code/common.md`
- `clean-code/method-design.md`
- `backend/java-common.md`
- `clean-code/abstraction.md`
- `backend/layered-architecture.md`

The `backend/java-common.md` surface included the new package planning guidance:

```text
구현 전에 package structure plan을 먼저 작성하고, 기본 후보는 presentation/application/domain/infrastructure 패키지로 역할 경계를 잡는다.
```

## Package Plan Signal

The ON stdout did not literally print `package structure plan`.

It did, however, describe the implementation shape before coding:

```text
I’ve got the shape of the change: a small layered HTTP app with in-memory persistence, validation, and a single integration test suite.
```

That planning signal was followed by the exact package shape in generated files.

## Comparison

| Check | Injection ON | Injection OFF | Signal |
| --- | --- | --- | --- |
| OpenCode run | exit `0` | exit `0` | neutral |
| Gradle only | `build.gradle`, `settings.gradle`, no `pom.xml` | `build.gradle`, `settings.gradle`, no `pom.xml` | neutral |
| Independent `gradle test` | pass | pass | neutral |
| HTTP smoke | create/list/loan/return/delete worked | create/list/loan/return/delete worked | neutral |
| Package planning in output | layered implementation shape described | no explicit layered package plan | weak ON-positive |
| Exact package names | `presentation/application/domain/infrastructure` | `book` + `web` | ON-positive |
| Application service | `application/BookService.java` | `book/LibraryService.java` | ON-positive |
| Domain model | `domain/Book.java`, `domain/BookStatus.java` | `book/Book.java`, `book/BookStatus.java` | ON-positive |
| Infrastructure boundary | `infrastructure/InMemoryBookRepository.java` implements `application/BookRepository` | `book/BookRepository.java` concrete storage class | ON-positive |
| Service storage/id ownership | Service delegates to repository | Service delegates to repository | neutral |
| Storage/id location | infrastructure repository owns `Map` and `nextId` | repository owns `Map` and `nextId` | neutral |

## HTTP Smoke

Both ON and OFF passed the same manual HTTP flow against a running Spring Boot process:

- `POST /books`: `201`
- `GET /books`: `200`
- `POST /books/1/loan`: `200`
- `POST /books/1/return`: `200`
- `DELETE /books/1`: `204`

The request field differed:

- ON used `borrowerName`.
- OFF used `borrower`.

Both are acceptable for this fixture because the requirements only say borrower name and do not fix the JSON field name.

## Decision

The package structure planning surface produced a clear ON-positive package-shape signal in this run.

Unlike the previous Library Loans A/B, Injection ON generated the exact `presentation/application/domain/infrastructure` package set. OFF stayed at a coarser `book` + `web` structure.

Do not overclaim this as product-quality proof. Treat it as one useful actual-run signal that package planning is a better lever than repeatedly strengthening package-name wording alone.

## Limitations

- Single A/B pair after the package planning change.
- ON ran after OFF because parallel OpenCode execution hit a global `database is locked` error.
- The model did not print a literal package structure plan; it printed a looser layered implementation shape.
- Both ON and OFF passed build and HTTP smoke, so the signal is code-shape uniformity, not correctness.
- This does not cover DB/JPA/Flyway, frontend, infra, or project-intake behavior.

## Next Loop

Stop reinforcing package naming for now.

The next useful loop is to decide the productization path:

1. keep this as default backend Clean Code baseline and move to project intake/planning surface, or
2. run one more different non-reservation Gradle fixture to see whether exact package shape repeats before moving on.

The current recommendation is to move toward intake/planning design, because the exact package-shape signal has now appeared once and further wording reinforcement risks overfitting the fixture.
