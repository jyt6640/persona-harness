---
id: clean-code.naming
source: clean-code
domain: common
topic: naming
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---

# Naming

- 이름은 구현 방식보다 도메인 의도와 유스케이스를 드러낸다.
- 축약어와 모호한 접미사(`data`, `info`, `manager`)를 기본 선택으로 쓰지 않는다.
- boolean 이름은 참/거짓 의미가 문장처럼 읽히게 한다.
- 테스트 이름은 조건과 기대 결과를 함께 드러낸다.
