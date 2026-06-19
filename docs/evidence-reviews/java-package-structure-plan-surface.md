# Java Package Structure Plan Surface

## Goal

Make Java/Spring generation surface a package structure plan before implementation.

This is a narrow backend Clean Code uniformity adjustment. It is not a product-quality gate and does not add a new observer.

## Context

The latest Library Loans A/B confirmed that Java common routing now reaches `LibraryApplication.java` and `build.gradle`, and Injection ON improved Service storage/id ownership compared with OFF.

However, exact `presentation/application/domain/infrastructure` package naming did not appear. Injection ON generated `book` + `web`.

## Decision

Before implementation, Java/Spring targets should first write a package structure plan.

The default package candidate is:

- `presentation`
- `application`
- `domain`
- `infrastructure`

This keeps exact package naming as a planning surface rather than another broad observer or product-quality claim.

## Changed Surface

`backend/java-common.md` now includes:

```text
구현 전에 package structure plan을 먼저 작성하고, 기본 후보는 presentation/application/domain/infrastructure 패키지로 역할 경계를 잡는다.
```

## Verification

`LibraryApplication.java` injection now includes:

- Java common Gradle/main application baseline
- package structure plan instruction
- `presentation/application/domain/infrastructure`
- layered role explanations from `backend/layered-architecture.md`

## Non-Goals

- No new observer.
- No test policy change.
- No DB/JPA/Flyway policy change.
- No frontend/infra/profile-aware expansion.
- No product-quality certification.

## Next Loop

Run the same non-leading Library Loans Gradle A/B pair again and check whether the model writes or follows a package structure plan before implementation.

Primary evidence to check:

- exact `presentation/application/domain/infrastructure` package names,
- whether a package plan appears in model output or work log,
- Service storage/id ownership,
- Repository boundary,
- `gradle test`,
- HTTP smoke.
