# GitHub Actions Release Automation

## Goal

Release Persona Harness packages with repeatable verification, npm trusted
publishing, registry post-checks, and GitHub release notes.

## Workflow

Verification and GitHub release-note automation lives in:

```text
.github/workflows/release.yml
```

Npm publishing lives in:

```text
.github/workflows/publish.yml
```

See:

```text
docs/current/release/npm-trusted-publishing-runbook.md
```

The manual GitHub Release workflow has two jobs:

1. `verify`
2. `github-release`

## Manual GitHub Release Policy

The manually supplied existing stable tag must match `package.json` exactly and
must satisfy the fixed protected-main/GA approval policy. Tag pushes do not
trigger this workflow.

Examples:

```text
package.json version: 1.0.0
tag: v1.0.0
dist-tag: latest
```

The workflow fails early unless its explicit `ga-approved` dispatch supplies
an existing stable tag equal to `v${package.json.version}`.

## Verification

The workflow verifies:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:scope:strict
npm run check:injection-value
npm run check:github-release-notes
npm pack --dry-run
npm publish --dry-run --access public --tag latest
```

## Publish

Npm publish is not performed by the GitHub Release workflow. Use
`.github/workflows/publish.yml` through `workflow_dispatch` after QA release GO.

Supported dist-tags:

- `staging` for the first approved prerelease publish, with
  `approval_scope=staging-only`.
- `next` only for a separately approved prerelease promotion, with
  `approval_scope=next-promotion-approved`.
- `latest` only for a separately approved stable/GA release, with
  `approval_scope=ga-approved`.

The publish workflow rejects prerelease versions published as `latest` and
stable versions published as `staging` or `next`. It also rejects an approval
scope that does not match the fixed selected channel.

## GitHub Release Notes

For explicitly approved stable GitHub releases, the workflow runs:

```bash
node scripts/generate-github-release-notes.mjs --tag "$TAG_NAME" --out github-release-notes.md
gh release create "$TAG_NAME" --notes-file github-release-notes.md --title "$TAG_NAME"
```

The generator reads `docs/current/release/v<version>-release-notes.md`, appends
automation metadata and claim boundaries, and fails if the tag does not match
`package.json`.

Use `docs/current/release/release-notes-template.md` to draft human-facing
notes before tagging. Release prep should run:

```bash
npm run check:github-release-notes
```

## npm Authentication Policy

Required path: npm trusted publishing with GitHub Actions OIDC.

Configure the npm package trusted publisher for:

- repository: `jyt6640/persona-harness`
- workflow file: `.github/workflows/publish.yml`
- environment: `npm-publish`, if using an npm/GitHub environment constraint

No `NPM_TOKEN` secret is required for the trusted publishing path.

## Manual Dispatch

Manual dispatch exists for controlled publishes after QA release GO. GitHub
Release creation is a separate manual-only GA-approved dispatch and requires an
existing stable tag.

Inputs:

- `dist_tag`: `staging`, `next`, or `latest`
- `approval_scope`: `staging-only`, `next-promotion-approved`, or
  `ga-approved`, matching the selected channel

Manual dispatch does not replace version commits, registry verification, or
post-publish git tags. It never creates or moves a Git tag.

## Release Sequence

1. Update `package.json` and `package-lock.json` version.
2. Update `CHANGELOG.md`.
3. Update `docs/current/release/vX.Y.Z...` release candidate notes.
4. Run local verification.
5. Commit the release prep.
6. Push the commit.
7. Run `.github/workflows/publish.yml` first with `dist_tag=staging` and
   `approval_scope=staging-only`.
8. Verify registry gitHead and shasum from the workflow post-check and run the
   staged installed-package gate.
9. Create and push the matching tag only through its separately approved
   immutable-tag sequence.
10. If a GitHub release is separately approved, dispatch
    `.github/workflows/release.yml` with that existing stable tag and
    `approval_scope=ga-approved`.
11. Obtain a separate approval and dispatch before moving the exact verified
   prerelease to `next`.

```bash
git push origin main
git tag v0.3.0-alpha.3 <verified-gitHead>
git push origin v0.3.0-alpha.3
```

## Post-release Check

```bash
npm view persona-harness dist-tags --json
npm view persona-harness@0.3.0-alpha.3 version
gh release view v0.3.0-alpha.3
```

Then install in a fresh temporary project and run:

```bash
npm install -D persona-harness@alpha
npx ph init
npx ph --help
```
