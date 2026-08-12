---
id: backend.spring.test
source: backend-policy
domain: backend
topic: test-policy
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Test.java"
severity: must
enforcement: inject_only
---

# Backend Test Policy

- `test-writer` writes failing/verification tests or an executable verification plan before implementation. Java/Spring/Gradle defaults are JUnit Jupiter, AssertJ, the smallest necessary Spring slice, and the project’s selected test command. `test-writer` does not implement product code, `implementer` implements, and `reviewer` reviews tests and requirement satisfaction. Never delete, weaken, or skip tests just to make a failing test pass.
- 메모리 저장소, static Map/List, sequence/id generator를 사용하는 테스트는 저장 데이터와 id sequence를 함께 초기화하고 테스트 간 상태를 공유하지 않는다.
- 핵심 비즈니스 규칙은 Domain public behavior 테스트부터 작성하고, 기능은 안쪽 레이어에서 바깥 방향으로 검증한다.
- Service 테스트는 흐름 조율을 검증하며, 정책 자체는 Domain, Policy, Validator 테스트에서 직접 검증한다.
- Acceptance Test는 마지막 전체 시나리오 검증으로 사용하며 Domain, Validator, Service, Repository, Controller 검증을 대체하지 않는다.
- 테스트는 요구사항의 HTTP method, path, status, response body를 직접 검증하되 구현이 선택한 REST 관습을 요구사항 대신 기본값으로 삼지 않는다.
- 테스트는 구현 클래스의 private 흐름보다 사용자에게 보이는 결과를 기준으로 실패해야 한다.
