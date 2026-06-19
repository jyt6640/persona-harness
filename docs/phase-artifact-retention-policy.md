# Phase Artifact Retention Policy

## Goal

Keep phase evidence useful while preventing `experiments/` from becoming a second source tree.

The retained artifact should explain what happened. Generated code, build caches, package caches, and bulky raw logs should be removable once the phase review is written.

## Retain

Keep these files inside each phase run:

- `run-metadata.json`
- `prompt.md`
- `summary.json`
- `tree.txt`
- `*.status`
- `*-review.md`
- `*.trimmed.log`

These files preserve the question, model/run metadata, final status, and human review result.

## Clean

Remove generated or reproducible artifacts at phase close:

- `sandbox/`
- `sandbox-baseline/`
- `.gradle/`
- `build/`
- `node_modules/`

Large raw `*.log` files may be reduced to `*.trimmed.log` with head/tail excerpts and metadata, then the original log can be deleted.

## Command

Dry run:

```sh
npm run cleanup:experiments
```

Apply:

```sh
npm run cleanup:experiments -- --apply
```

Target a single run:

```sh
npm run cleanup:experiments -- --root experiments/phase0-runs/<run-id>
```

The command is intentionally dry-run by default. It should be used before moving from one phase to the next, not during active A/B investigation.

## Non-Goals

- This is not a source-code quality check.
- This is not an evidence deletion mandate while a review is still active.
- This does not commit or track ignored `experiments/` files.
- This does not replace the written phase review.

## Phase Close Checklist

1. Write the review or decision document.
2. Run `npm run cleanup:experiments`.
3. Inspect the dry-run output.
4. Run `npm run cleanup:experiments -- --apply` only after the review captures the useful evidence.
5. Keep tracked docs as the long-term record.
