# Test Contract Observer Cleanup Decision

## Goal

Decide whether to close the Test Contract observer cleanup track or observe the remaining response time object warning in one more actual run.

This loop does not implement features, adjust matchers, reinforce rules or prompts, create an enforcement gate, or make a test-quality/product-quality claim.

## Current State

The Test Contract Anchor observer cleanup track has reduced the two confirmed observer-noise sources:

- row-count matcher correction is complete.
- time-list matcher correction is complete.
- actual report recheck moved `reservation row count 1/0` from missing to present.
- actual report recheck moved `reservation_time` table or time list size `1` from missing to present.

The remaining warning is:

- reservation response time object

Current evidence:

- `experiments/phase0-runs/2026-06-18T00-34-47-590Z` still has a response time object missing candidate.
- `experiments/phase0-runs/2026-06-18T02-10-18-110Z` has explicit `time.id` and `time.startAt` assertions.
- response time object actual missing has not repeated across the comparison run.

## Options

### A. Close Test Contract observer cleanup track

Scope:

- Treat row-count and time-list observer noise cleanup as sufficient for this track.
- Keep response time object warning as a deferred watch item.
- Do not reinforce rules/prompts without repeated manual-confirmed actual missing evidence.

Advantages:

- Avoids overfitting the loop to a single-run warning.
- Keeps report-only observation from becoming a product-quality gate.
- Frees the next loop to choose a new observation candidate or close the current Phase 1.2 pass.

Risks:

- A real response time object drift could still exist in some generated runs.
- The watch item may need revisiting if later actual runs show the same missing anchor.

### B. Observe one more actual run for response time object

Scope:

- Apply the existing observer to one additional actual Java/Spring #2-3 test file.
- Manually check `time.id`, `time.startAt`, `$.time.id`, `$.time.startAt`, or equivalent nested assertions.

Advantages:

- Could strengthen or dismiss the remaining response time object candidate.
- If repeated and manually confirmed, it could support a future rule/prompt candidate.

Risks:

- Current repeated evidence is weak.
- Another small-sample run may still be inconclusive.
- It extends the cleanup track after the main observer-noise sources have already been addressed.

## Decision

Choose A: close the Test Contract observer cleanup track.

## Why

The remaining response time object warning is a single-run actual missing candidate, not repeated evidence. The comparison run contains explicit response time object assertions, so the candidate is not currently strong enough to justify another cleanup loop or rule/prompt reinforcement.

The observer cleanup goal has been met narrowly:

- row-count false missing candidate reduced
- time-list false missing candidate reduced
- no matcher expansion beyond the documented string-based report-only scope

Additional observation could be useful later, but it is not the highest-value next action now.

## Rule/Prompt Candidate

Do not reinforce rule or prompt now.

Keep this candidate inactive unless future actual runs repeat the missing anchor and manual review confirms the absence of equivalent nested response assertions:

`예약 조회 응답의 time은 id/startAt 객체이며, 테스트는 이를 요구사항 anchor로 관찰해야 한다`

## Limitations

- Small sample.
- String-based observer only.
- Manual review can miss helper or custom DSL evidence.
- `WARN` remains a report-only missing-anchor signal.
- This does not judge test quality.
- This does not provide product-quality assurance.
- This does not create an enforcement gate.
- This does not connect to build/test failure.

## Next Loop

Choose the next Phase 1.2 action:

- select a new report-only observation candidate, or
- close the current Phase 1.2 observation pass and move to a broader planning decision.
