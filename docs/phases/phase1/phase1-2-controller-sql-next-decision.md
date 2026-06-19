# Controller SQL Access Next Decision

## Context

Controller SQL Access observer actual review는 single actual generated run 기준으로 완료했다.

기준 run은 `experiments/phase0-runs/2026-06-18T02-10-18-110Z`이고, 대상은 generated `ReservationController.java`다. observer는 문자열 기반 report-only 관찰로 유지한다.

이번 decision loop는 다음 액션 결정에만 한정한다. rule, prompt, code, observer logic은 보강하지 않는다.

## Evidence

report source:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z/controller-sql-observer-report.md`
- review: `docs/phases/phase1/phase1-2-controller-sql-actual-report-review.md`

finding:

- `PASS`

confidence:

- `none`

evidence summary:

- JdbcTemplate import: none
- field: none
- constructor parameter: none
- member call: none
- SQL literal: none

repeat summary:

- WARN/HIGH 반복 없음
- WARN/MEDIUM 반복 없음
- INFO/LOW도 없음

## Options

### A. rule/prompt 보강 보류

근거:

- actual generated run에서 WARN/HIGH 또는 WARN/MEDIUM이 반복 확인되지 않았다.
- SQL literal-only INFO/LOW도 없었다.
- observer는 report-only로 유지해야 한다.

비용:

- SQL observer 관련 rule/prompt 개선은 즉시 진행하지 않는다.
- single actual run 한계는 남는다.

### B. 추가 actual run 1회 관찰

근거:

- 현재 evidence는 single actual run이라 샘플이 약하다.
- 반복 WARN/HIGH 또는 WARN/MEDIUM 여부를 더 직접 확인할 수 있다.

비용:

- implementation run 비용과 시간이 든다.
- 이번 decision을 실제 OpenCode runtime 검증 loop로 확장하게 된다.
- 지금 관찰된 신호가 `PASS`라 즉시 필요한 blocker는 아니다.

### C. 다음 report-only 관찰 후보로 이동

근거:

- 현재 SQL observer 후보에서는 즉시 보강할 신호가 약하다.
- report-only observation 트랙을 유지하면서 다른 boundary 후보를 비교할 수 있다.
- 후보는 Service 저장소 상태/id sequence 직접 소유, DTO 저장소 구현 세부사항, Test contract drift 등으로 좁힐 수 있다.

비용:

- SQL observer 자체의 sample count는 single actual run으로 남는다.
- 다음 후보도 product-quality 보증이나 enforcement로 오해되지 않게 문서 경계를 다시 잡아야 한다.

## Decision

선택: **C. 다음 report-only 관찰 후보로 이동**

단, SQL observer에 대해서는 **A의 결론을 함께 유지**한다. 즉, 이번 evidence로 rule/prompt 보강은 보류한다.

## Why

- actual generated run의 SQL observer finding은 `PASS`다.
- WARN/HIGH 또는 WARN/MEDIUM 반복 evidence가 없으므로 `Controller는 JdbcTemplate/SQL을 직접 다루지 않고 Service만 호출한다` 문구를 지금 rule/prompt에 반영하지 않는다.
- SQL literal-only INFO/LOW도 없었고, 설령 있었다 해도 단독으로는 rule/prompt 보강 근거로 약하다.
- 추가 actual run은 샘플을 보강하지만 현재 `PASS` 결과만으로 비용을 바로 정당화하기 어렵다.
- 따라서 SQL observer 해석은 report-only decision으로 닫고, 다음 loop는 다른 report-only 관찰 후보를 하나로 좁히는 데 쓴다.

## Risk

- single actual run 한계가 남는다.
- 문자열 기반 observer라 unusual Java formatting에서는 false positive 또는 false negative 가능성이 남는다.
- `PASS`는 Controller SQL direct access 하나에 대한 관찰 결과일 뿐이며, generated Spring app 전체 품질 보증이 아니다.
- INFO/LOW를 나중에 발견하더라도 literal-only evidence를 rule/prompt 보강 근거로 과장하면 안 된다.
- 다음 후보가 Service/Test 내부 판단으로 이동하면 product-quality 보증이나 enforcement gate처럼 보일 위험이 커질 수 있다.

## Next Loop

추천 next loop:

```text
다음 report-only 관찰 후보를 하나로 좁힌다.
후보는 Service 저장소 상태/id sequence 직접 소유, DTO 저장소 구현 세부사항, Test contract drift 중에서 비교한다.
```

조건:

- 새 기능을 구현하지 않는다.
- observer logic을 확장하지 않는다.
- rule/prompt/code를 보강하지 않는다.
- product-quality 보증, enforcement gate, build/test failure, full Guard/AST/linter, profile-aware 확장, OMO workflow/skill 각색으로 확장하지 않는다.
