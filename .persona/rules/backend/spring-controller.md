---
id: backend.spring.controller
source: backend-policy
domain: backend
topic: controller-responsibility
globs:
  - "**/*Controller.java"
severity: must
enforcement: inject_only
---

# Spring Controller Policy

- Controller는 HTTP 요청/응답 변환만 담당한다.
- Controller에는 비즈니스 로직과 저장소 접근을 넣지 않는다.
- Request/Response DTO를 명시적으로 사용한다.
- Entity를 API 응답으로 직접 반환하지 않는다.
- API 경로와 메서드는 요구사항의 외부 계약을 그대로 따른다.
- Controller에서 트랜잭션 경계나 저장소 구현 세부사항을 결정하지 않는다.
