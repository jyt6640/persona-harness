# Docs Taxonomy And Archive Plan

## Goal

Make the documentation set navigable before it becomes the main source of project drift.

The current docs contain useful history, but the product needs a smaller set of current decision surfaces and a clear place for evidence reviews and archived phase material.

## Taxonomy

### Current Decisions

Use for documents that define active behavior or near-term product direction.

Examples:

- MVP scope settlement
- backend Clean Code rubric
- artifact retention policy
- scope consistency check

### Evidence Reviews

Use for A/B reviews, actual generated run reviews, and report-only observer reviews.

These documents explain what happened in one or more runs. They should not become active policy unless a decision document promotes their conclusion.

### Archive

Use for historical loop notes after the active decision has moved elsewhere.

Archived documents may remain useful, but they should not be required reading for the next implementation loop.

## Proposed Directory Shape

```text
docs/
  current/
  evidence-reviews/
  archive/
```

The first step is to add directory indexes. Moving older files should be a separate low-risk phase-close task because many current documents link to earlier paths.

## Progress Board Rule

`docs/project-progress-board.md` should stay a short index:

- current position,
- active next loop,
- short evidence summary,
- links to the active decision documents.

It should not keep growing as the full detailed history. Detailed loop history belongs in evidence reviews or archive.

## Phase Close Process

1. Promote active decisions into `docs/current/`.
2. Keep actual run reviews under `docs/evidence-reviews/`.
3. Move superseded loop notes to `docs/archive/`.
4. Run `npm run cleanup:experiments` after review docs capture the useful evidence.
5. Update the progress board with only the new current state and links.

## Non-Goals

- Do not move all historical docs in the same loop as behavior changes.
- Do not break existing links casually.
- Do not delete review history.
- Do not use the progress board as a complete changelog.
