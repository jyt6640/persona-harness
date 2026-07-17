# Staged Package Verification

This is a read-only gate for a candidate package that has already been staged
under `staging`. It validates aligned facts and requires independently issued
exact-artifact provenance before a later, separately authorized
channel-promotion decision. It does not publish, tag, deprecate, move a
dist-tag, or authorize a release.

## Installed CLI

The verifier is part of the packaged CLI and runs from a fresh installed
tarball without a source checkout:

```text
ph dev staged-package --plan <path> --preflight <path> --registry-facts <path> --tarball <path> [--json]
```

The separately packaged fixed-policy online verifier is:

```text
ph dev staged-package-provenance --channel <staging|next> --version <strict-semver> [--json]
```

## Inputs

The gate accepts bounded, versioned fact files plus one local tarball:

- `staged-package-plan.1` binds the candidate package/version, canonical main
  source head, matching `v<version>` tag, a fixed selected staged tag
  (`staging` or later-approved `next`), and the only accepted intended later
  promotion target, `next`. `latest` never enters this verifier path.
- `staged-package-preflight.1` records a read-only exact-version availability
  check. A present version blocks the gate.
- `staged-package-registry-facts.1` records read-only staged registry facts:
  package/version, the exact selected fixed `staging` or `next` channel value,
  gitHead, shasum, and integrity. The selected value must equal the planned
  prerelease version.
- The supplied local tarball is hashed independently. Its package/version,
  shasum, and integrity must agree with the staged registry facts.

The local caller-fact command cannot cryptographically bind a selected local
tarball to independently issued registry provenance. Therefore a generic
`npm audit signatures --json` success and caller-provided matching facts remain
diagnostic-only: `ph dev staged-package` emits
`artifact-provenance-unavailable` and cannot report `verificationStatus:
"verified"`.

`ph dev staged-package-provenance` is the only shipped positive provenance
path. It accepts no caller URLs, facts, repositories, workflows, trust roots,
or artifact paths. It fetches the selected fixed npm tag/version/tarball and
GitHub artifact attestation itself, verifies the exact tarball SHA-1, SRI, and
SHA-256, validates GitHub/Sigstore DSSE certificate, protected workflow,
repository/ref/run, Rekor inclusion, lifecycle, nonce, source/gitHead, fixed
command plan, and predicate bindings. Offline, unavailable, malformed,
repacked, copied, expired, duplicate, or mismatched evidence blocks with a
bounded diagnostic.

The controlled producer is documented in
[`staged-package-artifact-attestation-producer.md`](staged-package-artifact-attestation-producer.md).
It attests the exact downloaded npm `.tgz`; the verifier never accepts a local
repack, generic audit result, or copied JSON as a substitute.

All fact parsing is strict and bounded. Malformed, secret-shaped, or
unrecognized values block without echoing their raw contents.

## Installed Package Check

The local tarball, not a registry download, is installed into a fresh
disposable consumer. The gate verifies:

- the package test command is self-contained;
- `ph --help`, `ph version`, and `ph workflow --help` work from that install;
- the installed version matches the planned exact version;
- repository-only test/source paths are absent; and
- an authority-negative `workflow finish implement` fixture is nonzero,
  reports `trusted-authority-required`, never reports Finish PASS, and agrees
  with `workflow closure next --json` on the same blocked authority state.

The gate does not treat a generic npm signature-audit result as artifact
provenance and does not retain raw command output.

## Decision Boundary

`staged-package-verification.1` continues to block local tarballs with
`artifact-provenance-unavailable`, even when supplied facts and the installed
black-box surface agree. The separate online artifact verifier may report an
exact-artifact result, but both commands always report:

```json
{
  "promotionAuthorized": false,
  "promotionDecision": "release-approval-required",
  "registryMutation": "not-performed"
}
```

Promotion remains a separate release approval action. Existing workflow-finish
authority remains unchanged; neither local facts nor artifact provenance create
Finish PASS.

## Channel Sequence

For an approved prerelease, publish to the fixed `staging` channel first and
complete this gate plus the registry and fresh installed-package readback.
Moving that exact immutable version to `next` requires a later, separate
workflow dispatch with the explicit `next-promotion-approved` scope. `latest`
is excluded from this verifier and requires a separate approved stable/GA
decision. Neither the verifier nor the publish workflow creates or moves a Git
tag automatically.

## Durable Closure Evidence

Before a later release closure, retain either a GitHub Actions artifact/ref or
a separately authorized, sanitized tracked transcript beneath
`docs/audits/<date>-<slug>/`. Such a transcript must record the bounded
commands, package/version/source and artifact digests, expected and actual
exits, and confirmation that secrets were removed. This gate does not create
that durable record itself.
