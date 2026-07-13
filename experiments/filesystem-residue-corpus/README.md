# Filesystem Residue Corpus

This is a source-only, deterministic report-only corpus for synthetic
filesystem-residue conditions. It does not scan or mutate a real project, run
the product CLI, start a child process, use the network, or grant workflow
finish authority.

`corpus.json` is the immutable base corpus. `successor.json` is its
schema-versioned append-only successor and must preserve the exact base record
prefix before adding its one preregistered record. `canonical-lock.json` pins
the corpus semantics, ordered IDs, metadata, fixture paths and hashes, and the
successor lineage. The validator also pins the canonical lock bytes outside
the mutable JSON files; this detects working-copy drift, not an attacker who
rewrites the validator itself.

Run the direct surfaces:

```text
node validate.mjs --all
node evaluate.mjs --all
```

Both surfaces emit bounded structured diagnostics and prove
`childProcessInvocations: 0`, `productCliInvocations: 0`,
`networkAccess: false`, `realProjectAccess: false`, `writeOperations: 0`,
`reportOnly: true`, `enforcement: false`, and `authorityEligible: false`.

The corpus is package-excluded. Its preregistered zero-error thresholds are
contract gates only; this unit contains no observed efficacy, adoption,
reliability, security-mitigation, Stable, GA, or latest claim.
