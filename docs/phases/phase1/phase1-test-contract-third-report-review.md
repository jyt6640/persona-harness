# Test Contract Anchor Third Report Review

## Goal

세 번째 actual generated run에 observer를 적용해 WARN과 수동 확인 불일치가 계속되는지 확인한다.

이번 review는 existing Test Contract Anchor observer를 그대로 적용한다. 새 기능 구현, observer matcher 구현 보정, rule/prompt/code 보강, enforcement gate, build/test failure 연결, test quality 판정, product-quality 보증은 하지 않는다.

## Reports Compared

Report 1:

- run: `experiments/phase0-runs/2026-06-18T02-10-18-110Z`
- target: `ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/test-contract-observer-report.md`
- review: `docs/phases/phase1/phase1-test-contract-actual-report-review.md`

Report 2:

- run: `experiments/phase0-runs/2026-06-18T01-02-20-056Z`
- target: `ReservationControllerTest.java`
- report: `experiments/phase0-runs/2026-06-18T01-02-20-056Z/test-contract-observer-report.md`
- review: `docs/phases/phase1/phase1-test-contract-repeat-report-review.md`

Report 3:

- run: `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- target: `ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/test-contract-observer-report.md`

All three runs are Java/Spring #2-3 runs.

## Current Finding

`WARN/HIGH`

Current present anchors:

- `GET /reservations`
- `POST /reservations`
- `DELETE /reservations/{id}`
- `POST /times`
- `GET /times`
- `DELETE /times/{id}`
- `200 OK`
- request body `name/date/timeId`
- request body `startAt`

Current missing anchors:

- reservation response time object
- reservation row count `1/0`
- `reservation_time` table or time list size `1`

## Manual Check

Manual check found route/status/body anchors:

- reservation routes: `get("/reservations")`, `post("/reservations")`, `delete("/reservations/1")`
- time routes: `post("/times")`, `get("/times")`, `delete("/times/1")`
- status: `status().isOk()`
- reservation request body: `name`, `date`, `timeId`
- time request body: `startAt`

Manual check of missing anchors:

- reservation response time object: not found. The current test checks reservation list length and reservation creation id, but does not assert `$.time.id`, `$.time.startAt`, `$[0].time.id`, or `$[0].time.startAt`.
- reservation row count `1/0`: found. The test uses `select count(*) from reservation`, `rowCount`, `assertThat(rowCount).isEqualTo(1L)`, and `assertThat(rowCount).isEqualTo(0L)`.
- `reservation_time` table or time list size `1`: found. The test uses `reservation_time`, `insertTime`, and `jsonPath("$.length()").value(1)` in the `GET /times` flow.
- `timeId`: found in reservation request body.
- `startAt`: found in time request body and helper.

## Repeat Decision

Observer matcher 한계 반복:

- row-count anchor is reported missing again, but manual check finds reservation count SQL and `1L`/`0L` assertions.
- time table/list anchor is reported missing in this third run, but manual check finds `reservation_time` and time list length `1`.

Actual missing:

- reservation response time object is manually missing in this third run.

Judgment:

- The row-count mismatch continues across multiple runs and supports a narrow matcher adjustment design.
- The reservation response time object actual missing appears in this third run, but this loop does not establish enough manual-confirmed repeated actual missing evidence for rule/prompt reinforcement.
- Rule/prompt reinforcement remains deferred.

## Rule/Prompt Candidate

Do not reinforce rule or prompt in this loop.

Only if actual missing anchors repeat after manual confirmation should the next loop consider:

`테스트는 요구사항의 route/status/body/count anchor를 구현 결과가 아니라 원문 계약 기준으로 고정한다`

This third run creates a candidate to keep watching reservation response time object assertions, but current evidence still points first to row-count matcher adjustment and conservative additional observation.

## Matcher Candidate

Primary matcher candidate:

- recognize `assertThat(rowCount).isEqualTo(1L)` and `assertThat(rowCount).isEqualTo(0L)` when `rowCount` is assigned from `select count(*) from reservation`
- recognize `assertThat(countReservations()).isEqualTo(1L)` and `assertThat(countReservations()).isEqualTo(0L)` when `countReservations()` returns `select count(*) from reservation`
- keep matching narrow to reservation row-count anchors

Related but separate matcher candidate:

- consider `jsonPath("$.length()").value(1)` after `GET /times` as time list size `1`
- keep this separate from row-count helper correction to avoid broad assertion parsing

## Limitations

- String-based observer only.
- Small sample: three actual generated Java/Spring #2-3 runs.
- Report-only observation, ignored output only.
- `WARN` is a missing-anchor report-only signal, not a test insufficiency verdict.
- Helper methods, local variables, SQL casing, `Long` suffixes, `jsonPath("$.length()")`, constants, and formatting can create false positives or false negatives.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.

## Next Loop

Recommended next loop: implement the narrow row-count helper matcher correction with tests first, or write a small implementation design that splits row-count helper correction from time-list length matcher correction.

Do not move to rule/prompt reinforcement until repeated `WARN/HIGH` or `WARN/MEDIUM` remains after manual confirmation of real missing route/status/body/count anchors.
