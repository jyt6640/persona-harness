# Intent-Detection Corpus

This is a preregistered, package-external acceptance corpus for a future
intent-detection measurement. The corpus is static input data; it does not
implement detection, routing, hooks, or runtime activation.

## Corpus Contract

[`corpus.json`](corpus.json) contains 48 realistic prompts with stable case
IDs. Every record includes its language, polarity, category, exact prompt,
expected route, and rationale.

| Polarity | Korean | English | Total |
| --- | ---: | ---: | ---: |
| Positive implementation/requirements entry | 12 | 12 | 24 |
| Negative/non-entry | 12 | 12 | 24 |
| Total | 24 | 24 | 48 |

Positive records cover direct feature requests, README requirements, pasted
requirements, existing-project changes, bug fixes, and feature expansion.
Negative records cover explanation-only, status-only, review-only, git-only,
and ambiguous requests.

Expected routes are labels for a future evaluator:

- `entry/implementation`: an implementation-oriented rail entry candidate.
- `entry/requirements`: a requirements-oriented rail entry candidate.
- `non-entry/*`: do not enter a rail; the suffix identifies the expected
  response mode, including `clarify` for insufficiently specified prompts.

## Boundaries

The existence of this corpus is measurement material only. It is not:

- intent precision or recall evidence;
- authorization to activate runtime injection, host hooks, or automatic
  routing;
- a product-quality claim;
- a reason to change defaults, schemas, package contents, or release state.

Any measurement result requires a separately defined detector, evaluator, and
recorded run. New cases must be added through a new preregistration rather
than relabeling existing cases after an evaluation. This corpus is independent
of `../entry-intent-corpus/`: its case IDs, record shape, evaluator, and
decision boundary must not be merged with that 32-record corpus.

The `mutationPolicy` in `corpus.json` governs future additions to this
48-record corpus only. It does not establish the historical provenance or
causal origin of the entry-intent corpus or any runtime behavior.

## Package Boundary

The root `.npmignore` excludes `experiments/`, and the root `package.json`
allowlist does not include it. Package exclusion is verified with
`npm pack --dry-run --json`; this corpus must not appear in that output.
