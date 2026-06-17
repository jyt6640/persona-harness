---
id: backend.layered-architecture
source: backend-policy
domain: backend
topic: layered-architecture
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Layered Architecture Policy

- Presentation은 HTTP 요청/응답, 상태 코드, 외부 DTO 변환을 담당한다.
- Application은 하나의 유스케이스 흐름, 트랜잭션 경계, 필요한 협력 객체 호출을 조율한다.
- Domain은 비즈니스 규칙과 상태 전이를 담당하고 Spring, HTTP, DB 세부사항을 알지 않는다.
- Infrastructure는 저장소, 외부 API, 프레임워크 연동 같은 기술 세부사항을 담당한다.
- 의존 방향은 바깥 기술 세부사항에서 안쪽 도메인 규칙으로 향하게 둔다.
