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

Before acting, state the Persona Harness interpretation in English. Do not copy the OMO
`I detect ...` sentence. Use a PH-style preamble and immediately connect it to the next
`npx ph` command.

Use these forms:

- Vague product idea:
  - `Intent classification: product idea drafting request.`
  - `Next action: do not implement; write a requirements draft and wait for user review.`
- README or requirements file implementation:
  - `Intent classification: implementation request based on README.md.`
  - `Next action: split the requirements file into a ticket backlog, then implement only the current ticket.`
- Pasted prompt requirements:
  - `Intent classification: prompt-based requirements implementation request.`
  - `Next action: save the prompt as a requirements source, create a ticket backlog, and implement only the current ticket.`
- Requirements draft approval:
  - `Intent classification: requirements draft approval request.`
  - `Next action: approve the draft, create the ticket backlog, and move to the first ticket.`
- Continuation:
  - `Intent classification: continuation request.`
  - `Next action: inspect the next pending ticket and continue only the current ticket.`

Bad form:

- `Intent classification: implementation request. I will implement immediately.`

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

Intent classification: product idea drafting request.
Basis: the user described a new service idea without a concrete requirements file.
Next action: do not implement; write a requirements draft and wait for user review.

Required flow:
- Treat the prompt body as the product idea source.
- Do not implement.
- First create a requirements draft with `npx ph workflow draft --stdin`.
- Tell the user to review `.persona/workflow/requirements/backlog.md`, `questions.md`, and `assumptions.md`.
- Do not run `split`, `next`, or `implement` before the user approves the draft.
- Include a clear instruction asking the user to approve before implementation.

Finish gate:
- After build/test success, fill `.persona/workflow/implementation-report.md` with real evidence.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- Fill `.persona/workflow/review-report.md` with real review evidence.
- Run `npx ph plan --report-filled implementation` and `npx ph plan --report-filled review`.
- Run `npx ph workflow check` and resolve blockers.
- Do not archive req tickets until review confirms requirements are satisfied.
- Archive only confirmed tickets with `npx ph workflow archive <ticket>`.
- Before final completion, run `npx ph workflow finish implement`.
- If pending tickets remain, do not claim full completion; report the next ticket.

Non-goals:
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force the workflow in projects without `.persona`.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:approval -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

Intent classification: requirements draft approval request.
Basis: the user used wording that approves proceeding after draft review.
Next action: approve the draft, create the ticket backlog, and move to the first ticket.

Required flow:
- Treat the requirements draft as user-approved.
- Run `npx ph workflow approve requirements`.
- Run `npx ph workflow split .persona/workflow/requirements/backlog.md` to create implementation tickets.
- Run `npx ph workflow next` to inspect the first ticket.
- Start the implementation rail with `npx ph workflow implement` and implement only the current task card.
- If the backlog is too large for one session, complete only the bounded subset/current ticket and leave remaining tickets pending for continuation; do not claim the whole backlog.

Finish gate:
- After build/test success, fill `.persona/workflow/implementation-report.md` with real evidence.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- Fill `.persona/workflow/review-report.md` with real review evidence.
- Run `npx ph plan --report-filled implementation` and `npx ph plan --report-filled review`.
- Run `npx ph workflow check` and resolve blockers.
- Do not archive req tickets until review confirms requirements are satisfied.
- Archive only confirmed tickets with `npx ph workflow archive <ticket>`.
- Before final completion, run `npx ph workflow finish implement`.
- If pending tickets remain, do not claim full completion; report the next ticket.

Non-goals:
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force the workflow in projects without `.persona`.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:file -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

Intent classification: implementation request based on {{sourceFile}}.
Basis: the user asked to implement from a requirements file such as {{sourceFile}} or README.
Next action: split the requirements file into a ticket backlog, then implement only the current ticket.

Required flow:
- Requirements file: `{{sourceFile}}`
- Do not implement immediately.
- Do not write production code before split/next.
- First read the file through the end in bounded ranges, such as `npx ph bearshell --shell 'sed -n "1,220p" {{sourceFile}}'`.
- Then run `npx ph workflow split {{sourceFile}}` to create requirements analysis, backlog, and task cards.
- Run `npx ph workflow next` and implement only the current task card.
- If the backlog is too large for one session, complete only the bounded subset/current ticket and leave remaining tickets pending for continuation; do not claim the whole backlog.
- If backlog still has pending tickets, do not claim full completion.

