# Phase 0 Hook Feasibility

Date: 2026-06-17

## Goal

Prove the MVP path with a minimal rule loader:

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
3. Persona Harness selects `.persona/rules` files for that role.
4. Persona Harness creates a temporary Phase 0 injection block.
5. The messages transform hook prepends the block to the latest user message.
6. Assertions verify the transformed message contains both the original user request and the role-specific injection policy.

## Backend MVP Decision

Status: **Closed for Phase 0 #1 Java/Spring backend**.

This decision only covers `# 1단계: 웹 요청-응답`.

Reviewed runs:

- `experiments/phase0-runs/2026-06-17T10-53-27-107Z`
- `experiments/phase0-runs/2026-06-17T10-58-42-358Z`
- `experiments/phase0-runs/2026-06-17T11-04-54-321Z`
- `experiments/phase0-runs/2026-06-17T11-06-35-453Z`

Prior drift:

- `2026-06-17T10-53-27-107Z` kept the API contract and Controller/Service boundary, but generated `ReservationRepository` as a concrete `@Repository` class holding `List` and `AtomicLong`.
- That collapsed the repository contract and in-memory implementation into one class.
- The drift did not recur in the two post-reinforcement runs.

API contract evidence:

- `GET /reservations` returns `200 OK`.
- `POST /reservations` returns `200 OK`.
- `DELETE /reservations/1` returns `200 OK`.
- POST request body uses `name`, `date`, `time`.
- Create response contains `id`, `name`, `date`, `time`.
- The first created id is `1`.
- List size is `0` before create, `1` after create, and `0` after delete.

Role separation evidence:

- Controller calls Service and does not own Repository, Map/List, id sequence, or repository implementation details.
- Service handles create/list/delete use-case flow and does not own storage state or id sequence.
- `ReservationRepository` is an interface in the passing runs.
- `InMemoryReservationRepository` owns Map/List storage, id generation, and reset, and is registered as a Spring bean.
- DTOs express external API input/output contracts only.
- Tests pin status, body fields, first id, and list sizes instead of following generated implementation conventions.

Detector limitation:

- The detector is string-pattern based, not Java AST based.
- Normal generated code has produced false positives, including `jsonPath("$").isEmpty()` list-size assertions and `sequence.set(0L)` plus `incrementAndGet()` id reset.
- Detector PASS is not the sole completion signal.
- The closure decision combines detector output, direct generated-code review, Maven success, and repeated PASS evidence.

## Boundary

This phase intentionally keeps out:

- frontmatter validation
- full glob matching
- guard or AST enforcement

Those belong after the Phase 0 hook path and loop evidence are stable.
