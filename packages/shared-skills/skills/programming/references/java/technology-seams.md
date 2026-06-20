# Technology Seams — What the Harness Fills, Not the Skill

This skill fixes the **structure and the discipline**, never the stack. Per the philosophy: *"Domain은 `save()` / `findById()` 같은 저장 요구사항만 알고, JPA / JDBC / Redis 등의 구현은 알지 않는다"* and *"아키텍처 패턴 적용 자체를 목표로 삼지 않는다 … 현재 문제·규모·비용 기준으로 판단."*

So the concrete technology — web framework, persistence, DI mechanism, boilerplate tool, test libraries — is a **per-project decision** that lives in the project's harness (`AGENTS.md`, `docs/decisions/`), not baked into the skill's rules. But "decide everything from scratch each time" is its own cost. So this skill works in **three tiers**:

- **Invariant (MUST)** — the structural rules from the philosophy. Never change. These are the right-hand column of the table below.
- **Recommended default (SHOULD, overridable)** — if the harness hasn't decided a seam yet, start here. For new Java services, that default is now Java 25 LTS, Gradle 9.x, and Spring Boot 4.x. The harness may override any row in `docs/decisions/`; doing so is conformant, not a violation.
- **Project choice** — items whose intensity depends on team size, lifecycle, budget, or domain risk. The skill may suggest a default, but the project harness owns the decision.

The examples elsewhere in `references/java/` are written against the recommended default for concreteness; read them for the *shape*, and substitute whatever the harness chose.

## The seams: default, options, and the invariant

| Seam | **Recommended default** (overridable) | Other valid options | Invariant the philosophy requires regardless |
|---|---|---|---|
| **Language** | **Java 25 LTS** for new projects | Java 21, Java 17 | pin it with a toolchain; do not rely on the machine's ambient JDK |
| **Framework** | **Spring Boot 4.x / Spring Framework 7.x** | Spring Boot 3.x for maintenance, Quarkus, Micronaut, none | the framework is wiring; it never appears in the Domain |
| **Build** | **Gradle wrapper 9.x**, JDK pinned via a toolchain | Gradle 8.14+ for Boot 4 compatibility, Maven only if the project harness chooses it | pin the JDK and build tool so CI and local builds agree |
| **Web** | **Spring Web MVC** | WebFlux, none (library/CLI) | Presentation maps `Request → Command`, returns `Response`; never holds business logic; errors flow to one central handler |
| **DB** | **MySQL or PostgreSQL** | H2 (local/test), others | the Domain never names the DB; only the infrastructure adapter does |
| **Persistence / ORM** | **Spring Data JPA + Hibernate** | JdbcTemplate, MyBatis, Redis, in-memory | Repository *interface* in `domain`; *impl* in `infrastructure`. **The Domain entity is a pure POJO — NOT a `@Entity`.** A separate `@Entity` lives in `infrastructure`; the adapter maps entity ↔ domain (see below) |
| **Migration** | **Flyway** | Liquibase | schema is versioned, code-reviewed SQL; the ORM never auto-mutates prod schema (`ddl-auto: validate`) |
| **DI mechanism** | **Spring beans** (constructor injection) | Dagger, manual wiring in `main` | constructor injection with `final` fields; no field injection; no static-singleton mutable state |
| **Boilerplate** | **Lombok** (`@Getter`, `@RequiredArgsConstructor`, `@Slf4j`) | Java `record` (VO/DTO), hand-written | Entity is a `class` with a private ctor + static factory + behavior; no setters. The conveniences never change that shape |
| **Input validation** | **Bean Validation** (`@Valid` on the Request DTO) | manual guards | HTTP-shape checks (null/blank/format) on the boundary Request DTO; self-state rules in Domain/Policy; lookup rules in a Validator |
| **Auth** | **Spring Security** | custom interceptor/filter | auth is a Presentation/`global` concern; the Domain never imports it. Principal → a Command field, not a domain dependency |
| **Error → response mapping** | **`@RestControllerAdvice`** | framework filter, manual | one central handler converts a domain `ErrorCode` + unchecked exception into a response; domain throws meaning, not protocol |
| **API docs** | **springdoc-openapi / Swagger UI** | manual OpenAPI | docs are generated from Presentation DTOs/controllers; never let doc annotations leak past Presentation |
| **Test stack** | **JUnit Platform/Jupiter + AssertJ + Mockito + Testcontainers** | Spock; RestAssured; MockMvc / WebTestClient | Domain tests are POJO; Service/Validator tests inject a **Fake** (no container); Mockito is for Controller→Service delegation + true unmockables only; Testcontainers for the real-DB Repository/integration slice; Fakes live in a `fake` package; every production class is directly tested |
| **Static gates** | **Spotless + google-java-format, Error Prone, NullAway/JSpecify, ArchUnit** | Checkstyle, PMD, SpotBugs | formatting, bug patterns, nullness, and dependency direction are checked by tools, not memory |
| **Monitoring** | **Spring Boot Actuator** | Micrometer + external | an operational concern in `global`/config; never in the Domain |
| **Infra / CI** | **Docker + GitHub Actions** | other CI/registry | reproducible build & deploy; pin the JDK in CI too |

A project is free to override any row — record the override (and why) in `docs/decisions/` so the next reader knows it was a choice, not drift.

## Build line compatibility

The rows above are not independent toggles. Pick a compatible **Spring Boot plugin + Gradle wrapper/launcher + Java toolchain + JUnit Platform** set before generating build files.

For Spring Boot applications:

