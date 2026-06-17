---
id: clean-code.common
source: clean-code
domain: common
topic: readability
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Clean Code Baseline

- 코드는 짧게보다 명확하게 작성한다.
- 한 파일과 한 타입은 읽는 사람이 예측할 수 있는 하나의 중심 책임을 가져야 한다.
- 구현 편의를 위해 API 계약, 도메인 규칙, 영속성 세부사항을 한 곳에 섞지 않는다.
- null을 정상 흐름의 신호로 반환하지 않는다.
- 숨은 전역 상태와 암묵적 부작용을 만들지 않는다.
