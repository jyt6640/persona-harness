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

`ph authority status`, `ph authority fetch github`, and closure are
non-consuming. Missing enrollment, unavailable network, malformed records,
copied artifacts, source drift, replay, expiry, or any identity mismatch stay
blocked and never convert package provenance into Finish authority.

## Promotion Boundary

The beta starts at `staging`. Moving the exact immutable version to `next`
requires a later independent `next-promotion-approved` action. `latest`,
Stable/GA claims, GitHub releases, and registry mutation are outside this
document's source-preparation boundary.
