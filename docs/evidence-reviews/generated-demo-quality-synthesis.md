# Generated Demo Quality Synthesis

## Goal

Compare the generated Java/Spring demo projects currently spread across `/Users/yongtae/Desktop` and identify repeated product-code shape signals.

This is an evidence synthesis, not product-quality certification, not rule enforcement, and not a new observer. The purpose is to decide whether the next guidance change should be narrow and evidence-backed.

## Scope

Included generated app artifacts:

| Artifact | Path |
| --- | --- |
| persona-real-demo | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo` |
| persona-real-demo-2 | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-2` |
| persona-real-demo-3 | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-3` |
| persona-real-demo-4 | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-4` |
| persona-real-demo-5 | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-real-demo-5` |
| persona-v021-quality-check | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-v021-quality-check` |
| persona-v021-quality-check-course | `/Users/yongtae/Desktop/persona-harness-artifacts/generated-apps/persona-v021-quality-check-course` |

Excluded artifact:

| Artifact | Reason |
| --- | --- |
| `/Users/yongtae/Desktop/persona-harness-artifacts/smoke/persona-opencode-demo` | OpenCode/plugin smoke only; no generated Java app files. |

## Measurement Notes

The synthesis uses current filesystem inspection plus existing evidence reviews. It does not rerun every old generated app.

Measured directly:

- `build.gradle`, `settings.gradle`, and `pom.xml` presence.
- Java main/test file counts.
- existing JUnit XML result presence.
- `.persona/evidence` JSON file counts.
- root package patterns.
- repository port and implementation placement.
- domain `record` versus class/self-behavior signals.
- field-level application-service storage/id-sequence ownership signals.
- DTO file presence.

Existing review evidence used:

- `docs/evidence-reviews/v0.2.1-clean-project-quality-review.md`
- `docs/evidence-reviews/v0.3.0-live-http-qa-opencode-smoke.md`
- `docs/evidence-reviews/v0.3.0-policy-overlay-accepted-implementation-smoke.md`

## Artifact Inventory

| Artifact | Java files | Test files | Test result XML | Evidence JSON | Gradle only |
| --- | ---: | ---: | ---: | ---: | --- |
| persona-real-demo | 33 | 1 | 1 | 4 | PASS |
| persona-real-demo-2 | 48 | 3 | 2 | 13 | PASS |
| persona-real-demo-3 | 52 | 1 | 1 | 21 | PASS |
| persona-real-demo-4 | 18 | 0 | 0 | 47 | PASS |
| persona-real-demo-5 | 19 | 0 | 0 | 48 | PASS |
| persona-v021-quality-check | 36 | 1 | 1 | 143 | PASS |
| persona-v021-quality-check-course | 37 | 1 | 1 | 31 | PASS |

All included artifacts have `build.gradle` and `settings.gradle`, and none has `pom.xml`.

## Rubric Comparison

| Criterion | Result | Evidence |
| --- | --- | --- |
| Gradle only | Strong PASS | 7/7 generated apps have `build.gradle` and `settings.gradle`; 0/7 has `pom.xml`. |
| Root package stability | Mixed | Roots vary: `com.personarealdemo`, `com.personareal.demo`, `com.example`, `com.example.librarylending`, `com.example.courseenrollment`. This is acceptable across different domains, but some roomescape-style runs split roots inconsistently across `global` and domain packages. |
| `global + domain package` structure | Mostly PASS | Most apps separate shared `global` exception/response code from domain packages. Exception placement is inconsistent: some domain-specific exceptions sit under `global`, while later `library`/`v021` samples move some exceptions into domain packages. |
| `presentation/application/domain/infrastructure` boundary | PASS with variation | The later samples and v0.2.1 quality checks show the desired boundary clearly. Earlier roomescape samples also have boundary packages, but some use `feature/<domain>/...` and some place repository ports directly under infrastructure. |
| Domain repository port + infrastructure implementation | Mostly PASS, one clear historical WARN | `persona-real-demo-2` has repository interfaces under `infrastructure`, not `domain`. Other inspected apps generally have `*Repository` ports under `domain` and `Jdbc*`/`InMemory*Repository` implementations under `infrastructure`. |
| Service does not own storage/id sequence | PASS | A field-level scan found no application service directly owning `Map`, `AtomicLong`, `nextId`, `idCounter`, or `sequence`. The only narrow hit was a method parameter/local `List` in `persona-real-demo-3`, not storage ownership. |
| Domain owns field-based decisions/state transitions | Weakest repeated area | Several artifacts use domain `record`s as data carriers. `persona-v021-quality-check-course` is the strongest positive example with `Course.canEnroll()`, `Course.enroll()`, `Course.cancelEnrollment()`, and `Enrollment.isOwnedBy(...)`. `persona-real-demo-5` also has `Book.loanTo(...)` and `Book.returnBook()`. Earlier roomescape and first library-lending samples remain record/data-holder heavy. |
| DTO boundary | Mostly PASS after guidance tightening | Later samples have presentation request/response DTOs and application command/result DTOs. `persona-real-demo` has no conventional `dto` package and uses domain command records. |
| Test/build/live HTTP verification | Partial | Existing test result XML exists for 5/7 apps. `persona-real-demo-4` and `persona-real-demo-5` have no existing test result XML. Live HTTP is documented for the v0.2.1 quality review and later v0.3.0 workflow smoke reviews, but not across all Desktop artifacts. |

