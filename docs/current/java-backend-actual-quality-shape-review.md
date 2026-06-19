# Java Backend Actual Quality Shape Review

## Goal

Review the actual Java/Spring backend generated in `/Users/yongtae/Desktop/persona-real-demo`, reinforce only the backend product-code-shape guidance that is directly supported by that review, and revalidate with a clean generated run.

This is not a product-quality certification. It is a backend Clean Code shape and uniformity review.

## Original Actual Target

- Project: `/Users/yongtae/Desktop/persona-real-demo`
- Source: copied local `persona-harness` package installed through OpenCode plugin config
- Requirement file: `README.md`
- Validation observed: `./gradlew clean test` passed in the generated project
- Evidence observed: 4 Phase 0 evidence JSON files, all for `README.md`

## Original Successes

- Gradle files were generated and Maven was not generated.
- The app compiled and tests passed.
- Controllers delegated to services instead of owning repository access directly.
- Services did not directly own `Map`, `AtomicLong`, `nextId`, `idCounter`, or comparable id sequence state.
- Some presentation/application/domain/infrastructure separation was attempted.

## Original Shape Issues

- Package drift: generated code used `com.personarealdemo.feature.<domain>...` instead of root-level domain packages beside `global`.
- DTO drift: several request/response records were nested inside controllers instead of living under `presentation/dto/request` and `presentation/dto/response`.
- Service response drift: several response-ish records lived inside services, such as `AvailableTimeResponse`, `UserThemeResponse`, `UserReservationItem`, and `ThemePopularityResponse`.
- Application result boundary was weak: services returned domain entities or response-shaped nested records instead of explicit application result DTOs.
- Repository boundary was weak: generated repository implementations assembled richer aggregate objects and, in some cases, depended on other repositories.
- The actual evidence showed only `README.md` bootstrap injection. There was no Java target evidence in the first run, so Java role rules and the `programming` shared skill did not appear to influence most code creation.

## Reinforcement Basis

The reinforcement is intentionally narrow:

- Do not use `feature/features/module/modules` wrapper packages for the default Java backend MVP shape.
- Put `global` and root-level domain packages at the same depth under the root application package.
- Use explicit file DTO boundaries:
  - `root/<domain>/presentation/dto/request`
  - `root/<domain>/presentation/dto/response`
  - `root/<domain>/application/dto/command`
  - `root/<domain>/application/dto/result`
- Avoid nested request/response records inside controllers.
- Avoid nested `*Response`, `*Item`, or `*View` records/classes inside application services.
- Keep Service outputs as application results, not presentation response DTOs.
- Keep repository aggregate assembly and cross-repository implementation dependencies visible rather than hiding them inside repository implementations.
- During bootstrap, plan the package structure first and re-read key role files before continuing to the next role.

## Actual Revalidation

- Project: `/Users/yongtae/Desktop/persona-real-demo-2`
- Command: `opencode run --dir /Users/yongtae/Desktop/persona-real-demo-2 --model openai/gpt-5.4-mini-fast "README.md를 끝까지 읽고, 요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘."`
- Package setup:
  - `npm install -D /Users/yongtae/Desktop/persona-harness`
  - `npx persona-harness init`
- Generated validation: `gradle clean test` passed.
- Root files:
  - `build.gradle`
  - `settings.gradle`
  - no `pom.xml`
  - no Gradle wrapper generated; the run used system `gradle`

## Revalidation Evidence

Phase 0 evidence files in `/Users/yongtae/Desktop/persona-real-demo-2/.persona/evidence/phase0`:

- Total evidence JSON: 13
- File roles:
  - `project-bootstrap`: 4
  - `service`: 9
- Selected shared skills:
  - `programming`: 9, all on Java Service targets
  - `frontend`: 0
- Model-input injections:
  - README bootstrap: 1
  - Java Service: 1

## Revalidation Shape Result

Improved:

- `feature/features/module/modules` wrapper packages were not generated.
- Domain packages were created at root depth beside `global`, for example:
  - `com.personareal.demo.reservation`
  - `com.personareal.demo.theme`
  - `com.personareal.demo.time`
  - `com.personareal.demo.waiting`
