# Persona Harness Top-level Intent Router Design

## Goal

Persona Harness should first classify what the user is asking for, then route the AI into the right workflow rail or shared skill.

The immediate product goal is not to activate every vendored OMO skill. The goal is to define a small, deterministic routing policy so short TUI prompts such as `README 보고 구현해줘`, `버그 고쳐줘`, `리뷰해줘`, or `커밋해줘` do not all collapse into direct implementation.

## Current State

Persona Harness currently has three separate surfaces:

- Requirements workflow routing: active through `src/runtime/requirements-intent-router.ts`.
- File-target shared skill routing: active through `src/runtime/shared-skill-router.ts`.
- Vendored reference skills: present under `packages/shared-skills/skills`, but mostly inactive.

Current active shared-skill routing is intentionally narrow:

| Surface | Runtime Status | Notes |
| --- | --- | --- |
| requirements workflow | active | Handles README/requirements/prompt requirements draft, approval, implementation, change, and continuation intents. |
| debug workflow block | active | Handles failure/error/broken-behavior prompts before requirements implementation. |
| review workflow block | active | Handles review/audit/QA prompts as read-only findings-first work. |
| refactor workflow block | active | Handles cleanup/restructure prompts as behavior-preserving structural work. |
| git workflow block | active | Handles commit/push/tag/history prompts as repository-safe git work. |
| intent evidence | active | Records user prompt, selected intent, secondary intents, and injected rail marker. |
| programming | active | File-target support for Java/Gradle and selected programming targets. |
| frontend | experimental active | Active for frontend TypeScript targets, but not part of Java backend MVP productization. |
| debugging | inactive reference | Vendored reference only; PH debug runtime block is implemented separately. |
| review-work | inactive reference | Vendored reference only; PH review runtime block is implemented separately. |
| refactor | inactive reference | Vendored reference only; PH refactor runtime block is implemented separately. |
| git-master | inactive reference | Vendored reference only; PH git runtime block is implemented separately. |

## Implementation Status

Status: MVP runtime router implemented.

Implemented:

- `src/runtime/top-level-intent-router.ts` classifies one primary intent and optional secondary intents.
- Requirements workflow hook routing now calls the top-level router first.
- Requirements workflow injection only runs when the primary intent is `requirements`.
- README-related debug requests such as `README 보고 구현했는데 테스트가 실패해. 고쳐줘` stay out of the requirements implementation rail.
- Debug primary intent injects a PH debug workflow block.
- Review primary intent injects a PH review workflow block.
- Refactor primary intent injects a PH refactor workflow block.
- Git primary intent injects a PH git workflow block.
- Injected workflow rails write `phase0.intent.1` evidence records under `.persona/evidence/phase0`.
- Unit tests cover requirements, debug, review, refactor, git, programming, and mixed work/git intent.

Not implemented yet:

- Activation of inactive vendored OMO skills as PH runtime rails.
- Moving rail block text out of runtime code strings into PH skill/reference files.
- Hook-based verification that the AI followed the selected rail after tool use or stop.

## Design Principle

The top-level router should choose one primary intent and optional secondary intents.

Primary intent controls the next workflow rail. Secondary intents provide context but do not override the rail.

Example:

```text
README 보고 구현해줘
```

Primary intent: `requirements`

Secondary intent: `programming`

Reason: README/requirements-driven implementation must pass through requirements workflow before code edits.

## Intent Categories

### requirements

Use when the user provides or references requirements, asks for a new product/service, asks to continue steps, or approves a drafted backlog.

Signals:

- `README`, `requirements`, `요구사항`, `리드미`
- `TODO 웹 서비스 만들래`, `서비스 만들래`, `프로젝트 만들래`
- `진행하자`, `이어서`, `다음 step`, `Step 2부터`
- pasted feature requirements

Expected rail:

```bash
npx ph workflow draft --stdin
npx ph workflow split
npx ph workflow next
npx ph workflow implement
```

For existing README/requirements files:

```bash
npx ph workflow split README.md
npx ph workflow next
npx ph workflow implement
```

### debug

Use when the user reports a failure, incorrect behavior, stuck process, runtime error, failed test, or asks why something does not work.

Signals:

- `왜 안돼`, `에러`, `실패`, `버그`, `멈춤`, `안됨`
- `test fail`, `build fail`, `crash`, `hang`, `debug`

Expected rail:

- reproduce the failure
- form hypotheses
- inspect evidence
- fix only the confirmed root cause
- verify with the failing command or smoke path

Debug intent should outrank direct programming when a failure signal is present.

### review

Use when the user asks for review, QA, audit, verification, or cold analysis without explicit implementation.

Signals:

- `리뷰`, `검토`, `분석`, `냉정하게 봐봐`
- `review`, `audit`, `QA`, `verify`

Expected rail:

- inspect current state
- report findings first
- do not modify code unless the user explicitly asks for fixes

Review intent should not silently become refactor or implementation.

### refactor

Use when the user asks to restructure, cleanup, simplify, or improve code while preserving behavior.

Signals:

- `리팩터링`, `정리`, `구조 개선`, `cleanup`, `refactor`, `restructure`

Expected rail:

