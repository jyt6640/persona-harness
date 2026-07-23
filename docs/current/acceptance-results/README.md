# Acceptance Results

This docs package stores Persona Harness acceptance-test and A/B measurement
results. Add one Markdown file under `results/` for each accepted run, then
regenerate this index with:

```bash
npm run docs:acceptance-results
```

CI/docs checks can verify the generated index with:

```bash
npm run check:acceptance-results
```

## Result Records

| Date | Result | Mode | Package | Source | Record | Acceptance | A/B |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02 | PASS | local-current | 0.4.1-rc.2 | `1563a25ca5bb` | [Local-current acceptance and 10-pair OpenCode A/B](results/2026-07-02-local-current-acceptance-ab.md) | PASS 49 / N.A 5 / FAIL 0 | 10 paired OpenCode app-generation runs; PH ON increased measured provider tokens, read chars, and tool calls in this fixture set. |

## Rules

- Record acceptance results here instead of expanding `CHANGELOG.md` with
  long evidence transcripts.
- Keep each record scoped to the evidence it actually supports.
- Use PASS / PARTIAL / FAIL / N.A language and keep no-claim boundaries clear.
- Negative or inconclusive A/B evidence is still valid evidence.
- Do not record automatic downgrade/removal, token-saving, product-efficacy,
  app-quality, broad reliability, closure guarantee, or release claims unless a
  separate accepted evidence path supports that exact claim.
- This generated index cannot select a historical docs/current/ record as
  current workflow lifecycle or release guidance; use the canonical docs index
  and current docs pointer for that selection.

Template: [TEMPLATE.md](TEMPLATE.md)