- `presentation/dto/request` and `presentation/dto/response` files were generated.
- `application/dto/command` and `application/dto/result` files were generated.
- No nested controller request/response DTO records were found.
- No nested service `*Response`, `*Item`, or `*View` records/classes were found.
- No direct service-owned storage or id sequence state was found.
- `gradle clean test` passed.

Still weak:

- Repository interfaces were not placed in the domain package. The generated project used concrete repository classes in infrastructure, for example `reservation/infrastructure/ReservationRepository.java`.
- Repository naming still conflates the domain repository contract and the infrastructure implementation.
- The generated app did not create a Gradle wrapper, so local validation used system `gradle`.
- Java role injection only appeared after the model read Service files; Controller, DTO, and Repository role evidence was not observed in the clean rerun.

## Conclusion

The backend shape reinforcement produced a real positive signal on package depth, DTO file boundaries, application result DTOs, and service-owned state avoidance. It did not fully settle repository contract placement or role-by-role file reading.

## Repository Boundary Follow-up

Accepted next reinforcement:

- Domain owns the repository contract.
- `root/<domain>/domain/<Domain>Repository` is an interface, for example `BookRepository`.
- Infrastructure owns the implementation.
- `root/<domain>/infrastructure/Jdbc<Domain>Repository` or `root/<domain>/infrastructure/InMemory<Domain>Repository` is the implementation, for example `JdbcBookRepository` or `InMemoryBookRepository`.
- Infrastructure implementations should not be named only `<Domain>Repository`, because that hides the difference between the domain contract and the persistence adapter.

This is still product-code-shape guidance, not an enforcement gate or product-quality certification.

## Future TDD Direction

The long-term target is for generated backend work to follow a Test -> Feat -> Refactor loop. That is intentionally not expanded in this repository-boundary loop. Current validation remains focused on product code structure and Clean Code uniformity; test workflow policy should be handled as a later, separate track.

## Repository Boundary Clean Revalidation

- Project: `/Users/yongtae/Desktop/persona-real-demo-3`
- Command: `opencode run --dir /Users/yongtae/Desktop/persona-real-demo-3 --model openai/gpt-5.4-mini-fast "README.md를 끝까지 읽고, 요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘."`
- Package setup:
  - `npm install -D /Users/yongtae/Desktop/persona-harness`
  - `npx persona-harness init`
- Generated validation: `gradle clean test` passed.

Observed repository boundary result:

- Domain repository interfaces were generated:
  - `reservation/domain/ReservationRepository.java`
  - `theme/domain/ThemeRepository.java`
  - `time/domain/TimeRepository.java`
  - `waiting/domain/WaitingRepository.java`
- Infrastructure implementations were generated:
  - `reservation/infrastructure/JdbcReservationRepository.java`
  - `theme/infrastructure/JdbcThemeRepository.java`
  - `time/infrastructure/JdbcTimeRepository.java`
  - `waiting/infrastructure/JdbcWaitingRepository.java`
- No infrastructure repository class used the ambiguous plain `<Domain>Repository` implementation name.

Observed role evidence:

- Total Phase 0 evidence JSON: 21
- File roles:
  - `project-bootstrap`: 10
  - `service`: 6
  - `java-common`: 2
  - `test`: 3
- Selected shared skills:
  - `programming`: 11
- Model-input injections: 4

Shape result:

- `feature/features/module/modules` wrapper packages were not generated.
- Controller nested request/response DTO records were not found.
- Service nested `*Response`, `*Item`, or `*View` records/classes were not found.
- Service-owned `Map`, `AtomicLong`, `nextId`, `idCounter`, or direct id sequence state was not found.
- Gradle wrapper was generated in this run.

Remaining limitation:

- Controller, DTO, and Repository role evidence still did not appear naturally in this clean run. The generated shape improved through bootstrap/java-common/service/test surfaces, but role-by-role Java file reads are not yet consistently observed across every backend role.
