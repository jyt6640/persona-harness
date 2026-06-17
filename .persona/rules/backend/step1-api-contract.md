---
id: backend.step1.api-contract
source: backend-policy
domain: backend
topic: external-contract
globs:
  - "**/*Controller.java"
  - "**/*Request.java"
  - "**/*Response.java"
  - "**/*Test.java"
severity: must
enforcement: inject_only
---

# Step 1 API Contract

- 이번 1단계의 예약 추가 요청 본문은 반드시 `name`, `date`, `time`이다.
- 예약 추가 응답은 `id`, `name`, `date`, `time`을 반환한다.
- `GET /reservations`는 예약 목록을 반환하고, 처음 목록 크기는 0이어야 한다.
- 첫 예약 추가 응답의 `id`는 1이어야 한다.
- `DELETE /reservations/{id}`는 200 OK를 반환하고 삭제 후 목록 크기는 0이어야 한다.
- 화면, 데이터베이스, H2, 시간 관리 기능은 1단계 범위가 아니다.
