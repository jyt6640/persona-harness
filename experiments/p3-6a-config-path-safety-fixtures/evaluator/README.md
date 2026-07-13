# Evaluator

`measure.mjs` is a deterministic corpus-contract validator, not a P3-6
implementation. It validates the checked-in synthetic payloads, lock
fingerprints, oracle outcomes, and append-only successor policy.

```text
node evaluator/measure.mjs
node evaluator/measure.mjs --root /path/to/fixture-copy --version base
node evaluator/measure.mjs --root /path/to/fixture-copy --version successor
```

The command emits one JSON result and uses a nonzero exit code for any
contract failure. Failure records contain stable codes, bounded paths, and
structured disposition fields. They never include stack traces or raw
payload content.
