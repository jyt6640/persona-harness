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

- Gradle build file에서는 Java/Spring Boot backend 기준을 유지하고 Maven `pom.xml`을 생성하지 않는다. Hard rule: `gradle test`, `gradle build`, `bootRun` 결과를 Node/JS/Python/shell shim이나 `tools/gradle-shim.js` 같은 fake Gradle script로 흉내 내지 않는다. Gradle wrapper와 system Gradle이 모두 없으면 성공처럼 말하지 말고 toolchain/environment issue인 환경 문제로 보고한다.
- `settings.gradle` 또는 `settings.gradle.kts`는 하나의 Spring Boot application root project 이름을 명확히 둔다.
- Default guidance: `build.gradle` 또는 `build.gradle.kts`는 Spring Boot backend용 최소 plugin/dependency/source compatibility만 담고, 호환되는 Spring Boot plugin / Gradle launcher or wrapper / JDK toolchain 조합을 먼저 선택한다. Gradle wrapper를 프로젝트 산출물로 포함하고, system Gradle이 없으면 wrapper를 우선 생성/사용하며, system Gradle이 있어도 clean project 재현성을 위해 wrapper를 선호한다. 검증은 macOS/Linux `./gradlew test`, `./gradlew build`, `./gradlew bootRun`, Windows `gradlew.bat test`, `gradlew.bat build` 또는 `./gradlew.bat test`를 우선한다. Spring Boot dependencies는 `org.springframework.boot` plugin과 `io.spring.dependency-management` 또는 Boot plugin-managed dependencies를 사용하고, `spring-boot-starter-*`, JDBC/JPA/validation starter, `org.flywaydb:flyway-core`에는 임의의 빈 version 또는 dot version을 붙이지 않는다. build.gradle self-check: Gradle 실행 전 dependency notation에 `:.`, 빈 version, Boot-managed starter explicit version이 있으면 repair before test/build. dependency version을 모르면 성공처럼 진행하지 말고 Spring Initializr/build.gradle template 또는 generated wrapper project의 valid build line을 따른다. wrapper 생성 후 `gradlew.bat test/build`가 dependency resolution으로 실패하면 build.gradle을 고치고 재검증한다. JUnit Platform 실행에는 `testRuntimeOnly "org.junit.platform:junit-platform-launcher"` 또는 동등한 runtime launcher를 포함한다.
- 실행 가능한 Spring Boot app에서는 `bootJar`를 끄지 않는다. `tasks.named("bootJar") { enabled = false }` 또는 동등한 설정은 plain Java library로 명시된 프로젝트가 아니면 사용하지 않는다. `gradle build` 출력에 `:bootJar SKIPPED`가 나오면 실행 가능한 Spring Boot app 검증을 통과한 것으로 기록하지 않는다. `bootJar`가 `CopyProcessingSpec.getDirMode()` 같은 호환성 오류로 실패하면, `bootJar`를 비활성화하지 말고 Spring Boot plugin을 현재 Gradle과 호환되는 line으로 올리거나 Gradle wrapper를 해당 plugin이 지원하는 line으로 고정한다.
- 로컬 launcher가 Gradle 9.x이면 Spring Boot 3.3.x 같은 오래된 plugin line을 기본으로 섞지 않는다. 호환 여부가 불명확하면 executable app 기준으로 `gradle test`, `gradle build`, `gradle bootRun`이 모두 통과하는 line을 선택한다.
- build 설정은 presentation/application/domain/infrastructure package 구조를 대신하지 않는다.
- build file target에서는 frontend/infra/multi-domain productization으로 확장하지 않는다.
