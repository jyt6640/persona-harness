# Test Contract Response Time Repeat Review

## Goal

다른 actual #2-3 test file에 observer를 적용하고 response time object anchor missing 반복 여부를 수동 확인한다.

This loop uses the existing Test Contract Anchor observer as-is. It does not implement a new matcher, reinforce rules/prompts, add dependencies, create an enforcement gate, or make a test-quality/product-quality claim.

## Reports Compared

Previous actual missing candidate:

- run: `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- target: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/sandbox/src/test/java/com/example/reservation/ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/test-contract-observer-report.md`
- review: `docs/phase1-test-contract-third-report-review.md`
- finding after row-count correction: `WARN/HIGH`
- response time object manual result: missing candidate

Current comparison run:

- run: `experiments/phase0-runs/2026-06-18T02-10-18-110Z`
- target: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/sandbox/src/test/java/com/example/reservation/ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/test-contract-observer-report.md`

Both runs are actual Java/Spring #2-3 runs.

## Current Finding

`WARN/HIGH`

Present anchors:

- `GET /reservations`
- `POST /reservations`
- `DELETE /reservations/{id}`
- `POST /times`
- `GET /times`
- `DELETE /times/{id}`
- `200 OK`
- request body `name/date/timeId`
- request body `startAt`
- reservation response time object
- reservation row count `1/0`

Missing anchors:

- `reservation_time` table or time list size `1`

## Observer Missing

The observer does not report response time object as missing in the current comparison run.

It reports only `reservation_time` table or time list size `1` as missing.

## Manual Check

Manual review found explicit response time object assertions in the current test file:

- `jsonPath("$[0].time.id").value(1)`
- `jsonPath("$[0].time.startAt").value("09:00")`
- `jsonPath("$.time.id").value(1)`
- `jsonPath("$.time.startAt").value("09:00")`

These assertions cover the reservation response time object anchor for both reservation list response and reservation creation response.

No helper or constant indirection was needed for this finding.

## Repeat Decision

반복 아님.

The previous run `2026-06-18T00-34-47-590Z` remains a response time object actual missing candidate, but the current comparison run `2026-06-18T02-10-18-110Z` has explicit `time.id` and `time.startAt` response assertions.

Therefore, response time object actual missing did not repeat in this comparison.

The remaining WARN in the current report points to the separate time-list/table matcher limitation candidate, not response time object.

## Rule/Prompt Candidate

Do not reinforce rule or prompt in this loop.

Because response time object actual missing did not repeat, keep this candidate inactive:

`예약 조회 응답의 time은 id/startAt 객체이며, 테스트는 이를 요구사항 anchor로 관찰해야 한다`

Only reconsider it if another actual generated run shows repeated observer missing and manual-confirmed absence of `time.id`/`time.startAt` or equivalent nested response assertions.

## Limitations

- String-based observer only.
- Small sample comparison.
- `WARN` is a missing-anchor report-only signal, not a test insufficiency verdict.
- Helper methods, constants, custom DSLs, or DTO-level assertions could hide equivalent nested response evidence.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.

## Next Loop

Recommended next loop: decide whether to address the remaining time-list/table matcher limitation.

Candidate scope:

- `GET /times`
- nearby `jsonPath("$.length()").value(1)`
- avoid generic list-size over-attribution

Rule/prompt reinforcement remains deferred.
