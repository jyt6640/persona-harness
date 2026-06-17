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
- 흐름을 진행하는 코드와 판단을 내리는 코드를 구분한다.
- 중복 제거보다 의도 보존을 우선한다. 의미가 다른 코드를 같은 모양이라는 이유만으로 합치지 않는다.
- null을 정상 흐름의 신호로 반환하지 않는다.
- 숨은 전역 상태와 암묵적 부작용을 만들지 않는다.
- 공통화가 필요하면 먼저 이름 있는 책임을 찾고, `Util`, `Helper`, `Manager` 같은 범용 이름을 기본 선택으로 쓰지 않는다.
