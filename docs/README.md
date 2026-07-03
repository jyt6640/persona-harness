# Persona Harness Docs

This directory is intentionally packaged by document purpose. Durable release
facts are now versioned first; `docs/current/` is a working pointer area, not
the long-term home for every accepted fact.

Root-level docs are restricted to this index and the compact progress board. New docs must go under one of the packages below; `npm run check:docs` enforces that shape.

## Documentation Areas

These are documentation directories, not npm packages or release channels.

- `releases/`: versioned release capsules for durable release facts, registry
  smoke records, measurement summaries, and caveats.
- `current/`: active policy, current decisions, install guides, status JSON,
  current pointers into versioned records, and the full docs inventory.
- `current/release/`: release checklist, release note templates, and repeated
  release operations. Version-specific release-note files remain here for
  release workflow compatibility, with durable summaries linked from
  `releases/`.
- `evidence-reviews/`: A/B reviews, actual-run reviews, regrades, generated-run observations, and evidence summaries. This is a docs taxonomy area, not a published `evidence-review` package or npm channel.
- `phases/`: phase-specific plans, designs, decisions, and completion notes.
- `archive/`: historical snapshots and superseded transition plans.

## Root Entrypoints

- `project-progress-board.md`: short current-state board.
- `README.md`: this taxonomy and placement guide.
- `current/docs-inventory.md`: classification index for every file under
  `docs/**`.

## Placement Rules

- Put versioned release facts in `releases/v<version>/`.
- Put active behavior or current product direction in `current/`, preferably as
  a pointer or status index when a durable versioned record exists.
- Put observations, report reviews, A/B evidence, and regrades in `evidence-reviews/`.
- Put Phase 0, Phase 1, or Phase-next design/decision files in `phases/{phase}/`.
- Put superseded plans or historical snapshots in `archive/`.
- Preserve old `current/` records by append-only correction or index/pointer
  updates before considering deletion.
- When a file cannot be moved safely, keep it in place and classify it in
  `current/docs-inventory.md`.
- Do not add new `.md` or `.json` files directly under `docs/`.

## Checks

```bash
npm run check:docs
```

`npm test` also runs this check before Vitest.
