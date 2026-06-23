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

If requirements are in a file:

1. Read the file fully with `npx ph bearshell`, splitting long files into ranges.
2. Run `npx ph workflow split <file>`.
3. Run `npx ph workflow next`.
4. Read the current task card.
5. Implement only the current task card.

If requirements are in the prompt:

1. Capture the prompt requirements with `npx ph workflow capture --stdin`.
2. Run `npx ph workflow split`.
3. Run `npx ph workflow next`.
4. Read the current task card.
5. Implement only the current task card.

If the request is continuation work:

1. Run `npx ph workflow next`.
2. If the accepted plan continuation is needed, run `npx ph workflow continue`.
3. Implement only the current task card.

## Finish Gate

Before saying complete:

1. Fill `.persona/workflow/implementation-report.md`.
2. Fill `.persona/workflow/review-report.md`.
3. Archive completed tickets with `npx ph workflow archive <ticket>`.
4. Run `npx ph workflow finish implement`.

If pending tickets remain, do not claim full completion. Report the next ticket instead.

## Non-Goals

- This is not product-quality certification.
- This is not an AST/linter/enforcement gate.
- This does not force Persona Harness in projects without `.persona`.
- This does not replace project-specific requirements or user decisions.
