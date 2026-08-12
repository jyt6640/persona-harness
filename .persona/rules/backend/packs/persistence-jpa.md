---
id: backend.pack.persistence-jpa
source: backend-policy
domain: backend
topic: persistence-jpa-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Entity.java"
  - "**/*Repository.java"
  - "**/build.gradle"
  - "**/build.gradle.kts"
  - "README.md"
  - "**/README.md"
severity: should
enforcement: inject_only
---

# Explicit JPA Persistence Pack

- JPA/Hibernate는 persistence technology로 명시적으로 선택된 경우에만 적용한다.
- Entity mapping, persistence annotations, repository implementation, fetch/transaction choices를 선택한 요구사항과 기존 코드에서 확인한다.
- JDBC profile이나 불확정 profile에 JPA dependency, entity mapping, repository convention을 추측해 추가하지 않는다.
