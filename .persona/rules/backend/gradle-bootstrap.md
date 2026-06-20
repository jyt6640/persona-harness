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
- `build.gradle` 또는 `build.gradle.kts`는 호환되는 Spring Boot/Gradle/JDK 조합을 선택하고 그 선택을 toolchain/source compatibility에 반영한다. 임의로 최신 Gradle과 오래된 Spring Boot plugin을 섞지 말고, JUnit Platform 실행에는 `junit-platform-launcher`를 포함하며, 실행 가능한 Spring Boot app에서는 build 성공을 위해 `bootJar`를 끄는 방식을 기본 해법으로 쓰지 않는다.
- build 설정은 presentation/application/domain/infrastructure package 구조를 대신하지 않는다.
- build file target에서는 frontend/infra/multi-domain productization으로 확장하지 않는다.
