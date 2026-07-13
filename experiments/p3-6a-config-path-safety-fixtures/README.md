# P3-6a Config, Path, And Walker Fixture Contract

This is a source-only preregistration for the future P3-6 config/path/walker
owner. It records synthetic audit-derived invariants; it does not implement
P3-6, change Persona Harness behavior, or claim that any mitigation exists.

The corpus is package-excluded and has no connection to a real project. Its
payloads model `harness.jsonc`, configured evidence/rules roots, and bounded
walker observations as data. The evaluator reads only this directory with
Node built-ins. It does not invoke a shell, PH, a product command, a network,
or a real project.

## Frozen Contract

- Base schema: `p3-6a-config-path-safety.1`.
- Base records: 13 frozen records in `corpus.json`.
- Successor schema: `p3-6a-config-path-safety.2`.
- Successor extension: one fresh record in `corpus.v2.json`.
- Base and successor locks bind corpus bytes, canonical record bytes, fixture
  bytes, payload fingerprints, metadata fingerprints, and lock fingerprints.
- The synthetic oracle requires corpus-only false-positive and false-negative
  counts of zero.
- Results are `reportOnly: true`, `sourceOnly: true`, and `enforcement: false`.

Malformed or corrupt config payloads must be represented as fail-closed for
normal closure authority while retaining a distinct read-only diagnostic or
recovery disposition. Configured `evidenceDir` and `rulesDir` must share one
canonical path model for closure and doctor. Walker payloads record `lstat`
and no-follow semantics plus bounded handling for symlink cycle/ELOOP, path
escape, depth, entry count, bytes, unreadable, and binary inputs. Structured
outcomes never carry stack text and always report bounded diagnostics.

## Mutation Policy

`corpus.json`, its existing records, and existing fixture bytes are immutable.
An extension is append-only: it must use a new schema version, bind to the
base corpus and lock fingerprints, declare a new preregistration, append fresh
record IDs and fixture paths, and produce a separate result. Relabeling,
removing, reordering, or changing any prior record or fixture fails closed.

The corpus does not protect the validator or source history from a hostile
coordinated rewrite. That supply-chain boundary is owned by the surrounding
P3 integrity program and is explicitly out of scope here.
