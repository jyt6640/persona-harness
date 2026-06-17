---
id: backend.spring.service
source: backend-policy
domain: backend
topic: service-transaction
globs:
  - "**/*Service.java"
severity: must
enforcement: inject_only
---

# Spring Service Policy

- Service public 메서드는 하나의 유스케이스 흐름을 표현한다.
- Controller의 HTTP 세부사항이나 Repository의 저장 방식 세부사항을 Service에 새기지 않는다.
- 도메인 상태 변경은 의미 있는 도메인 메서드나 명확한 유스케이스 메서드로 표현한다.
- DB를 사용하는 단계에서는 트랜잭션 경계를 Service public 메서드 기준으로 둔다.
