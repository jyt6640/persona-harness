# P3-8 CI And Release Integrity Candidate

Status: candidate branch only; QA and External re-gate required.

## Provenance

- Base: `41bdf99e2523749df19208bcf8740b61db80c933`.
- Branch: `ci/release-integrity-hardening`.
- Source bundle used for the isolated clone:
  `/tmp/persona-p3-receipt-provenance-binding-41bdf99.bundle`.
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

Exact immutable action commit SHAs were not resolved reliably in this
environment. Existing major action references remain unchanged; no fake pins
were added. Exact action pinning is a remaining supply-chain/admin gate.

GitHub branch protection, rulesets, required checks, trusted publishing
environment approval, and npm/GitHub trusted-publisher configuration are not
mutated or inferred from workflow YAML. They require a separate admin/API gate.

## Verification Boundary

Focused policy tests cover canonical-main ref/SHA/ancestry, tag/version and
ancestry, prerelease/stable dist-tags, registry shasum/integrity/tag readback,
and absent/matching/mismatched release idempotency. Static workflow tests cover
PR/main triggers, no publish in CI, policy invocation, and forbidden trigger
surfaces.

This candidate makes no npm publish, GitHub release, tag, version, config,
schema, runtime, P2, P3-4, efficacy, reliability, token-saving, or closure
guarantee claim.
