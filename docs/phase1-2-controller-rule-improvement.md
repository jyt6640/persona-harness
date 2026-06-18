# Phase 1.2 Controller Rule Improvement

## Goal

Controller direct Repository dependency observer report를 바탕으로 rule/prompt 개선 후보를 정리한다.

이번 문서는 개선 후보 문서화에만 한정한다. backend/controller rule이나 experiment prompt를 아직 수정하지 않고, observer 로직도 확장하지 않는다.

## Evidence Source

기준 report:

- `.persona/evidence/phase1-2/observer-report.md`
- review 문서: `docs/phase1-2-report-review.md`

evidence 성격:

- smoke fixture observer report다.
- finding은 `WARN`이다.
- evidence는 field, constructor parameter, method call로 나뉘어 있다.
- full generated experiment run 전체 결과가 아니다.
- `experiments/phase0-runs/**/observer-report.md` 기반 증거는 아직 없다.

따라서 이 evidence는 rule/prompt 개선 후보를 식별하기에는 부분 충분하지만, actual generated run 우선순위 판단으로 과장하지 않는다.

## Finding

Controller가 Repository를 직접 의존하는 경우 WARN이 가능하다는 관찰이 있었다.

관찰된 직접 의존 형태:

- Controller field: `private final ReservationRepository repository;`
- Controller constructor parameter: `ReservationRepository repository`
- Controller method body direct call: `repository.findById(`

이번 finding은 품질 게이트가 아니고 build/test failure 조건도 아니다. 다음 rule/prompt 개선 후보를 찾기 위한 report-only evidence다.

## Current Rule

현재 `.persona/rules/backend/spring-controller.md`의 관련 문구:

```md
- Controller는 HTTP 요청/응답 변환만 담당하고, 유스케이스 실행은 Service public 메서드에 위임한다.
- Controller에는 Repository 의존성, Map/List 저장 상태, id sequence, 저장소 구현 세부사항을 넣지 않는다.
- Controller에서 트랜잭션 경계나 저장소 구현 세부사항을 결정하지 않는다.
```

현재 rule은 이미 `Repository 의존성` 금지를 포함한다. 따라서 Candidate A는 완전히 새로운 정책 추가라기보다 기존 문구를 `Repository interface/implementation`까지 더 명시하는 clarification에 가깝다.

현재 experiment prompt의 관련 문구:

- `scripts/run-phase0-experiment.mjs`: `Controller는 Repository, Map/List 저장 상태, id sequence를 직접 소유하거나 호출하지 말고 ReservationService 같은 Service만 주입받아 위임하라.`
- `scripts/run-phase0-experiment.mjs`: `Service는 예약 생성/목록 조회/삭제 유스케이스를 조율하고 Repository는 메모리 저장/조회/삭제와 id 발급만 담당하게 하라.`
- `scripts/run-phase0-step2-3-experiment.mjs`: `Controller는 HTTP 요청/응답 변환과 Service 호출만 담당하고, JdbcTemplate, SQL, 저장소 구현 세부사항을 직접 다루지 마라.`
- `scripts/run-phase0-step2-3-experiment.mjs`: `Service는 예약/시간 유스케이스 흐름을 조율하고, JdbcTemplate과 SQL은 Repository가 담당하게 하라.`

#1 experiment prompt는 Controller direct Repository dependency를 이미 직접 금지한다. #2-3 experiment prompt는 Service-only와 JdbcTemplate/SQL/storage detail 금지를 포함하지만, Controller가 `Repository`를 직접 다루지 말라는 단어는 상대적으로 덜 명시적이다.

## Improvement Candidates

### Candidate A: backend/spring-controller.md clarification

`backend/spring-controller.md`에 다음 취지의 문구를 명시한다.

```text
Controller는 Repository interface/implementation에 직접 의존하지 않는다.
```

장점:

- base Controller rule에서 Repository interface와 implementation을 모두 분명히 금지한다.
- observer evidence의 field, constructor parameter, method call WARN과 직접 연결된다.
- prompt별 하드코딩보다 rule catalog의 기준 문구가 선명해진다.

단점:

