---
name: workflow-git
description: "Use when a user asks for commit, push, tag, release, git status, git log, blame, or repository history work. AI-facing git rail for safe repository operations."
---

# Git Workflow

This skill is AI-facing. It routes prompts like `커밋해줘`, `푸쉬해줘`, or `git status 봐줘` into repository-safe git work.

## Non-Goals

- This is not implementation, debug, or refactor work.
- This does not authorize destructive git commands.
- This does not push unless the user explicitly asked for push.

<!-- PH_RUNTIME_BLOCK:default -->
[Persona Harness Git Workflow]

Detected intent: {{detectedIntent}}
Secondary intents: {{secondaryIntents}}
Reason: {{reason}}

Intent classification: git work request.
Basis: the user explicitly asked for repository work such as commit, push, tag, or history.
Next action: inspect the worktree and diff first, then perform only the requested git work.

Required flow:
- Check git status.
- Inspect the diff and distinguish staged from unstaged changes.
- Stage only relevant files. Do not mix unrelated dirty work.
- Create an atomic commit using the repository's existing message style.
- Push only when the user explicitly requested a push.
- Before pushing, check the current branch and upstream state.
- After completion, report the commit hash and remaining worktree state.

Evidence checklist:
- git status
- diff summary
- staged files
- commit hash when committed
- push target when pushed
- remaining worktree state

Non-goals:
- This is not implementation/debug/refactor work.
- Do not run rebase/reset/stash/drop unless the user requested it.
- This is not generated app product-quality certification.
- This is not an AST/linter/enforcement gate.
<!-- /PH_RUNTIME_BLOCK -->
