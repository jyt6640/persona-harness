---
id: backend.java-backend-bootstrap
source: backend-policy
domain: backend
topic: backend-bootstrap
globs:
  - "README.md"
  - "**/README.md"
  - "requirements.md"
  - "**/requirements.md"
severity: must
enforcement: inject_only
---

# Java Backend Bootstrap

- 0-start 요구사항을 먼저 backend product code shape 계획으로 변환하고 Gradle 기반 Spring Boot backend project로 구현한다. Maven 파일은 생성하지 않는다. Hard rule: Gradle 없는 환경에서 Node/JS/Python/shell shim 또는 `tools/gradle-shim.js` 같은 fake Gradle script로 `gradle test`, `gradle build`, `bootRun`을 흉내 내지 않는다. Gradle wrapper와 system Gradle이 모두 없으면 성공처럼 말하지 말고 toolchain/environment issue로 보고한다. Default guidance: Gradle project라면 `gradlew`, `gradlew.bat`, `gradle/wrapper/`를 만들거나 실제 Gradle launcher 사용 가능성을 확인하고, system Gradle이 없으면 wrapper를 우선 사용한다. 검증 명령은 macOS/Linux `./gradlew test`, Windows에서는 `./gradlew.bat test` 또는 `gradlew.bat test`를 우선 예시로 든다. Project-choice: Spring/Gradle/JPA/database profile이면 HttpServer/InMemory/Node shim으로 우회하지 말고 실제 Spring Boot/Gradle/JPA 구조를 만들며, DB/JPA/Flyway 선택은 profile 또는 project-choice를 따른다.
- 구현 전에 package structure plan을 작성한다. root package 바로 아래에 `global`과 `root/<domain>`을 같은 depth로 두고, `feature/features/module/modules` 같은 wrapper package를 추가하지 않는다.
- 도메인 package 내부는 presentation/application/domain/infrastructure 흐름을 기본으로 두고 `root/<domain>/presentation`, `root/<domain>/application`, `root/<domain>/domain`, `root/<domain>/infrastructure`로 배치한다.
- `root/<domain>/controller`, `root/<domain>/service`, `root/<domain>/repository`, `root/<domain>/dto` 또는 `book/controller`, `book/service`, `book/repository`, `book/dto/request` 같은 역할명 package로 대체하지 않는다. Controller는 `presentation`, Service는 `application`, Repository interface는 `domain`, Repository 구현체는 `infrastructure`, HTTP DTO는 `presentation/dto`, Command/Result는 `application/dto`에 둔다.
- DTO는 파일 경계로 둔다. Presentation DTO는 `root/<domain>/presentation/dto/request`와 `root/<domain>/presentation/dto/response`, Application DTO는 `root/<domain>/application/dto/command`와 `root/<domain>/application/dto/result`에 둔다.
- 구현 중에는 package structure plan을 기준으로 Domain, Repository, Service, DTO, Controller 역할 파일을 만들고 주요 Java 파일을 다시 읽고 다음 역할로 넘어간다. Domain entity/aggregate가 static factory를 쓰면 public constructor가 아니라 private constructor로 생성 경로를 닫는다.
- presentation은 HTTP 요청/응답과 request/response DTO boundary를 담당하고, application service에 위임한다.
- Application Service는 use-case 흐름 조율만 담당하며 Service는 Map/List/AtomicLong/nextId/idCounter 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.
- 저장소 상태와 id generation은 Repository/Store 같은 persistence/storage component 뒤로 위임한다.
- Repository interface는 domain 경계에 `root/<domain>/domain/<Domain>Repository`로 두고 구현체는 infrastructure 경계에 `Jdbc<Domain>Repository` 또는 `InMemory<Domain>Repository`로 둔다.
- Domain은 Spring, HTTP, DB, infrastructure 세부사항에 의존하지 않는다.
- Domain entity/aggregate는 record 데이터 홀더로 만들지 않는다. 자신의 필드로 판단할 수 있는 규칙은 `isOwner(name)`, `isReturned()`, `canLoan()` 같은 의미 있는 메서드로 Domain 객체가 직접 판단하고, Application Service가 getter/accessor로 필드를 꺼내 판단하지 않는다.
- Domain entity/aggregate가 `create`, `restore`, `of` 같은 static factory로 생성 경로를 제공하면 public constructor를 열지 않고 private constructor로 닫는다.
- frontend, infra, test-quality, generated app product-quality 보증은 현재 bootstrap injection 범위 밖이다.