- establish current behavior
- keep public behavior stable
- make scoped structural changes
- run tests

Refactor intent should outrank programming when the user explicitly asks to preserve or improve structure.

### git

Use when the user explicitly asks for git history or repository state operations.

Signals:

- `커밋`, `푸쉬`, `태그`, `릴리즈`, `git log`, `blame`, `rebase`
- `commit`, `push`, `tag`, `release`

Expected rail:

- inspect status
- stage only intended files
- commit atomically
- push only when explicitly requested

Git can be a primary intent when the request is only git work. If the request is `수정하고 커밋해`, implementation/debug/refactor is primary and git is a final secondary action.

### programming

Use when the user asks to create, edit, or implement code and no stronger workflow intent applies.

Signals:

- `구현`, `만들어`, `코드 작성`, `수정해`
- `implement`, `build`, `create`, `edit`

Expected rail:

- inspect relevant files
- implement scoped changes
- verify

Programming intent should not bypass requirements workflow when README/requirements or project idea signals are present.

## Priority Model

The router should use this priority model:

| Priority | Intent | Rule |
| --- | --- | --- |
| 1 | git-only | If the request is only commit/push/tag/history, route to git. |
| 2 | debug | Failure and broken-behavior signals beat direct implementation. |
| 3 | review | Explicit review/audit/analysis without fix request should stay read-only. |
| 4 | requirements | README/requirements/project idea/continuation/approval beats direct programming. |
| 5 | refactor | Structural improvement with behavior preservation beats generic programming. |
| 6 | programming | Default for direct code creation or editing. |

Mixed-intent exception:

If the user asks `fix and commit`, `implement and push`, or similar, the work intent is primary and `git` is secondary.

## Mixed Examples

| User Request | Primary Intent | Secondary Intent | Expected Behavior |
| --- | --- | --- | --- |
| `README 보고 구현해줘` | requirements | programming | Split/next/implement workflow before code edits. |
| `TODO 웹 서비스 만들래` | requirements | none | Draft backlog and ask for review before implementation. |
| `진행하자` | requirements | programming | Approve/split/next or continue the next ticket. |
| `Step 2부터 이어서 구현해줘` | requirements | programming | Continue from workflow ticket/backlog state. |
| `왜 gradle build가 실패하지?` | debug | programming | Reproduce and debug before editing. |
| `이 코드 리뷰해줘` | review | none | Findings first, no code changes by default. |
| `구조 좀 정리해줘` | refactor | programming | Preserve behavior and run tests. |
| `커밋하고 푸쉬해` | git | none | Inspect status, commit, push. |
| `버그 고치고 커밋해` | debug | git | Debug/fix/verify first, commit last. |

## Intent Preamble

Every selected rail should expose a short Korean preamble to the AI and, when useful, to the user-facing progress output.

Format:

```text
의도 감지: <intent> 요청으로 판단함.
근거: <short reason>
다음 행동: <next rail action>
```

## Intent Evidence

When a workflow rail is actually injected, Persona Harness writes a local intent evidence record.

Schema:

```json
{
  "schemaVersion": "phase0.intent.1",
  "hook": "experimental.chat.messages.transform",
  "injectedInto": "intent-workflow",
  "userPrompt": "...",
  "primaryIntent": "debug",
  "secondaryIntents": ["programming"],
  "reason": "...",
  "railMarker": "[Persona Harness Debug Workflow]"
}
```

This is diagnostics-only evidence. It does not enforce compliance, certify generated app quality, or fail the build.

Examples:

```text
의도 감지: 요구사항 구현 요청으로 판단함.
근거: README/requirements 파일을 기준으로 구현하라는 요청임.
다음 행동: workflow ticket을 확인하고, 구현 전/후 report evidence를 남긴다.
```

```text
의도 감지: 디버그 요청으로 판단함.
근거: 실패/에러/동작 이상을 해결해달라는 표현이 있음.
다음 행동: 재현 명령과 증거를 먼저 확보한 뒤 확인된 원인만 수정한다.
```

```text
의도 감지: 리뷰 요청으로 판단함.
근거: 구현보다 검토/분석/QA를 요구함.
다음 행동: 변경 없이 findings를 먼저 정리하고, 수정은 별도 승인 후 진행한다.
```

## Non-goals

- No full autonomous multi-agent system in this loop.
- No activation of inactive vendored OMO skills by default.
- No frontend/infra productization.
- No AST/linter/enforcement gate.
- No generated app product-quality certification.
- No replacement of the existing requirements sub-router yet.

## Future Implementation Candidate

Next implementation loop can add:

- `src/runtime/top-level-intent-router.ts`
- tests for intent priority and mixed-intent sequencing
- integration from top-level router to requirements workflow block
- metadata evidence for selected primary/secondary intents

Implementation acceptance criteria:

- `README 보고 구현해줘` routes to requirements primary and programming secondary.
- `왜 테스트 실패해?` routes to debug primary.
- `리뷰해줘` routes to review primary and stays read-only.
- `리팩터링해줘` routes to refactor primary.
- `커밋하고 푸쉬해` routes to git primary.
- `버그 고치고 커밋해` routes to debug primary and git secondary.
- Existing requirements workflow tests remain green.
