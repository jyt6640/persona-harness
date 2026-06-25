# Idea: Team Decision Memory

I want a lightweight backend for a team decision memory.

The problem is that teams decide things in chat, forget why, and repeat the same debate later.
The tool should help capture decisions, alternatives, rationale, and follow-up checks.

I am not sure yet what the exact data model should be.
Start with a sensible minimal backend and make assumptions explicit in the generated project notes.
Do not build a frontend.

## What It Should Help With

- capture a decision title and short context;
- record alternatives considered;
- record the chosen option;
- record why the option was chosen;
- attach lightweight tags;
- mark a decision as proposed, accepted, superseded, or archived;
- search or filter decisions by status and tag;
- add a follow-up note after the decision is revisited.

## Ambiguities To Resolve

Make reasonable choices for:

- whether alternatives are separate records or embedded in a decision;
- whether tags are normalized or simple values;
- whether follow-up notes can exist before a decision is accepted;
- which fields are required at creation time;
- which status transitions are valid.

Document those choices briefly.

## Guardrails

- Keep the first version small.
- Prefer a backend API with persistence and tests.
- Avoid building authentication unless the chosen design needs a placeholder user identity.
- Avoid generating a frontend, admin dashboard, or complex collaboration features.
- Make the project easy to build and run locally.

## Expected Smoke Flow

The generated backend should support a minimal flow equivalent to:

1. create a proposed decision;
2. add at least two alternatives;
3. choose one alternative and accept the decision;
4. add a follow-up note;
5. list accepted decisions by tag.

## Evaluation Notes

This fixture intentionally starts from an idea rather than a precise technical spec.
The eval should observe whether the agent drafts a reasonable scope, avoids overbuilding, and still produces a buildable, testable backend.
