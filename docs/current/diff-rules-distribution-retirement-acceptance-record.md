# Item 12 Diff-Rules Distribution Retirement Acceptance Record

Status: accepted on exact main

## Accepted Main

Item 12 accepts the diff-rules distribution and fresh-init retirement at:

```text
656a678b5072f77ff2ee57e4ee51b5b052fa2bcb
chore(package): stop shipping diff-rules
```

Canonical QA accepted that exact main independently. The External package smoke
below also targeted that exact main, not a later docs-record commit.

## Provenance

The accepted change fast-forwarded from pre-main:

```text
af07738 -> 656a678
```

`656a678` removes the package-files inclusion for
`.persona/rules/diff-rules/**`. This is distribution and fresh-init retirement,
not repository corpus deletion: the 28 diff-rules source assets and the current
classification/delivery documentation remain in the repository.

## Accepted Contract

The npm tarball retires exactly 28 `.persona/rules/diff-rules/**` assets. It
retains the required backend and clean-code rule families: 14 backend rules and
6 clean-code rules. Fresh `ph init` and `ph bootstrap backend` exclude
diff-rules while retaining those public families.

An ordinary fresh `ph doctor` has no legacy-material advisory. When a valid
retained legacy diff-rules path exists, `ph doctor` emits exactly one clear,
non-destructive advisory. The legacy material is preserved across doctor, init,
and bootstrap; the accepted smoke observed unchanged bytes, inode, mtime, and
146-byte size.

Representative positional `ph go` and `ph workflow loop --dry-run` remain
functional. Installed rule catalog and implementer delivery contain no
diff-rules, while backend rule delivery remains available.

This record does not introduce a `finish --json` contract.

## Exact-Main Evidence

Canonical QA: PASS on exact main `656a678`.

External: PASS through a fresh local-current tarball package smoke at:

```text
/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stop-shipping-diff-rules-main-package-smoke-656a678-20260710T185407Z
```

| Fact | Value |
| --- | --- |
| Target commit | `656a678b5072f77ff2ee57e4ee51b5b052fa2bcb` |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh local-current tarball; registry not used |
| SHA-1 | `927d72c6433c14ca795de6033e7e44475a403c44` |
| SHA-256 | `246450c5ac8d1cbf0d73245280b2dbd2f0a25cca0d62a9c4dbf906de65b2e908` |
| Entry count | `691` |

The archive records zero packaged diff-rules assets, the 14/6 retained public
rule-family counts, fresh init/bootstrap behavior, ordinary and legacy doctor
behavior, legacy preservation, representative go/workflow/rule-delivery
observations, and `runtimeInjection=false`. It is local tarball evidence only,
not registry evidence.

The existing docs taxonomy warning for
`docs/phase1-test-contract-repeat-report-review.md` and the existing direct
README-link expectation failure in `tests/package-files-policy.test.ts` remain
separate baseline exceptions if reproduced; they are not Item 12 regressions.

## Boundaries

This is distribution/init retirement, not corpus deletion or generated-app
product-quality evidence. No runtime/default, schema/evidence-schema, version,
publish, release, tag, `latest`, `next`, LEAN, or Java-rule change is accepted
here. This is not a token-saving, efficacy, app-quality, broad-reliability,
enforcement, delegation, or generated-app certification claim.
