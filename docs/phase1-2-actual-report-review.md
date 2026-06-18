# Phase 1.2 Actual Report Review

## Goal

actual ignored generated experiment run에 observer report를 붙이고 Controller direct Repository dependency WARN 반복 여부를 검토한다.

이번 review는 Controller direct Repository dependency 하나만 관찰한다. rule, prompt, observer logic은 보강하지 않는다.

## Report Source

actual run:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z`

observed Controller:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z/sandbox/src/main/java/com/example/reservation/ReservationController.java`

observer report:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z/observer-report.md`

run 선택 이유:

- `docs/phase1-completion-audit.md`와 `PROJECT-PLAN.md`에서 #2-3 live implementation evidence로 이미 기록된 actual generated run이다.
- 해당 run은 Controller/Test/DTO targetFile evidence를 남긴 #2-3 live run이다.

## Finding

`PASS`

actual generated Controller에서는 Controller direct Repository dependency WARN이 발생하지 않았다.

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

## Comparison

smoke fixture report:

- source: `.persona/evidence/phase1-2/observer-report.md`
- finding: `WARN`
- evidence:
  - field: `private final ReservationRepository repository;`
  - constructor parameter: `ReservationRepository repository`
  - method call: `repository.findById(`

actual generated run report:

- source: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/observer-report.md`
- finding: `PASS`
- evidence:
  - import: none
  - field: none
  - constructor parameter: none
  - method call: none

차이:

- smoke fixture는 의도적으로 Controller direct Repository dependency가 있는 WARN 샘플이다.
- actual #2-3 generated Controller는 Service dependency만 갖는다.
- 따라서 smoke fixture WARN은 actual generated run에서 반복 확인되지 않았다.

## Repeat Decision

반복 아님.

이번 actual generated run에서는 Controller direct Repository dependency WARN이 반복되지 않았다.

## Rule/Prompt Candidate

이번 loop에서는 Candidate B를 즉시 반영하지 않는다.

조건부 후보:

```text
experiment prompt에 “Controller는 Service만 호출하고 Repository/JdbcTemplate/SQL을 직접 다루지 않는다”를 최소 추가한다.
```

조건:

- 다른 actual generated run에서도 Controller direct Repository dependency WARN이 반복될 때만 다음 loop 후보로 올린다.
- 단일 actual run PASS만으로 rule/prompt를 강화하지 않는다.

## Limitations

- 문자열 기반 observer다.
- single actual run 기준이다.
- PASS는 Controller direct Repository dependency 하나에 대한 관찰 결과일 뿐이다.
- generated Spring app product-quality 보증이 아니다.
- enforcement gate가 아니다.
- build/test failure 조건이 아니다.
- full Guard/AST/linter 검증이 아니다.
- profile-aware backend/frontend/infra 확장이나 OMO workflow/skill 각색이 아니다.

## Next Loop

추천 next loop:

```text
Phase 1.2 actual report review 결과를 기준으로 rule/prompt 보강을 보류할지,
혹은 다른 actual generated run 1회를 추가 관찰할지 결정한다.
```

현재 판단:

- Candidate B는 즉시 적용하지 않는다.
- 추가 actual run에서 WARN이 반복될 때만 prompt 최소 보강을 다시 검토한다.
