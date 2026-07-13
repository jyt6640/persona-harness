# P3-7 `ph init` Safe Upgrade Contract

Status: source-only preregistration and synthetic fixture contract. This
directory is excluded from the npm package and is not a product-quality,
reliability, or mitigation claim.

## Scope

The corpus defines future acceptance boundaries for safe `ph init` rerun and
upgrade behavior:

- generated-file ownership markers;
- safe upgrades only for owned files whose current bytes are unchanged;
- fail-closed conflicts for user-modified config, rules, and `AGENTS.md`;
- preservation of pre-existing foreign files;
- backup location, manifest, and digest binding;
- full rollback when any planned write fails;
- symlink, escape, and no-follow refusal;
- partial initialization and concurrent target-creation refusal;
- deterministic dry-run with zero writes;
- exact package, profile, and synthetic project binding;
- idempotent unchanged-owned rerun with no writes.

All target state is represented as JSON under `fixtures/`. The validator never
opens a project, runs `ph init`, invokes a product CLI, starts a child process,
uses the network, or mutates a real filesystem project.

## P3-6 Boundary

Malformed config recovery and configured-path safety are P3-6-owned
dependencies. This corpus records the dependency and its handoff boundary; it
does not parse product config, implement path walking, or duplicate P3-6
behavior.

## Canonical Locks And Mutation Policy

`canonical-lock.json` freezes the `.1` corpus, registry bytes, record order,
fixture identities, and base binding. `canonical-lock.v2.json` separately
binds the `.2` successor and its one new extension fixture.

Existing `.1` records, fixture bytes, metadata, ownership markers, negative
cases, and lock bytes are immutable. A successor is append-only and requires a
new corpus schema, exact base corpus and lock fingerprints, a fresh record ID,
a fresh fixture ID, a new preregistration, and a separate lock/result. Naive
append, relabel, deletion, reorder, reused identity, or coordinated manifest
and payload mutation fails closed.

## Boundary Flags

The corpus is fixed to:

```json
{
  "reportOnly": true,
  "sourceOnly": true,
  "enforcement": false,
  "productBehaviorChange": false,
  "actualPhInit": false
}
```

Passing this validator only proves that the synthetic contract and its
fingerprints are internally consistent. It does not authorize implementation,
overwrite, cleanup, rollback code, release movement, or data-loss claims.

## Validation

```sh
node experiments/p3-7-ph-init-safe-upgrade-contract/validate.mjs
node experiments/p3-7-ph-init-safe-upgrade-contract/validate.mjs experiments/p3-7-ph-init-safe-upgrade-contract/corpus.v2.json
```

The focused tests mutate disposable copies of this corpus only. They verify
category coverage, immutable locks, append-only evolution, no-write dry-run
oracles, rollback/no-overwrite expectations, P3-6 dependency separation, and
recursive npm package exclusion.

The threat model excludes a hostile rewrite of the validator, canonical locks,
or source history. Repository controls and QA provenance own that boundary.
