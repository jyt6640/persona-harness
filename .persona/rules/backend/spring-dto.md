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

- Request DTO는 외부 입력 계약과 검증 경계를 표현한다. Controller 내부 중첩 request/response record/class 대신 `presentation/dto/request`와 `presentation/dto/response` 파일 경계에 DTO를 둔다.
- Controller/Service response path는 domain entity를 직접 외부 응답으로 노출하지 않고 Response DTO boundary를 둔다. Controller는 Request DTO를 Command/Query로 변환해 Application Service에 넘기고, Application Result를 Response DTO로 변환해 반환한다. Service 내부 중첩 response/result record/class 대신 `application/dto/command`와 `application/dto/result` 파일 경계를 사용한다.
- 요구사항의 필드 이름을 임의로 합치거나 바꾸지 않는다.
- DTO가 Entity 변환 세부사항을 과도하게 소유하면 책임이 섞였는지 의심한다.
- Service 입력이 HTTP 요청 구조와 달라지면 Request DTO와 Command/Query를 분리한다.
- Response DTO는 도메인 내부 구조를 그대로 노출하기보다 외부 계약에 맞춘다.
