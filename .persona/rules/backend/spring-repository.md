---
id: backend.spring.repository
source: backend-policy
domain: backend
topic: repository-boundary
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Repository.java"
severity: should
enforcement: inject_only
---

# Repository Policy

- Repository contract는 domain 경계의 interface로 두고 구현은 infrastructure 또는 프로젝트가 선택한 persistence 경계에 둔다. HTTP Request/Response DTO를 저장소 API나 저장 상태로 삼지 않는다.
- Repository 구현체가 다른 Repository 구현체를 주입받아 aggregate를 조립하거나 N+1 조회 흐름을 숨기지 않는다. 여러 aggregate 조립은 application orchestration, 전용 query/read model, 또는 명시적 infrastructure query 책임으로 분리한다.
- 저장소 경계를 둘지와 구현 이름은 프로젝트 규모와 profile에서 결정한다. 메모리 저장소를 선택했다면 상태와 id sequence를 그 경계가 소유하고 테스트 초기화 방법을 제공한다.
- 비즈니스 판단을 Repository query 조건이나 map 조작 안에 숨기지 않는다.
- 선택한 SQL, JPA, Map 같은 저장 방식의 세부사항은 호출 계층의 비즈니스 흐름에 새지 않게 한다.
- Repository 메서드 이름은 저장소 기술보다 도메인 관점의 조회 의미를 드러낸다.
