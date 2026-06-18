# Next Phase Plan

## Context

narrow Phase 1은 Phase 0 MVP 종료 판단, Phase 1.1 종료 판단, Phase 1.2 report-only observer 판단을 바꾸지 않는 범위에서 닫혔다.

현재 닫힌 Phase 1은 "Java/Spring Backend fixture에서 rule selection/injection evidence를 안정화하고, Controller direct Repository dependency 하나를 report-only로 관찰한다"는 좁은 정의다. 이 정의는 생성된 Spring 애플리케이션 품질 보증이나 Guard/AST/linter enforcement를 포함하지 않는다.

이 문서는 narrow Phase 1 이후의 별도 Phase 후보를 분리하고, 다음 loop에서 무엇을 먼저 볼지 결정한다.

## Closed Scope

Phase 0 MVP에서 닫힌 것:

- Java/Spring target file 감지와 file role 분류.
- `.persona/rules` 기반 rule selection과 injection block 생성.
- tool output 또는 model input으로 injection block이 도달한다는 evidence.
- Phase 0 #1, #2-3 Java/Spring backend fixture evidence.
- Scenario-aware contract selection이 step1과 step2-3 contract rule을 섞지 않는다는 evidence.

Phase 1.1에서 닫힌 것:

- minimal rule catalog loader.
- frontmatter/glob/scenario eligibility layer.
- Java/Spring Backend fixture에 한정한 catalog-backed rule selection refinement.
- #1/#2-3 contract exclusivity, Java/Spring base rule 유지, injection block format, `selectedRules` path string array shape.
- full rule engine이 아니라 기존 Phase 0 behavior 위에 붙인 최소 selection refinement.

Phase 1.2에서 닫힌 것:

- Controller direct Repository dependency를 문자열 기반으로 관찰하는 최소 observer.
- Java/Spring backend fixture의 Controller 파일만 대상으로 한 PASS / WARN / UNKNOWN finding.
- Repository import, field, constructor parameter, method body direct call evidence.
- report-only 원칙.
- ignored output report 위치: `.persona/evidence/phase1-2/observer-report.md`.
- build/test failure 또는 quality gate로 연결하지 않는 기준.

## Not Closed

다음 항목은 narrow Phase 1 종료 범위가 아니다.

- 실제 ignored experiment run 기반 observer/report 결과 검토.
- 별도 승인된 Guard/AST/linter observation 설계.
- Guard/AST/linter enforcement 또는 build/test failure gate.
- generated Spring product-quality 보증.
- profile-aware backend/frontend/infra 확장.
- OMO workflow/skill 각색.
- full rule engine 또는 broad AST/linter framework.

## Candidate Comparison

| Candidate | 후보 | narrow Phase 1과의 연속성 | 구현 없이 문서/설계로 충분한지 | 1-2 loop 안에 검증 가능한지 | MVP 본질을 흐리지 않는지 | 품질 게이트 오해 위험 |
| --- | --- | --- | --- | --- | --- | --- |
| A | 실제 ignored experiment run 기반 observer/report 결과 검토 | 높음. Phase 1.2 report-only observer의 바로 다음 해석 단계다. | 충분함. 새 기능 없이 기존 ignored report와 run evidence를 읽고 해석하면 된다. | 높음. 한 run의 report, evidence, limitations를 검토하면 된다. | 높음. injection/observation evidence 해석에 머문다. | 낮음. report review로 명명하고 gate가 아님을 반복하면 된다. |
| B | Guard/AST/linter observation 설계 | 중간. Phase 1.2 observer limitation과 연결되지만 한 단계 커진다. | 가능함. 설계 문서까지만 한다면 충분하다. | 중간. 설계는 가능하지만 도구 선택 논쟁이 커질 수 있다. | 중간. enforcement와 분리해야 MVP 경계를 지킨다. | 중간-높음. Guard/AST/linter라는 이름 자체가 gate로 오해되기 쉽다. |
| C | product-quality 검증으로 확장 | 낮음. Phase 0/1.1/1.2 모두 product quality를 닫지 않았다. | 낮음. 품질 검증은 실제 앱 실행, 테스트, 기준 정의가 필요하다. | 낮음. 1-2 loop 안에 과장 없이 닫기 어렵다. | 낮음. Persona Harness MVP가 injection path proof라는 본질을 흐린다. | 높음. quality certification으로 오해된다. |
| D | profile-aware 확장 | 낮음. 현재 active domain은 Java/Spring Backend only다. | 중간. planning fixture는 가능하지만 이번 결정 이후 단계다. | 낮음-중간. shallow demo가 될 위험이 크다. | 낮음. backend/frontend/infra routing으로 MVP 경계가 넓어진다. | 중간. profile routing이 품질 보증처럼 읽힐 수 있다. |
| E | OMO workflow/skill 각색 | 낮음. current Persona Harness는 OMO workflow 이식이 아니라 rule injection proof다. | 가능함. 비교 문서만은 가능하다. | 중간. 문서화는 가능하지만 범위가 빨리 커진다. | 낮음. OMO machinery가 Persona Harness evidence를 흐릴 수 있다. | 중간. workflow gate로 오해될 수 있다. |

