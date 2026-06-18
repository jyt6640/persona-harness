# Phase 1.2 Report Review

## Goal

실제 ignored experiment/report 산출물 기반 observer/report 결과가 rule/prompt 개선 후보를 식별하는 데 충분한지 평가한다.

이번 review는 Phase 1.2 observer 로직을 확장하지 않는다. Guard/AST/linter, enforcement gate, build/test failure, product-quality 보증, profile-aware 확장, OMO workflow/skill 각색으로 넘어가지 않는다.

## Report Source

확인한 ignored report:

- `.persona/evidence/phase1-2/observer-report.md`

추가 탐색 결과:

- `experiments/phase0-runs/**/observer-report.md`는 발견되지 않았다.

따라서 이번 판단은 `.persona/evidence/phase1-2/observer-report.md`의 `phase1-2-smoke` report에 한정한다.

## Report Summary

Target:

- run: `phase1-2-smoke`
- file: `.persona-test-fixtures/phase1-2/src/main/java/com/example/reservation/ReservationController.java`

Finding:

- `WARN`

Evidence:

- import: none
- field: `private final ReservationRepository repository;`
- constructor parameter: `ReservationRepository repository`
- method call: `repository.findById(`

Limitations:

- 문자열 기반 관찰이다.
- unusual Java formatting에서는 false positive 또는 false negative가 가능하다.

Decision:

- quality gate: no
- build/test failure: no
- next rule/prompt improvement candidate: yes

## Sufficiency Assessment

판단: **부분 충분**.

충분한 점:

- Target이 run id와 file path로 식별된다.
- Finding이 `WARN`으로 명확하게 구분된다.
- Evidence가 field, constructor parameter, method call로 나뉘어 기록된다.
- WARN의 원인이 `ReservationController`가 `ReservationRepository`를 직접 보유하고 호출한 것임을 추적할 수 있다.
- Decision이 quality gate나 build/test failure가 아니라 rule/prompt improvement candidate로 이어진다.

부족한 점:

- report가 full generated experiment run context와 연결되어 있지는 않다.
- report source는 `.persona/evidence` smoke fixture report이며, `experiments/phase0-runs/**/observer-report.md`는 없다.
- 어떤 prompt 또는 rule 문구가 실제 생성 결과에 영향을 주었는지까지는 report만으로 확인할 수 없다.
- PASS 또는 UNKNOWN 사례는 이번 report에 없어서 PASS/UNKNOWN 해석 충분성은 실제 산출물 기준으로는 아직 평가할 수 없다.

결론:

- 이 report는 WARN 발생 시 rule/prompt 개선 후보를 식별하기에는 충분하다.
- 단, 실제 experiment run 전체 맥락에서 개선 우선순위를 정하기에는 부분 충분에 머문다.

## Rule/Prompt Improvement Candidates

report에서 직접 도출 가능한 후보:

- Controller guidance를 강화한다: Controller는 Repository를 직접 field로 보유하지 않고 Service를 의존해야 한다.
- Constructor injection guidance를 강화한다: Controller constructor parameter에는 Service 타입을 받게 하고 Repository 타입은 Service 또는 lower layer에 머물게 한다.
- Method body guidance를 강화한다: Controller method body에서 `repository.*` 직접 호출을 하지 않고 Service method를 호출하게 한다.
- Existing backend/API contract rule 또는 Controller role prompt에 "Controller -> Service -> Repository" 경계를 더 명시한다.

report만으로 아직 도출하지 않는 것:

- AST 기반 rule 설계.
- enforcement gate.
- build/test failure 조건.
- generated Spring app product-quality verdict.

## Limitations

- 이번 review는 실제 ignored report 산출물 하나만 기준으로 한다.
- source report는 smoke fixture report이며, full `experiments/phase0-runs` observer report가 아니다.
- 문자열 기반 observer의 false positive/false negative 가능성은 남아 있다.
- 이 review는 Controller direct Repository dependency 하나만 다룬다.
- 결과는 quality gate가 아니라 다음 rule/prompt 개선 후보 식별에만 사용한다.

## Decision

다음 loop는 observer 로직 보강이 아니라 **rule/prompt 개선 후보 문서화**로 가는 것이 더 작다.

이유:

- report가 이미 field, constructor parameter, method call evidence를 제공한다.
- WARN 원인이 Controller direct Repository dependency로 충분히 추적된다.
- observer precision을 올리기 전에, 현재 report가 가리키는 rule/prompt 문구 후보를 먼저 정리할 수 있다.

단, 실제 experiment run 맥락에서 우선순위를 확인하려면 별도 loop에서 ignored experiment run에 observer report를 붙여 다시 검토한다.

## Next Loop

추천 다음 loop:

```text
Phase 1.2 report review에서 나온 Controller direct Repository dependency 개선 후보를 바탕으로,
기존 backend/controller rule 또는 prompt 문구를 어떻게 보강할지 문서화한다.
```

제약:

- 아직 rule/prompt를 실제 수정하지 않는다.
- Guard/AST/linter로 확장하지 않는다.
- enforcement gate나 build/test failure로 연결하지 않는다.
- product-quality 보증으로 설명하지 않는다.
