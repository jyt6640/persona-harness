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
