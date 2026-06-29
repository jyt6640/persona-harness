---
name: workflow-requirements
description: "Use when a user asks to draft requirements from a vague product idea, implement README.md, requirements.md, pasted product requirements, feature additions, Step continuation, or remaining requirement work. AI-facing workflow rail for requirements drafting, analysis, backlog ticketing, implementation reports, and finish gates."
---

# Requirements Workflow

This skill is AI-facing. It exists so the agent can route short user requests like
`README.md 구현해줘` or `이 요구사항대로 만들어줘` into the Persona Harness workflow
without making the user memorize CLI commands.

## Trigger

Use this when the user asks to:

- implement `README.md`
- implement `requirements.md`
- draft requirements from a vague product idea
- build from pasted requirements
- add or change a feature from product requirements
- continue `Step N`
- complete remaining requirements

Do not use this skill for explanation-only, debugging-only, or code-review-only requests.

## Intent Preamble

Before acting, state the Persona Harness interpretation in Korean. Do not copy the OMO
`I detect ...` sentence. Use a PH-style preamble and immediately connect it to the next
`npx ph` command.

Use these forms:

- Vague product idea:
  - `의도 감지: 제품 아이디어 초안 작성 요청으로 판단함.`
  - `다음 행동: 구현하지 않고 requirements draft를 작성한 뒤 사용자 검토를 기다린다.`
- README or requirements file implementation:
  - `의도 감지: README.md 기반 구현 요청으로 판단함.`
  - `다음 행동: 요구사항 파일을 ticket backlog로 나눈 뒤 현재 ticket만 구현한다.`
- Pasted prompt requirements:
  - `의도 감지: 프롬프트 기반 요구사항 구현 요청으로 판단함.`
  - `다음 행동: 프롬프트를 요구사항 source로 저장하고 ticket backlog를 만든 뒤 현재 ticket만 구현한다.`
- Requirements draft approval:
  - `의도 감지: 요구사항 draft 승인 요청으로 판단함.`
  - `다음 행동: draft를 승인하고 ticket backlog를 만든 뒤 첫 ticket으로 이동한다.`
- Continuation:
  - `의도 감지: 이어서 진행 요청으로 판단함.`
  - `다음 행동: 다음 pending ticket을 확인하고 현재 ticket만 이어서 진행한다.`

Bad form:

- `의도 감지: 구현 요청입니다. 바로 구현하겠습니다.`

The preamble is not decoration. It must choose the next command rail.

## Required Flow

If the user gives a vague product idea such as `TODO 웹 서비스 만들래`:

1. Do not implement yet.
2. Run `npx ph workflow draft --stdin`.
3. Review `.persona/workflow/requirements/backlog.md`, `questions.md`, and `assumptions.md`.
4. Tell the user the requirements draft is complete.
5. Ask the user to review it and say `진행하자` when accepted.

If the user approves a requirements draft:

1. Run `npx ph workflow approve requirements`.
2. Run `npx ph workflow split .persona/workflow/requirements/backlog.md`.
3. Run `npx ph workflow next`.
4. Run `npx ph workflow implement`.
5. Implement only the current task card.
6. If the backlog is too large for one session, complete a bounded subset/current ticket, leave remaining tickets pending for continuation, and do not claim the whole backlog.

If requirements are in a file:

1. Read the file fully with `npx ph bearshell`, splitting long files into ranges.
2. Run `npx ph workflow split <file>`.
3. Run `npx ph workflow next`.
4. Read the current task card.
5. Implement only the current task card.
6. If the backlog is too large for one session, complete a bounded subset/current ticket, leave remaining tickets pending for continuation, and do not claim the whole backlog.

If requirements are in the prompt:

1. Capture the prompt requirements with `npx ph workflow capture --stdin`.
2. Run `npx ph workflow split`.
3. Run `npx ph workflow next`.
4. Read the current task card.
5. Implement only the current task card.
6. If the backlog is too large for one session, complete a bounded subset/current ticket, leave remaining tickets pending for continuation, and do not claim the whole backlog.

If the request is continuation work:

1. Run `npx ph workflow next`.
2. If the accepted plan continuation is needed, run `npx ph workflow continue`.
3. Implement only the current task card.
4. If the backlog is too large for one session, complete a bounded subset/current ticket, leave remaining tickets pending for continuation, and do not claim the whole backlog.

## Finish Gate

Before saying complete:

1. After build/test succeeds, fill `.persona/workflow/implementation-report.md` with actual evidence.
2. After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
3. Fill `.persona/workflow/review-report.md` with actual review evidence.
4. Run `npx ph plan --report-filled implementation` and `npx ph plan --report-filled review`.
5. Run `npx ph workflow check` and address blockers.
6. Archive satisfied req tickets only after review confirms requirements are satisfied: `npx ph workflow archive <ticket>`.
7. Run `npx ph workflow finish implement`.

