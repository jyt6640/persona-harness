# Controller SQL Access Actual Report Review

## Goal

actual generated run에 Controller SQL Access observer report를 붙이고 WARN/HIGH 또는 WARN/MEDIUM 반복 여부를 검토한다.

이번 review는 기존 문자열 기반 Controller SQL Access observer를 actual generated Controller 1개에 적용해 해석하는 데만 한정한다. observer logic, rule, prompt, code는 보강하지 않는다.

## Report Source

actual run:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z`

선택 이유:

- `evidence.md`가 `step2-3 implementation` scenario와 OpenCode exit code `0`을 기록한다.
- generated Java files에 `ReservationController.java`, `ReservationService.java`, repository, DTO, integration test가 포함된다.
- 더 최신 `2026-06-18T05-13-12-174Z`, `2026-06-18T05-13-16-381Z`는 prepare-only/not-run이라 actual generated run이 아니다.

actual generated Controller:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z/sandbox/src/main/java/com/example/reservation/ReservationController.java`

observer report:

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z/controller-sql-observer-report.md`

## Finding

`PASS`

actual generated Controller에서는 Controller SQL direct access가 관찰되지 않았다.

## Confidence

`none`

`PASS` finding이라 report에는 `HIGH`, `MEDIUM`, `LOW` confidence가 붙지 않는다. 이번 actual report에서 WARN/HIGH, WARN/MEDIUM, INFO/LOW는 발생하지 않았다.

## Evidence

observer report evidence:

- JdbcTemplate import: none
- field: none
- constructor parameter: none
- member call: none
- SQL literal: none

actual Controller의 관련 구조:

```java
private final ReservationService reservationService;

public ReservationController(ReservationService reservationService) {
    this.reservationService = reservationService;
}
```

Controller method body는 `reservationService.*` 호출로 이어진다. `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource`, `java.sql.*`, SQL literal, direct SQL access member call은 관찰되지 않았다.

## Repeat Decision

반복 아님.

이번 actual generated run에서는 WARN/HIGH 또는 WARN/MEDIUM이 발생하지 않았다. 따라서 Controller SQL direct access 반복은 확인되지 않았다.

PASS로 기록한다:

```text
actual generated run에서는 Controller SQL direct access 반복 확인 안 됨
```

## Rule/Prompt Candidate

없음.

이번 actual generated run이 `PASS`이므로 다음 문구를 prompt 또는 backend/spring-controller rule에 반영할 근거로 사용하지 않는다.

```text
Controller는 JdbcTemplate/SQL을 직접 다루지 않고 Service만 호출한다
```

해당 문구는 나중에 actual generated run에서 WARN/HIGH 또는 WARN/MEDIUM이 반복될 때만 최소 보강 후보로 다시 올린다.

SQL literal-only INFO/LOW도 발생하지 않았으므로, INFO/LOW를 rule/prompt 보강 근거로 과장하는 문제도 이번 report에는 없다.

## Limitations

- 문자열 기반 observer다.
- single actual run 기준이다.
- product-quality 보증이 아니다.
- enforcement gate가 아니다.
- build/test failure 조건이 아니다.
- full Guard/AST/linter 검증이 아니다.
- profile-aware backend/frontend/infra 확장이나 OMO workflow/skill 각색이 아니다.
- `PASS`는 Controller SQL direct access 하나에 대한 관찰 결과일 뿐이며, generated Spring app 전체 품질 보증이 아니다.

## Next Loop

추천 next loop:

```text
Controller SQL Access observer actual report는 PASS로 유지하고,
rule/prompt 보강 없이 추가 actual run을 볼지 또는 다음 report-only 관찰 후보로 이동할지 결정한다.
```

조건부 next loop:

```text
나중에 actual generated run에서 Controller SQL Access observer가 WARN/HIGH 또는 WARN/MEDIUM을 반복 기록하면,
`Controller는 JdbcTemplate/SQL을 직접 다루지 않고 Service만 호출한다`를 prompt 또는 backend/spring-controller rule에 최소 반영할지 별도 loop에서 결정한다.
```
