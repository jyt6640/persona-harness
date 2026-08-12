---
id: backend.java.common
source: backend-policy
domain: backend
topic: backend-boundary
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Java/Spring Backend Baseline

- Java/Spring 프로젝트는 Gradle을 기본 빌드 도구로 사용하고 Maven 파일을 생성하지 않으며, Spring Boot main application class는 root package에 하나만 둔다.
- package와 class 배치는 README, 기존 코드, project profile, 명시 요구사항에서 확인한 선택을 따른다. 구조를 제안할 수는 있지만 `global`, 특정 DTO 디렉터리, 도메인 깊이, Repository 구현 이름을 기본값으로 강제하지 않는다.
- presentation → application → domain 흐름을 기본으로 두고, Controller가 Repository를 직접 호출하거나 presentation이 infrastructure를 건너뛰어 결합하지 않게 한다.
- API 외부 계약은 DTO 또는 프로젝트가 명시한 API boundary로 표현하고 Entity를 직접 노출하지 않는다.
- 도메인 규칙은 Spring, HTTP, DB 세부사항에 의존하지 않게 두고, Entity/Domain 객체가 자기 상태로 판단할 수 있는 규칙을 소유한다.
- Entity/Aggregate는 record 데이터 홀더 대신 class로 두고 public setter를 열지 않으며, constructor injection과 명시적인 생성 경계를 따른다.
- RuntimeException을 직접 던지는 방식으로 정책을 숨기지 않으며, Spring annotation은 역할이 분명한 타입에만 붙인다.
- persistence, migration, global error response, test style, workflow evidence는 project profile 또는 명시적으로 선택한 conditional pack이 있을 때만 추가한다.
