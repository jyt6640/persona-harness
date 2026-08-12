---
id: backend.pack.error-contract-global
source: backend-policy
domain: backend
topic: global-error-contract-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*.java"
  - "README.md"
  - "**/README.md"
severity: should
enforcement: inject_only
---

# Explicit Global Error Contract Pack

- 전역 exception handler와 공통 error response envelope는 API 요구사항이나 팀 계약이 명시된 경우에만 선택한다.
- 선택 후에도 Controller마다 응답 변환을 복제하지 말고 하나의 명시된 처리 경계를 사용한다.
- 상태 코드, 오류 필드, validation 표현을 추측하지 말고 README, API schema, 기존 계약에서 확인한다.