- 현재 rule이 이미 `Controller에는 Repository 의존성...을 넣지 않는다`고 말한다.
- 실제 변경은 신규 정책보다 중복 clarification에 가깝다.
- smoke fixture 하나만으로 base rule을 더 강하게 보강하면 actual generated run 우선순위를 과장할 수 있다.

### Candidate B: experiment prompt wording

experiment prompt에 다음 취지의 문구를 추가하거나 기존 문구를 정리한다.

```text
Controller는 Service만 호출하고 Repository/JdbcTemplate/SQL을 직접 다루지 않는다.
```

장점:

- #2-3 prompt의 현재 문구가 `JdbcTemplate, SQL, 저장소 구현 세부사항`은 금지하지만 `Repository` 단어를 직접 묶어 말하지 않는 gap을 줄인다.
- base rule을 바꾸지 않고 experiment-specific wording만 좁게 보강할 수 있다.
- later generated run에서 같은 WARN이 반복될 때 가장 작은 수정 후보가 될 수 있다.

단점:

- #1 prompt는 이미 Controller direct Repository ownership/call 금지를 명시한다.
- prompt가 길어지면 API contract, status code, DTO shape 같은 중요한 bullet의 주의력이 밀릴 수 있다.
- prompt 문구 보강은 observer report 자체의 precision을 높이지 않는다.

### Candidate C: collect more report evidence before changing rule/prompt

rule은 그대로 두고 observer report를 반복 수집한 뒤, actual generated run evidence가 쌓이면 보강한다.

장점:

- smoke fixture evidence를 부분 충분으로만 취급한다.
- current rule이 이미 Repository dependency 금지를 포함한다는 사실과 충돌하지 않는다.
- actual generated run에서 같은 WARN이 반복되는지 확인한 뒤 Candidate A/B 중 작은 변경을 고를 수 있다.

단점:

- 즉시 문구를 고치지는 않는다.
- #2-3 prompt의 `Repository` 명시성 gap은 당장 닫히지 않는다.
- 추가 ignored report가 필요하다.

## Recommendation

추천: **Candidate C**.

이유:

- 현재 backend controller rule은 이미 `Repository 의존성` 금지를 포함한다.
- #1 experiment prompt는 Controller가 Repository를 직접 소유하거나 호출하지 말라고 이미 명시한다.
- #2-3 prompt는 `Repository` 단어를 Controller 금지 문구에 직접 넣지는 않지만, Service-only와 JdbcTemplate/SQL/storage detail 금지를 이미 포함한다.
- 이번 evidence는 smoke fixture report 하나이며, actual generated experiment run 전체 우선순위 증거가 아니다.
- 따라서 지금 rule/prompt를 바로 수정하기보다, observer report를 actual ignored generated run에 붙여 반복 여부를 확인하는 것이 더 작고 정직하다.

후속 조건부 추천:

- actual generated run에서 Controller direct Repository dependency WARN이 반복되면 Candidate B를 먼저 검토한다.
- 여러 scenario에서 base rule 해석이 흔들리면 Candidate A를 clarification으로 검토한다.

## Risks

- 너무 강한 rule이 1단계처럼 Service가 아직 없는 fixture에 과도하게 작동할 수 있다.
- prompt가 길어져 중요한 contract bullet이 밀릴 수 있다.
- smoke fixture evidence만으로 actual generated run 우선순위를 과장할 수 있다.
- 이미 존재하는 rule 문구를 중복 보강하면 무엇이 실제로 모델 행동을 바꿨는지 판단하기 어려워진다.
- report-only observer 결과를 품질 판단이나 enforcement 근거처럼 오해할 수 있다.

## Next Loop

추천 next loop:

```text
Candidate C를 유지할지 판단하기 위해 actual ignored generated experiment run에 Phase 1.2 observer report를 붙이고,
Controller direct Repository dependency WARN이 반복되는지 검토한다.
```

대안 next loop:

```text
actual generated run evidence를 추가로 확보하지 않는다면,
Candidate B를 #2-3 experiment prompt에 최소 반영할지 여부만 별도로 결정한다.
```

다음 loop에서도 enforcement gate, build/test failure, full Guard/AST/linter, product-quality 보증, profile-aware 확장, OMO workflow/skill 각색으로 확장하지 않는다.
