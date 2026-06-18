# Test Contract Matcher Adjustment Result

## Goal

row-count helper matcher 보정 결과를 확인한다.

This loop only adjusts the Test Contract Anchor observer matcher for narrow row-count helper patterns. It does not reinforce rules or prompts, change time-list matching, change response time object matching, add dependencies, create an enforcement gate, or connect observer output to build/test failure.

## Changed Matcher

The row-count matcher now recognizes narrow reservation row-count evidence patterns:

- direct reservation count SQL with `isEqualTo(1L)` and `isEqualTo(0L)`
- `countReservations()` helper assertions:
  - `assertThat(countReservations()).isEqualTo(1L)`
  - `assertThat(countReservations()).isEqualTo(0L)`
- local variable assertions when the variable is assigned from reservation count SQL:
  - `Long rowCount = jdbcTemplate.queryForObject("select count(*) from reservation", Long.class)`
  - `assertThat(rowCount).isEqualTo(1L)`
  - `assertThat(rowCount).isEqualTo(0L)`

The implementation remains string-based and does not introduce a parser, linter, AST traversal, or broad assertion interpreter.

## Tests Added

Added `tests/phase1-test-contract-row-count-observer.test.ts`.

The new tests cover:

- `assertThat(countReservations()).isEqualTo(1L)` as reservation row count `1`
- `assertThat(countReservations()).isEqualTo(0L)` as reservation row count `0`
- local `rowCount` variables assigned from `select count(*) from reservation`
- `HIGH` or `MEDIUM` confidence for explicit helper/local variable evidence
- unrelated helpers such as `countTimes()` not satisfying reservation row count
- comments and string literals not satisfying reservation row count

## Actual Report Recheck

Rechecked actual run:

- run: `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- target: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/sandbox/src/test/java/com/example/reservation/ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/test-contract-observer-report.md`

The report remains ignored under `experiments/`.

## Before / After

Before matcher adjustment:

- finding: `WARN/HIGH`
- missing:
  - reservation response time object
  - reservation row count `1/0`
  - `reservation_time` table or time list size `1`

After matcher adjustment:

- finding: `WARN/HIGH`
- present now includes:
  - reservation row count `1/0`
- missing:
  - reservation response time object
  - `reservation_time` table or time list size `1`

The row-count false missing was reduced for the rechecked actual run.

## Still Missing

Still missing in the rechecked report:

- reservation response time object
- `reservation_time` table or time list size `1`

These are intentionally not fixed in this loop.

The time-list issue is separate because it involves `jsonPath("$.length()").value(1)` after `GET /times`, not row-count helper recognition.

The response time object issue is separate because manual review of the third run did not find `$.time.id`, `$.time.startAt`, `$[0].time.id`, or `$[0].time.startAt`.

## Limitations

- String-based observer only.
- Narrow row-count helper patterns only.
- False positives remain possible if a helper named `countReservations()` does not actually count all reservation rows.
- False negatives remain possible for custom helper names such as `reservationRows()` or assertion formatting outside the narrow patterns.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.
- `WARN` remains a missing-anchor report-only signal.

## Next Loop

Recommended next loop candidates:

1. Design or implement a narrow time-list matcher for `GET /times` with `jsonPath("$.length()").value(1)`.
2. Observe one more actual run for repeated manual-confirmed reservation response time object missing.

Rule/prompt reinforcement remains deferred until `WARN/HIGH` or `WARN/MEDIUM` repeats and manual review confirms real missing anchors.
