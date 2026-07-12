# Entry-Intent Corpus

This source-only corpus preregisters the deterministic entry-steering detector
measurement. Its result is deterministic for this corpus only. It is
package-external experiment material, not a product efficacy, broad
reliability, app-quality, or default-on authorization claim.

## Corpus

[`corpus.json`](corpus.json) contains 32 stable records:

| Polarity | Korean | English | Total |
| --- | ---: | ---: | ---: |
| Positive implementation intent | 8 | 8 | 16 |
| Negative/non-entry intent | 8 | 8 | 16 |
| Total | 16 | 16 | 32 |

The preregistration weights false negatives at 2 and false positives at 1.
Its deterministic evaluator requires precision >= 0.90, recall >= 0.85, and
weighted error rate <= 0.20. Run it with:

```bash
npm run measure:entry-steering
```

The current corpus result is 16 true positives, 16 true negatives, zero false
positives, and zero false negatives. That result is limited to this corpus and
does not authorize a default-on setting or claim product efficacy.

This corpus is independent of `../intent-detection/`: the two corpora have
different IDs, record shapes, labels, evaluators, and decision boundaries.
Reported results must name the corpus used and must not merge or relabel
records from the other corpus after evaluation. Any changed records or
evaluator require a new preregistration and run.

## Package Boundary

The root package allowlist excludes `experiments/**`. The corpus and
[`measure.mjs`](measure.mjs) must remain absent from `npm pack --dry-run --json`
output.
