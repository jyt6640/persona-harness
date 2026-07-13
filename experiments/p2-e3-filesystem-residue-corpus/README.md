# P2 E3 Filesystem Residue Corpus

This source-only corpus preregisters a report-only filesystem-residue
measurement. It is a standalone local diagnostic prerequisite, not a detector
implementation, product efficacy claim, or default-on authorization.

## Contract

- `reportOnly: true`
- `sourceOnly: true`
- `enforcement: false`
- zero false positives and zero false negatives are the only accepted corpus
  thresholds

## Corpus layout

- [`corpus.json`](corpus.json) is the frozen preregistration manifest.
- [`fixtures/`](fixtures) contains simulated `git status --porcelain=v1`
  snapshots and their path lists.
- [`evaluator/measure.mjs`](evaluator/measure.mjs) validates the corpus,
  verifies every fixture fingerprint, and emits a deterministic report-only
  measurement JSON object.

The corpus uses only simulated git-status and path fixtures. It never inspects
or mutates real projects.
