---
id: backend.pack.migration-flyway
source: backend-policy
domain: backend
topic: migration-flyway-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/build.gradle"
  - "**/build.gradle.kts"
  - "README.md"
  - "**/README.md"
severity: should
enforcement: inject_only
---

# Explicit Flyway Migration Pack

- Flyway를 migration tool로 명시적으로 선택한 경우에만 Flyway dependency, migration location, naming, 실행 순서를 계획에 포함한다.
- 이미 적용된 migration 파일은 수정하거나 재사용으로 덮어쓰지 않고 새 forward-only migration으로 변경한다.
- Flyway를 선택하지 않은 JDBC/JPA profile에는 Flyway 파일과 dependency를 추측해 만들지 않는다.
