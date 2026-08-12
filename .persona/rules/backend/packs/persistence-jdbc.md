---
id: backend.pack.persistence-jdbc
source: backend-policy
domain: backend
topic: persistence-jdbc-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Repository.java"
  - "**/build.gradle"
  - "**/build.gradle.kts"
  - "README.md"
  - "**/README.md"
severity: should
enforcement: inject_only
---

# Explicit JDBC Persistence Pack

- JDBC/JdbcTemplate은 persistence technology로 선택된 경우에만 사용하며, JPA entity, repository, annotation을 자동으로 추가하지 않는다.
- Repository interface와 JDBC 구현의 경계를 유지하고 SQL·row mapping 세부사항을 Controller나 Application Service에 노출하지 않는다.
- JDBC starter, driver, transaction, schema/migration 방식은 project profile과 요구사항을 확인한 뒤 선택한다.
