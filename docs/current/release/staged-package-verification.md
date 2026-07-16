# Staged Package Verification

This is a read-only gate for a candidate package that has already been staged
under `staging`. It verifies aligned facts before a later, separately authorized
channel-promotion decision. It does not publish, tag, deprecate, move a
dist-tag, or authorize a release.

## Installed CLI

The verifier is part of the packaged CLI and runs from a fresh installed
tarball without a source checkout:

```text
ph dev staged-package --plan <path> --preflight <path> --registry-facts <path> --tarball <path> [--json]
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

The gate also records only a digest and status for the npm signature audit
command. It does not retain raw command output.

## Decision Boundary

`staged-package-verification.1` can report `verificationStatus: "verified"`
only when the supplied facts and installed black-box surface agree. Even then
it always reports:

```json
{
  "promotionAuthorized": false,
  "promotionDecision": "release-approval-required",
  "registryMutation": "not-performed"
}
```

Promotion remains a separate release approval action. Existing workflow-finish
authority remains unchanged and local package facts do not create Finish PASS.

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
