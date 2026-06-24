---
name: workflow-review
description: "Use when a user asks for review, audit, QA, verification, or cold analysis without asking for fixes. AI-facing review rail for findings-first, read-only review."
---

# Review Workflow

This skill is AI-facing. It routes prompts like `리뷰해줘`, `검토해줘`, or `냉정하게 봐봐` into findings-first review instead of silent code edits.

## Non-Goals

- This is not an automatic fix rail.
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Review Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

의도 감지: 리뷰 요청으로 판단함.
근거: 사용자가 구현보다 검토/분석/QA를 요구함.
다음 행동: 수정하지 말고 findings를 먼저 정리한다.

Required flow:
- 코드를 수정하지 않는다.
- 현재 목표, 변경 범위, 관련 파일을 먼저 확인한다.
- Findings를 먼저 쓴다. 심각도 높은 순서로 정리한다.
- 각 finding에는 파일/라인/증거/영향을 포함한다.
- 문제가 없으면 `No findings`라고 명확히 말하고 남은 리스크를 적는다.
- 수정은 사용자가 명시적으로 요청할 때만 별도 구현/debug/refactor rail로 진행한다.

Evidence checklist:
- Reviewed files
- Commands or evidence inspected
- Findings with file/line/evidence/impact
- Residual risks

Non-goals:
- 자동 수정 rail이 아니다.
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
- 구현/리팩터링을 시작하지 않는다.
<!-- /PH_RUNTIME_BLOCK -->
