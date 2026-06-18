# Phase 1.2 Next Decision

## Context

Phase 1.2는 Controller direct Repository dependency 하나만 report-only로 관찰한다.

지금까지의 관계:

- smoke fixture에서는 Controller direct Repository dependency `WARN`이 가능했다.
- actual #2-3 generated run `2026-06-18T02-10-18-110Z`에서는 observer finding이 `PASS`였다.
- actual generated Controller는 `ReservationService`만 의존했고 Repository import, field, constructor parameter, method call evidence는 없었다.
- Candidate B prompt 보강은 즉시 반영하지 않기로 기록했다.

따라서 이번 결정은 rule/prompt/code를 보강할지 여부가 아니라, 다음 액션을 보류할지 추가 관찰로 분리할지의 결정이다.

## Evidence

Smoke fixture report:

- path: `.persona/evidence/phase1-2/observer-report.md`
- finding: `WARN`
- evidence:
  - field: `private final ReservationRepository repository;`
  - constructor parameter: `ReservationRepository repository`
  - method call: `repository.findById(`

Actual run report:

- run id: `2026-06-18T02-10-18-110Z`
- path: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/observer-report.md`
- target: `experiments/phase0-runs/2026-06-18T02-10-18-110Z/sandbox/src/main/java/com/example/reservation/ReservationController.java`
- finding: `PASS`
- evidence:
  - import: none
  - field: none
  - constructor parameter: none
  - method call: none

Git state at decision start:

- `main` was 2 commits ahead of `origin/main`.
- push was pending and remains out of scope for this loop.

## Options

### A. rule/prompt 보강 보류

근거:

- actual generated run에서 WARN 반복이 확인되지 않았다.
- Candidate B는 반복 WARN이 나올 때까지 보류한다.
- Phase 1.2 observer는 report-only observation으로 유지한다.
- prompt를 더 길게 만들 근거가 아직 약하다.

비용:

- single actual run 한계는 남는다.
- 추가 confidence를 얻으려면 나중에 별도 run이 필요할 수 있다.

### B. 다른 actual generated run 1회 추가 관찰

근거:

- actual 관찰이 single run이라 샘플이 약하다.
- smoke fixture WARN과 actual run PASS 사이의 차이를 더 확인할 수 있다.

비용:

- 새 implementation run은 시간과 token 비용이 크다.
- 현재 evidence가 rule/prompt 보강을 요구하지 않으므로, 추가 run은 즉시 필요한 blocker가 아니다.
- 추가 관찰을 하더라도 이번 loop의 결론은 보강 보류일 가능성이 높다.

## Decision

선택: **A. rule/prompt 보강 보류**.

Candidate B prompt 보강은 지금 적용하지 않는다.

다른 actual generated run 1회 추가 관찰도 지금 실행하지 않는다. 필요하면 별도 loop 후보로만 남긴다.

## Why

- actual generated run에서 Controller direct Repository dependency WARN이 반복되지 않았다.
- actual Controller는 Service dependency만 갖고 Repository direct dependency evidence가 없었다.
- smoke fixture WARN은 observer가 문제를 잡을 수 있음을 보여주는 샘플이지, actual generated run에서 반복된 defect evidence가 아니다.
- 현재 rule은 이미 Controller의 Repository 의존성을 금지한다.
- #2-3 prompt도 Service-only와 JdbcTemplate/SQL/storage detail 직접 접근 금지를 포함한다.
- 지금 prompt에 Candidate B를 추가하면 중요한 contract bullet 사이에 중복성 있는 문구가 늘어난다.
- Phase 1.2는 report-only observation이며, 이 결과를 enforcement나 product-quality 판단으로 확장하지 않는다.

## Risk

- single actual run 한계가 있다.
- 문자열 기반 observer라 unusual Java formatting에서는 false positive 또는 false negative가 가능하다.
- prompt bloat 위험이 있다.
- Candidate B를 보류하면 #2-3 prompt의 `Repository` 명시성 gap은 당장 닫히지 않는다.
- PASS는 Controller direct Repository dependency 하나에 대한 관찰 결과일 뿐이며 generated Spring app product-quality 보증이 아니다.

## Next Loop

추천 다음 loop:

```text
Phase 1.2 Controller direct Repository dependency는 보강 보류로 닫고,
다음 별도 Phase 후보를 Guard/AST/linter observation design 또는 다른 report-only observation 후보로 정리한다.
```

조건부 다음 loop:

```text
나중에 actual generated run에서 Controller direct Repository dependency WARN이 반복되면,
Candidate B prompt 보강을 최소 반영할지 별도 loop에서 결정한다.
```

이번 결정은 rule/prompt/code 보강, observer logic 확장, enforcement gate, build/test failure, full Guard/AST/linter, product-quality 보증, profile-aware 확장, OMO workflow/skill 각색을 포함하지 않는다.
