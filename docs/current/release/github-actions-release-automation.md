# GitHub Actions Release Automation

## Goal

Release Persona Harness alpha/beta/stable packages from a pushed git tag with repeatable verification, npm publish, and GitHub release notes.

## Workflow

Automation lives in:

```text
.github/workflows/release.yml
```

The release workflow has three jobs:

1. `verify`
2. `publish`
3. `github-release`

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

Tag publish behavior:

- `vX.Y.Z-alpha.N` publishes with npm dist-tag `alpha`.
- `vX.Y.Z-beta.N` publishes with npm dist-tag `beta`.
- `vX.Y.Z` publishes with npm dist-tag `latest`.

During the current alpha/beta pilot, prerelease publishes also synchronize `latest` to the same version. This is a temporary tester convenience and does not imply stable support.

## GitHub Release Notes

For tag releases, the workflow runs:

```bash
gh release create "$TAG_NAME" --generate-notes --title "$TAG_NAME"
```

Use `docs/current/release/release-notes-template.md` to draft human-facing notes before tagging. GitHub generated notes are still created automatically from merged commits and tags.

## npm Authentication Policy

Preferred future path: npm trusted publishing with GitHub Actions OIDC.

Official npm guidance recommends trusted publishing for CI/CD because it avoids long-lived access tokens and can generate provenance from GitHub Actions.

Current fallback path: repository secret `NPM_TOKEN`.

Use this only until trusted publishing is configured for the package.

Requirements:

- repository secret name: `NPM_TOKEN`
- token type: granular automation/publish token
- token must be allowed to publish while account 2FA is enabled
- workflow keeps `id-token: write` for provenance/trusted-publishing readiness

## Manual Dispatch

Manual dispatch exists for recovery or controlled tester releases.

Inputs:

- `publish`: must be true to publish
- `dist_tag`: `alpha`, `beta`, or `latest`

Default use should still be tag-based release. Manual dispatch should not replace version commits and tags.

## Release Sequence

1. Update `package.json` and `package-lock.json` version.
2. Update `CHANGELOG.md`.
3. Update `docs/current/release/vX.Y.Z...` release candidate notes.
4. Run local verification.
5. Commit the release prep.
6. Push the commit.
7. Create and push the matching tag.

```bash
git tag v0.3.0-alpha.3
git push origin main
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
