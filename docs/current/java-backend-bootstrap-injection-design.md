# Java Backend Bootstrap Injection Design

## Goal

빈 프로젝트에서 Java 파일이 아직 없어도 `README.md`, `requirements.md`, `build.gradle`, `settings.gradle` 같은 0-start target을 통해 Java/Spring backend Clean Code guidance가 model input에 들어가게 한다.

## Scope

현재 productized MVP는 Java/Spring backend Clean Code injection이다. Bootstrap injection도 이 범위 안에서만 동작한다.

대상:

- `README.md`
- `requirements.md`
- `build.gradle`
- `settings.gradle`
- `.gradle.kts` variant

비대상:

- `docs/` 내부 markdown
- `CHANGELOG.md`
- 임의 note markdown
- frontend/infra/multi-domain productization

## File Roles

- `project-bootstrap`: README 기반 project start.
- `requirements-bootstrap`: requirements 문서 기반 project start.
- `gradle-bootstrap`: Gradle build/settings 기반 Spring Boot setup.

## Guidance

- Gradle 고정, Maven 생성 금지.
- Spring Boot backend project로 시작.
- root package 아래 `global`과 feature package를 같은 depth로 둔다.
- feature package 내부는 presentation/application/domain/infrastructure 흐름을 기본으로 둔다.
- Presentation은 HTTP와 DTO boundary를 맡고 Application Service에 위임한다.
- Application Service는 use-case orchestration만 담당한다.
- Service는 Map/List/AtomicLong/nextId/idCounter 같은 storage state나 id sequence를 직접 소유하지 않는다.
- storage state와 id generation은 Repository/Store 같은 persistence/storage component 뒤로 위임한다.
- Domain은 Spring/HTTP/DB/infrastructure 세부사항에 독립적이어야 한다.

## Non-Goals

- `.md` 전체에 무조건 injection을 걸지 않는다.
- generated Spring app product-quality 보증이 아니다.
- test-quality gate가 아니다.
- AST/linter/Guard/enforcement가 아니다.
- frontend/infra/multi-domain productization이 아니다.

## Evidence

Bootstrap hook이 발동하면 `.persona/evidence/phase0/*.json`에 `targetFile`, `fileRole`, `selectedRules`, `selectedRuleMetadata`, `injectedInto`가 남는다. Backend profile summary가 같은 injection block에 포함됐는지는 `profileSummaryInjected`로 남겨 README/bootstrap evidence를 AGENTS-only 신호와 구분한다. `.persona/evidence/`는 init template로 복사하지 않고 runtime hook이 만들 때만 생긴다.
