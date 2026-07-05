---
id: backend.layered-architecture
source: backend-policy
domain: backend
topic: layered-architecture
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

# Layered Architecture Policy

- Presentation은 HTTP 요청/응답, 상태 코드, 외부 DTO 변환을 담당한다.
- Presentation은 Request DTO를 Application Command/Query로 변환한다.
- Presentation은 Domain 결과를 Response DTO로 변환한다.
- Presentation은 비즈니스 로직을 작성하거나 Repository를 직접 호출하거나 Domain 객체 상태를 직접 변경하지 않는다.
- Application은 하나의 유스케이스 흐름, 트랜잭션 경계, 필요한 협력 객체 호출을 조율한다.
- Application은 저장소 조회 기반 검증을 Application Validator에 위임하고, HTTP Request/Response DTO에 의존하지 않는다.
- Domain은 비즈니스 규칙과 상태 전이를 담당하고 Spring, HTTP, DB 세부사항을 알지 않는다.
- Infrastructure는 저장소, 외부 API, 프레임워크 연동 같은 기술 세부사항을 담당한다.
- Infrastructure는 Repository 인터페이스를 구현한다.
- Infrastructure는 DB/외부 API/메시징 같은 기술 세부사항을 다루되 새로운 비즈니스 규칙을 만들지 않는다.
- 상위 계층은 하위 계층을 알 수 있지만, presentation이 domain/infrastructure를 직접 호출하는 식으로 계층 경계를 건너뛰지 않는다.
- Domain은 Application Service와 Infrastructure 양쪽에서 사용할 수 있는 독립 계층이며, Application이나 Infrastructure를 알지 않는다.
