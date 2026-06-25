# Java Backend Recipe

Load this only when the work touches backend services: Spring, HTTP, persistence, transactions, DB migrations, API errors, observability, or deployment.

Read `foundations.md` first. Backend code still follows the Java foundation rules: clear object responsibility, typed boundaries, behavior-first tests, explicit errors, measured performance, and no framework leakage into core policy.

## Backend Philosophy

A backend service has two jobs:

1. expose stable behavior through a transport boundary;
2. keep business policy independent from transport, framework, database, and operations detail.

Domain-first layering remains the default service shape in this skill, but it is not a reason to overbuild tiny CRUD. If the harness chooses a simpler shape, record that decision and preserve the invariants: typed inputs, clear boundaries, direct tests, and no accidental technology leak into core rules.

## Tooling Defaults And Invariants

The left side is the default when the project harness has not decided. The right side is the rule that survives any company/personal/project override.

| Category | Default recommendation | Hard invariant |
|---|---|---|
| JDK | Java 25 LTS for new projects; Java 21/17 for compatibility | pin the JDK with a toolchain |
| Build | Gradle wrapper + Java toolchain; Gradle 9.x preferred; wrapper first when system Gradle is absent | do not rely on a global build tool as the contract; never fake Gradle with Node/JS/Python/shell shims |
| Web app | Spring Boot 4.x + Spring Framework 7.x | framework annotations stay out of domain code |
| Maintenance line | keep existing Boot/JDK unless migration is the task | do not mix major versions casually |
| Web stack | Spring Web MVC | choose WebFlux only for explicit reactive pressure |
| Persistence | Spring Data JPA + Hibernate + Flyway | no ORM auto-DDL in production; Repository boundary stays explicit |
| Input validation | Bean Validation on request DTOs | HTTP-shape validation at boundary; domain rules in Domain/Policy |
| Testing | JUnit Platform/Jupiter + AssertJ + Mockito + Testcontainers | tests verify behavior, not implementation-only calls |
| Formatting | Spotless + google-java-format | formatting is machine-owned when configured |
| Static analysis | Error Prone + NullAway/JSpecify + ArchUnit | checked contracts are not replaced by memory |
| API/ops | springdoc-openapi, Actuator, Micrometer, structured logging | domain code never depends on operational APIs |

## Build Compatibility

Before generating a Spring project, pick one compatible build line and keep it coherent:

- Spring Boot plugin version
- Gradle wrapper or launcher version
- Java toolchain version
- JUnit Platform runtime

Do not solve a Spring Boot executable-app build failure by disabling `bootJar` unless the project is explicitly a plain Java library. For a backend application, `gradle test`, `gradle build`, and a basic `gradle bootRun` smoke should all be expected to pass.

Generated Spring apps should prefer wrapper-backed verification. Include `gradlew`, `gradlew.bat`, and `gradle/wrapper` when feasible; otherwise record why the wrapper could not be generated and avoid treating missing system Gradle as an application failure. Use `./gradlew test` on macOS/Linux and `./gradlew.bat test` or `gradlew.bat test` on Windows before using a global `gradle` command.

If `bootJar` fails with a compatibility symptom such as `CopyProcessingSpec.getDirMode()`, do not add `tasks.named("bootJar") { enabled = false }`. Treat it as a Spring Boot plugin / Gradle launcher mismatch: prefer a compatible Spring Boot plugin line for the current Gradle launcher, or generate a Gradle wrapper for the Gradle line supported by the chosen plugin.

If the local environment uses a newer Gradle than the selected Spring Boot plugin supports, prefer a compatible Spring Boot plugin line or generate a Gradle wrapper for the chosen line. With a Gradle 9.x launcher, do not default to older Spring Boot 3.3.x plugin lines unless the wrapper pins a supported Gradle line. If the test task fails to load JUnit Platform, add the launcher explicitly:

```groovy
testRuntimeOnly "org.junit.platform:junit-platform-launcher"
```

## Backend Iron List

1. **Pin the JDK with a toolchain** -- Java source, target, CI, and local builds must agree.
2. **Package by business domain and four layer names** -- `order/presentation`, `order/application`, `order/domain`, `order/infrastructure`; do not default to `order/controller`, `order/service`, `order/repository`, `order/dto`, or a top-level `controller/service/repository` dump.
3. **Frameworks stay at the edge** -- Spring/JPA/HTTP/SQL imports belong in presentation, infrastructure, config, or global handlers, not the domain core.
4. **Validate once at the right boundary** -- request shape in Presentation, self-state rules in Domain/Policy, lookup rules in Application Validator.
5. **Request is not Command** -- Presentation owns request/response DTOs; Application owns command/query DTOs.
6. **Repository is a port** -- domain-owned interface, infrastructure adapter implementation.
7. **Typed errors only** -- per-domain error codes and unchecked domain/application exceptions; no bare `RuntimeException`.
8. **Constructor injection only** -- final fields, no field injection, no mutable static singleton state.
9. **Architecture rules are executable** -- use ArchUnit for dependency direction, layer access, cycles, and forbidden imports.
10. **Test through the smallest truthful surface** -- POJO domain tests, fake-backed application tests, real DB adapter tests, web slice controller tests, focused acceptance tests.