If pending tickets remain, do not claim full completion. Report the next ticket instead.

## Non-Goals

- This is not product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force Persona Harness in projects without `.persona`.
- This does not replace project-specific requirements or user decisions.

<!-- PH_RUNTIME_BLOCK:draft -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

의도 감지: 제품 아이디어 초안 작성 요청으로 판단함.
근거: 구체 요구사항 파일 없이 새 서비스 아이디어를 말함.
다음 행동: 구현하지 않고 requirements draft를 작성한 뒤 사용자 검토를 기다린다.

Required flow:
- 프롬프트 본문을 제품 아이디어 source로 취급한다.
- 구현하지 않는다.
- 먼저 `npx ph workflow draft --stdin`로 requirements draft를 작성한다.
- `.persona/workflow/requirements/backlog.md`, `questions.md`, `assumptions.md`를 사용자에게 검토하라고 보고한다.
- 사용자가 `진행하자`라고 승인하기 전에는 `split`, `next`, `implement`를 실행하지 않는다.
- Draft complete message에는 `Say `진행하자``를 포함한다.

Finish gate:
- build/test 성공 후 `.persona/workflow/implementation-report.md`를 실제 evidence로 채운다.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- `.persona/workflow/review-report.md`를 실제 review evidence로 채운다.
- `npx ph plan --report-filled implementation`과 `npx ph plan --report-filled review`를 실행한다.
- `npx ph workflow check`를 실행하고 blocker를 해결한다.
- Do not archive req tickets until review confirms requirements are satisfied.
- 확인된 ticket만 `npx ph workflow archive <ticket>`로 history에 남긴다.
- 최종 완료 전 `npx ph workflow finish implement`를 실행한다.
- pending ticket이 남아 있으면 전체 완료라고 말하지 말고 다음 ticket을 보고한다.

Non-goals:
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
- `.persona`가 없는 프로젝트에는 이 workflow를 강제하지 않는다.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:approval -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

의도 감지: 요구사항 draft 승인 요청으로 판단함.
근거: 사용자가 draft 검토 후 진행을 승인하는 표현을 사용함.
다음 행동: draft를 승인하고 ticket backlog를 만든 뒤 첫 ticket으로 이동한다.

Required flow:
- 사용자가 requirements draft를 승인한 것으로 처리한다.
- `npx ph workflow approve requirements`를 실행한다.
- `npx ph workflow split .persona/workflow/requirements/backlog.md`를 실행해 implementation tickets를 만든다.
- `npx ph workflow next`로 첫 ticket을 확인한다.
- `npx ph workflow implement`로 구현 레일을 시작하고 현재 task card만 구현한다.
- backlog가 한 세션에 너무 크면 bounded subset/current ticket만 완료하고 leave remaining tickets pending for continuation; do not claim the whole backlog.

Finish gate:
- build/test 성공 후 `.persona/workflow/implementation-report.md`를 실제 evidence로 채운다.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- `.persona/workflow/review-report.md`를 실제 review evidence로 채운다.
- `npx ph plan --report-filled implementation`과 `npx ph plan --report-filled review`를 실행한다.
- `npx ph workflow check`를 실행하고 blocker를 해결한다.
- Do not archive req tickets until review confirms requirements are satisfied.
- 확인된 ticket만 `npx ph workflow archive <ticket>`로 history에 남긴다.
- 최종 완료 전 `npx ph workflow finish implement`를 실행한다.
- pending ticket이 남아 있으면 전체 완료라고 말하지 말고 다음 ticket을 보고한다.

Non-goals:
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
- `.persona`가 없는 프로젝트에는 이 workflow를 강제하지 않는다.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:file -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

의도 감지: {{sourceFile}} 기반 구현 요청으로 판단함.
근거: 사용자가 {{sourceFile}}/리드미 같은 요구사항 파일을 보고 구현하라고 요청함.
다음 행동: 요구사항 파일을 ticket backlog로 나눈 뒤 현재 ticket만 구현한다.

Required flow:
- 요구사항 파일: `{{sourceFile}}`
- 바로 구현하지 않는다.
- split/next 전에는 production code를 작성하지 않는다.
- 먼저 `npx ph bearshell --shell 'sed -n "1,220p" {{sourceFile}}'`처럼 범위를 나눠 파일을 끝까지 읽는다.
- 그 다음 `npx ph workflow split {{sourceFile}}`를 실행해 requirements-analysis/backlog/task card를 만든다.
- `npx ph workflow next`를 실행하고 현재 task card만 구현한다.
- backlog가 한 세션에 너무 크면 bounded subset/current ticket만 완료하고 leave remaining tickets pending for continuation; do not claim the whole backlog.
- backlog에 pending ticket이 남아 있으면 전체 완료라고 말하지 않는다.

