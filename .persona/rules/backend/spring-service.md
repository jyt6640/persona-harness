---
id: backend.spring.service
source: backend-policy
domain: backend
topic: service-transaction
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Service.java"
severity: must
enforcement: inject_only
max_bullets: 3
---

# Spring Service Policy

- Application Service는 비즈니스/use-case 흐름을 조율하고 저장소 구현 세부사항을 직접 소유하지 않는다.
- Service는 List, Map, AtomicLong, nextId, idCounter, sequence 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.
- Controller가 아니라 Service가 Repository를 호출하고, 생성/조회/삭제 흐름을 조율한다. Controller의 HTTP 세부사항이나 Repository의 저장 방식 세부사항을 Service에 새기지 않는다.
- `@Transactional` 경계가 필요해지면 Service public 메서드 기준으로 두되, 트랜잭션 기술 선택은 project profile과 요구사항을 따른다.
- Service는 흐름을 조율하고, 검증과 정책 판단은 가능한 Domain, Validator, Policy 같은 이름 있는 책임에 맡긴다.