## Decision

다음 별도 Phase 첫 후보는 **Candidate A: 실제 ignored experiment run 기반 observer/report 결과 검토**로 선택한다.

## Why

- 이미 Phase 1.2 report-only observer가 있다.
- Guard/AST/linter observation 설계로 넘어가기 전에, 실제 report가 어떤 evidence와 limitation을 주는지 먼저 확인하는 편이 작다.
- 새 기능 구현 없이 ignored output과 existing evidence만 검토할 수 있다.
- 1-2 loop 안에서 검증 가능하다.
- MVP 본질인 injection/observation evidence 해석에서 크게 벗어나지 않는다.
- quality gate가 아니라 "다음 rule/prompt 개선 후보인지 해석하는 report review"로 유지하기 쉽다.

## Why Not Others Yet

Candidate B는 중요하지만 지금 바로 하면 Guard/AST/linter gate처럼 읽힐 위험이 있다. 먼저 Candidate A로 실제 report의 정보량과 한계를 확인한 뒤, 부족한 부분이 분명해졌을 때 observation 설계로 들어간다.

Candidate C는 generated Spring product-quality 보증으로 범위를 바꾼다. Phase 0 MVP, Phase 1.1, Phase 1.2 어느 쪽도 product-quality certification을 닫지 않았다.

Candidate D는 profile-aware backend/frontend/infra 확장이다. 현재 active scope가 Java/Spring Backend only이므로, 지금 확장하면 MVP 경계와 regression attribution이 흐려진다.

Candidate E는 OMO workflow/skill 각색이다. 장기 비전과 연결될 수 있지만, 현재 Persona Harness의 좁은 Phase 1 후속으로는 너무 크고 injection/report evidence 판단을 흐릴 수 있다.

## ULW Checkpoint Limitation

이전 goal-loop에서 `omo ulw-loop checkpoint --status complete`는 Codex goal objective와 ULW aggregate objective 불일치로 거부됐다.

확인된 제한:

- Codex goal objective: Persona Harness Phase 1 남은 범위를 문서 기준으로 감사하고, 허용 범위만 구현/검증하는 목표.
- ULW aggregate objective: `.omo/ulw-loop/.../goals.json`의 durable aggregate plan을 완료하는 목표.
- 두 objective가 일치하지 않아 checkpoint reconciliation이 실패했다.

처리 원칙:

- 거짓 JSON으로 objective를 맞추지 않는다.
- 실제 완료된 작업과 ULW checkpoint limitation을 분리해 기록한다.
- 이 제한은 narrow Phase 1 종료 판단을 바꾸지 않는다.

## Next Loop

다음 최소 loop goal:

```text
실제 ignored experiment run 기반 Phase 1.2 observer/report 결과를 검토하고,
report가 rule/prompt 개선 후보를 식별하는 데 충분한지 문서화한다.
```

다음 loop 조건:

- 새 Guard/AST/linter 구현 금지.
- build/test failure 또는 enforcement gate 금지.
- product-quality 보증으로 확장 금지.
- ignored output의 observer report와 관련 run evidence만 검토.
- 결과는 tracked summary 문서와 local PROJECT-PLAN update에만 반영.
