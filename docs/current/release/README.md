# Release Operations

This is the release operator entrypoint. It explains what to run and where to
find the record; it is not a ledger of every historical release decision.

## Read This First

- [Release checklist](release-checklist.md) is the procedural checklist.
- [GitHub Actions release automation](github-actions-release-automation.md)
  describes the protected release workflow.
- [npm trusted publishing runbook](npm-trusted-publishing-runbook.md) covers
  the npm publisher environment and approval boundary.
- [Versioned release docs](../../releases/README.md) and the
  [package/version index](../../releases/package-index.md) hold durable version
  facts.
- [Release operations history](history.md) retains old readiness decisions,
  beta evidence, and the full release-note index without making them current.

## Recorded Release State

At the 2026-08-09 registry and GitHub readback:

| Channel or record | Value | Source |
| --- | --- | --- |
| npm `latest` | `0.8.1` | [`v0.8.1` release notes](v0.8.1-release-notes.md) |
| npm `next` | `0.8.0-rc.1` | [`v0.8.0-rc.1` release notes](v0.8.0-rc.1-release-notes.md) |
| npm `staging` | `0.8.0-beta.34` | [`v0.8.0-beta.34` release notes](v0.8.0-beta.34-release-notes.md) |
| GitHub latest release | `v0.8.1` | [GitHub releases](https://github.com/jyt6640/persona-harness/releases) |

These are recorded facts, not a standing authorization to publish, promote a
channel, consume Finish authority, or create a release. Before a release
decision, read the live registry and the protected workflow state again.

## Current Workflow Lifecycle Boundary

The current workflow/closure/finish state contract is
[`../workflow-closure-state-machine-design.md`](../workflow-closure-state-machine-design.md).
`workflow-lifecycle.1` is a read-only, fail-closed workflow projection; it is
not a release state, approval, or producer record. A blocked or trusted
`finishAuthority` value does not claim producer success, signature
verification, registry publication, tag movement, GitHub release creation, or
release completion.

Only records selected by [`../README.md`](../README.md) or
[`../canonical-docs-index.md`](../canonical-docs-index.md) are current inputs.
Historical readiness files are context, not current release decisions.

## Release Messaging Guardrail

Describe Persona Harness as an AI coding workflow rail and completion-evidence
harness. Do not turn a release, an evidence count, or a smoke run into a claim
of generated-app quality, broad reliability, token saving, or autonomous
completion. Record the sample, operator, environment, and unmeasured limits
when evidence needs interpretation.

## Release Tags Are Immutable

`refs/tags/v*` is covered by the `Release tags are immutable` ruleset with no
bypass actors. It blocks all three tag mutations:

| Rule | Effect |
| --- | --- |
| `deletion` | A release tag cannot be deleted. |
| `update` | A release tag cannot be repointed. |
| `non_fast_forward` | A release tag cannot be rewound. |

Tag creation remains open for a new release. `update` is essential:
`non_fast_forward` alone only blocks a rewind, so moving an old tag forward can
otherwise succeed. The 2026-08-09 probe restored `v0.8.0-beta.8` to
`c13caf30f058c4112101ec3ac093c114463aa74b` before adding `update`.

To remove or repoint a tag deliberately, disable the ruleset, perform the
operation, and re-enable it. There is no bypass path.

## Release Order

Run `release.yml` before `publish.yml`. The release workflow's source
verification includes `npm publish --dry-run`; after a version exists on npm,
that verification can no longer prepare the GitHub release for the same
version.

For a general-availability release:

1. Tag the approved protected-main commit.
2. Dispatch `release.yml` with the tag and `approval_scope: ga-approved`.
3. Dispatch `publish.yml` with the tag, `dist_tag: latest`, and
   `approval_scope: ga-approved`.

If the order was reversed, use `checkReleaseState` in
`scripts/release-workflow-policy.mjs` to verify the recovered release state.