## Data Modeling By Layer

| Situation | Use |
|---|---|
| HTTP request / response | `record` in presentation DTO package, Bean Validation on request fields |
| Application command / query | `record` in application DTO package, already parsed from request |
| Domain entity / aggregate | `class` with private constructor, static `create`/`restore`, final fields where possible, named behavior |
| Value object | `record` or small final class with factory validation |
| Repository contract | domain-owned interface, domain-language methods |
| Persistence shape | infrastructure entity/row model, mapped to/from domain |
| Error catalogue | per-domain `ErrorCode` enum implementing the common error contract |
| Cross-cutting config | `global`/config package, never domain |

## Default Stack By Project Shape

| Project shape | Default recipe |
|---|---|
| New web service | Java 25 LTS, Gradle 9.x wrapper, Spring Boot 4.x, Spring MVC, Flyway, JUnit Jupiter, AssertJ, Testcontainers, Spotless, Error Prone, NullAway/JSpecify, ArchUnit |
| Existing Spring service | Keep its current Boot/JDK line unless the task is migration; add tests and gates incrementally |
| Small library | Java 21 or 25, Gradle wrapper, JUnit Jupiter, AssertJ, Error Prone, NullAway/JSpecify, no Spring unless needed |
| CLI / batch | Java 25, Gradle application plugin, picocli if argument parsing matters, structured logging, integration tests for IO boundaries |
| Simple CRUD prototype | Spring Boot default stack is acceptable, but record shortcuts and direct JPA entities are a harness decision, not accidental drift |

## Spring Defaults

Use Spring Boot 4.x for new Spring work when the harness has not chosen a line. Boot 4 runs on Java 17+ and aligns with Spring Framework 7, Jakarta EE 11, modern null-safety work, and current Gradle support. A project may choose Boot 3.x, Java 21/17, or another framework; that is conformant when recorded as a project decision.

Spring MVC is the default for request/response services. Choose WebFlux only when backpressure, streaming, or a reactive downstream stack is a real requirement.

## Persistence Defaults

The default persistence recipe, when the project has not chosen otherwise, is:

- schema first with Flyway migrations;
- `ddl-auto: validate` outside throwaway local experiments;
- repository interface in `domain`;
- adapter implementation in `infrastructure`;
- Testcontainers for real database mapping/query tests.

For this skill's current domain-first baseline, JPA annotations do not belong in `domain`. If the project chooses JPA, a JPA entity lives in infrastructure and maps to/from the domain object. If the project chooses JDBC/MyBatis, keep the same port/adapter boundary and substitute the adapter technology. The cost/benefit of strict entity separation for small CRUD is a project decision; do not resolve it silently inside ordinary feature work.

## Testing

| Test | Loads | Doubles | Asserts |
|---|---|---|---|
| Domain / value object / policy | plain JVM | none | creation rules, behavior, state transitions, exhaustive variants |
| Service / validator | no Spring context | map-backed Fake repository | orchestration, lookup validation, transaction-facing behavior |
| Repository / adapter | DB slice or container | real database via Testcontainers | query, mapping, migration compatibility |
| Controller | web slice | Mockito mock service | HTTP status, request parsing, response shape, delegation |
| Acceptance | full app | real app and real downstreams where feasible | user-visible scenario |
| Architecture | ArchUnit | bytecode inspection | package dependencies, cycles, forbidden imports |

JUnit Jupiter and AssertJ are the default testing stack. Mockito is for delegation boundaries and true unmockables, not for replacing every collaborator. Testcontainers is the default for integration tests that talk to databases, brokers, browsers, or other real services when the project cost/benefit supports it.

## Static Gates

Minimum local gate:

```bash
bash scripts/java/check-no-excuse-rules.sh <changed .java paths>
./gradlew compileJava test check
```

Recommended gate for new projects:

```bash
./gradlew spotlessCheck compileJava test check
```

Add these tools when the project can support them:

| Tool | Catches |
|---|---|
| Spotless + google-java-format | formatting drift |
| Error Prone | dangerous Java bug patterns at compile time |
| NullAway or JSpecify-based nullness | nullness contracts and likely NPEs |
| ArchUnit | layer violations, cycles, forbidden framework imports |
| Testcontainers | false confidence from fake infrastructure |

## Known Pending Reconciliation

Some architectural choices from the original Java draft are intentionally left pending for a later harness pass:

- how strict pure-domain/JPA-entity separation should be for very small CRUD apps;
- when a project may intentionally choose a simpler anemic model for low-risk admin CRUD.

Do not silently resolve those conflicts inside feature work. Record the local harness decision when the project needs one.
