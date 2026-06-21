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

- Entity/Aggregate는 record 데이터 홀더로 만들지 않고 class로 둔다. record는 Request/Response DTO, Command/Result DTO, 값 자체가 의미인 Value Object에만 제한한다.
- Entity는 setter를 열지 않는다.
- `create`, `restore`, `of` 같은 static factory를 쓰는 Entity/Aggregate는 public constructor를 열지 않고 private constructor로 생성 경로를 닫는다.
- 상태 변경은 의미 있는 메서드로만 한다.
- 도메인 불변식은 Entity나 Domain 객체 안에서 지킨다.
- 자신의 필드만으로 판단할 수 있는 규칙은 Entity/Domain 객체가 직접 판단한다. 예: `isOwner(name)`, `isReturned()`, `canLoan()` 같은 메서드를 두고, Service가 `entity.name()`/getter/accessor를 꺼내 같은 판단을 대신하지 않는다.
- 외부 API 요청 DTO가 Entity 생성 세부사항을 직접 소유하지 않게 한다.
- getter는 응답 변환이나 직렬화처럼 필요한 경계에서만 사용하고, 외부 판단을 유도하는 기본 수단으로 삼지 않는다.
- equals/hashCode 기준은 식별자와 생명주기 요구가 분명할 때 명시적으로 정한다.
