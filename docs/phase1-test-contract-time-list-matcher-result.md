# Test Contract Time-list Matcher Result

## Goal

GET `/times` context의 list size assertion을 time list size `1` anchor로 인식하도록 보정한 결과를 확인한다.

This loop only adjusts the Test Contract Anchor observer matcher for a narrow `/times` context. It does not reinforce rules or prompts, change response time object matching, add dependencies, create an enforcement gate, or connect observer output to build/test failure.

## Changed Matcher

The time-list matcher now recognizes:

- `GET /times` followed in the same operation segment by `jsonPath("$.length()").value(1)`
- existing `GET /times` plus `hasSize(1)` behavior
- existing `reservation_time` row-count text behavior

The matcher remains string-based and does not become a generic list size parser. A `jsonPath("$.length()").value(1)` assertion near `GET /reservations` is not treated as time list size evidence.

## Tests Added

Added `tests/phase1-test-contract-time-list-observer.test.ts`.

The new tests cover:

- `GET /times` near `jsonPath("$.length()").value(1)` satisfies `reservation_time table or time list size 1`
- a time API test block with `GET /times` and `jsonPath("$.length()").value(1)` satisfies the anchor
- `GET /reservations` near `jsonPath("$.length()").value(1)` does not satisfy the time-list anchor
- comments and string literals do not satisfy the time-list anchor
- existing `hasSize(1)` based time-list behavior remains intact
- existing row-count helper matcher behavior remains intact

## Actual Report Recheck

Rechecked actual run:

- run: `experiments/phase0-runs/2026-06-18T00-34-47-590Z`
- target: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/sandbox/src/test/java/com/example/reservation/ReservationIntegrationTest.java`
- report: `experiments/phase0-runs/2026-06-18T00-34-47-590Z/test-contract-observer-report.md`

The report remains ignored under `experiments/`.

## Before / After

Before time-list matcher adjustment:

- finding: `WARN/HIGH`
- present:
  - reservation row count `1/0`
- missing:
  - reservation response time object
  - `reservation_time` table or time list size `1`

After time-list matcher adjustment:

- finding: `WARN/HIGH`
- present now includes:
  - reservation row count `1/0`
  - `reservation_time` table or time list size `1`
- missing:
  - reservation response time object

The time-list false missing candidate was reduced for the rechecked actual run.

## Still Missing

Still missing in the rechecked report:

- reservation response time object

This is intentionally not fixed in this loop. A previous comparison run had explicit `time.id` and `time.startAt` assertions, so response time object actual missing is not currently treated as repeated.

## Limitations

- String-based observer only.
- Narrow `/times` context only.
- False positives remain possible if a `GET /times` operation segment also contains unrelated list size assertions.
- False negatives remain possible for helper methods, constants, custom DSLs, or formatting outside the narrow pattern.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.
- `WARN` remains a missing-anchor report-only signal.

## Next Loop

Recommended next loop:

- Decide whether to close the current Test Contract observer cleanup track or run one more follow-up observation for the remaining response time object warning.

Rule/prompt reinforcement remains deferred until `WARN/HIGH` or `WARN/MEDIUM` repeats and manual review confirms real missing anchors.
