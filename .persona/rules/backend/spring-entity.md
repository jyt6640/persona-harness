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
- getter는 응답 변환이나 직렬화처럼 필요한 경계에서만 사용하고, 외부 판단을 유도하는 기본 수단으로 삼지 않는다.
- equals/hashCode 기준은 식별자와 생명주기 요구가 분명할 때 명시적으로 정한다.
