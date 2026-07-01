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

The tag release workflow has two jobs:

1. `verify`
2. `github-release`

## Tag Policy

Tags must match `package.json` exactly.

Examples:

```text
package.json version: 0.3.0-alpha.3
tag: v0.3.0-alpha.3
dist-tag: alpha
```

```text
package.json version: 0.3.0-beta.0
tag: v0.3.0-beta.0
dist-tag: beta
```

```text
package.json version: 1.0.0
tag: v1.0.0
dist-tag: latest
```

The workflow fails early if the pushed tag does not equal `v${package.json.version}`.

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
npm pack --dry-run
npm publish --dry-run --access public --tag <resolved-dist-tag>
```

## Publish

Npm publish is no longer performed by the tag workflow. Use
`.github/workflows/publish.yml` through `workflow_dispatch` after QA release GO.

Supported dist-tags:

- `next` for prerelease candidates.
- `latest` for stable releases.

The publish workflow rejects prerelease versions published as `latest` and
stable versions published as `next`.

## GitHub Release Notes

For tag releases, the workflow runs:

```bash
gh release create "$TAG_NAME" --generate-notes --title "$TAG_NAME"
```

Use `docs/current/release/release-notes-template.md` to draft human-facing notes before tagging. GitHub generated notes are still created automatically from merged commits and tags.

## npm Authentication Policy

Required path: npm trusted publishing with GitHub Actions OIDC.

Configure the npm package trusted publisher for:

- repository: `jyt6640/persona-harness`
- workflow file: `.github/workflows/publish.yml`
- environment: `npm-publish`, if using an npm/GitHub environment constraint

No `NPM_TOKEN` secret is required for the trusted publishing path.

## Manual Dispatch

Manual dispatch exists for controlled publishes after QA release GO.

Inputs:

- `dist_tag`: `next` or `latest`

Manual dispatch does not replace version commits, registry verification, or
post-publish git tags.

## Release Sequence

1. Update `package.json` and `package-lock.json` version.
2. Update `CHANGELOG.md`.
3. Update `docs/current/release/vX.Y.Z...` release candidate notes.
4. Run local verification.
5. Commit the release prep.
6. Push the commit.
7. Run `.github/workflows/publish.yml` with the intended dist-tag.
8. Verify registry gitHead and shasum from the workflow post-check.
9. Create and push the matching tag.

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
