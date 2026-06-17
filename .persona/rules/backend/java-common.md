---
id: backend.java.common
source: backend-policy
domain: backend
topic: backend-boundary
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
---

# Java/Spring Backend Baseline

- HTTP 요청/응답, 유스케이스 흐름, 도메인 상태, 저장소 접근 책임을 구분한다.
- API 외부 계약은 DTO로 표현하고 Entity를 직접 노출하지 않는다.
- RuntimeException을 직접 던지는 방식으로 정책을 숨기지 않는다.
- 요구사항의 요청/응답 필드 이름을 임의로 바꾸지 않는다.
- Spring annotation은 역할이 분명한 타입에만 붙인다.
