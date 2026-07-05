---
id: clean-code.method-design
source: clean-code
domain: common
topic: method-design
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Method Design

- 메서드는 하나의 의도를 가진다.
- 메서드 이름은 내부 절차가 아니라 호출자가 얻는 결과를 표현한다.
- `validateAndCancel`, `process`, `execute`, `handle`처럼 여러 의도나 모호한 절차를 숨기는 이름은 지양한다.
- 정상 흐름을 읽기 쉽게 만들기 위해 실패 조건은 early return이나 early throw로 먼저 정리한다.
- 인자는 가능한 적게 유지하고, 인자가 많아지면 의미 단위로 묶는다.
- boolean 파라미터로 두 흐름이나 정책 차이를 한 메서드에 숨기지 않는다.
- 복잡한 조건식은 도메인 의미가 드러나는 메서드나 변수로 추출한다.
- 조건 분기가 늘어나면 도메인 메서드, 정책 객체, 별도 타입으로 책임을 분리할 수 있는지 먼저 본다.
- null 반환을 기본 전략으로 사용하지 않고, 의미 있는 부재는 Optional 또는 명확한 예외로 표현한다.
- 지역 변수는 사용하는 곳 가까이에 선언하고, 임시 변수 이름도 도메인 의미를 드러내게 한다.