Finish gate:
- build/test 성공 후 `.persona/workflow/implementation-report.md`를 실제 evidence로 채운다.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- `.persona/workflow/review-report.md`를 실제 review evidence로 채운다.
- `npx ph plan --report-filled implementation`과 `npx ph plan --report-filled review`를 실행한다.
- `npx ph workflow check`를 실행하고 blocker를 해결한다.
- Do not archive req tickets until review confirms requirements are satisfied.
- 확인된 ticket만 `npx ph workflow archive <ticket>`로 history에 남긴다.
- 최종 완료 전 `npx ph workflow finish implement`를 실행한다.
- pending ticket이 남아 있으면 전체 완료라고 말하지 말고 다음 ticket을 보고한다.

Non-goals:
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
- `.persona`가 없는 프로젝트에는 이 workflow를 강제하지 않는다.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:prompt -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

의도 감지: 프롬프트 기반 요구사항 구현 요청으로 판단함.
근거: 사용자가 요구사항 본문이나 기능 설명을 프롬프트로 직접 제공함.
다음 행동: 프롬프트를 요구사항 source로 저장하고 ticket backlog를 만든 뒤 현재 ticket만 구현한다.

Required flow:
- 프롬프트 본문을 요구사항 source로 취급한다.
- 구현 전에 `npx ph workflow capture --stdin`로 요구사항을 저장한다.
- 그 다음 `npx ph workflow split`를 실행해 requirements-analysis/backlog/task card를 만든다.
- `npx ph workflow next`를 실행하고 현재 task card만 구현한다.
- backlog가 한 세션에 너무 크면 bounded subset/current ticket만 완료하고 leave remaining tickets pending for continuation; do not claim the whole backlog.

Finish gate:
- build/test 성공 후 `.persona/workflow/implementation-report.md`를 실제 evidence로 채운다.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- `.persona/workflow/review-report.md`를 실제 review evidence로 채운다.
- `npx ph plan --report-filled implementation`과 `npx ph plan --report-filled review`를 실행한다.
- `npx ph workflow check`를 실행하고 blocker를 해결한다.
- Do not archive req tickets until review confirms requirements are satisfied.
- 확인된 ticket만 `npx ph workflow archive <ticket>`로 history에 남긴다.
- 최종 완료 전 `npx ph workflow finish implement`를 실행한다.
- pending ticket이 남아 있으면 전체 완료라고 말하지 말고 다음 ticket을 보고한다.

Non-goals:
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
- `.persona`가 없는 프로젝트에는 이 workflow를 강제하지 않는다.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:continuation -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

의도 감지: 이어서 진행 요청으로 판단함.
근거: 사용자가 다음 단계/이어서 진행을 요청함.
다음 행동: 다음 pending ticket을 확인하고 현재 ticket만 이어서 진행한다.

Required flow:
- 이어서 할 ticket을 찾기 위해 `npx ph workflow next`를 실행한다.
- accepted plan continuation이 필요하면 `npx ph workflow continue`를 실행한다.
- README.md가 없으면 막히지 말고 `.persona/project-profile.jsonc`, `.persona/policies/overlay.jsonc`, `.persona/workflow/plan.md`, 현재 task card를 repo-relative path로 읽고, package.json에서 Node/CommonJS stack을 추론하지 않는다.
- 현재 task card만 구현하고, 남은 ticket이 있으면 전체 완료라고 말하지 않는다.
- backlog가 한 세션에 너무 크면 bounded subset/current ticket만 완료하고 leave remaining tickets pending for continuation; do not claim the whole backlog.

Finish gate:
- build/test 성공 후 `.persona/workflow/implementation-report.md`를 실제 evidence로 채운다.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- `.persona/workflow/review-report.md`를 실제 review evidence로 채운다.
- `npx ph plan --report-filled implementation`과 `npx ph plan --report-filled review`를 실행한다.
- `npx ph workflow check`를 실행하고 blocker를 해결한다.
- Do not archive req tickets until review confirms requirements are satisfied.
- 확인된 ticket만 `npx ph workflow archive <ticket>`로 history에 남긴다.
- 최종 완료 전 `npx ph workflow finish implement`를 실행한다.
- pending ticket이 남아 있으면 전체 완료라고 말하지 말고 다음 ticket을 보고한다.

Non-goals:
- generated app product quality 보증이 아니다.
- AST/linter/enforcement gate가 아니다.
- `.persona`가 없는 프로젝트에는 이 workflow를 강제하지 않는다.
<!-- /PH_RUNTIME_BLOCK -->
