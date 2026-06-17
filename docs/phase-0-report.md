# Phase 0 Hook Feasibility

Date: 2026-06-17

## Goal

Prove the MVP path before implementing the full rule loader:

```text
targetFile -> injection block -> actual model input
```

## Decision

Use an OpenCode TypeScript plugin, not a Java application.

The Java/Spring files are test targets only. They live under ignored fixture paths so the repository stays focused on the plugin implementation.

## Hook Points

- `tool.execute.before`: best first capture point for read/edit/write-like tool arguments.
- `tool.execute.after`: fallback capture point when a host exposes usable target file arguments after execution.
- `experimental.chat.messages.transform`: preferred Phase 0 injection point because it mutates the message list immediately before model input.

## Current Proof

The test suite simulates OpenCode hook calls:

1. A tool call touches `ReservationController.java`, `ReservationService.java`, or `ReservationEntity.java`.
2. Persona Harness captures the target Java file and resolves its file role.
3. Persona Harness creates a temporary Phase 0 injection block.
4. The messages transform hook prepends the block to the latest user message.
5. Assertions verify the transformed message contains both the original user request and the role-specific injection policy.

## Boundary

This phase intentionally does not implement:

- `.persona/rules/**/*.md` loading
- frontmatter validation
- metadata-only evidence files
- guard or AST enforcement

Those belong after this hook path is proven.
