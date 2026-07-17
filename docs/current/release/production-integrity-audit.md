# Production Integrity Audit

The `Production integrity audit` workflow is a protected-main,
`workflow_dispatch`-only read-only evidence route. It has no user inputs and
uses fixed repository, package, and registry policy. Its expected registry
channel is derived only from strict package SemVer: `staging` for a
prerelease and `latest` for a stable version.

After a separately authorized lifecycle, the workflow:

1. reads the package version and protected-main source revision from its clean
   checkout;
2. runs the repository contract and build;
3. reads fixed npm registry metadata and downloads the exact selected package
   tarball to bind package/version, tag, gitHead, SHA-1, SRI, and SHA-256;
4. performs a separate fresh `npm install persona-harness@<derived-version>`
   from the fixed public registry, then runs the installed black-box
   authority-negative/adversarial matrix;
5. runs the fixed read-only exact-artifact provenance verifier; and
6. uploads a sanitized JSON summary as a GitHub Actions artifact.

The exact-artifact provenance verifier is intentionally restricted to
`staging|next`. For a stable `latest` audit, the fixed command must remain a
bounded expected nonzero rather than becoming a positive provenance path. A
stable audit therefore cannot create, infer, or substitute for the separate
durable protected approval required by the stable-promotion completion gate.

The summary contains only the fixed command catalog, expected and actual exit
states, exact package version/source revision, registry/subject/artifact
digests, bounded diagnostic codes, and `secretRemovalConfirmed`. It excludes
raw URLs, tarballs, Sigstore bundles, logs, filesystem paths, and secrets.

This workflow cannot publish, tag, create a GitHub release, move a dist-tag,
or provide Finish/closure authority. A blocked summary is durable audit input,
not release approval.
