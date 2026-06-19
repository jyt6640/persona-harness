# Persona Harness Docs

This directory is intentionally packaged by document purpose, not by creation date.

Root-level docs are restricted to this index and the compact progress board. New docs must go under one of the packages below; `npm run check:docs` enforces that shape.

## Packages

- `current/`: active policy, current decisions, install guides, status JSON, and productization direction.
- `evidence-reviews/`: A/B reviews, actual-run reviews, regrades, generated-run observations, and evidence summaries.
- `phases/`: phase-specific plans, designs, decisions, and completion notes.
- `archive/`: historical snapshots and superseded transition plans.

## Root Entrypoints

- `project-progress-board.md`: short current-state board.
- `README.md`: this taxonomy and placement guide.

## Placement Rules

- Put active behavior or current product direction in `current/`.
- Put observations, report reviews, A/B evidence, and regrades in `evidence-reviews/`.
- Put Phase 0, Phase 1, or Phase-next design/decision files in `phases/{phase}/`.
- Put superseded plans or historical snapshots in `archive/`.
- Do not add new `.md` or `.json` files directly under `docs/`.

## Checks

```bash
npm run check:docs
```

`npm test` also runs this check before Vitest.
