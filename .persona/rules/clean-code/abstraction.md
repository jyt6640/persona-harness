---
id: clean-code.abstraction
source: clean-code
domain: common
topic: abstraction
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---

# Abstraction Policy

- 추상화는 미리 만들지 않고, 반복되는 변경 비용이나 책임 혼재가 실제로 보일 때 도입한다.
- 패턴 적용 자체를 목표로 삼지 않는다. 현재 요구사항을 더 읽기 쉽고 테스트 가능하게 만들 때만 사용한다.
- 상속이나 generic base class보다 명시적인 조합과 작은 타입 분리를 먼저 검토한다.
- 공통 코드가 생겨도 도메인 의미가 다르면 성급하게 합치지 않는다.
- 구조 변경은 public behavior를 유지한 채 작게 진행한다.
