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

- Phase 0 메모리 CRUD에서도 Service public 메서드는 Controller와 Repository 사이의 얇은 유스케이스 경계를 표현하고, Service는 `nextId`, `AtomicLong`, Map/List 저장 상태를 직접 소유하지 않는다.
- Controller가 아니라 Service가 Repository를 호출하고, 생성/조회/삭제 흐름을 조율한다.
- 1단계에서도 저장 상태와 id 발급은 Repository 책임이다. Service는 요청 데이터를 Repository 저장 요청으로 넘기고 저장 결과를 응답 DTO로 변환한다.
- @Transactional 경계가 필요해지면 Service public 메서드 기준으로 둔다.
- Controller의 HTTP 세부사항이나 Repository의 저장 방식 세부사항을 Service에 새기지 않는다.
- Service는 흐름을 조율하고, 검증과 정책 판단은 가능한 Domain, Validator, Policy 같은 이름 있는 책임에 맡긴다.
- 도메인 상태 변경은 의미 있는 도메인 메서드나 명확한 유스케이스 메서드로 표현한다.
- 조회 전용 유스케이스는 읽기 전용 트랜잭션을 검토한다.
