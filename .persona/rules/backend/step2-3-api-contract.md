---
id: backend.step2-3.api-contract
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

# Step 2-3 API Contract

- `GET /reservations`는 200 OK를 반환하고, `POST /reservations`는 request body로 `name`, `date`, `timeId`를 받으며 200 OK와 DB가 생성한 `id`를 반환하고, `DELETE /reservations/{id}`는 200 OK를 반환한다.
- 예약 조회 응답의 `time`은 문자열이 아니라 `{ id, startAt }` 객체이며, 예약 생성 request body는 `time`이 아니라 `timeId`를 사용한다.
- `POST /times`는 request body로 `startAt`을 받으며 200 OK를 반환하고, `GET /times`는 200 OK와 시간 목록을 반환하고, `DELETE /times/{id}`는 200 OK를 반환한다.
- 원문에 없는 실패 케이스, validation 응답, DELETE response body는 단정하지 않는다.
