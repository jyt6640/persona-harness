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
- boolean 파라미터로 두 흐름을 한 메서드에 숨기지 않는다.
- 조건 분기가 늘어나면 도메인 메서드나 별도 타입으로 분리할 수 있는지 먼저 본다.