## Per-artifact Findings

| Artifact | Strong signals | Weak signals |
| --- | --- | --- |
| persona-real-demo | Gradle-only; domain repository ports and JDBC infrastructure implementations; `global` error handling; existing test result. | Domain models are mostly records; DTO boundary is not conventional; evidence count is low. |
| persona-real-demo-2 | Gradle-only; presentation/application/domain/infrastructure packages; DTO packages; existing test results. | Repository ports are under infrastructure; domain models are records/data holders; application services depend on infrastructure repository names. |
| persona-real-demo-3 | Gradle-only; domain repository ports plus JDBC implementations; DTO boundary; existing test result. | Domain entities are still records; root package shape is cleaner than demo-2 but still not a reusable product template. |
| persona-real-demo-4 | Gradle-only; compact domain package; domain repository port plus infrastructure implementation; class-based `Book`. | No existing test XML; domain behavior is light and lacks guard/self-judgment methods; no live HTTP review. |
| persona-real-demo-5 | Gradle-only; domain repository port plus infrastructure implementation; class-based `Book`; `Book.loanTo(...)` and `Book.returnBook()` carry state transitions; domain exceptions under domain. | No existing test XML; no live HTTP review; generated scope is small. |
| persona-v021-quality-check | Gradle-only; clean domain packages; repository ports in domain; infrastructure implementations; DTO boundary; build/test and manual API QA documented. | `Book`, `Member`, and `Loan` are records; only `Loan` has light self-behavior; README-only bootstrap originally needed target-file follow-up for repository port placement. |
| persona-v021-quality-check-course | Gradle-only; repository ports in domain; infrastructure implementations; DTO boundary; class-based domain models; `Course.canEnroll()` and `Enrollment.isOwnedBy(...)`; build/test documented. | Some domain-specific exceptions are under `global`; live HTTP is not documented in this artifact itself. |

## Repeated Signals

### Stable Positive Signals

- Gradle-only generation is stable across all included generated apps.
- Maven avoidance is stable across all included generated apps.
- Controller/Service/Repository/DTO/layer separation is broadly present.
- Application services generally do not own storage state or id sequence directly.
- Repository port placement improved after the v0.2.1 guidance work and is not the strongest current problem.

### Repeated Weak Signals

- Domain behavior is the most repeated weak point.
  - Earlier roomescape generated apps use records heavily.
  - The first v0.2.1 library-lending quality check still uses records for key domain objects.
  - The strongest positive counterexample is the later course-enrollment check, where domain objects are classes with field-based judgment methods.
- Verification depth is uneven.
  - Some generated apps have test XML and documented manual QA.
  - Some Desktop demos have no current build/test/live HTTP record.
- Package structure is mostly acceptable but not fully stable as a reusable house style.
  - `com.example` plus domain packages appears in later library/course examples.
  - earlier roomescape examples vary between `feature/<domain>` and root-level domain packages.

## Decision

The next guidance candidate should be domain behavior, not repository placement, Service storage, Gradle/Maven, or DTO boundary.

Narrow candidate:

> Domain models should not default to anemic records/data holders when they own meaningful state. A domain object should keep field-based decisions and state transitions close to its own fields, for example `isOwnedBy(...)`, `canEnroll()`, `loanTo(...)`, or `returnBook()`.

This should be treated as Java/backend Clean Code guidance, not enforcement. Do not add an observer, AST/linter, or build gate from this synthesis.

## Why This Candidate

- Repository boundary already improved and is mostly present in later samples.
- Service storage/id sequence ownership is not repeating as an actual field-level problem.
- Gradle-only is stable.
- DTO boundary is mostly present after guidance tightening.
- Domain record/data-holder drift appears across multiple historical generated apps and directly maps to the user's stated target: domain objects should judge their own fields.

## Non-decisions

- Do not claim generated app product quality.
- Do not add a new observer.
- Do not add an AST/linter/enforcement gate.
- Do not run another broad A/B loop before making the next narrow decision.
- Do not widen into frontend/infra/desktop.

## Next

Recommended next loop:

1. Check the current Java shared-skill/backend guidance and rules for domain model behavior wording.
2. If the wording is weak or too implicit, make one narrow wording change around domain self-judgment and state transitions.
3. Verify with one clean Java/Spring Gradle generation after the wording change.
4. Evaluate only the domain behavior criterion first; do not reopen package naming or broad product-quality scoring unless the generated app fails basic build/test/manual QA.