- do not disable `bootJar` merely to make `gradle build` pass;
- do not add `tasks.named("bootJar") { enabled = false }` unless the project is explicitly a plain Java library rather than an executable Spring Boot app;
- if `bootJar` fails with `CopyProcessingSpec.getDirMode()` or a similar plugin API mismatch, fix the Spring Boot plugin / Gradle launcher line instead of disabling the task;
- keep `gradle test`, `gradle build`, and a basic `gradle bootRun` smoke viable;
- add `testRuntimeOnly "org.junit.platform:junit-platform-launcher"` when the selected Gradle/JUnit setup needs an explicit launcher;
- if the local Gradle is newer than the chosen Spring Boot plugin supports, prefer a compatible plugin line or generate a wrapper for the supported Gradle line;
- with a Gradle 9.x launcher, do not default to older Spring Boot 3.3.x plugin lines unless a wrapper pins a supported Gradle line.

If the project is explicitly a plain Java library rather than a Spring Boot application, record that as the harness decision before disabling executable-application tasks.

## The JPA ↔ pure-domain reconciliation (the one seam with a catch)

`domain-does-not-know-technology` is **accepted** (the Domain is a pure POJO, no framework annotations). `domain-entity-separation` is **pending** — and per the harness rule, *a pending decision cannot override an accepted one.* So with **Spring Data JPA as the default**, the conformant pattern is:

```
order/
├── domain/
│   ├── Order.java                 ← pure POJO: private ctor + create/restore/of + behavior. NO @Entity.
│   └── OrderRepository.java        ← the port (plain interface, domain language)
└── infrastructure/
    ├── OrderJpaEntity.java         ← @Entity, @Id, no-arg ctor, JPA's mutable shape — lives HERE, not in domain
    ├── OrderJpaRepository.java      ← Spring Data: interface extends JpaRepository<OrderJpaEntity, Long>
    └── OrderRepositoryAdapter.java  ← implements OrderRepository; maps OrderJpaEntity ↔ Order (via Order.restore / from-domain)
```

The adapter is the only place that knows JPA. `OrderJpaEntity.toDomain()` rebuilds the domain object through `Order.restore(...)`; `OrderJpaEntity.fromDomain(order)` flattens it for persistence. The Service and Domain depend only on `OrderRepository`.

> **Cost vs. scale (a harness call).** Full entity separation adds a class + a mapping per aggregate. The tradeoff is real for small CRUD (`domain-entity-separation` notes this), so the *intensity* is the harness's to decide — but the *invariant* is not negotiable: **no `@Entity`/`@Table`/`@Column`/`@Id` on a class in a `domain` package.** If a project decides the separation cost isn't worth it yet, it records that in `docs/decisions/` — and even then keeps JPA annotations out of the domain layer (e.g. defer persistence to a later milestone, or use JdbcTemplate where mapping is explicit). The skill's `domain-record` / no-annotation discipline guards this.

## What the scaffold wires

`scripts/java/new-project.py` scaffolds the **code seams** of the current starter — Spring Boot + Web MVC + **Spring Data JPA (with the domain/entity separation above)** + Flyway + Bean Validation + Lombok, and a Fake-based Service test (JUnit Jupiter + AssertJ). The scaffold may lag the preferred ecosystem baseline while staying runnable on the local machine; when starting a real project, raise the wrapper/JDK/Boot line to the harness decision and add the static gates (Spotless, Error Prone, NullAway/JSpecify, ArchUnit). The **operational / cross-cutting seams** — Spring Security, springdoc, Actuator, Testcontainers integration tests, Docker, GitHub Actions — are listed as defaults but added per project need, so the starter stays minimal and runnable. Treat the scaffold as a worked example to extend, not the full production surface.

## How to read the rest of the references

When a reference shows `@Service`, `@Transactional`, `@RestControllerAdvice`, `@Entity` / `JpaRepository`, `@Getter`, `ResponseEntity.status(...)`, or `@NotBlank`, treat those tokens as **the example's instantiation**, not a mandate. The load-bearing part is always the *structural rule* stated next to the code:

- `@Service` + `@RequiredArgsConstructor` → the rule is *"Application service, constructor-injected, orchestration only."*
- `@Entity` + `JpaRepository` + adapter → the rule is *"the adapter owns the storage tech; the JPA entity lives in infra and maps to the domain via `restore`."*
- `ErrorCode` + `ResponseEntity.status(...)` → the rule is *"per-domain error catalogue; one central handler maps status codes to a response."*

If your harness picked a different framework, keep the rule and swap the token.

## Deciding a seam is a harness activity

When a project hasn't yet chosen a seam (which framework? JPA or JDBC?), that is a **decision for the harness**, recorded under `docs/decisions/` — not something this skill should hardcode. The philosophy even allows *deferring* the decision: *"보류는 미완성이 아니라, 판단 시점을 뒤로 미루는 선택."* Until the harness decides, write the technology-neutral core (domain model, ports, validators, error catalogue) — it compiles and tests against an in-memory Fake without any framework at all.

## The scaffold is a worked example, not a mandate

`scripts/java/new-project.py` generates the code seams of the default service shape (Spring Boot + Web MVC + Spring Data JPA with domain/entity separation + Flyway + Bean Validation + Lombok, plus a Fake-based Service test). It is a worked example of the philosophy, not a declaration that the stack is mandatory or always on the newest upstream line. A project whose harness chose JdbcTemplate, Maven, Java 21/17, or no Lombok is fully conformant — adapt or ignore the scaffold accordingly.
