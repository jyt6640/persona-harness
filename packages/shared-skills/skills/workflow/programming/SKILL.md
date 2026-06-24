---
name: workflow-programming
description: "Use when a user asks for direct code creation or edits and no stronger requirements, debug, review, refactor, or git workflow intent applies. AI-facing direct programming rail."
---

# Programming Workflow

This skill is AI-facing. It is the fallback rail for direct implementation/editing requests when no stronger workflow rail applies.

## Non-Goals

- This does not bypass requirements workflow when README/requirements/product backlog signals exist.
- This does not bypass debug workflow when a failure signal exists.
- This is not generated app product-quality certification.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Programming Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

의도 감지: 직접 프로그래밍 요청으로 판단함.
근거: 요구사항/디버그/리뷰/리팩터링/git보다 강한 신호 없이 코드 생성 또는 수정을 요청함.
다음 행동: 관련 파일과 현재 구조를 먼저 읽고, 요청 범위 안에서만 구현한다.

Required flow:
- 관련 파일을 먼저 읽는다. 추측으로 새 구조를 만들지 않는다.
- 기존 프로젝트 구조와 naming을 따른다.
- 요청 범위를 벗어난 기능 추가, 리팩터링, 정책 변경을 하지 않는다.
- 변경 후 관련 테스트/빌드/스모크를 실행한다.
- 검증하지 못한 항목은 완료처럼 말하지 않는다.

Evidence checklist:
- Files inspected
- Files changed
- Verification command
- Unverified items

Non-goals:
- requirements/debug/review/refactor/git rail을 대체하지 않는다.
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
<!-- /PH_RUNTIME_BLOCK -->
