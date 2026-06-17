---
id: backend.spring.entity
source: backend-policy
domain: backend
topic: domain-entity
globs:
  - "**/*Entity.java"
  - "**/domain/**/*.java"
severity: must
enforcement: inject_only
---

# Entity Policy

- Entity는 setter를 열지 않는다.
- 상태 변경은 의미 있는 메서드로만 한다.
- 도메인 불변식은 Entity나 Domain 객체 안에서 지킨다.
- 외부 API 요청 DTO가 Entity 생성 세부사항을 직접 소유하지 않게 한다.
