---
id: backend.spring.dto
source: backend-policy
domain: backend
topic: dto-boundary
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*Request.java"
  - "**/*Response.java"
  - "**/*Controller.java"
severity: must
enforcement: inject_only
---

# DTO Boundary Policy

- Request DTO는 외부 입력 계약과 검증 경계를 표현한다. Controller 내부 중첩 타입을 피할지, 별도 파일·패키지 경계를 둘지는 기존 프로젝트와 명시 요구사항을 따른다.
- Controller/Service response path는 domain entity를 외부 응답으로 직접 노출하지 않고 선택한 API boundary를 둔다. Request를 application 입력으로, application 결과를 외부 응답으로 변환하는 책임을 분리한다.
- 요구사항의 필드 이름을 임의로 합치거나 바꾸지 않는다.
- DTO가 Entity 변환 세부사항을 과도하게 소유하면 책임이 섞였는지 의심한다.
- Service 입력이 HTTP 요청 구조와 달라지면 Request DTO와 application 입력을 분리할지 프로젝트 convention을 확인한다.
- Response DTO는 도메인 내부 구조를 그대로 노출하기보다 외부 계약에 맞춘다.
