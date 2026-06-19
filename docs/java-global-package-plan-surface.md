# Java Global Package Plan Surface

## Goal

Refine the Java/Spring backend package planning surface so root-level common cross-cutting concerns are planned under `global`, while each domain package owns its internal layers.

This is a narrow Clean Code uniformity adjustment. It does not add a new observer and does not claim product quality.

## Decision

The default backend package plan is now explicit:

```text
root
├── global
│   ├── exception
│   ├── response
│   └── config
└── <domain>
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

## Package Responsibilities

`global` is for shared cross-cutting concerns only:

- `global/exception`
- `global/response`
- `global/config`

It should not become a bucket for domain logic, domain DTOs, services, repositories, or one-off helpers.

Layer-specific defaults:

- `<domain>/presentation/dto/request` and `<domain>/presentation/dto/response` hold HTTP boundary DTOs.
- `<domain>/application/dto/command` and `<domain>/application/dto/result` hold use-case input/output DTOs.
- Repository interfaces live in `<domain>/domain`.
- Repository implementations live in `<domain>/infrastructure`.

## Changed Surface

`backend/java-common.md` now surfaces:

```text
구현 전에 package structure plan을 먼저 작성한다. 명시적 기본 구조는 root/global/exception·root/global/response·root/global/config와 root/<domain>/application·root/<domain>/application/dto/command·root/<domain>/application/dto/result·root/<domain>/domain·root/<domain>/infrastructure·root/<domain>/presentation·root/<domain>/presentation/dto/request·root/<domain>/presentation/dto/response이며, global은 공통 관심사만, Repository interface는 domain, 구현체는 infrastructure에 둔다.
```

## Verification

`LibraryApplication.java` injection was manually checked after build and includes:

- `root/global/exception`
- `root/<domain>/application`
- `root/<domain>/domain`
- `root/<domain>/infrastructure`
- `root/<domain>/presentation`
- `presentation/dto/request`
- `presentation/dto/response`
- `application/dto/command`
- `application/dto/result`
- `Repository interface는 domain`
- `구현체는 infrastructure`

## Non-Goals

- Do not force empty `ApiResponse` or `WebConfig` files when not needed.
- Do not force empty `global/response` or `global/config` packages when the current requirements do not need them.
- Do not put presentation/application/domain/infrastructure directly under the root package for domain-specific code.
- Do not change test style policy.
- Do not change DB/JPA/Flyway policy.
- Do not add a report-only observer.
- Do not certify product quality.

## Next Loop

Run the Library Loans Gradle A/B again or move to intake/planning design.

If another A/B is run, check whether Injection ON creates:

- `root/global/exception` only when error handling is needed,
- `library/presentation/dto/request` and `library/presentation/dto/response`,
- `library/application/dto/command` and `library/application/dto/result`,
- `library/domain/BookRepository`,
- `library/infrastructure/InMemoryBookRepository`.
