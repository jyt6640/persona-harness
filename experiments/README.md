# Experiments

This directory contains package-external experiment inputs and results. It is
not part of the published npm package.

## Index

- [Intent-detection corpus](intent-detection/README.md): preregistered Korean
  and English prompts for a future measurement run.
- [Entry-intent corpus](entry-intent-corpus/README.md): 32-record bilingual
  preregistration for the default-off OpenCode advisory detector; false negatives
  cost 2 and false positives cost 1. Its deterministic result is corpus-only.

## Corpus Identity And Provenance

These are two separate preregistered corpora, not revisions of one shared
dataset:

| Corpus | Contract | Decision surface |
| --- | --- | --- |
| `intent-detection` | 48 stable Korean/English cases, `intent-detection-corpus.1`, future evaluator input | No current detector or runtime decision is attached. |
| `entry-intent-corpus` | 32 stable bilingual records, `entry-intent-corpus.1`, bounded entry-steering evaluator input | The existing opt-in OpenCode advisory measurement only. |

Their IDs, record shapes, labels, evaluator, thresholds, and result meanings
are not interchangeable. A run must name exactly one corpus and may not merge,
backfill, or relabel the other corpus after evaluation. A changed corpus or
evaluator requires a new preregistration and a new recorded run.

The `mutationPolicy` field in `intent-detection/corpus.json` is a prospective
rule for adding cases to that corpus. It is not contemporaneous evidence that
the policy caused, governed, or historically produced
`entry-intent-corpus`. The separate introducing commits visible in this
snapshot establish chronology only; they do not establish causal history.

Experiment material is package-excluded and is not product-quality evidence,
runtime activation authorization, or a default-on decision.
