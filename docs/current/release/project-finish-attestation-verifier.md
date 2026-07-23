# Project Finish Attestation Verifier Core

Status: Issue #114 verifier-core candidate. This record describes a
product-owned library boundary only. It does not add enrollment UX, artifact
fetching, a default Finish route, a closure result, a registry action, a tag,
or a release claim.

## Evidence Boundary

The verifier reads exactly three regular files below the fixed project-relative
directory .persona/evidence/project-finish-attestation:

- bundle.json, limited to 1 MiB;
- predicate.json, limited to 512 KiB; and
- receipt.json, limited to 512 KiB.

The directory must contain no other entry. The project root, .persona,
.persona/evidence, evidence directory, and every leaf are captured without
following symlinks and rechecked after reads. Missing, oversized, substituted,
replaced, symlinked, noncanonical, malformed, local unsigned, or altered
evidence blocks with a bounded diagnostic. The verifier never reports a
caller path, bundle bytes, raw trust response, token, or input text.

Positive verification is defined over the original signed bundle bytes, not a
synthetic fixture. The historical candidate evidence was GitHub Actions
artifact 8549737417 from
jyt6640/persona-harness-attestation-claim-fixture, whose original ZIP SHA-256
is b76495f1e973225a2b742b4e72279d49ebb8ef948cca4c0177b6bef6710af013 and
whose signed bundle SHA-256 is
5f8bbcb7735f1cb7bc451215d2c59fd1233c2b80da4fb7374bb91ca91c81ba78. Those
facts are acceptance evidence, not package data or an enrollment default.

## Fixed Product Policy

The worker receives only the bounded bundle bytes and uses the fixed Sigstore
TUF mirror, GitHub Actions OIDC issuer, producer repository
jyt6640/persona-harness, and reusable workflow path
.github/workflows/persona-harness-project-finish.yml. It requires a DSSE
envelope, certificate, Rekor inclusion evidence, and Sigstore verification.
The certificate identity must match the exact reusable-workflow SHA carried by
the subsequently verified DSSE payload; it cannot merely match a different
revision of that workflow.

Strict project-finish-attestation.1 parsing then requires the single GitHub
Artifact Attestation subject basename receipt.json, its canonical receipt
digest, the canonical predicate and receipt bytes, a public repository, a
push event on refs/heads/main, fixed Gradle catalog and fresh JUnit/build
facts, linked caller/source/run/attempt fields, and bounded freshness. The
signed push proves only those signed facts. It is not proof of branch
protection, review, approval, or historical protection state.

The caller supplies a typed enrollment policy only through the product API:
repository numeric ID and slug, caller workflow path, and immutable reusable
workflow SHA. No project-local config, caller URL, environment variable, or
caller trust material selects issuer, repository, workflow, ref, or trust
root.

The producer binds its source content digest to a no-follow input snapshot,
which includes local filesystem identities and is intentionally not portable
between checkouts. The verifier therefore requires the signed commit, tracked
index, clean Git state apart from fixed diagnostic evidence roots, every
non-evidence source entry including ignored files, source shape, exclusions,
and counts to match a fresh detached clean worktree. It also recaptures safe
current Gradle/profile descriptors and rejects any source drift. It does not
treat a raw local source digest as equivalent to that producer-bound snapshot
digest.

## Inspection And Consumption

inspectProjectFinishAttestation is non-consuming. It may report an already
matching existing terminal record as consumed, but does not write one.
consumeProjectFinishAttestation performs the same cryptographic and policy
checks first and only then uses the existing finish-attestation terminal schema
for an exclusive create. A second consuming call blocks as replay. The generic
terminal schema is used only because project-finish lifecycle fields map
exactly to its existing bindings.

verifyProjectFinishAttestation is non-consuming unless its explicit consume
option is true. No default workflow-finish authority imports this verifier.
Issue #112 owns enrollment and fetch UX; Issue #116 owns end-to-end registry
audit and consumer authority integration.

Network inability to obtain the fixed Sigstore trust root returns
network-unavailable. Invalid DSSE, certificate, identity, Rekor, or signature
evidence returns crypto-failed. Neither result consumes authority.

## Package And Hosted Boundary

The packaged runtime includes the verifier core and its fixed worker script.
Synthetic inputs and tests remain source-only. A packed package must prove the
same original-bundle acceptance without a source fallback before this candidate
is sent to Source or Security QA.

The remaining hosted-only observation is a future original GitHub-signed
consumer artifact produced after protected integration. It must be independently
verified against GitHub, Sigstore, and Rekor, then checked once through the
frozen source-built and fresh packed verifier. That observation does not
authorize a registry, release, tag, branch-protection, or Finish claim by
itself.
