# Item 21 Java Precision Warnings Acceptance Record

Status: accepted on exact implementation main

## Accepted Main

Item 21 accepts the initial Java precision-warning scope at:

```text
a7e521e2dd19ddb86c5a16726e6da8e57e6303e2
merge: integrate Java precision warnings
```

The accepted implementation candidate is
`3b082d4f6d33a64bd02406a2b4ebb70156b49a2e`. Candidate QA and candidate
External both passed. Post-integration QA also passed on exact main `a7e521e`;
Item 22 is GO separately.

## Provenance

The accepted candidate started from:

```text
25bc923dc217656c3f7a1fcc7067a8a6c3f2cf16 -> 3b082d4f6d33a64bd02406a2b4ebb70156b49a2e
```

The implementation reached main through merge
`a7e521e2dd19ddb86c5a16726e6da8e57e6303e2`, whose parents are:

```text
d55fae298e4cf2cf1278278e855a1184bd349058
3b082d4f6d33a64bd02406a2b4ebb70156b49a2e
```

This record is a later docs-only record. It does not change the accepted
implementation behavior.

## Accepted Contract

The initial high-precision conventions are:

| Iron List row | Convention ID | Exact initial scope |
| --- | --- | --- |
| I-08 | `java.raw-type` | Raw common generic type identifiers in field, local-variable, formal-parameter, or method declarations when not already inside a generic type. |
| I-09 | `java.optional-get` | Exact `Optional.empty().get()` and `Optional.ofNullable(...).get()` chains. |
| I-12 | `java.mutable-static` | Static fields without `final`. |

All three are Java/Spring service-architecture, single-file, high-precision
dynamic conventions with default level `warn`. Each sets
`persona-harness-block-allowed: false`.

If configuration requests `block`, the convention-level calculation demotes
these definitions to `warn` because block use is not allowed. The accepted
configured-block fixture therefore remains a warning, is non-blocking, and
creates no architecture-convention closure blocker.

This is not full Iron List enforcement. It accepts only the three scoped
initial rules above; their patterns do not establish broad raw-type,
`Optional.get()`, or mutable-state coverage.

## Exact-Main Evidence

Canonical QA: PASS on candidate `3b082d4` and again on exact main `a7e521e`.

External: PASS through the candidate fresh local-current tarball package smoke
at:

```text
/tmp/persona-harness-external-archives/item21-java-precision-warnings-package-smoke-3b082d4-20260711T052855Z
```

| Fact | Value |
| --- | --- |
| Target candidate | `3b082d4f6d33a64bd02406a2b4ebb70156b49a2e` |
| Candidate parent | `25bc923dc217656c3f7a1fcc7067a8a6c3f2cf16` |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh local-current tarball; registry not used |
| SHA-1 | `044bbf010b4bda3adbf97a668b5cfc676af2880b` |
| SHA-256 | `c66b6058e11467bf7f5cc77f1b0a94831fb6e64b7b861a90eb948d4b06ea180c` |
| Entry count | `695` |

The archive records exactly three packaged convention additions:
`.persona/conventions/java-raw-type.yml`,
`.persona/conventions/java-optional-get.yml`, and
`.persona/conventions/java-mutable-static.yml`. Fresh bootstrap contained the
five existing conventions plus those three, for eight total. It also records
authorized fail-fixture matches, no matches for the paired pass fixtures,
warning-only workflow-check output, a configured-block demotion to warning,
zero convention closure blockers, `runtimeInjection=false`, and package
version `0.6.0`.

This docs record follows the established current-acceptance-record package
policy and adds its own Markdown path to the package manifest. That docs entry
is separate from Item 21's accepted package delta of three convention YAML
files.

## Boundaries

No `block` adoption, closure-blocker adoption, or full Iron List enforcement is
accepted here. This record does not claim token saving, efficacy, app quality,
broad reliability, generated-app quality, or broader enforcement.

No runtime/default, schema/evidence-schema, version, release, publish, tag,
`latest`, `next`, LEAN, Item 22 implementation, or Item 23 work is opened by
this record.
