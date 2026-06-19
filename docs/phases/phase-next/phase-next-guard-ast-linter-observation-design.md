# Guard/AST/Linter Observation Design

## Goal

Phase 1 이후 별도 Phase 후보로서 Guard/AST/linter observation을 최소 설계한다.

이번 설계는 구현 계획이 아니라 관찰 경계 문서다. Phase 0 MVP, Phase 1.1, Phase 1.2 종료 판단을 바꾸지 않으며, Phase 1.2의 report-only 원칙도 유지한다.

## Context

Phase 1.2는 Controller direct Repository dependency 하나를 문자열 기반 observer로 관찰했다.

문자열 기반 observer는 작고 검증 가능했지만 다음 한계가 있다.

- Java syntax를 실제로 이해하지 않는다.
- unusual formatting, nested class, partial source에서 false positive 또는 false negative가 가능하다.
- report-only observation에는 충분했지만, 더 넓은 구조 관찰로 확장하면 AST/linter/Guard처럼 보이는 이름 자체가 gate로 오해될 수 있다.

따라서 다음 후보는 "enforcement"가 아니라 "observation"으로만 설계한다.

## Decision

다음 별도 Phase 후보는 **AST-first observation design**으로 둔다.

단, 이번 loop에서는 AST parser, linter, Guard, CLI, hook, npm script, test, runtime integration을 구현하지 않는다.

## Why

세 후보를 분리한다.

| Candidate | 의미 | 지금 판단 |
| --- | --- | --- |
| AST observation | Java source를 구조적으로 읽고 report-only finding을 만든다. | 다음 후보로 가장 작다. Phase 1.2 문자열 observer의 한계를 직접 줄인다. |
| Linter observation | Checkstyle/PMD/SpotBugs 같은 외부 도구 결과를 읽는다. | 지금은 과하다. tool config, dependency, execution, environment drift가 생긴다. |
| Guard observation | harness hook path에서 rule violation을 막거나 경고한다. | 지금은 하지 않는다. enforcement gate로 오해될 위험이 가장 크다. |

AST-first라고 해도 implementation-first가 아니다. 먼저 observation contract와 output boundary를 문서로 고정한 뒤, 별도 승인 loop에서만 실험한다.

## Scope

최소 후보 scope:

- Java/Spring backend fixture only.
- 기존 Phase 1.2와 같은 Controller direct Repository dependency 관찰.
- `*Controller.java` target only.
- Repository import, field, constructor parameter, method call evidence.
- PASS / WARN / UNKNOWN finding.
- ignored output report only.

AST observation이 추가로 해도 되는 일:

- import declaration node 확인.
- class field node의 type 확인.
- constructor parameter node의 type 확인.
- method invocation receiver가 repository 변수인지 확인.
- parser failure 또는 partial source는 UNKNOWN으로 기록.

## Non-Goals

- 새 기능 구현 아님.
- enforcement gate 아님.
- build/test failure 연결 아님.
- product-quality 보증 아님.
- full Guard framework 아님.
- full AST/linter framework 아님.
- profile-aware backend/frontend/infra 확장 아님.
- OMO workflow/skill 각색 아님.
- Controller direct Repository dependency 외 규칙 확장 아님.
- generated Spring app 품질 평가 아님.

## Observation Contract

후속 구현 후보가 생기더라도 contract는 다음 범위를 넘지 않는다.

```ts
type ObservationFinding = "PASS" | "WARN" | "UNKNOWN";

type ObservationEvidence =
  | "import"
  | "field"
  | "constructor parameter"
  | "method call"
  | "limitation";
```

필수 속성:

- finding은 build/test result로 해석하지 않는다.
- WARN은 rule/prompt 개선 후보일 뿐이다.
- UNKNOWN은 실패가 아니라 관찰 한계다.
- report는 ignored output에만 남긴다.
- tracked docs에는 요약과 결정만 남기고 generated report를 자동 커밋하지 않는다.

## Tooling Options

### Option A: AST Parser

예상 방식:

- Java parser를 사용해 `CompilationUnit` 수준으로 import/class/member/method call을 읽는다.
- parser failure는 UNKNOWN으로 남긴다.
- Phase 1.2 문자열 observer와 같은 report format을 유지한다.

장점:

- 문자열 observer보다 false positive/false negative를 줄일 수 있다.
- 기존 observation target과 바로 이어진다.
- report-only 구조를 유지하기 쉽다.

위험:

- parser dependency 선택이 별도 논쟁이 된다.
- incomplete Java source에서 UNKNOWN이 늘 수 있다.
- AST helper가 커지면 full framework로 번질 수 있다.

### Option B: External Linter

예상 방식:

- Checkstyle/PMD/SpotBugs 같은 외부 결과를 읽고 report-only summary로 변환한다.

장점:

- Java ecosystem의 기존 rule tooling을 활용할 수 있다.

위험:

- config와 execution environment가 필요하다.
- build/test failure나 CI gate로 오해될 가능성이 높다.
- product-quality validation으로 확장되기 쉽다.

### Option C: Guard Hook

예상 방식:

- harness hook path에서 violation을 감지하고 경고 또는 차단한다.

장점:

- 나중에 policy enforcement가 필요해질 때 연결 지점이 될 수 있다.

위험:

- 이번 사용자 경계와 정면으로 충돌한다.
- enforcement gate가 되기 쉽다.
- Phase 1.2 report-only 원칙을 흐린다.

## Recommendation

추천은 **Option A: AST Parser를 이용한 report-only observation 설계 후보**다.

이유:

- Phase 1.2 문자열 observer의 한계를 가장 직접적으로 줄인다.
- 기존 Controller direct Repository dependency 관찰 대상을 그대로 유지할 수 있다.
- linter나 Guard보다 enforcement/gate 오해 위험이 낮다.
- 다만 다음 loop도 implementation이 아니라 parser 후보 비교와 fixture contract 고정으로 시작하는 편이 안전하다.

## Output Boundary

후속 observation report 후보:

- `.persona/evidence/phase-next/guard-ast-linter-observation-report.md`
- `experiments/phase0-runs/{timestamp}/guard-ast-linter-observation-report.md`

출력 조건:

- ignored path only.
- report-only markdown.
- PASS / WARN / UNKNOWN.
- Evidence와 Limitations 필수.
- Decision은 "rule/prompt improvement candidate"까지만 허용.

## Verification Boundary

이번 설계 loop의 검증은 repository health만 확인한다.

필수:

- `npm test`
- `npm run typecheck`
- `npm run build`

금지:

- AST parser 설치.
- linter 실행.
- Guard hook 추가.
- npm script 추가.
- generated app quality test.
- build/test failure와 observation finding 연결.

## Next Loop

추천 next loop:

```text
Guard/AST/linter observation 중 AST-first report-only 후보를 구현하지 않고,
Java parser 후보와 fixture contract를 비교해 다음 구현 여부를 결정한다.
```

대안 next loop:

```text
다른 report-only observation 후보를 Phase 1.2와 같은 형식으로 비교하고,
Controller direct Repository dependency 이외의 첫 후보를 고른다.
```

