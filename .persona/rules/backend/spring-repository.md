---
id: backend.spring.repository
source: backend-policy
domain: backend
topic: repository-boundary
globs:
  - "**/*Repository.java"
severity: should
enforcement: inject_only
---

# Repository Policy

- Repository contract는 domain package의 BookRepository 같은 interface로 두고, 저장소 구현은 infrastructure의 JdbcBookRepository 또는 InMemoryBookRepository 같은 class로 둔다. Repository는 저장소 접근, Map/List 상태, id sequence, 테스트 reset을 담당하고, HTTP Request/Response DTO를 저장소 API나 저장 상태로 삼지 않는다.
- Repository 구현체가 다른 Repository 구현체를 주입받아 aggregate를 조립하거나 N+1 조회 흐름을 숨기지 않는다. 여러 aggregate 조립은 application orchestration, 전용 query/read model, 또는 명시적 infrastructure query 책임으로 분리한다.
- 메모리 CRUD나 작은 프로젝트에서도 Repository를 생략하지 않는다. `ReservationRepository` 같은 Repository 이름은 저장소 계약 interface로 두고, Map/List 저장 상태와 id sequence는 `InMemoryReservationRepository` 같은 `@Repository` 구현체에 둔다.
- 비즈니스 판단을 Repository query 조건이나 map 조작 안에 숨기지 않는다.
- 메모리 저장소 단계에서는 id 발급, 저장 상태 변화, 테스트 초기화가 가능해야 한다.
- in-memory Repository는 테스트에서 호출할 수 있는 `clear()` 또는 동등한 초기화 메서드로 저장 상태와 id sequence를 함께 초기화한다.
- find/save/delete 메서드는 호출자가 기대하는 저장소 의미를 명확히 드러낸다.
- SQL, JPA, Map 같은 저장 방식 세부사항은 호출 계층의 비즈니스 흐름에 새지 않게 한다.
- Repository 메서드 이름은 저장소 기술보다 도메인 관점의 조회 의미를 드러낸다.
