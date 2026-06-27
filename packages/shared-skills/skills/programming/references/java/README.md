# Java Programmer

Modern Java. Type-forward, object-responsible, toolchain-gated.

## Philosophy

Java's type system, object model, and JVM tooling are the proof surface. Make invalid states hard to represent, keep responsibilities inside the objects that own them, parse inputs at boundaries, and make backend frameworks a detail rather than the design center.

Backend recipes are separate. For ordinary Java work, start with the foundation router and only load deeper topic files when the change needs them.

## Guidance Priority And Rule Strength

This reference is the **base Clean Code skill**. It fills gaps when no stronger project guidance exists.

Guidance priority:

1. explicit task requirement
2. company / team harness
3. personal philosophy harness
4. this Clean Code skill

When a company or personal harness chooses a different stack, test convention, or architecture intensity, follow that harness and keep the invariant behind the rule.

Rule strength:

| Strength | Meaning | Examples |
|---|---|---|
| **Hard universal** | Applies unless the explicit task requires otherwise. | pin runtime/build; never fake Gradle with Node/JS/Python/shell shims; no framework imports in domain; no field injection; no mutable static storage; no raw `RuntimeException`; Service does not own storage state/id sequence |
| **Default recommendation** | Use when the harness has not decided. Override by recording the project choice. | Java 25 LTS, Spring Boot 4.x, Gradle 9.x, Spring MVC, JUnit/AssertJ, Flyway |
| **Project choice** | Ask/decide per project profile. The skill only preserves boundaries. | JPA vs JDBC/MyBatis, Flyway vs Liquibase, Testcontainers intensity, package depth, test naming convention |

## Base Defaults

### Tooling

| Category | Strength | Use when undecided | Hard invariant |
|---|---|---|---|
| JDK | Default recommendation | Java 25 LTS for new projects; Java 21/17 for compatibility | pin the toolchain; never rely on ambient JDK |
| Build | Default recommendation | Gradle wrapper + Java toolchain; Gradle 9.x preferred; include wrapper as generated project output; prefer wrapper even when system Gradle exists | CI and local builds use the same pinned toolchain; Gradle tasks are run by real Gradle, never by a fake shim |
| Formatter | Default recommendation | Spotless + google-java-format | formatting is machine-owned when configured |
| Static bug checks | Default recommendation | Error Prone | configured checks are not skipped silently |
| Nullness | Default recommendation | NullAway or JSpecify-based nullness | nullness contracts are explicit at boundaries |
| Architecture | Default recommendation | ArchUnit | dependency direction is reviewed or checked |
| Testing | Project choice | JUnit Platform/Jupiter + AssertJ + Mockito + Testcontainers | tests verify behavior, not implementation-only calls |
| Backend | Default recommendation | Spring Boot 4.x / Spring Framework 7.x | framework annotations stay out of domain/core code |
| Persistence | Project choice | Flyway + Spring Data JPA/Hibernate adapter | ORM must not auto-mutate production schema; domain remains storage-tech ignorant |

Build compatibility note:

- Choose a mutually compatible Spring Boot plugin, Gradle wrapper or launcher, and Java toolchain line before writing code.
- Prefer the Gradle wrapper for generated Gradle projects and include `gradlew`, `gradlew.bat`, and `gradle/wrapper/` as project outputs. Prefer wrapper-backed commands even when system Gradle exists because they make a clean project reproducible. Use `./gradlew test` and `./gradlew build` on macOS/Linux; use `gradlew.bat test` and `gradlew.bat build` on Windows.
- For Spring Boot Gradle builds, use the `org.springframework.boot` plugin plus `io.spring.dependency-management` or Boot plugin-managed dependencies. Do not attach empty or dot versions to `spring-boot-starter-*`, JDBC/JPA/validation starters, or `org.flywaydb:flyway-core`; if the version is unknown, follow a Spring Initializr/build.gradle template or the generated wrapper project's valid build line. If wrapper-backed test/build fails during dependency resolution, fix `build.gradle` and rerun it instead of reporting success.
- Before running wrapper commands, do a build.gradle self-check: if dependency notation contains `:.`, an empty version, or a Boot-managed starter explicit version, repair before test/build.
- Do not create Node/JS/Python/shell shims such as `tools/gradle-shim.js` to pretend that `gradle test`, `gradle build`, or `bootRun` succeeded. If neither the wrapper nor system Gradle can run, report a toolchain/environment issue instead of claiming verification.
- For a Spring Boot executable application, do not disable `bootJar` to make `gradle build` pass. `tasks.named("bootJar") { enabled = false }` is only acceptable after the project is explicitly declared a plain Java library.
- If `bootJar` fails with a Gradle/Spring Boot plugin compatibility error such as `CopyProcessingSpec.getDirMode()`, treat it as a build-line mismatch: upgrade the Spring Boot plugin to a line compatible with the current Gradle launcher or generate a Gradle wrapper pinned to the plugin-supported Gradle line.
- Do not mix a very new Gradle launcher with an older Spring Boot plugin. With a Gradle 9.x launcher, avoid defaulting to older Spring Boot 3.3.x plugin lines unless a wrapper pins a supported Gradle line.
- For generated Spring apps, `gradle test`, `gradle build`, and a basic `gradle bootRun` smoke should work unless the project is explicitly a library.
- When using Gradle 9.x with JUnit Platform, include the JUnit Platform launcher on the test runtime classpath if the test task cannot load it.

