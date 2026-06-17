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

- 테스트는 요구사항의 HTTP method, path, status, response body를 직접 검증한다.
- 생성 전 조회, 생성 후 조회, 삭제 후 조회처럼 상태 변화를 한 흐름으로 확인한다.
- 테스트가 컴파일되는지 확인하지 않고 완료했다고 말하지 않는다.
- 테스트 helper보다 요구사항의 입력과 기대값이 먼저 읽혀야 한다.
