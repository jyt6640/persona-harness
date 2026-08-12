---
id: backend.pack.testing-gwt
source: backend-policy
domain: backend
topic: gwt-test-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Test.java"
severity: should
enforcement: inject_only
---

# Explicit Given/When/Then Test Pack

- Given/When/Then 구조가 팀 테스트 convention 또는 이슈 close condition인 경우에만 선택한다.
- 각 테스트는 하나의 When과 관찰 가능한 Then을 갖고, 문구 snapshot이나 구현 세부사항 대신 public contract를 검증한다.
- 기존 테스트 스타일이 다른 경우 이 pack을 형식 강제로 사용하지 말고 요구사항과 repository convention을 따른다.
