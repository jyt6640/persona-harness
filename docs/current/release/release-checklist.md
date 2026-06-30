# Release Checklist

Use this checklist before every npm release.

## 1. Scope

- Confirm the release version and dist-tag.
- Confirm whether the release is `alpha`, `beta`, or `latest`.
- Confirm the supported product surface.
- Confirm unsupported surfaces are still documented.
- Confirm no generated evidence, experiments, or local fixtures are included in package contents.

## 2. Metadata

- `package.json` version is correct.
- `package-lock.json` root package version is aligned.
- release tag matches `v${package.json.version}`.
- `package.json` license is correct.
- Root `LICENSE` file exists.
- `README.md` describes the install flow for the target dist-tag.
- Language README links work.
- `CHANGELOG.md` has an entry for the release.
- Release notes are drafted from `docs/current/release/release-notes-template.md`.

## 3. Docs Stale Guard

Run this guard before release prep and again before publish if any smoke, runtime, CLI, or develop-doc update lands after the release-prep commit.

Check:

- `package.json`, `package-lock.json`, `CHANGELOG.md`, the current release note, and the develop README/current-status record all name the same intended release version.
- The current release note and CHANGELOG name the package/source type for every cited smoke result: registry package, local tarball, current tarball, or workspace install.
- Current-tarball or workspace smoke is never described as published registry behavior. Registry behavior may be claimed only after `npm view persona-harness@<version> version gitHead dist.shasum --json` and `npm dist-tag ls persona-harness` confirm the published package and dist-tag state.
- `CHANGELOG.md` and the release note both distinguish surface-verified smoke from full generated-app behavior verification.
- The release note explicitly says generated app product quality is not certified unless there is a separate, explicit product-quality certification decision.
- Registry state is recorded when relevant:
  - npm dist-tag/version checked;
  - registry `gitHead` checked;
  - current `HEAD` checked;
  - any registry `gitHead` / current `HEAD` mismatch recorded with whether smoke used the registry package, local tarball, or workspace install.
- Develop docs are checked for stale or missing smoke summaries when release notes cite those smoke results.
- If `/Users/yongtae/Documents/하네스/Persona-Harness/develop` is not a git worktree, the release report records that develop-doc changes have no commit.
- If develop docs are a git worktree, the release report records the commit hash or the explicit no-commit reason.

Do not proceed from this guard to publish, push, or tag. It is a documentation freshness gate only.

## 4. Package Contents

Run:

```bash
npm pack --dry-run --json
```

Check:

- `dist` is included.
- `README.md` and language README files are included.
- `LICENSE` is included.
- `.persona/harness.jsonc` is included.
- `.persona/rules` is included.
- Java MVP shared-skill reference subset is included.
- inactive shared-skills are excluded.
- Java no-excuse fixtures are excluded.
- `experiments/`, `.persona/evidence/`, `.persona-test-fixtures/`, and `.omo/` are excluded.

## 5. Verification

Run:

```bash
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:scope:strict
npm run check:injection-value
npm publish --dry-run --tag <dist-tag>
```

## 6. Publish / Tag Order

Use this order for prerelease refreshes:

1. Publish explicitly, either locally with `npm publish --tag <dist-tag>` or through the GitHub Actions `workflow_dispatch` publish job.
2. Verify the registry package with `npm view persona-harness@<version> version gitHead dist.shasum --json`.
3. Verify dist-tags with `npm dist-tag ls persona-harness`.
4. Push `main` and the matching `v${package.json.version}` tag only after registry verification succeeds.

Tag pushes are verification/GitHub-release events only. They must not be used as the npm publish trigger, because the package may already be immutable in the registry or require interactive npm auth.

Expected:

- Tests pass.
- Typecheck passes.
- Build passes.
- Rule diagnostics are `PASS`.
- Scope diagnostics are `PASS`.
- Injection value state is acceptable for the release.
- Publish dry-run reports the expected package version, files, and dist-tag.

GitHub Actions also runs the verification subset on release tags:

```bash
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:scope:strict
npm run check:injection-value
npm pack --dry-run
npm publish --dry-run --access public --tag <resolved-dist-tag>
```

## 6. Install Smoke

Use a temporary project outside the repository:

```bash
tmp_project=$(mktemp -d)
cd "$tmp_project"
npm init -y
npm install -D persona-harness@<dist-tag>
npx ph --help
npx ph init
```

Check:

- `.opencode/opencode.json` exists.
- `.persona/harness.jsonc` exists.
- `.persona/rules` exists.
- `npx ph --help` shows the CLI commands.

For a local pre-publish smoke, install the generated tarball instead of the registry package.

## 7. Publish

Only run real publish after explicit approval.

```bash
npm publish --tag <dist-tag>
```

For the current alpha line:

```bash
npm publish --tag alpha
```

During the alpha/beta pilot, keep `latest` synchronized to the current prerelease package to avoid stale default installs. This does not imply stable support guarantees.

### GitHub Actions path

The `.github/workflows/release.yml` workflow publishes from tags that match `v*.*.*`.

- `vX.Y.Z-alpha.N` publishes with dist-tag `alpha`, then synchronizes `latest` to the same version.
- `vX.Y.Z-beta.N` publishes with dist-tag `beta`, then synchronizes `latest` to the same version.
- `vX.Y.Z` publishes with dist-tag `latest`.

Required repository setup:

- preferred future setup: configure npm trusted publishing for this GitHub repository and remove long-lived token dependency;
- current fallback setup: add an `NPM_TOKEN` repository secret with granular publish permission and 2FA-compatible automation behavior;
- keep `id-token: write` enabled for npm provenance/trusted-publishing readiness;
- push the version commit before pushing the tag.

Manual dispatch can publish the current ref with an explicit `alpha`, `beta`, or `latest` dist-tag, but should stay reserved for recovery or controlled tester releases.

## 8. Post-publish

- Run `npm view persona-harness dist-tags --json`.
- Run `npm view persona-harness@<version> version`.
- Install in a fresh temporary project using the public dist-tag.
- Confirm `npx ph init` works from the published package.
- Update `CHANGELOG.md` date if it was left as `Unreleased`.
- Create GitHub release notes from the release notes template if this release gets a GitHub release.
- For tag releases, GitHub Actions creates GitHub release notes with `gh release create --generate-notes`.