### The Iron List

1. **Pin the runtime and build.** Java version, Gradle wrapper, CI, and local toolchain must agree.
2. **Make semantic primitives explicit.** IDs, money, email, quantity, duration, and status are typed values, not primitive soup.
3. **Use the right type form.** `record` for transparent immutable data, `class` for identity/lifecycle/behavior, `enum` for named closed sets, `sealed interface` for closed variants.
4. **Parse at boundaries.** Request/config/file/env input becomes typed request/command/value objects once.
5. **Objects own decisions.** Avoid getter-driven business logic. Put behavior near the data and rule owner.
6. **No public setters by default.** State changes are named behavior or new immutable values.
7. **Equality is explicit.** Value objects compare by value; entities compare by stable identity.
8. **No raw types or unchecked escape hatches.** Do not use raw collections/classes; localize and justify unavoidable unchecked operations.
9. **No unsafe Optional usage.** `Optional.get()` is banned unless presence is proven in the same small scope with an opt-out reason.
10. **Typed errors only.** No bare `RuntimeException("...")`; use meaningful exception types and error catalogues where applicable.
11. **No broad catch or swallowed failures.** Catch narrowly; boundary catch-all requires `// no-excuse-ok: catch`.
12. **No mutable static state.** Shared mutable state needs an explicit owner/lifecycle.
13. **Frameworks stay at the edge.** Spring/JPA/HTTP/SQL imports do not belong in domain/core packages.
14. **Use four backend layer package names by default.** Under each business domain, prefer `presentation`, `application`, `domain`, and `infrastructure`; do not default to `controller`, `service`, `repository`, or `dto` role packages.
15. **Test names follow the chosen project convention.** Default profile uses `methodName_ExpectedResult_TestState`; company/personal harness may choose another explicit convention.
16. **250 pure LOC ceiling.** Split Java source files by responsibility before they become design dumps.

### Data Modeling -- Which Construct, When

| Situation | Use |
|---|---|
| External request/response | boundary DTO `record` + validation |
| Application command/query | `record` built from parsed input |
| Domain value | `record` or final class with invariant-preserving factory |
| Domain entity/aggregate | `class` with identity, private construction, named behavior |
| Closed business variant | `sealed interface` + exhaustive `switch`, or enum with behavior |
| Distinct primitive | typed value object, not raw `String`/`Long`/`BigDecimal` |
| Repository/port | interface named by role, owned by the policy side |
| Persistence shape | infrastructure row/entity mapped to domain |
| Expected local alternative | explicit result type, enum, sealed result, or `Optional` return |
| Boundary failure | typed exception translated once at the boundary |

**The one rule:** untrusted data crosses a boundary once. Inside the boundary, pass typed values and behavior-owning objects.

## Mandatory Gates

Minimum gate after any Java edit:

```bash
bash scripts/java/check-no-excuse-rules.sh <changed .java paths>
./gradlew compileJava test check
```

Recommended gate for new or fully configured projects:

```bash
./gradlew spotlessCheck compileJava test check
```

When configured, these are not optional:

