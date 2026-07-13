# P3-8 CI And Release Integrity Candidate

Status: source workflow controls and repository admin controls are recorded as
of 2026-07-13. This is not an RC3, publish, `latest`, stable, or GA approval.

## Provenance

- Base: `41bdf99e2523749df19208bcf8740b61db80c933`.
- Branch: `ci/release-integrity-hardening`.
- Source bundle used for the isolated clone:
  `/tmp/persona-p3-8-release-integrity-hardening-bf16616.bundle`.
- This record is not a publish, tag, release, or stable/GA approval.

## Candidate Scope

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`.
  It runs the release-workflow policy checker, docs/scope/injection checks,
  typecheck, tests, build, and npm pack dry-run. It never publishes.
- `.github/workflows/publish.yml` permits manual publish only from the exact
  current `refs/heads/main` SHA after a full-depth fetch and ancestry check.
  It preserves `next` for prereleases and `latest` for stable versions.
- Publish registry readback requires package version, `gitHead`, `dist.shasum`,
  `dist.integrity`, and the selected dist-tag.
- `.github/workflows/release.yml` requires the exact package-version tag and
  tag commit to be an ancestor of canonical `main`. Manual dispatch is
  constrained to canonical main and does not create a release.
- Existing GitHub releases are verified for tag, title, prerelease state,
  resolved tag commit, and canonical target before the workflow succeeds.
  A matching release is idempotent; a mismatch fails closed; an absent release
  is created with the workflow commit as target and then rechecked.
- `scripts/release-workflow-policy.mjs` is the shared pure policy seam used by
  workflows and focused tests. `scripts/check-release-workflows.mjs` rejects
  missing triggers/checks and `pull_request_target`.

## Action Pins And Admin Boundaries

The workflow action references are pinned to the exact immutable commits verified
for the official `v4` tags: `actions/checkout` uses
`34e114876b0b11c390a56381ad16ebd13914f8d5`, and `actions/setup-node` uses
`49933ea5288caeca8642d1e84afbd3f7d6820020`. The static workflow policy rejects
floating major-tag references and requires the expected pin count in each
workflow.

The source candidate itself did not mutate GitHub settings. Workflow YAML and
GitHub or npm administrator state remain separate evidence surfaces.

## Repository Admin Controls Observed On 2026-07-13

Authenticated GitHub API readback recorded these repository controls:

- `main` requires the strict GitHub Actions check `Verify repository`
  (app id `15368`). Pull request review protection remains enabled with zero
  required approvals for the single-admin repository; stale reviews are
  dismissed and conversations must be resolved.
- Administrators are subject to branch protection. Force pushes and branch
  deletion are disabled.
- Actions are enabled with `allowed_actions=all` and
  `sha_pinning_required=true`. Default workflow permissions remain `read`.
- The `npm-publish` environment requires reviewer `jyt6640`, accepts protected
  branches only, does not allow administrator bypass, and currently permits
  self-review for the single-owner workflow.
- The OIDC subject configuration is still the GitHub default:
  `use_default=true`, `use_immutable_subject=false`, and
  `sub_claim_prefix=repo:jyt6640/persona-harness`.

These settings complement, but are not established by, the immutable action
pins and policy checks in the repository workflow source.

## Remaining Admin And Release Gates

- npm trusted-publisher binding has not been verified through an authenticated
  npm administrator surface. It is tracked as issue `#5`,
  `Maintenance: verify npm trusted publisher release binding`.
- This record does not infer organization or enterprise inherited controls.
- The default OIDC subject configuration is recorded as observed state only; it
  is neither accepted as hardened nor classified as broken here.

## Verification Boundary

Focused policy tests cover canonical-main ref/SHA/ancestry, tag/version and
ancestry, prerelease/stable dist-tags, registry shasum/integrity/tag readback,
and absent/matching/mismatched release idempotency. Static workflow tests cover
PR/main triggers, no publish in CI, policy invocation, and forbidden trigger
surfaces.

This record makes no npm publish, GitHub release, tag, version, config, schema,
runtime, P2, efficacy, reliability, token-saving, closure guarantee, RC3, or
release-readiness claim.
