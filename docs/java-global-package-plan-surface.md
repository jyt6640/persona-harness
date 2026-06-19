# Java Global Package Plan Surface

## Goal

Refine the Java/Spring backend package planning surface so common cross-cutting concerns are planned under `global`.

This is a narrow Clean Code uniformity adjustment. It does not add a new observer and does not claim product quality.

## Decision

The default backend package plan is now:

- `global`
- `presentation`
- `application`
- `domain`
- `infrastructure`

## Package Responsibilities

`global` is for shared cross-cutting concerns only:

- `global/error`
- `global/response`
- `global/config`

It should not become a bucket for domain logic, domain DTOs, services, repositories, or one-off helpers.

Layer-specific defaults:

- `presentation/dto/request` and `presentation/dto/response` hold HTTP boundary DTOs.
- `application/dto/command` and `application/dto/result` hold use-case input/output DTOs.
- Repository interfaces live in `domain`.
- Repository implementations live in `infrastructure`.

## Changed Surface

`backend/java-common.md` now surfaces:

```text
구현 전에 package structure plan을 먼저 작성하고, 기본 후보는 global/presentation/application/domain/infrastructure이며, global은 error/response/config 같은 공통 관심사만, presentation/dto/request·presentation/dto/response는 HTTP DTO, application/dto/command·application/dto/result는 use-case DTO, Repository interface는 domain, 구현체는 infrastructure에 둔다.
```

## Verification

`LibraryApplication.java` injection was manually checked after build and includes:

- `global/presentation/application/domain/infrastructure`
- `global은 error/response/config 같은 공통 관심사만`
- `presentation/dto/request`
- `presentation/dto/response`
- `application/dto/command`
- `application/dto/result`
- `Repository interface는 domain`
- `구현체는 infrastructure`

## Non-Goals

- Do not force empty `ApiResponse` or `WebConfig` files when not needed.
- Do not change test style policy.
- Do not change DB/JPA/Flyway policy.
- Do not add a report-only observer.
- Do not certify product quality.

## Next Loop

Run the Library Loans Gradle A/B again or move to intake/planning design.

If another A/B is run, check whether Injection ON creates:

- `global/error` only when error handling is needed,
- `presentation/dto/request` and `presentation/dto/response`,
- `application/dto/command` and `application/dto/result`,
- `domain/BookRepository`,
- `infrastructure/InMemoryBookRepository`.
