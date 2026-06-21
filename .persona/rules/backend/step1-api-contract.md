---
id: backend.step1.api-contract
source: backend-policy
domain: backend
topic: external-contract
globs:
  - "**/roomescape/**/*Controller.java"
  - "**/roomescape/**/*Request.java"
  - "**/roomescape/**/*Response.java"
  - "**/roomescape/**/*Test.java"
  - "**/roomescape/**/*Tests.java"
  - "**/roomescape/**/*IntegrationTest.java"
severity: must
enforcement: inject_only
---

# Step 1 API Contract

Roomescape step fixture 전용 외부 계약이다. 일반 Java/Spring clean project의 HTTP status, request body, response body는 해당 프로젝트 README와 intake/profile 요구사항을 따른다.

- `GET /reservations`는 200 OK와 예약 목록을 반환하고, 생성 전 목록 크기는 0이어야 한다.
- `POST /reservations`는 200 OK를 반환한다. 201 Created는 이 단계에서 오답이며, 요청 본문은 `name`, `date`, `time`, 응답은 `id`, `name`, `date`, `time`, 첫 `id`는 1, 생성 후 목록 크기는 1이어야 한다.
- `DELETE /reservations/{id}`는 200 OK를 반환한다. 204 No Content는 이 단계에서 오답이며, 삭제 후 목록 크기는 0이어야 한다.
- 1단계 예약 추가 요청 본문은 반드시 `name`, `date`, `time`이다.
- 예약 추가 응답은 `id`, `name`, `date`, `time`을 반환한다.
- `GET /reservations`는 예약 목록을 반환하고, 처음 목록 크기는 0이어야 한다.
- 첫 예약 추가 응답의 `id`는 1이어야 한다.
- `POST /reservations` 이후 목록 크기는 1이고, `DELETE /reservations/{id}` 이후 목록 크기는 0이어야 한다.
- 화면, 데이터베이스, H2, 시간 관리 기능은 1단계 범위가 아니다.
