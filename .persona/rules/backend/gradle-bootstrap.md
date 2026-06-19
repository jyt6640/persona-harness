---
id: backend.gradle-bootstrap
source: backend-policy
domain: backend
topic: gradle-bootstrap
globs:
  - "build.gradle"
  - "settings.gradle"
  - "**/build.gradle"
  - "**/settings.gradle"
  - "build.gradle.kts"
  - "settings.gradle.kts"
  - "**/build.gradle.kts"
  - "**/settings.gradle.kts"
severity: must
enforcement: inject_only
---

# Gradle Bootstrap

- Gradle build file에서는 Java/Spring Boot backend 기준을 유지하고 Maven `pom.xml`을 생성하지 않는다.
- `settings.gradle` 또는 `settings.gradle.kts`는 하나의 Spring Boot application root project 이름을 명확히 둔다.
- `build.gradle` 또는 `build.gradle.kts`는 Spring Boot backend를 만들기 위한 최소 plugin/dependency/source compatibility만 다룬다.
- build 설정은 presentation/application/domain/infrastructure package 구조를 대신하지 않는다.
- build file target에서는 frontend/infra/multi-domain productization으로 확장하지 않는다.
