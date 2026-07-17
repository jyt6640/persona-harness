# P3-10 External Finish Attestation Verifier Candidate

Status: candidate branch only; QA and External re-gate required.

## Scope

This candidate adds a product-owned verifier for the original signed
`finish-attestation.1` bundle produced by the protected-main canonical builder.
The verifier is the only external authority path. Local receipts, predicates,
JUnit/TDD output, generated markers, copied JSON, legacy `clean-ci-builder.1`,
and any `authorityEligible` field without successful cryptographic verification
remain diagnostic-only.

The fixed policy binds the repository and immutable repository ID, protected
main push/ref/workflow path/workflow SHA/source HEAD, GitHub-hosted
`ubuntu-latest`/Linux runner, OIDC issuer and workflow identity, DSSE subject
digest and canonical receipt bytes, source-identity.1 and clean digest, fixed
command catalog/argv, PH/package/test facts, timestamps, nonce/request identity,
and one-time replay consumption. Missing, stale, expired, offline, malformed,
revoked, wrong-root, replayed, dirty, source-drifted, zero-test, manual,
staging, fork, reusable, or non-main evidence fails closed.

## Node 20 Sigstore Contract

The packed product locks the Node-20-compatible API set:

- `@sigstore/bundle@4.0.0`, engine `^20.17.0 || >=22.9.0`
- `@sigstore/tuf@4.0.0`, engine `^20.17.0 || >=22.9.0`
- `@sigstore/verify@3.0.0`, engine `^20.17.0 || >=22.9.0`

The fixed worker uses `bundleFromJSON`, `getTrustedRoot`,
`toSignedEntity`, `toTrustMaterial`, and `Verifier`. It refreshes the online
Sigstore public-good trust root with the fixed mirror, `forceInit: true`, and
`forceCache: false`, then requires a DSSE envelope, certificate-backed OIDC
identity, and transparency-log inclusion. No caller, project environment, CLI
argument, or `gh` output provides trust material or policy.

## Cache And Finish Boundary

Trusted external results are not cached. Every authority check re-verifies the
bundle and re-checks source, policy, freshness, and online trust material.
Finish and `workflow closure next --json` use the same authority decision path;
closure inspection is non-consuming, while the final finish decision atomically
consumes the attestation exactly once. This candidate does not claim Finish PASS
or authorize release, publish, tag, registry, or settings changes.
