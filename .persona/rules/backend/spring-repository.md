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

- Repository는 저장소 접근과 조회 컬렉션 관리만 담당한다.
- 비즈니스 판단을 Repository query 조건이나 map 조작 안에 숨기지 않는다.
- 메모리 저장소 단계에서는 id 발급과 저장 상태 변화가 테스트 가능해야 한다.
- find/save/delete 메서드는 호출자가 기대하는 저장소 의미를 명확히 드러낸다.
- SQL, JPA, Map 같은 저장 방식 세부사항은 호출 계층의 비즈니스 흐름에 새지 않게 한다.
- Repository 메서드 이름은 저장소 기술보다 도메인 관점의 조회 의미를 드러낸다.
