# Test Contract Follow-up Decision

## Context

The Test Contract Anchor observer still reports `WARN/HIGH` after the row-count helper matcher correction.

The row-count matcher correction is considered complete for the currently observed patterns:

- `countReservations()`
- `select count(*) from reservation`
- `assertThat(countReservations()).isEqualTo(1L)`
- `assertThat(countReservations()).isEqualTo(0L)`
- local `rowCount` variables assigned from reservation count SQL and asserted with `1L`/`0L`

The latest actual report recheck moved reservation row count `1/0` from missing to present.

This decision does not implement a new matcher, reinforce rules/prompts, create an enforcement gate, or make any test-quality/product-quality claim.

## Current Report State

Rechecked report:

- run: `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- target: `ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/test-contract-observer-report.md`
- finding: `WARN/HIGH`

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
- reservation row count `1/0`

Missing anchors:

- reservation response time object
- `reservation_time` table or time list size `1`

Manual split:

- time-list/table: likely matcher limitation candidate. Manual review found `GET /times` with `jsonPath("$.length()").value(1)` and `reservation_time`.
- response time object: actual missing candidate. Manual review did not find `$.time.id`, `$.time.startAt`, `$[0].time.id`, or `$[0].time.startAt` in the third run.

## Candidates

### A. time-list matcher 보정

Scope:

- Recognize time list size assertion patterns such as `jsonPath("$.length()").value(1)`.
- Only consider it when close to `GET /times` or a clear time API test context.

Advantages:

- Addresses one remaining missing anchor that manual review suggests is a matcher limitation.
- Keeps the observer more accurate for already observed generated test styles.
- Can be implemented narrowly with string-based evidence and unit tests.

Risks:

- Generic list size assertions can be over-attributed to time list size.
- `jsonPath("$.length()").value(1)` is common and can refer to reservations or unrelated arrays.
- Needs careful context bounding around `GET /times`; otherwise false positives are likely.

False positive risk:

- Medium unless the matcher requires nearby `GET /times` evidence.

Next loop cost:

- Small to medium. It needs tests first and a narrow context window design.

### B. response time object actual missing 반복 관찰

Scope:

- Apply the existing observer to one more actual generated Java/Spring #2-3 test file.
- Manually check whether reservation response asserts `time.id`, `time.startAt`, or equivalent nested response evidence.

Advantages:

- Targets the only remaining missing anchor that manual review currently treats as actual missing candidate.
- If repeated with manual confirmation, it can become a stronger rule/prompt candidate later.
- Avoids spending the next loop on a matcher-only issue while an actual requirements anchor candidate remains unresolved.

Risks:

- The observer may miss helper-based nested JSON assertions.
- A single additional actual run may still be too small to justify rule/prompt reinforcement.
- If no comparable actual run exists, the decision may remain inconclusive.

False positive / false negative risk:

- Medium. Helper methods, constants, DTO assertions, or custom JSON assertion helpers can hide nested response object evidence.

Next loop cost:

- Small. It requires one actual report, manual review, and a comparison document. No new matcher implementation is required.

## Comparison

| Candidate | Advantage | Main Risk | False Positive Risk | Next Loop Cost |
| --- | --- | --- | --- | --- |
| A. time-list matcher 보정 | Reduces likely matcher false missing | Generic list size over-attribution | Medium without strict `/times` context | Small-medium |
| B. response time object actual missing 반복 관찰 | Tests actual missing candidate before rule/prompt decision | Helper/constant evidence can be missed | Medium | Small |

## Decision

Choose B: response time object actual missing 반복 관찰.

## Why

Row-count is now corrected, so the remaining WARN has two different meanings:

- time-list/table is likely still a matcher limitation.
- response time object is the stronger actual missing candidate.

The next highest-value action is to check whether the actual missing candidate repeats in another actual generated run before implementing another matcher or considering rule/prompt reinforcement.

Time-list matcher correction remains valid, but it is a narrower observer accuracy cleanup. The response time object candidate is closer to a requirements anchor that may eventually justify a backend test rule/prompt candidate if repeated and manually confirmed.

## Non-Goals

- rule/prompt 보강 아님
- product-quality 보증 아님
- test-quality 판정 아님
- enforcement gate 아님
- build/test failure 연결 아님
- AST/linter/full Guard 아님
- 새 dependency 추가 아님
- time-list matcher 구현 아님
- response time object matcher 구현 아님

## Next Loop

Apply the existing Test Contract Anchor observer to one more actual generated Java/Spring #2-3 test file and manually check reservation response time object anchors.

Required comparison:

- current known response time object missing candidate:
  - `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- next actual run:
  - choose a different actual generated Java/Spring #2-3 run if available

Record:

- observer finding and confidence
- whether response time object is missing in the report
- whether manual review confirms missing `time.id`/`time.startAt` or equivalent assertion
- whether actual missing repeats

Do not reinforce rules/prompts unless repeated `WARN/HIGH` or `WARN/MEDIUM` remains after manual confirmation of real missing anchors.
