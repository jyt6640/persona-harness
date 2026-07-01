# npm Trusted Publishing Runbook

Persona Harness publishes npm packages through GitHub Actions trusted
publishing. This avoids long-lived npm publish tokens and keeps OTP out of the
local release path.

## One-Time npm Setup

Configure the `persona-harness` package on npm:

1. Open the package settings on npm.
2. Add a trusted publisher.
3. Provider: GitHub Actions.
4. Repository: `jyt6640/persona-harness`.
5. Workflow file: `.github/workflows/publish.yml`.
6. Environment: `npm-publish`, if npm asks for or supports an environment
   constraint for this package.

The workflow must be the exact file registered with npm. If the file path is
changed, update npm package settings before publishing.

## GitHub Setup

Recommended:

- Create a GitHub environment named `npm-publish`.
- Require manual approval for that environment if a human review gate is
  desired before npm publish.

No `NPM_TOKEN` secret is required for the trusted publishing path.

## Publish Workflow

Workflow file:

```text
.github/workflows/publish.yml
```

Trigger:

```text
workflow_dispatch
```

Inputs:

- `dist_tag`: `next` or `latest`.

The workflow verifies:

```bash
npm ci
npm run check:docs
npm run check:injection-value
npm run typecheck
npm test
npm run build
npm run smoke:product-mvp
npm pack --dry-run --json
```

Then it publishes:

```bash
npm publish --access public --tag <dist_tag> --provenance
```

The workflow refuses unsafe tag/version combinations:

- prerelease versions cannot publish as `latest`;
- stable versions cannot publish as `next`.

## Registry Post-Check

After publish, the workflow checks npm registry metadata:

```bash
npm view persona-harness@<version> version gitHead dist.shasum --json
npm dist-tag ls persona-harness
```

Required match:

- registry version equals `package.json` version;
- registry `gitHead` equals the GitHub workflow commit SHA;
- registry `dist.shasum` exists;
- selected dist-tag points to the published version.

## Tag Rule

Git tag creation is a separate step after registry verification.

Do not create or push `v${package.json.version}` before npm registry `gitHead`
matches the release prep commit.

After the publish workflow succeeds:

```bash
git tag v<version> <verified-gitHead>
git push origin v<version>
```

The existing `.github/workflows/release.yml` workflow can then verify the tag
and create GitHub release notes. It is not the npm publish path.

## Release Owner Sequence

1. Prepare the release commit.
2. Push the release prep commit to `origin/main`.
3. QA verifies release readiness.
4. Run `.github/workflows/publish.yml` with `dist_tag=next` or `latest`.
5. Confirm workflow registry post-check passed.
6. Create and push the matching git tag.
7. Run External registry smoke.
8. Record post-publish docs.

## Boundaries

Trusted publishing changes only the authentication path.

It does not prove:

- token savings;
- product quality;
- full TDD/test sufficiency;
- LSP effectiveness/default behavior;
- broad reliability;
- closure success guarantee.
