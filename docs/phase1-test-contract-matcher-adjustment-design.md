# Test Contract Matcher Adjustment Design

## Goal

row-count helper pattern을 좁게 인식해 false missing 가능성을 줄인다.

이번 설계는 Test Contract Anchor observer의 report-only 성격을 유지한다. matcher 구현 보정, rule/prompt/code 보강, enforcement gate, build/test failure 연결, test quality 판정, product-quality 보증은 하지 않는다.

## Evidence

Two actual generated Java/Spring #2-3 runs produced observer-level `WARN/HIGH` for row-count anchors, but manual reading found row-count evidence in the test files.

First mismatch:

- run: `experiments/phase0-runs/2026-06-18T02-10-18-110Z`
- target: `ReservationIntegrationTest.java`
- observer missing anchors:
  - reservation row count `1/0`
  - `reservation_time` table or time list size `1`
- manual evidence:
  - `SELECT COUNT(*) FROM reservation`
  - `SELECT COUNT(*) FROM reservation_time`
  - `reservation_time`
  - list length assertions

Second mismatch:

- run: `experiments/phase0-runs/2026-06-18T01-02-20-056Z`
- target: `ReservationControllerTest.java`
- observer missing anchor:
  - reservation row count `1/0`
- manual evidence:
  - `assertThat(countReservations()).isEqualTo(1L)`
  - `assertThat(countReservations()).isEqualTo(0L)`
  - `countReservations()` helper
  - `jdbcTemplate.queryForObject("select count(*) from reservation", Long.class)`

## Current Problem

The current observer does not sufficiently recognize helper method based row-count assertions.

The observed gap is narrow:

- direct count SQL exists inside a helper method
- the test method asserts helper call results with `isEqualTo(1L)` and `isEqualTo(0L)`
- the observer reports reservation row count `1/0` as missing

This is not evidence that generated tests missed the requirement anchor. It is evidence that the string matcher can miss row-count anchors when count SQL and expected values are split between a helper definition and helper call assertions.

## Narrow Match Candidates

Candidate patterns for a future implementation loop:

- `countReservations()` helper call
- `select count(*) from reservation`
- `SELECT COUNT(*) FROM reservation`
- `isEqualTo(1L)` / `isEqualTo(0L)` near a count helper call
- `isEqualTo(1)` / `isEqualTo(0)` near a count helper call
- `assertThat(countReservations()).isEqualTo(1L)`
- `assertThat(countReservations()).isEqualTo(0L)`
- helper body containing `queryForObject("select count(*) from reservation", Long.class)`

The first implementation candidate should prefer explicit `countReservations()` over broad `count` keyword matching.

## Non-Goals

- assertion parser 아님
- AST/linter 아님
- 모든 DB count helper 일반화 아님
- custom DSL 일반 해석 아님
- route/status/body matcher 변경 아님
- time list/table matcher 확장 아님
- test quality 보증 아님
- product-quality 보증 아님
- enforcement gate 아님
- build/test failure 연결 아님
- rule/prompt 보강 아님
- 새 dependency 추가 아님

## Confidence

- `HIGH`: count helper call and expected value are in the same assertion expression.
  - Example: `assertThat(countReservations()).isEqualTo(1L)`
  - Example: `assertThat(countReservations()).isEqualTo(0L)`
- `MEDIUM`: count helper call and expected value are within a small nearby line range, and a helper body contains `select count(*) from reservation`.
- `LOW`: only `count`, `reservation`, or SQL count keywords are found without a clear helper call and expected value pair.

Confidence remains evidence strength only. It is not a product behavior guarantee.

## Test Criteria For Future Implementation

In a future implementation loop, write tests first for the narrow observed patterns:

- `assertThat(countReservations()).isEqualTo(1L)` and `assertThat(countReservations()).isEqualTo(0L)` plus a `countReservations()` helper containing `select count(*) from reservation` should satisfy reservation row count `1/0` with `HIGH` confidence.
- The same pattern with `isEqualTo(1)` and `isEqualTo(0)` should also satisfy reservation row count `1/0`.
- A helper body with `select count(*) from reservation` but no `1` and `0` expected assertions should not produce `PASS/HIGH`.
- Unrelated helpers such as `countTimes()` or `countUsers()` should not satisfy reservation row count `1/0`.
- Keyword-only text such as a test name or comment containing `row count` should remain `LOW`, `INFO`, or missing depending on the surrounding anchors.
- Existing PASS behavior for direct `SELECT COUNT(*) FROM reservation` assertions should remain unchanged.
- Existing route/status/body/time anchors should remain unchanged.
- Non-test files should remain `UNKNOWN`.

## Risks

- false positive: a helper named `countReservations()` could count a filtered subset rather than all reservation rows.
- false positive: `isEqualTo(1L)` and `isEqualTo(0L)` could refer to unrelated assertions near the helper call.
- false negative: custom helper names like `reservationRows()` or `rowCount()` would remain unrecognized by this narrow design.
- false negative: multiline formatting may split `assertThat(countReservations()).isEqualTo(1L)` beyond a simple line or expression window.
- false negative: constants may hide expected values.
- scope creep: expanding from `countReservations()` to arbitrary DB helper analysis would move toward an assertion parser or linter, which is explicitly out of scope.

## Decision

If implemented later, keep the matcher correction narrow and evidence-bound:

- prioritize `countReservations()` and direct reservation count SQL
- accept `1L`/`0L` as expected values
- require both `1` and `0` evidence for the `reservation row count 1/0` anchor
- keep output report-only and ignored

Do not use this design to justify rule/prompt reinforcement. Rule/prompt changes require repeated `WARN/HIGH` or `WARN/MEDIUM` plus manual confirmation of actual missing anchors.
