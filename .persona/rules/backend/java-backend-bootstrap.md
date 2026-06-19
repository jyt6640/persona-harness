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

- 0-start 요구사항을 먼저 backend product code shape 계획으로 변환하고 Gradle 기반 Spring Boot backend project로 구현한다. Maven 파일은 생성하지 않는다.
- 구현 전에 package structure plan을 작성한다. root package 바로 아래에 `global`과 `root/<domain>`을 같은 depth로 두고, `feature/features/module/modules` 같은 wrapper package를 추가하지 않는다.
- 도메인 package 내부는 presentation/application/domain/infrastructure 흐름을 기본으로 두고 `root/<domain>/presentation`, `root/<domain>/application`, `root/<domain>/domain`, `root/<domain>/infrastructure`로 배치한다.
- DTO는 파일 경계로 둔다. Presentation DTO는 `root/<domain>/presentation/dto/request`와 `root/<domain>/presentation/dto/response`, Application DTO는 `root/<domain>/application/dto/command`와 `root/<domain>/application/dto/result`에 둔다.
- 구현 중에는 package structure plan을 기준으로 Domain, Repository, Service, DTO, Controller 역할 파일을 만들고 주요 Java 파일을 다시 읽고 다음 역할로 넘어간다.
- presentation은 HTTP 요청/응답과 request/response DTO boundary를 담당하고, application service에 위임한다.
- Application Service는 use-case 흐름 조율만 담당하며 Service는 Map/List/AtomicLong/nextId/idCounter 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.
- 저장소 상태와 id generation은 Repository/Store 같은 persistence/storage component 뒤로 위임한다.
- Repository interface는 domain 경계에 두고 구현체는 infrastructure에 둔다.
- Domain은 Spring, HTTP, DB, infrastructure 세부사항에 의존하지 않는다.
- frontend, infra, test-quality, generated app product-quality 보증은 현재 bootstrap injection 범위 밖이다.
