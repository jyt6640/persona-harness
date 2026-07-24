# Consumer Authority Beta Lifecycle

The Consumer Authority Beta is a staging-first, non-authoritative package
lifecycle. It combines a fixed package provenance route with the separate
user-scoped consumer authority route; neither one automatically promotes a
package or makes Finish pass.

## Fixed Sequence

1. An approved protected-main source candidate has strict prerelease SemVer
   and an existing matching immutable `v<version>` tag.
2. The manual publish workflow permits only `staging` with `staging-only` for
   that prerelease, publishes once through npm Trusted Publishing, and records
   bounded version/gitHead/SHA-1/SRI/SHA-256/tag readback.
3. The controlled staged-package producer attests the exact downloaded npm
   tarball. The fixed online verifier independently checks the original npm,
   GitHub, and Sigstore bindings before any later promotion decision.
4. A fresh exact registry installation proves the packaged CLI boundaries. A
   public consumer separately enrolls its fixed workflow, fetches original
   signed bytes, verifies them against its current source, and only an explicit
   Finish may consume a trusted result once.

The final hosted evidence uses two fresh registry-installed fixtures, each
installing the exact immutable version only from `https://registry.npmjs.org`:

- the cooperative fixture runs `ph workflow finish implement --assurance
  cooperative` and requires its explicit same-invocation PASS while default
  Finish and later closure remain external-blocked; and
- the public external fixture runs the user-scoped `ph authority` enrollment,
  original-artifact fetch, independent verification, and explicit Finish
  consumption path against its own signed public push evidence.

Neither fixture can borrow the other fixture's evidence. Forged, copied,
wrong-repository/workflow/ref, drifted, replayed, expired, zero/all-skipped,
malformed/unsafe, or network-denied variants must remain nonzero with no
authority artifact or Finish PASS.

`ph authority status`, `ph authority fetch github`, and closure are
non-consuming. Missing enrollment, unavailable network, malformed records,
copied artifacts, source drift, replay, expiry, or any identity mismatch stay
blocked and never convert package provenance into Finish authority.

## Live Trust Diagnostics

`ph doctor` performs a live, read-only Sigstore trust-root check with a
30-second whole-worker deadline. Its plaintext and JSON output report network
and trust-root readiness separately. The check uses a fresh product-owned
temporary cache that the parent process removes even when the child times out;
it never treats offline or previously cached material as a positive authority
result.

Consumer verification keeps these bounded, non-secret failure states distinct:
`dns-unavailable`, `network-unavailable`, `trust-root-unavailable`,
`verification-timeout`, `signature-invalid`, `certificate-invalid`,
`transparency-invalid`, and `malformed-bundle`. Diagnostics do not include
tokens, signed URLs, raw bundles, upstream error messages, or absolute paths.

## Promotion Boundary

The beta starts at `staging`. Moving the exact immutable version to `next`
requires a later independent `next-promotion-approved` action. `latest`,
Stable/GA claims, GitHub releases, and registry mutation are outside this
document's source-preparation boundary.