Finish gate:
- After build/test success, fill `.persona/workflow/implementation-report.md` with real evidence.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- Fill `.persona/workflow/review-report.md` with real review evidence.
- Run `npx ph plan --report-filled implementation` and `npx ph plan --report-filled review`.
- Run `npx ph workflow check` and resolve blockers.
- Do not archive req tickets until review confirms requirements are satisfied.
- Archive only confirmed tickets with `npx ph workflow archive <ticket>`.
- Before final completion, run `npx ph workflow finish implement`.
- If pending tickets remain, do not claim full completion; report the next ticket.

Non-goals:
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force the workflow in projects without `.persona`.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:prompt -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

Intent classification: prompt-based requirements implementation request.
Basis: the user provided requirements text or a feature description directly in the prompt.
Next action: save the prompt as a requirements source, create a ticket backlog, and implement only the current ticket.

Required flow:
- Treat the prompt body as the requirements source.
- Before implementation, save the requirements with `npx ph workflow capture --stdin`.
- Then run `npx ph workflow split` to create requirements analysis, backlog, and task cards.
- Run `npx ph workflow next` and implement only the current task card.
- If the backlog is too large for one session, complete only the bounded subset/current ticket and leave remaining tickets pending for continuation; do not claim the whole backlog.

Finish gate:
- After build/test success, fill `.persona/workflow/implementation-report.md` with real evidence.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- Fill `.persona/workflow/review-report.md` with real review evidence.
- Run `npx ph plan --report-filled implementation` and `npx ph plan --report-filled review`.
- Run `npx ph workflow check` and resolve blockers.
- Do not archive req tickets until review confirms requirements are satisfied.
- Archive only confirmed tickets with `npx ph workflow archive <ticket>`.
- Before final completion, run `npx ph workflow finish implement`.
- If pending tickets remain, do not claim full completion; report the next ticket.

Non-goals:
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force the workflow in projects without `.persona`.
<!-- /PH_RUNTIME_BLOCK -->

<!-- PH_RUNTIME_BLOCK:continuation -->
[Persona Harness Requirements Workflow]

Detected intent: {{detectedIntent}}
Selected skill: workflow-requirements ({{selectedSkillPath}})
Reason: {{reason}}

Intent classification: continuation request.
Basis: the user asked for the next step or to continue.
Next action: inspect the next pending ticket and continue only the current ticket.

Required flow:
- Run `npx ph workflow next` to find the ticket to continue.
- If accepted plan continuation is needed, run `npx ph workflow continue`.
- If README.md is absent, do not block; read `.persona/project-profile.jsonc`, `.persona/policies/overlay.jsonc`, `.persona/workflow/plan.md`, and the current task card by repo-relative path, and do not infer a Node/CommonJS stack from package.json.
- Implement only the current task card; if tickets remain, do not claim full completion.
- If the backlog is too large for one session, complete only the bounded subset/current ticket and leave remaining tickets pending for continuation; do not claim the whole backlog.

Finish gate:
- After build/test success, fill `.persona/workflow/implementation-report.md` with real evidence.
- After any bounded bootRun/manual QA attempt, stop the app if needed, summarize the observed result, and record a verification limitation/blocker instead of looping when it hangs or is inconclusive.
- Fill `.persona/workflow/review-report.md` with real review evidence.
- Run `npx ph plan --report-filled implementation` and `npx ph plan --report-filled review`.
- Run `npx ph workflow check` and resolve blockers.
- Do not archive req tickets until review confirms requirements are satisfied.
- Archive only confirmed tickets with `npx ph workflow archive <ticket>`.
- Before final completion, run `npx ph workflow finish implement`.
- If pending tickets remain, do not claim full completion; report the next ticket.

Non-goals:
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force the workflow in projects without `.persona`.
<!-- /PH_RUNTIME_BLOCK -->
