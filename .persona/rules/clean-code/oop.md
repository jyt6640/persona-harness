---
id: clean-code.oop
source: clean-code
domain: common
topic: object-responsibility
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---

# Object Responsibility

- 객체는 자신의 상태와 규칙을 스스로 지키게 한다.
- 외부에서 getter로 상태를 꺼내 판단한 뒤 다시 객체를 조작하는 흐름을 기본 선택으로 삼지 않는다.
- 상태 변경은 의미 있는 행위 메서드로 표현한다.
- 불변으로 만들 수 있는 값은 불변으로 두고, setter는 기본으로 열지 않는다.
- 복잡한 정책 판단은 도메인 객체나 이름 있는 정책 타입으로 옮겨 호출자의 흐름 코드를 단순하게 둔다.
