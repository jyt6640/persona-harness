---
id: clean-code.testability
source: clean-code
domain: common
topic: testability
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

# Testability

- 외부 입출력, 시간, 저장소 같은 변하는 요소는 테스트에서 통제할 수 있게 분리한다.
- 테스트는 public behavior를 검증하고 내부 구현 순서에 과하게 결합하지 않는다.
- 성공 경로만 확인하지 말고 비어 있음, 삭제 후 상태, 잘못된 입력 같은 경계 조건을 확인한다.
- 테스트 데이터는 읽는 사람이 요청과 응답을 바로 이해할 수 있게 명시한다.
- 테스트는 빠르고 독립적으로 실행되어야 하며, 실행 순서나 이전 테스트의 상태에 기대지 않는다.
- Mock은 상호작용 자체가 요구사항일 때 사용하고, 단순 상태 검증은 가짜 구현이나 실제 객체를 우선 검토한다.
