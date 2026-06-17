---
id: clean-code.method-design
source: clean-code
domain: common
topic: method-design
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Method Design

- 메서드는 하나의 의도를 가진다.
- 메서드 이름은 내부 절차가 아니라 호출자가 얻는 결과를 표현한다.
- 정상 흐름을 읽기 쉽게 만들기 위해 실패 조건은 early return이나 early throw로 먼저 정리한다.
- boolean 파라미터로 두 흐름을 한 메서드에 숨기지 않는다.
- 복잡한 조건식은 도메인 의미가 드러나는 메서드나 변수로 추출한다.
- 조건 분기가 늘어나면 도메인 메서드, 정책 객체, 별도 타입으로 책임을 분리할 수 있는지 먼저 본다.
- 지역 변수는 사용하는 곳 가까이에 선언하고, 임시 변수 이름도 도메인 의미를 드러내게 한다.
