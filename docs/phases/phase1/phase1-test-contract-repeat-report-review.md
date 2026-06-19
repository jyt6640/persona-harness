# Test Contract Anchor Repeat Report Review

## Goal

추가 actual generated Java/Spring test file에 observer를 적용해 WARN/HIGH 또는 WARN/MEDIUM 반복 여부와 수동 확인 결과를 비교한다.

이번 review는 새 기능 구현, observer logic 확장, rule/prompt/code 보강이 아니다. 기존 문자열 기반 Test Contract Anchor observer를 다른 actual generated run 하나에 적용하고, report-only 결과와 manual check 사이의 불일치 여부를 기록한다.

## Reports Compared

Previous report:

- review doc: `docs/phases/phase1/phase1-test-contract-actual-report-review.md`
- actual run: `experiments/phase0-runs/2026-06-18T02-10-18-110Z`
- target test file: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/sandbox/src/test/java/com/example/reservation/ReservationIntegrationTest.java`
- observer report: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/test-contract-observer-report.md`

Current report:

- actual run: `experiments/phase0-runs/2026-06-18T01-02-20-056Z`
- target test file: `experiments/phase0-runs/2026-06-18T01-02-20-056Z/sandbox/src/test/java/com/example/reservation/ReservationControllerTest.java`
- observer report: `experiments/phase0-runs/2026-06-18T01-02-20-056Z/test-contract-observer-report.md`

Both runs are Java/Spring #2-3 runs based on their requirements files.

## Previous Finding

`WARN/HIGH`

Previous missing anchors:

- reservation row count `1/0`
- `reservation_time` table or time list size `1`

Manual reading of the previous target showed `SELECT COUNT(*) FROM reservation`, `SELECT COUNT(*) FROM reservation_time`, `reservation_time`, and list length assertions in the test file. Therefore, the previous report was recorded as a likely string matcher limitation rather than enough evidence for immediate rule/prompt reinforcement.

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
- reservation response time object
- `reservation_time` table or time list size `1`

Current missing anchors:

- reservation row count `1/0`

Current evidence recorded by the observer:

- route evidence: `get("/reservations")`, `post("/reservations")`, `delete("/reservations")`, `post("/times")`, `get("/times")`, `delete("/times")`
- status evidence: `status().isOk()`
- body evidence: `name`, `date`, `timeId`, `startAt`, `time.id`
- count/table evidence: `time list size 1`

## Manual Check

The observer reported reservation row count `1/0` as missing.

Manual check found reservation row count anchors in the target test file:

- `assertThat(countReservations()).isEqualTo(1L)` after `GET /reservations`
- `assertThat(countReservations()).isEqualTo(1L)` after `POST /reservations`
- `assertThat(countReservations()).isEqualTo(0L)` after `DELETE /reservations/1`
- `countReservations()` returns `jdbcTemplate.queryForObject("select count(*) from reservation", Long.class)`

Manual check also found the table/time anchors that matter for #2-3:

- `reservation_time` appears in database reset, insert, select, and count helper code.
- `timeId` appears in reservation request body and helper parameter.
- `startAt` appears in time request body and response assertions.
- time list size `1` appears as `jsonPath("$").value(org.hamcrest.Matchers.hasSize(1))` in the `GET /times` flow.
- `countTimes()` checks `select count(*) from reservation_time`.

So the current missing row-count anchor is present in the actual test file, but hidden behind helper method style that the current string observer does not classify as row count evidence.

## Repeat Decision

Observer-level `WARN/HIGH` repeated.

Manual-confirmed actual missing anchor did not repeat.

The more precise decision is: observer matcher limitation 가능성 반복. Both actual test files contain row-count/table/count evidence on manual reading, while the current observer still reports at least one count-related missing anchor.

This should not be treated as test quality failure, product quality failure, or enough rule/prompt reinforcement evidence.

## Rule/Prompt Candidate

Do not reinforce rule or prompt in this loop.

The candidate remains inactive unless `WARN/HIGH` or `WARN/MEDIUM` repeats and manual confirmation also shows actual missing route/status/body/count anchors:

`테스트는 요구사항의 route/status/body/count anchor를 구현 결과가 아니라 원문 계약 기준으로 고정한다`

Current evidence points first to observer matcher review, not backend test rule/prompt reinforcement.

## Limitations

- String-based observer only.
- Small sample: two actual generated Java/Spring #2-3 runs.
- Report-only observation, ignored output only.
- `WARN` is a missing-anchor report-only signal, not a test insufficiency verdict.
- Helper methods can hide count assertions from exact string matchers.
- SQL case, helper naming, `JdbcTemplate` wrappers, custom DSLs, constants, and assertion style can create false positives or false negatives.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.

## Next Loop

Recommended next loop: decide between a narrow observer matcher correction design for row-count helper patterns or one more actual run review.

Do not move to rule/prompt reinforcement until repeated `WARN/HIGH` or `WARN/MEDIUM` remains after manual confirmation of real missing anchors.
