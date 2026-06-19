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
- 구현 전에 package structure plan을 작성하고, root package 아래에 `global`과 feature package를 같은 depth로 둔다.
- feature package 내부는 presentation/application/domain/infrastructure 흐름을 기본으로 둔다.
- presentation은 HTTP 요청/응답과 request/response DTO boundary를 담당하고, application service에 위임한다.
- Application Service는 use-case 흐름 조율만 담당하며 Service는 Map/List/AtomicLong/nextId/idCounter 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.
- 저장소 상태와 id generation은 Repository/Store 같은 persistence/storage component 뒤로 위임한다.
- Repository interface는 domain 경계에 두고 구현체는 infrastructure에 둔다.
- Domain은 Spring, HTTP, DB, infrastructure 세부사항에 의존하지 않는다.
- frontend, infra, test-quality, generated app product-quality 보증은 현재 bootstrap injection 범위 밖이다.
