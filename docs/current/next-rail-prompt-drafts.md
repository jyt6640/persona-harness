# Next Rail Prompt Drafts

## Purpose

Record the next PH rail prompts before implementing each rail.

These are AI-facing workflow blocks. They are not generated-app product-quality certification, enforcement gates, or AST/linter rules.

## Next Candidate: Review Rail

```text
[Persona Harness Review Workflow]

Detected intent: review
Reason: The user asked for review, QA, audit, verification, or cold analysis.

의도 감지: 리뷰 요청으로 판단함.
근거: 사용자가 구현보다 검토/분석/QA를 요구함.
다음 행동: 수정하지 말고 findings를 먼저 정리한다.

Required flow:
- 코드를 수정하지 않는다.
- 현재 목표, 변경 범위, 관련 파일을 먼저 확인한다.
- Findings를 먼저 쓴다. 심각도 높은 순서로 정리한다.
- 각 finding에는 파일/라인/증거/영향을 포함한다.
- 문제가 없으면 "No findings"라고 명확히 말하고 남은 리스크를 적는다.
- 수정은 사용자가 명시적으로 요청할 때만 별도 구현 rail로 진행한다.

Evidence checklist:
- Reviewed files
- Commands or evidence inspected
- Findings with file references
- Residual risks

Non-goals:
- 자동 수정 rail이 아니다.
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
```

## Parking Draft: Refactor Rail

```text
[Persona Harness Refactor Workflow]

의도 감지: 리팩터링 요청으로 판단함.
근거: 사용자가 구조 개선/정리/리팩터링을 요청함.
다음 행동: public behavior를 먼저 고정하고, 동작 유지 범위 안에서만 구조를 바꾼다.

Required flow:
- 현재 동작을 테스트/빌드/스모크로 먼저 확인한다.
- 변경 범위를 작게 잡는다.
- public behavior를 바꾸지 않는다.
- 구조 변경 후 같은 검증을 다시 실행한다.
- 기능 추가와 리팩터링을 섞지 않는다.
```

## Parking Draft: Git Rail

```text
[Persona Harness Git Workflow]

의도 감지: git 작업 요청으로 판단함.
근거: 사용자가 commit/push/tag/history 작업을 명시함.
다음 행동: 작업트리와 diff를 확인하고, 요청된 git 작업만 수행한다.

Required flow:
- git status를 확인한다.
- diff를 확인한다.
- 관련 파일만 stage한다.
- atomic commit을 만든다.
- push는 사용자가 명시적으로 요청한 경우에만 한다.
```
