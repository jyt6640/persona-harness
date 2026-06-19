# Test Contract Anchor Actual Report Review

## Goal

actual generated run의 Java/Spring test file에 Test contract anchor observer를 적용해 WARN/HIGH 또는 WARN/MEDIUM 반복 여부를 검토한다.

이번 review는 새 observer 기능 구현이나 rule/prompt/code 보강이 아니다. 기존 문자열 기반 report-only observer를 actual generated test file 하나에 적용하고, ignored report output을 읽어 다음 판단 후보를 정리한다.

## Report Source

- actual run: `experiments/phase0-runs/2026-06-18T02-10-18-110Z`
- requirements: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/requirements.md`
- target test file: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/sandbox/src/test/java/com/example/reservation/ReservationIntegrationTest.java`
- observer report: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/test-contract-observer-report.md`

The selected run is a Java/Spring #2-3 actual generated run. The target is the only generated `src/test/java/**/*Test.java` file found in that run.

## Scenario

`step2-3`

The requirement includes reservation routes, time routes, `timeId`, `startAt`, reservation response time object, reservation row count, and `reservation_time`/time list anchors.

## Finding

`WARN`

## Confidence

`HIGH`

## Present Anchors

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

## Missing Anchors

- reservation row count `1/0`
- `reservation_time` table or time list size `1`

## Evidence

Route anchor evidence:

- `get("/reservations")`
- `post("/reservations")`
- `delete("/reservations")`
- `post("/times")`
- `get("/times")`
- `delete("/times")`

Status anchor evidence:

- `status().isOk()`

Body anchor evidence:

- `body field: name`
- `body field: date`
- `body field: timeId`
- `body field: startAt`
- `time.id`

Count/table anchor evidence:

- The generated report did not record row-count or `reservation_time`/time-list evidence.
- Manual reading of the target file shows `JdbcTemplate` count assertions and `reservation_time` setup/assertion text, so this missing-anchor result is a likely string matcher limitation rather than enough evidence for immediate rule/prompt reinforcement.

## Repeat Decision

판단 불가.

This is one actual generated run. It produced `WARN/HIGH`, so it is a candidate signal to compare against another actual run. It is not WARN repetition yet.

Because the target file appears to contain some count/table assertions that the current observer did not classify as present anchors, this single `WARN/HIGH` should be treated conservatively as report-only evidence plus possible false negative in anchor recognition.

## Rule/Prompt Candidate

Do not reinforce rule or prompt in this loop.

If `WARN/HIGH` or `WARN/MEDIUM` repeats in another actual generated run and the missing anchors survive manual review, the next loop may consider this minimal backend test rule or prompt candidate:

`테스트는 요구사항의 route/status/body/count anchor를 구현 결과가 아니라 원문 계약 기준으로 고정한다`

## Limitations

- String-based observer only.
- Single actual run only.
- Report-only observation, ignored output only.
- `WARN` is a missing-anchor report-only signal, not a test insufficiency verdict.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.
- Helper methods, constants, MockMvc variants, custom DSLs, SQL formatting, table setup code, and assertion style can create false positives or false negatives.

## Next Loop

Apply the same Test Contract Anchor observer to one additional actual generated Java/Spring test file and compare:

- previous report: `WARN/HIGH`
- next report: `PASS`, `WARN`, `INFO`, or `UNKNOWN`

Only repeated `WARN/HIGH` or `WARN/MEDIUM` after manual review should move rule/prompt reinforcement into consideration.
