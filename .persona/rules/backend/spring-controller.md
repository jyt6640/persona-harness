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

- Controller는 HTTP 요청/응답 변환만 담당하고, API 경로, 메서드, status code, request body, response body는 요구사항의 외부 계약을 그대로 따르며, 유스케이스 실행은 Service public 메서드에 위임한다.
- Controller에는 Repository 의존성, Map/List 저장 상태, id sequence, 저장소 구현 세부사항을 넣지 않는다.
- Request/Response DTO를 명시적으로 사용한다.
- Entity를 API 응답으로 직접 반환하지 않는다.
- 특정 미션 fixture의 200 OK/201 Created/204 No Content 판단을 일반 clean project에 재사용하지 않는다.
- Controller에서 트랜잭션 경계나 저장소 구현 세부사항을 결정하지 않는다.
