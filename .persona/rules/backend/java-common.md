---
id: backend.java.common
source: backend-policy
domain: backend
topic: backend-boundary
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Java/Spring Backend Baseline

- Java/Spring 프로젝트는 Gradle을 기본 빌드 도구로 사용하고 Maven 파일을 생성하지 않으며, Spring Boot main application class는 root package에 하나만 두고 feature/domain package 아래에 추가 `*Application.java`를 만들지 않는다.
- 구현 전에 package structure plan을 먼저 작성한다. root package는 Spring Boot Application class가 위치한 최상위 앱 패키지이며, global은 root package 바로 아래에 두고 도메인 패키지는 global과 같은 depth에 둔다. `feature/features/module/modules` 같은 wrapper package를 추가하지 않는다. 명시적 기본 구조는 root/global/exception·root/global/response·root/global/config와 root/<domain>/application·root/<domain>/application/dto/command·root/<domain>/application/dto/result·root/<domain>/domain·root/<domain>/domain/<Domain>Repository interface·root/<domain>/infrastructure·root/<domain>/infrastructure/Jdbc<Domain>Repository 또는 InMemory<Domain>Repository·root/<domain>/presentation·root/<domain>/presentation/dto/request·root/<domain>/presentation/dto/response이다. 기존 Application class가 com.example.library에 있으면 library를 도메인 패키지로 보고 library 아래에 loan 같은 추가 도메인 패키지를 만들지 않는다. global은 공통 관심사만, Repository interface는 domain, 구현체는 infrastructure에 두며 infrastructure class 이름을 <Domain>Repository로 끝내지 않는다.
- presentation → application → domain 흐름을 기본으로 두고, infrastructure는 domain을 사용할 수 있지만 domain은 infrastructure를 알지 않는다.
- API 외부 계약은 DTO로 표현하고 Entity를 직접 노출하지 않는다.
- 도메인 규칙은 Spring, HTTP, DB 세부사항에 의존하지 않게 둔다.
- RuntimeException을 직접 던지는 방식으로 정책을 숨기지 않는다.
- 요구사항의 요청/응답 필드 이름을 임의로 바꾸지 않는다.
- Spring annotation은 역할이 분명한 타입에만 붙인다.
