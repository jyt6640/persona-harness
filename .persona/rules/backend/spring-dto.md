---
id: backend.spring.dto
source: backend-policy
domain: backend
topic: dto-boundary
globs:
  - "**/*Request.java"
  - "**/*Response.java"
  - "**/*Controller.java"
severity: must
enforcement: inject_only
---

# DTO Boundary Policy

- Request DTO는 외부 입력 계약과 검증 경계를 표현한다.
- Response DTO는 외부 출력 계약을 표현한다.
- 요구사항의 필드 이름을 임의로 합치거나 바꾸지 않는다.
- DTO가 Entity 변환 세부사항을 과도하게 소유하면 책임이 섞였는지 의심한다.
