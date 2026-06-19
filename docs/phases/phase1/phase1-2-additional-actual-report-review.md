# Phase 1.2 Additional Actual Report Review

## Goal

Phase 1.2 문자열 기반 observer를 actual generated run 1회에 추가 적용하고, 기존 actual `PASS` 결과와 비교해 false positive, false negative, WARN 반복 여부를 재검토한다.

이번 review는 Controller direct Repository dependency 하나만 관찰한다. observer logic, rule, prompt, code는 변경하지 않는다.

## Report Source

additional actual run:

- `experiments/phase0-runs/2026-06-18T01-02-20-056Z`

observed Controller:

- `experiments/phase0-runs/2026-06-18T01-02-20-056Z/sandbox/src/main/java/com/example/reservation/ReservationController.java`

observer report:

- `experiments/phase0-runs/2026-06-18T01-02-20-056Z/observer-report.md`

run 선택 이유:

- `evidence.md`가 `step2-3 implementation` scenario와 generated Java files를 기록한다.
- Controller가 빈 클래스가 아니라 `ReservationService` field, constructor injection, endpoint method body를 포함한다.
- 따라서 기존 actual `PASS` run과 비교할 수 있는 meaningful Service-only generated Controller다.

## Finding

`PASS`

additional actual generated Controller에서는 Controller direct Repository dependency `WARN`이 발생하지 않았다.

## Evidence

observer report evidence:

- import: none
- field: none
- constructor parameter: none
- method call: none

actual Controller의 관련 구조:

```java
private final ReservationService reservationService;

public ReservationController(ReservationService reservationService) {
    this.reservationService = reservationService;
}
```

Controller method body는 `reservationService.*` 호출로 이어지고, `Repository` type import, field, constructor parameter, direct method call은 관찰되지 않았다.

## Comparison With Existing Actual PASS

existing actual run:

- run id: `2026-06-18T02-10-18-110Z`
- report: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/observer-report.md`
- finding: `PASS`
- evidence: import none, field none, constructor parameter none, method call none

additional actual run:

- run id: `2026-06-18T01-02-20-056Z`
- report: `experiments/phase0-runs/2026-06-18T01-02-20-056Z/observer-report.md`
- finding: `PASS`
- evidence: import none, field none, constructor parameter none, method call none

두 actual generated Controller 모두 `ReservationService`만 의존했다. smoke fixture의 intentional `WARN`은 추가 actual run에서도 반복 확인되지 않았다.

## False Positive / False Negative Review

false positive:

- 추가 actual run에서 observer는 Service-only Controller를 `PASS`로 판단했다.
- `Repository` evidence가 없는 Controller를 `WARN`으로 과장하지 않았으므로, 이번 표본에서는 false positive가 관찰되지 않았다.

false negative:

- manual source review에서도 Repository import, field, constructor parameter, direct method call은 보이지 않았다.
- 따라서 이번 표본에서는 Controller direct Repository dependency를 놓친 false negative evidence도 관찰되지 않았다.
- 단, 문자열 기반 observer라 unusual Java formatting, alias-like naming, generated code shape 변화에서는 false negative 가능성이 남는다.

## WARN Repeat Decision

반복 아님.

기존 actual run과 추가 actual run 모두 `PASS`이므로, actual generated run 기준 Controller direct Repository dependency `WARN` 반복은 확인되지 않았다.

## Decision

현재 evidence만으로 rule/prompt/code를 보강하지 않는다.

Candidate B prompt 보강은 계속 보류한다. 반복 `WARN`이 actual generated run에서 확인될 때만 다음 loop 후보로 다시 올린다.

## Limitations

- 문자열 기반 observer다.
- actual generated run 추가 1회 기준이다.
- `PASS`는 Controller direct Repository dependency 하나에 대한 관찰 결과일 뿐이다.
- product-quality 보증이 아니다.
- enforcement gate가 아니다.
- build/test failure 조건이 아니다.
- full Guard/AST/linter 검증이 아니다.
- AST/parser 재도입 판단이 아니다.
- profile-aware backend/frontend/infra 확장이나 OMO workflow/skill 각색이 아니다.

## Next Loop

추천 next loop:

```text
Phase 1.2 actual observer evidence는 WARN 반복 없음으로 유지하고,
다음 별도 Phase 후보를 다른 report-only observation 후보 문서화로 좁힌다.
```

조건부 next loop:

```text
나중에 actual generated run에서 Controller direct Repository dependency WARN이 반복되면,
Candidate B prompt 보강을 최소 반영할지 별도 loop에서 결정한다.
```
