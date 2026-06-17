---
id: backend.spring.test
source: backend-policy
domain: backend
topic: test-policy
globs:
  - "**/*Test.java"
severity: must
enforcement: inject_only
---

# Backend Test Policy

## 메모리 저장소 테스트 격리

- 메모리 저장소, static Map, static List, sequence/id generator를 사용하는 테스트는 테스트 간 상태를 반드시 초기화한다.
- 각 테스트는 독립적으로 실행되어야 하며, 이전 테스트의 저장 데이터나 id sequence에 의존하지 않는다.
- Repository가 in-memory 구현이면 `@BeforeEach`에서 `clear()` 또는 동등한 초기화 메서드를 호출한다.
- 테스트가 단독 실행될 때만 통과하고 전체 실행에서 실패하면 상태 공유를 1순위 원인으로 의심한다.
- `@DirtiesContext`는 마지막 수단이며, 먼저 저장소 초기화 API를 명시적으로 제공하는 방식을 우선한다.

## HTTP Contract Test

- 테스트는 요구사항의 HTTP method, path, status, response body를 직접 검증한다.
- 테스트는 구현이 선택한 REST 관습을 따라가지 말고, 요구사항에 적힌 status/body 계약을 고정한다.
- 1단계 Controller 테스트는 첫 생성 응답의 `id`가 1인지, 생성 후 목록 크기가 1인지, 삭제 후 목록 크기가 0인지 검증한다.
- 생성 전 조회, 생성 후 조회, 삭제 후 조회처럼 상태 변화를 한 흐름으로 확인한다.
- 테스트가 컴파일되는지 확인하지 않고 완료했다고 말하지 않는다.
- 테스트 helper보다 요구사항의 입력과 기대값이 먼저 읽혀야 한다.
- Controller 테스트는 HTTP 계약을, Service/Domain 테스트는 유스케이스와 규칙을 검증한다.
- 테스트는 구현 클래스의 private 흐름보다 사용자에게 보이는 결과를 기준으로 실패해야 한다.
