# Spring Boot Entrypoint Package Shape Review

## Goal

Spring Boot main application class를 root package에 하나만 두고, feature/domain package 아래에 추가 `*Application.java`를 만들지 않는 baseline이 실제 Gradle generated run에서 유지되는지 확인한다.

## Baseline Change

- `backend/java-common.md` now injects Gradle-only generation plus the Spring Boot entrypoint/package-shape rule.
- `backend/package-structure.md` keeps the same package-shape policy as a package-specific baseline.

Injected policy surface:

```text
Java/Spring 프로젝트는 Gradle을 기본 빌드 도구로 사용하고 Maven 파일을 생성하지 않으며, Spring Boot main application class는 root package에 하나만 두고 feature/domain package 아래에 추가 *Application.java를 만들지 않는다.
```

## A/B Source

- Run: `experiments/phase0-runs/2026-06-19T00-14-57-663Z-19978-drflpp`
- Model: `openai/gpt-5.4-mini-fast`
- ON target: `sandbox`
- OFF target: `sandbox-baseline`
- Fixture: Gradle-based Java/Spring step1 fixture.

## Result

| Check | Injection ON | Injection OFF |
| --- | --- | --- |
| `build.gradle` | present | present |
| `settings.gradle` | present | present |
| `pom.xml` | absent | absent |
| `*Application.java` count | 1 | 1 |
| Application class path | `src/main/java/com/example/ReservationApplication.java` | `src/main/java/com/example/ReservationApplication.java` |
| Application class package | `com.example` | `com.example` |
| Feature/domain package extra `*Application.java` | none | none |
| `gradle test --quiet` | pass | pass |

Additional storage/id-sequence scan:

- ON `ReservationService` delegates to `ReservationRepository` and does not own `Map`, `List` storage fields, `AtomicLong`, `nextId`, or `idCounter`.
- OFF `ReservationService` also delegates to `ReservationRepository` and does not own those storage/id sequence fields.

## Decision

The entrypoint/package-shape baseline is reflected in the injection surface and the new A/B pair does not reproduce the earlier extra feature-package `ReservationApplication` noise.

This is not an ON-positive differential signal because both ON and OFF produced the desired package shape in this pair. Treat it as a cleanup confirmation, not as product-quality proof.

## Limitations

- Single A/B pair.
- Same step1 fixture remains relatively saturated by existing prompt and runner constraints.
- This review checks file/package shape and basic Gradle execution only.
- It does not prove broader code quality or long-term uniformity.

## Next Loop

Move away from repeatedly polishing the same saturated step1 fixture unless a new repeated defect appears. The next useful loop is either:

- a less saturated backend fixture to measure Clean Code uniformity under weaker prompt pressure, or
- an intake/planning surface that asks project scale and stack choices before generation while keeping the default Clean Code baseline.