| Gate | Proves |
|---|---|
| Spotless/google-java-format | formatting is machine-owned |
| Error Prone | dangerous Java patterns fail compilation |
| NullAway/JSpecify | nullness contracts are checked |
| ArchUnit | dependency direction and forbidden imports are executable |
| Testcontainers integration tests | infrastructure adapters talk to real dependencies |

If a configured gate is skipped, the work is not done. If the project lacks the gate, say so and run the strongest available local substitute.

## Foundation Loading

Load `foundations.md` for every Java change. It is a router, not a large guide.

Default baseline for ordinary Java code:

1. `foundations.md`
2. one focused topic file that matches the change

Do not load all foundation topic files by default. Load more only when the change crosses those concerns.

| Need | Load |
|---|---|
| syntax, references, type forms, resources, exceptions | `language-core.md` |
| construction, equality, generics, enum, lambda, stream, Optional | `java-idioms.md` |
| role/responsibility/collaboration, encapsulation, patterns | `object-collaboration.md` |
| naming, method/class shape, smells, refactoring, boundaries | `code-quality-refactoring.md` |
| performance, memory, GC, IO, logging, DB cost | `performance-discipline.md` |
| threads, locks, futures, async, reactive, shared state | `concurrency-discipline.md` |
| TDD, unit tests, xUnit fixtures, doubles, test smells | `test-design.md` |
| Spring, HTTP, persistence, transactions, DB, API errors, observability | `backend.md` |

## Reference Loading

Load on demand, not all at once.

| Need | Load |
|---|---|
| Runtime/build/framework/static-analysis seams | `technology-seams.md` |
| Layers, dependency direction, package structure | `architecture.md` |
| Entity / VO / static factory / Policy / immutability / equals | `domain-model.md` |
| Repository port & adapter, SQL, mapping | `repository-pattern.md` |
| Service, Validator, transaction, Request/Command | `application-layer.md` |
| ErrorCode, exception hierarchy, central handler | `error-handling.md` |
| Method design + naming | `method-and-naming.md` |
| Full backend test discipline | `testing.md` |
| Rejected patterns | `anti-patterns.md` |

## No-Excuse Audit

Pure-text rules live in `../../scripts/java/check-no-excuse-rules.sh`. Run after every Java edit session.

This checker is a **default-profile tripwire**, not a full compiler or architecture oracle. It catches cheap textual regressions; it cannot prove layer intent, full `Optional` control flow, AST-level generic safety, test quality, or domain richness. Use it with the Gradle gate, the focused Java reference, and human design review. Regression samples live under `../../fixtures/java/no-excuse/` and must be updated when a rule changes.

If company/personal guidance deliberately changes a project-choice convention, follow that stronger harness. The checker may need a future configurable profile rather than treating every default rule as universal.

| Rule | Catches |
|---|---|
| `vague-name` | class/interface named `*Manager`, `*Helper`, `*Util` |
| `raw-type` | raw `List`, `Map`, `Set`, `Class`, `Optional`, etc. |
| `optional-get` | unsafe `Optional.get()` |
| `mutable-static` | mutable static fields |
| `public-field` | public non-constant fields |
| `domain-framework-import` | Spring/JPA/HTTP/SQL imports in `domain` |
| `test-name-convention` | default-profile test methods not named `methodName_ExpectedResult_TestState` |
| `printf-debug` | `System.out/err.print*` outside main/test |
| `printstacktrace` | `e.printStackTrace()` |
| `broad-catch` | `catch (Exception/Throwable)` outside tests |
| `empty-catch` | empty catch body |
| `field-injection` | `@Autowired` field injection |
| `setter` | public setter on domain object |
| `domain-record` | `record` in domain without VO opt-out |
| `raw-runtime-throw` | `throw new RuntimeException("...")` |
| `todo-no-owner` | TODO/FIXME without issue or owner |

Opt out only with `// no-excuse-ok: <reason>` on the line that needs it.

## Existing Codebases

When editing a file that does not follow these rules: write new code in this style, do not refactor the surrounding file in the same change unless it blocks the task. If a touched Java file is over 250 pure LOC, surface the smell and split the touched responsibility before adding more behavior.

## Activation

This skill activates whenever you write or modify `.java`, `build.gradle*`, `settings.gradle*`, `pom.xml`, Java CI/build configuration, or Java project scaffolding.
