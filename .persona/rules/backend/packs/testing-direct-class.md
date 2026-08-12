---
id: backend.pack.testing-direct-class
source: backend-policy
domain: backend
topic: direct-class-test-pack
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

# Explicit Direct-Class Test Pack

- production class별 직접 테스트가 필요한 경우에만 이 기준을 선택하고, DTO·configuration·bootstrap 등 제외 대상과 이유를 계획에 적는다.
- 직접 클래스 테스트는 public behavior와 책임 경계를 보강해야 하며 private 구현 흐름을 고정하는 테스트가 되어서는 안 된다.
- public boundary 테스트를 대체하지 않고 위험도에 맞는 slice/integration/acceptance 범위를 함께 선택한다.
