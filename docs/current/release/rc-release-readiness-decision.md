# RC Release Readiness Decision

Status: current-main release-planning decision as of 2026-07-14. This record
does not authorize a tag, GitHub release, npm publication, dist-tag change,
Stable/GA claim, or npm `latest` movement.

## Exact Assessment

- Assessed protected `main`:
  `00dd2215210bbeaf6c92a155d77aed7f9db6cd55`.
- Direct parent:
  `dbedde3cd28aec94261d6fb4291606156e8fdccc`.
- Required `Verify repository` run:
  `29302479532`, completed successfully for the assessed commit.
- Source package version:
  `persona-harness@0.7.0-rc.2`.
- Current registry `0.7.0-rc.2` gitHead:
  `185885b7918459ef12bbea120a4261962cd57059`.
- Current registry channels:
  `latest=0.6.0` and `next=0.7.0-rc.2`.

The source version on current `main` is already published, but its current
commit differs from the registry package gitHead. npm cannot safely accept a
second publication of the same version, and this record therefore does not
create a fresh release candidate package.

## Controls Observed

- `main` requires the strict `Verify repository` check, requires no approvals
  for the single-owner flow, dismisses stale reviews, requires conversation
  resolution, applies protection to administrators, and disallows force pushes
  and deletion.
- GitHub Actions requires SHA-pinned actions and uses read-only default
  workflow permissions. The repository workflows pin `checkout` and
  `setup-node`, keep CI free of `npm publish`, and require exact canonical-main
  or tag ancestry before publish or release work.
- The `npm-publish` environment requires reviewer `jyt6640`, accepts protected
  branches, and disallows administrator bypass.
- Closed issue `#10` records the owner-authenticated recreation of the npm
  trusted publisher as GitHub `jyt6640/persona-harness`, `publish.yml`,
  environment `npm-publish`, with `publish` permission only. The current
  workflow has no staged-publish path.
- This decision did not complete a new interactive npm trusted-publisher
  readback because npm requires owner one-time authentication for that account
  operation. It does not infer fresh publish authorization from the earlier
  evidence.
- The GitHub OIDC subject still uses the default configuration. No immutable
  subject hardening claim is made here.

## Decision

| Path | Decision | Reason |
| --- | --- | --- |
| Plan the next RC | GO | A separately scoped release-preparation unit may choose a new prerelease version and assemble fresh evidence. |
| Publish current `0.7.0-rc.2` from `main` | NO-GO | The version is already published from a different gitHead. |
| Tag or create a GitHub release from current `main` | NO-GO | No new version-specific release note, exact-version tag, or fresh release-candidate package has been prepared. |
| Publish a new prerelease to `next` | NO-GO until a new RC gate passes | It requires an explicit version decision, fresh QA and External installed-package evidence, owner-authenticated publisher verification, and registry readback. |
| Stable, GA, or npm `latest` | NO-GO | It additionally requires a fresh RC cycle, exact tag/version/main ancestry, registry evidence, and the trusted external attestation boundary in the P3 roadmap. |

## Required Next RC Gate

Before a new RC can be considered for publication:

1. Open a separately scoped release-preparation issue that names the intended
   version and exact source candidate.
2. Update the version and workflow-compatible release notes without reusing
   the already-published `0.7.0-rc.2` identity.
3. Pass the protected PR and main CI checks, then run fresh QA and an
   installed-package External smoke against that exact version.
4. Verify the trusted-publisher binding through the owner-authenticated npm
   surface immediately before and after the publish decision.
5. Create the exact version tag only after the candidate is on canonical
   `main`; let the release workflow verify tag ancestry and release state.
6. Record registry version, gitHead, shasum, integrity, intended dist-tag, and
   package contents before any Stable/GA or `latest` decision.

An RC planning decision is not an authorization to publish. Any actual tag,
release, registry publish, or dist-tag change requires a separate explicit
release decision.

## Boundary

This record is docs-only. It changes no product source, workflow, GitHub
setting, npm trusted-publisher setting, version, tag, GitHub release, npm
package, or dist-tag. It preserves the P3 authority boundary and makes no
product-efficacy, reliability, security-certification, Stable/GA, or `latest`
claim.
