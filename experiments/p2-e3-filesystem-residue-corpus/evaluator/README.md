# Evaluator

Run the deterministic preregistration check with:

```bash
node experiments/p2-e3-filesystem-residue-corpus/evaluator/measure.mjs
```

You can also point it at a copied corpus root:

```bash
node experiments/p2-e3-filesystem-residue-corpus/evaluator/measure.mjs --corpus /tmp/corpus.json
```

The evaluator is report-only, source-only, and enforcement-disabled. It only
verifies the frozen corpus manifest and fixture fingerprints.

The `.1` corpus is frozen under an explicit mutation policy. A `.2`
append-only successor must declare the `.1` base corpus fingerprint and keep
the preserved prefix byte-identical before appending new records.
