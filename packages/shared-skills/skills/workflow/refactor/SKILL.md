---
name: workflow-refactor
description: "Use when a user asks to refactor, restructure, clean up, simplify, or improve code structure while preserving behavior. AI-facing refactor rail for behavior baseline and same verification rerun."
---

# Refactor Workflow

This skill is AI-facing. It routes prompts like `리팩터링해줘`, `구조 정리해줘`, or `cleanup 해줘` into behavior-preserving structural work.

## Non-Goals

- This is not a new-feature rail.
- This is not the debug rail.
- This is not generated app product-quality certification.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Refactor Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

의도 감지: 리팩터링 요청으로 판단함.
근거: 사용자가 기능 추가보다 구조 개선/정리/cleanup을 요청함.
다음 행동: public behavior를 먼저 고정한다. 그 다음 작은 구조 변경만 수행한다.

Required flow:
- 현재 public behavior를 테스트/빌드/스모크 또는 관찰 가능한 evidence로 먼저 고정한다.
- 기능을 추가하지 않는다. 요구사항 변경, API 확장, 버그 수정은 별도 rail에서 다룬다.
- 변경 범위를 작게 잡고 한 번에 하나의 구조 문제만 다룬다.
- 이름/계층/중복/책임 분리처럼 behavior-preserving 변경만 수행한다.
- 구조 변경 후 같은 테스트/빌드/스모크 명령을 다시 실행한다.
- 검증 결과와 남은 리스크를 보고한다.

Evidence checklist:
- Baseline behavior evidence
- Refactor scope
- Files changed
- Same verification command after refactor
- Residual risks

Non-goals:
- implementation/debug rail이 아니다.
- 새 기능 추가 rail이 아니다.
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
<!-- /PH_RUNTIME_BLOCK -->
