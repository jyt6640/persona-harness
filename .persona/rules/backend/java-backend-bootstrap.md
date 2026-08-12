---
id: backend.java-backend-bootstrap
source: backend-policy
domain: backend
topic: backend-bootstrap
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "README.md"
  - "**/README.md"
  - "requirements.md"
  - "**/requirements.md"
severity: must
enforcement: inject_only
---

# Java Backend Bootstrap

- 0-start 요구사항을 먼저 backend product code shape 계획으로 변환하고 Gradle 기반 Spring Boot backend project로 구현한다. Maven 파일은 생성하지 않는다. Hard rule: Gradle 없는 환경에서 Node/JS/Python/shell shim 또는 `tools/gradle-shim.js` 같은 fake Gradle script로 `gradle test`, `gradle build`, `bootRun`을 흉내 내지 않는다. Gradle wrapper와 system Gradle이 모두 없으면 성공처럼 말하지 말고 toolchain/environment issue로 보고한다. Default guidance: 새 Java/Spring/Gradle project는 `gradlew`, `gradlew.bat`, `gradle/wrapper/` 같은 Gradle wrapper를 프로젝트 산출물로 포함하고, system Gradle이 없으면 wrapper를 우선 사용하며, system Gradle이 있어도 clean project 재현성을 위해 wrapper를 선호한다. 검증은 macOS/Linux `./gradlew test`, `./gradlew build`, `./gradlew bootRun`, Windows `gradlew.bat test`, `gradlew.bat build` 또는 `./gradlew.bat test`를 우선한다. Spring Boot dependency 버전은 `org.springframework.boot` plugin과 dependency management, project profile에서 확인하며 선택하지 않은 persistence나 migration 기술을 추측해 추가하지 않는다. build.gradle self-check: Gradle 실행 전 dependency notation에 `:.`, 빈 version, managed dependency의 임의 version이 있으면 repair before test/build. dependency version을 모르면 성공처럼 진행하지 말고 Spring Initializr/build.gradle template 또는 generated wrapper project의 valid build line을 따른다. wrapper 생성 후 `gradlew.bat test/build`가 dependency resolution으로 실패하면 build.gradle을 고치고 재검증한다.
- package와 DTO 구조는 README, 기존 코드, project profile, 명시 요구사항에 맞춰 계획한다. 선택된 conditional pack이 없는 상태에서는 특정 persistence, global response, test-style, workflow artifact 구조를 기본 생성하지 않는다.
- 구현 중에는 선택된 구조 계획을 기준으로 Domain, Repository, Service, DTO, Controller 역할 파일을 만들고 주요 Java 파일을 다시 읽고 다음 역할로 넘어간다.
- presentation은 HTTP 요청/응답과 선택된 request/response boundary를 담당하고 application service에 위임한다.
- Application Service는 use-case 흐름 조율만 담당하며 Service는 Map/List/AtomicLong/nextId/idCounter 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.
- 저장소 상태와 id generation은 Repository/Store 같은 명시적인 persistence boundary 뒤로 위임한다.
- Domain은 Spring, HTTP, DB, infrastructure 세부사항에 의존하지 않는다.
- Domain entity/aggregate는 record 데이터 홀더로 만들지 않는다. 자신의 필드로 판단할 수 있는 규칙은 `isOwner(name)`, `isReturned()`, `canLoan()` 같은 의미 있는 메서드로 Domain 객체가 직접 판단하고, Application Service가 getter/accessor로 필드를 꺼내 판단하지 않는다.
- Domain entity/aggregate가 `create`, `restore`, `of` 같은 static factory로 생성 경로를 제공하면 public constructor를 열지 않고 private constructor로 닫는다.
- frontend, infra, generated app product-quality 보증은 현재 bootstrap injection 범위 밖이다.
