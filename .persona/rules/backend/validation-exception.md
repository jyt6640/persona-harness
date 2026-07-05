---
id: backend.validation-exception
source: backend-policy
domain: backend
topic: validation-exception
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---

# Validation And Exception Policy

- 검증 책임은 그 규칙을 가장 잘 아는 계층에 둔다. 형식 검증은 입력 경계에, 도메인 규칙은 도메인에 둔다.
- 예외는 일반적인 분기 처리를 대신하는 수단으로 쓰지 않는다.
- 예외 메시지와 타입은 호출자가 이해할 수 있는 도메인 의미를 드러낸다.
- Spring 애플리케이션에서는 예외 응답 변환을 Controller마다 흩뿌리지 않고 일관된 처리 지점에 모은다.
- 구체적인 ErrorCode 체계는 프로젝트 규모와 API 요구가 충분할 때 도입한다.
