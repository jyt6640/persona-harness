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

- `dist_tag`: one fixed channel only: `staging`, `next`, or `latest`.
- `package.json` version: bounded strict SemVer; malformed, partial,
  leading-zero, control-character, path-shaped, and oversized forms are
  rejected before channel selection.
- `approval_scope`: must match the selected channel:
  - `staging` requires `staging-only` and accepts prerelease versions only;
  - `next` requires `next-promotion-approved` and accepts prerelease versions
    only; this is a separate later promotion dispatch after staging evidence;
  - `latest` requires `ga-approved` and accepts stable versions only.

The workflow verifies the source boundary under the canonical packer runtime:

```bash
npm ci
npm run check:docs
npm run check:injection-value
npm run typecheck
npm test
npm run build
npm run smoke:product-mvp
```

It then creates exactly one normalized tarball and matching package facts with
Node `20.19.0` and npm `10.8.2` under isolated npm and Git configuration. That
runtime is the canonical packer only; it never performs the registry PUT.

The publisher switches to Node `24.18.0` and npm `11.16.0`, reserves a separate
empty npm home/cache/configuration, verifies the exact canonical tarball SHA-256
and portable package-content identity, and runs the exact publish argv once in
dry-run mode. This exceeds the documented npm Trusted Publishing floor of Node
`22.14.0` and npm `11.5.1`:

```bash
npm publish <canonical-tarball> --access public --tag <dist_tag> --provenance --dry-run
```

Only then does the trusted publisher issue the real registry PUT with the same
canonical tarball argv minus `--dry-run`. It never repacks the workspace. The
release workflow uses this same Node20 packer and Node24 dry-run publisher route.
Neither workflow performs a custom OIDC token exchange or prints authentication
state; npm Trusted Publishing remains the only authentication path.

The workflow refuses unsafe tag/version combinations:

- prerelease versions cannot publish as `latest`;
- stable versions cannot publish as `staging` or `next`;
- the selected approval scope cannot authorize a different channel.

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
4. Run `.github/workflows/publish.yml` first with
   `dist_tag=staging` and `approval_scope=staging-only`.
5. Confirm the workflow registry post-check and the staged-package verifier
   passed against that exact immutable version.
6. Create and push the matching git tag only through the separately approved
   tag/release sequence; the publish workflow never moves a tag itself.
7. Run External registry smoke from a fresh exact-version install.
8. Obtain a separate explicit approval and a new protected workflow dispatch
   before moving the verified prerelease to `next`.
9. Do not select `latest` unless the version is stable and a separate
   Stable/GA decision approved `approval_scope=ga-approved`.
10. Record post-publish docs.

## Boundaries

Trusted publishing changes only the authentication path.

An authorization-shaped registry response is not evidence that a package is
missing. In particular, beta.16 remains present in the public registry; a
beta.17 Node20/npm10 registry PUT failure does not change that fact. The Node24
publisher handoff still requires one new hosted registry PUT and independent
registry raw-byte, integrity, and package-content-identity readback.

It does not prove:

- token savings;
- product quality;
- full TDD/test sufficiency;
- LSP effectiveness/default behavior;
- broad reliability;
- closure success guarantee.
