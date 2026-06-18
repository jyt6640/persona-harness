# Test Contract Time-list Matcher Decision

## Context

The Test Contract Anchor observer now has a narrower state after recent loops:

- row-count matcher correction is complete for the observed patterns.
- reservation row count `1/0` moved from missing to present in the rechecked actual report.
- response time object actual missing did not repeat in the comparison run.
- the remaining `WARN/HIGH` in the current comparison report is centered on `reservation_time` table or time list size `1`.

The current remaining WARN should not be treated as a test-quality or product-quality verdict. It is a report-only missing-anchor signal from a string-based observer.

## Current Problem

The remaining time-list/table anchor has two competing risks.

False missing risk:

- Actual generated tests can verify the time list size with `jsonPath("$.length()").value(1)` after `GET /times`.
- The current observer only recognizes `hasSize(1)` near `GET /times` or a broad `reservation_time` plus `isEqualTo(1)` style.
- That means valid `GET /times` list size assertions using `jsonPath("$.length()").value(1)` can be missed.

False positive risk:

- `jsonPath("$.length()").value(1)` is generic.
- The same expression can assert reservation list size, time list size, or another array response.
- Treating every `jsonPath("$.length()").value(1)` as time list size would overstate evidence.

The matcher can only be considered if it is bounded by `/times` context.

## Options

### A. 좁은 `/times` context matcher로 보정

Scope:

- Recognize `jsonPath("$.length()").value(1)` or equivalent list size assertion only near a `GET /times` operation.
- Keep this as a string-based report-only matcher.

Advantages:

- Reduces the current false missing candidate.
- Aligns the observer with actual generated test style already seen in multiple #2-3 runs.
- Keeps the correction narrow and local to the time-list anchor.

Risks:

- Generic list size assertions can still be over-attributed if context bounds are too wide.
- Multi-step tests can include several route calls close together, making "nearby" ambiguous.
- Helper methods or constants can still hide equivalent evidence.

### B. 보류하고 다음 observation 후보로 이동

Scope:

- Leave the current time-list matcher as-is.
- Treat remaining `reservation_time` table or time list size `1` WARN as known observer limitation.
- Move to a different report-only observation candidate.

Advantages:

- Avoids adding another heuristic.
- Reduces false positive risk.
- Keeps the observer simpler.

Risks:

- Leaves a repeated false missing candidate unresolved.
- Makes actual report review noisier because the same time-list WARN can recur.
- Weakens the usefulness of Test Contract observer reports for #2-3 runs.

## Decision

Choose A: 좁은 `/times` context matcher로 보정.

## Why

The row-count mismatch has already been reduced, and response time object actual missing did not repeat. The remaining active WARN is now mostly a time-list/table matcher limitation.

The value of a narrow `/times` matcher is higher than the risk if the implementation requires clear `GET /times` context. The important constraint is to avoid a generic list size parser.

This decision does not implement the matcher. It only selects the next loop direction.

## Narrow Match Conditions

Future implementation should only recognize time list size `1` when all relevant context is present.

Required context:

- A `GET /times` request appears in the same operation segment, method block, or a small nearby line/window.
- The list assertion is close to that `GET /times` request.
- The assertion is one of:
  - `jsonPath("$.length()").value(1)`
  - `jsonPath("$").value(hasSize(1))`
  - `jsonPath("$", hasSize(1))`
  - another explicitly equivalent list size `1` assertion, only if already observed and documented first.

Disambiguation conditions:

- Do not count a list size assertion near `GET /reservations` as time list size.
- Do not count a file-level `jsonPath("$.length()").value(1)` without nearby `/times`.
- Do not count comments or string literal descriptions.
- Do not count unrelated helper names unless the helper clearly wraps `GET /times`.
- Prefer `HIGH` confidence only when `GET /times` and list size assertion are in the same operation chain or very small segment.
- Use `MEDIUM` only for clearly nearby helper/constant patterns.
- Keep weak keyword-only evidence as missing or `LOW`, not `PASS/HIGH`.

## Non-Goals

- generic list size parser 아님
- AST/linter 아님
- full Guard 아님
- 새 dependency 추가 아님
- test quality 보증 아님
- product-quality 보증 아님
- enforcement gate 아님
- build/test failure 연결 아님
- rule/prompt 보강 아님
- response time object matcher 변경 아님
- row-count matcher 재작업 아님

## Next Loop

Implement the narrow time-list matcher with tests first.

Suggested required tests:

- `GET /times` followed by `jsonPath("$.length()").value(1)` satisfies `reservation_time table or time list size 1`.
- `GET /reservations` followed by the same assertion does not satisfy the time-list anchor.
- `jsonPath("$.length()").value(1)` in comments or unrelated strings does not satisfy the time-list anchor.
- Existing `hasSize(1)` near `GET /times` behavior remains intact.
- Existing row-count matcher behavior remains intact.

Rule/prompt reinforcement remains deferred.
